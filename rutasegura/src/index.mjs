import { answerWith } from "./agent.mjs";
import { FRONTEND_HTML } from "./frontend.mjs";

async function geocode(address) {
  const key = process.env.GOOGLE_MAPS_API_KEY;
  const url =
    `https://maps.googleapis.com/maps/api/geocode/json` +
    `?address=${encodeURIComponent(address)}&region=mx&language=es&key=${key}`;
  const res  = await fetch(url);
  const data = await res.json();
  if (data.status !== "OK" || !data.results.length) {
    throw new Error(`No se encontró "${address}" (Geocoding: ${data.status})`);
  }
  const { lat, lng } = data.results[0].geometry.location;
  const formatted    = data.results[0].formatted_address;
  return { address: formatted, lat, lng };
}

export const handler = awslambda.streamifyResponse(
  async (event, responseStream) => {
    const method = event.httpMethod ?? event.requestContext?.http?.method ?? "GET";

    // GET / — sirve el frontend
    if (method === "GET") {
      responseStream = awslambda.HttpResponseStream.from(responseStream, {
        statusCode: 200,
        headers: { "Content-Type": "text/html; charset=utf-8" },
      });
      responseStream.write(FRONTEND_HTML);
      responseStream.end();
      return;
    }

    // POST /chat — geocodifica y corre el agente con streaming NDJSON
    responseStream = awslambda.HttpResponseStream.from(responseStream, {
      statusCode: 200,
      headers: {
        "Content-Type": "application/x-ndjson",
        "Transfer-Encoding": "chunked",
        "Access-Control-Allow-Origin": "*",
      },
    });

    const send = (obj) => responseStream.write(JSON.stringify(obj) + "\n");

    try {
      const body = JSON.parse(event.body ?? "{}");
      const { origin, destination, weights, sessionId = "no-session" } = body;

      if (!origin || !destination) {
        send({ type: "error", text: "origin y destination son requeridos." });
        responseStream.end();
        return;
      }

      // Geocodificar — aceptamos tanto string como objeto {address, lat, lng}
      const [originGeo, destGeo] = await Promise.all([
        typeof origin === "string"      ? geocode(origin)      : Promise.resolve(origin),
        typeof destination === "string" ? geocode(destination) : Promise.resolve(destination),
      ]);

      for await (const chunk of answerWith({ origin: originGeo, destination: destGeo, weights }, sessionId)) {
        send(chunk);
      }
      send({ type: "done" });
    } catch (err) {
      send({ type: "error", text: `${err.name}: ${err.message}` });
    }

    responseStream.end();
  }
);
