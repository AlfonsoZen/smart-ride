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

  return `Eres SmartDrive, experto en movilidad urbana de la CDMX.
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

Responde SOLO con el texto de análisis. No incluyas ningún JSON ni metadatos al final.`;
}

function pickBestRoute(routes, weights) {
  if (!routes.length) return 0;
  const maxDur = Math.max(...routes.map(r => r.duration_min), 1);
  const maxDist = Math.max(...routes.map(r => parseFloat(r.distance_km)), 1);

  let bestIdx = 0, bestScore = -Infinity;
  for (const r of routes) {
    const speedScore  = 10 - (r.duration_min / maxDur * 10);
    const safetyScore = r.safety?.safety_score ?? 5;
    const costScore   = 10 - (parseFloat(r.distance_km) / maxDist * 10);
    const accScore    = r.accessibility?.accessibility_score ?? 5;
    const w = weights;
    const total =
      speedScore  * (w.speed  ?? 5) +
      safetyScore * (w.safety ?? 5) +
      costScore   * (w.cost   ?? 5) +
      accScore    * (w.accessibility ?? 5);
    if (total > bestScore) { bestScore = total; bestIdx = r.index; }
  }
  return bestIdx;
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
    routesWithData[0] = { ...routesWithData[0], accessibility: accessibilityData };
  }

  // Emitir ruta inmediatamente — antes del LLM, el mapa puede dibujar ya
  const bestIdx = pickBestRoute(routesWithData, mergedWeights);
  const best = routesWithData[bestIdx];
  yield {
    type: "route",
    route: {
      index:       bestIdx,
      polyline:    best.polyline,
      origin:      origin.address,
      destination: destination.address,
    },
  };

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

  for await (const ev of agent.stream(dataMessage)) {
    if (
      ev.type === "modelStreamUpdateEvent" &&
      ev.event.type === "modelContentBlockDeltaEvent" &&
      ev.event.delta?.type === "textDelta"
    ) {
      yield { type: "token", text: ev.event.delta.text };
    }
  }

  // Fire-and-forget: no bloquear el stream esperando DynamoDB
  saveHistory(sessionId, agent.messages).catch(() => {});
}
