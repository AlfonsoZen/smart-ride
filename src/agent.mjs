import { Agent, BedrockModel } from "@strands-agents/sdk";
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, GetCommand, PutCommand } from "@aws-sdk/lib-dynamodb";
import { fetchRoutes, fetchWeather, evalSafety, calcCost, evalAccessibility } from "./tools.mjs";

const ddb = DynamoDBDocumentClient.from(new DynamoDBClient({}));

const model = new BedrockModel({
  modelId: "global.anthropic.claude-haiku-4-5-20251001-v1:0",
});

async function loadHistory(sessionId) {
  const resp = await ddb.send(new GetCommand({
    TableName: process.env.SESSIONS_TABLE,
    Key: { sessionId },
  }));
  return resp.Item ? JSON.parse(resp.Item.messages) : [];
}

async function saveHistory(sessionId, messages) {
  await ddb.send(new PutCommand({
    TableName: process.env.SESSIONS_TABLE,
    Item: {
      sessionId,
      messages: JSON.stringify(messages),
      expiresAt: Math.floor(Date.now() / 1000) + 24 * 60 * 60,
    },
  }));
}

function buildSystemPrompt(weights) {
  const priorities = Object.entries(weights)
    .sort(([, a], [, b]) => b - a)
    .map(([k, v]) => {
      const labels = {
        speed: "Rapidez", safety: "Seguridad", weather: "Clima/Inundaciones",
        cost: "Costo", accessibility: "Accesibilidad",
      };
      return `${labels[k] ?? k} (${v}/10)`;
    })
    .join(" > ");

  return `Eres RutaSegura, experto en movilidad urbana de la CDMX.
Recibirás datos ya recopilados (rutas, clima, seguridad, costos). Tu única tarea es
ANALIZAR esos datos y recomendar la mejor ruta según las prioridades del usuario.

PRIORIDADES: ${priorities}

FORMATO DE RESPUESTA (en español, máximo 200 palabras):
- "✅ Ruta recomendada: [nombre/vialidades]"
- Tiempo estimado y distancia
- 2-3 razones concretas según las prioridades más altas
- Advertencias activas (lluvia, zona de riesgo, etc.) si las hay
- Opciones de transporte con su costo
- Una línea de contexto CDMX si es relevante

AL FINAL, en la última línea, exactamente esto (sin markdown, solo el número del índice):
ROUTE_DATA:{"index":<0|1|2>}`;
}

export async function* answerWith(payload, sessionId) {
  const { origin, destination, weights = {} } = payload;
  const mergedWeights = { speed: 5, safety: 5, weather: 5, cost: 5, accessibility: 5, ...weights };
  const needsAccessibility = (mergedWeights.accessibility ?? 0) >= 5;

  // Pre-fetch en paralelo — todo antes de llamar al LLM
  yield { type: "tool", name: "get_routes" };
  yield { type: "tool", name: "get_weather" };

  const [routes, weather] = await Promise.all([
    fetchRoutes(origin.lat, origin.lng, destination.lat, destination.lng),
    fetchWeather(destination.lat, destination.lng),
  ]);

  // Seguridad y costo para cada ruta (síncronos, sin I/O)
  yield { type: "tool", name: "get_safety_index" };
  yield { type: "tool", name: "get_transport_cost" };

  const routesWithData = routes.map(r => ({
    ...r,
    safety:    evalSafety(r.main_roads.join(" ") + " " + r.summary),
    transport: calcCost(parseFloat(r.distance_km), r.duration_min),
  }));

  let accessibilityData = null;
  if (needsAccessibility) {
    yield { type: "tool", name: "get_accessibility" };
    const bestRoute = routesWithData[0];
    accessibilityData = evalAccessibility(bestRoute.main_roads.join(", "));
  }

  // Construir mensaje con todos los datos para que el LLM solo sintetice
  const dataMessage =
    `Encuentra la mejor ruta desde "${origin.address}" hasta "${destination.address}".\n\n` +
    `RUTAS DISPONIBLES:\n${JSON.stringify(routesWithData, null, 2)}\n\n` +
    `CLIMA EN DESTINO:\n${JSON.stringify(weather, null, 2)}\n\n` +
    (accessibilityData ? `ACCESIBILIDAD:\n${JSON.stringify(accessibilityData, null, 2)}\n\n` : "") +
    `Analiza estos datos y recomienda la mejor ruta según las prioridades del usuario.`;

  const history = await loadHistory(sessionId);

  const agent = new Agent({
    model,
    systemPrompt: buildSystemPrompt(mergedWeights),
    messages: history,
    tools: [],   // sin tools — todos los datos ya están en el mensaje
    printer: false,
  });

  let fullText = "";

  for await (const ev of agent.stream(dataMessage)) {
    if (
      ev.type === "modelStreamUpdateEvent" &&
      ev.event.type === "modelContentBlockDeltaEvent" &&
      ev.event.delta?.type === "textDelta"
    ) {
      const text = ev.event.delta.text;
      fullText += text;
      yield { type: "token", text };
    }
  }

  const routeMatch = fullText.match(/ROUTE_DATA:\{"index":(\d)\}/);
  if (routeMatch) {
    const idx = Math.min(parseInt(routeMatch[1]), routesWithData.length - 1);
    const chosen = routesWithData[idx];
    yield {
      type: "route",
      route: {
        polyline:    chosen.polyline,
        origin:      origin.address,
        destination: destination.address,
      },
    };
  }

  await saveHistory(sessionId, agent.messages);
}
