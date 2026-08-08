import { Agent, BedrockModel } from "@strands-agents/sdk";
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, GetCommand, PutCommand } from "@aws-sdk/lib-dynamodb";
import { getRoutes, getWeather, getSafetyIndex, getTransportCost, getAccessibility } from "./tools.mjs";

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
  // Ordenar pesos de mayor a menor para que el agente entienda las prioridades
  const priorities = Object.entries(weights)
    .sort(([, a], [, b]) => b - a)
    .map(([k, v]) => {
      const labels = {
        speed:         "Rapidez",
        safety:        "Seguridad",
        weather:       "Clima/Inundaciones",
        cost:          "Costo",
        accessibility: "Accesibilidad",
      };
      return `${labels[k] ?? k} (${v}/10)`;
    })
    .join(" > ");

  const needsAccessibility = (weights.accessibility ?? 0) >= 5;

  return `Eres RutaSegura, un agente experto en movilidad urbana de la Ciudad de México.
Tu misión: analizar rutas entre un origen y destino, y recomendar la MEJOR opción según
las prioridades del usuario.

PRIORIDADES DEL USUARIO (de mayor a menor importancia):
${priorities}

PROCESO OBLIGATORIO — sigue estos pasos en orden:
1. Llama a get_routes para obtener las rutas alternativas.
2. Llama a get_weather con las coordenadas del destino.
3. Para la ruta más prometedora, llama a get_safety_index.
4. Llama a get_transport_cost con la distancia y duración de esa ruta.
${needsAccessibility ? "5. Llama a get_accessibility porque la accesibilidad es prioritaria para este usuario.\n" : ""}
Luego, pondera los resultados usando los pesos del usuario y elige la ruta óptima.

FORMATO DE RESPUESTA (responde siempre en español):
- Una línea con: "✅ Ruta recomendada: [nombre/vialidades principales]"
- Tiempo estimado y distancia
- 2-3 razones concretas de la elección (en función de los pesos más altos)
- Advertencias activas si las hay (lluvia, zona de riesgo, etc.)
- Opciones de transporte con su costo
- Una línea de contexto CDMX si es relevante (p.ej. horario metro, evitar horas pico)

AL FINAL de tu respuesta, en la última línea, incluye exactamente esto (sin markdown ni espacios extra):
ROUTE_DATA:{"index":<número_de_ruta_0_1_2>,"polyline":"<polyline_codificada>","origin":"<dirección_origen>","destination":"<dirección_destino>"}

Sé conciso. El usuario está en movimiento. Máximo 200 palabras en tu respuesta.`;
}

export async function* answerWith(payload, sessionId) {
  const { origin, destination, weights = {} } = payload;

  const defaultWeights = { speed: 5, safety: 5, weather: 5, cost: 5, accessibility: 5 };
  const mergedWeights = { ...defaultWeights, ...weights };

  const history = await loadHistory(sessionId);

  const message =
    `Encuentra la mejor ruta desde "${origin.address}" hasta "${destination.address}".\n` +
    `Coordenadas origen: ${origin.lat}, ${origin.lng}\n` +
    `Coordenadas destino: ${destination.lat}, ${destination.lng}`;

  const agent = new Agent({
    model,
    systemPrompt: buildSystemPrompt(mergedWeights),
    messages: history,
    tools: [getRoutes, getWeather, getSafetyIndex, getTransportCost, getAccessibility],
    printer: false,
  });

  let fullText = "";

  for await (const ev of agent.stream(message)) {
    if (
      ev.type === "modelStreamUpdateEvent" &&
      ev.event.type === "modelContentBlockDeltaEvent" &&
      ev.event.delta?.type === "textDelta"
    ) {
      const text = ev.event.delta.text;
      fullText += text;
      yield { type: "token", text };
    } else if (ev.type === "beforeToolCallEvent") {
      yield { type: "tool", name: ev.toolUse?.name ?? "tool" };
    }
  }

  // Extraer y emitir los datos de la ruta para que el frontend dibuje en el mapa
  const routeMatch = fullText.match(/ROUTE_DATA:(\{.*\})/);
  if (routeMatch) {
    try {
      const routeData = JSON.parse(routeMatch[1]);
      yield { type: "route", route: routeData };
    } catch (_) {
      // polyline malformada — el frontend simplemente no dibuja
    }
  }

  await saveHistory(sessionId, agent.messages);
}
