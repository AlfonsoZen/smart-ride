# RutaSegura CDMX — Plan de Hackathon

**Problemática:** Con las lluvias recientes y los índices de delincuencia en la CDMX, elegir la ruta de regreso a casa es cada vez más difícil. Este agente analiza múltiples rutas y construye la mejor opción personalizada según las prioridades del usuario.

**Stack:** Strands Agents SDK + Amazon Bedrock (Claude) + Lambda + API Gateway + DynamoDB · mismo patrón del workshop.

---

## Visión general del producto

El usuario ingresa origen y destino, ajusta cuánto le importa cada variable con un slider (0–10), y el agente devuelve la ruta óptima ponderada trazada sobre un mapa.

```
┌─────────────────────────────────────────┐
│  📍 Origen       [Campo autocompletado] │
│  🏁 Destino      [Campo autocompletado] │
│                                         │
│  ⚡ Rapidez      ━━━━●━━━━━  7          │
│  🔒 Seguridad    ━━━━━━━●━━  8          │
│  🌧 Clima        ━━●━━━━━━━  3          │
│  💰 Costo        ━━━━●━━━━━  5          │
│  ♿ Accesibilidad ━●━━━━━━━━  2          │
│                                         │
│          [ Buscar ruta ]                │
├─────────────────────────────────────────┤
│                                         │
│   🗺  Mapa con ruta resaltada            │
│      + tarjeta resumen del agente       │
│                                         │
└─────────────────────────────────────────┘
```

---

## Arquitectura

```
Browser
  │  POST /chat  { origin, destination, weights, sessionId }
  ▼
API Gateway → Lambda (agente Strands)
                │
                ├── tool: get_routes          → Google Maps Directions API
                ├── tool: get_weather         → OpenWeatherMap API
                ├── tool: get_safety_index    → CDMX Open Data (siniestros)
                ├── tool: get_transport_cost  → Datos CDMX (metro/metrobús/taxi)
                └── tool: get_accessibility   → CDMX datos infraestructura
                │
                └── DynamoDB (historial de sesión)
```

---

---

# PAREJA 1 — Frontend

**Entregables:** Interfaz web servida desde Lambda (igual que el nube-agent del workshop), con input tipo Uber, sliders de peso y mapa con la ruta.

## Paso 1 — Arrancar desde el frontend existente

1. Copiar el directorio `agent/` del workshop como base del nuevo proyecto:
   ```bash
   cp -r /home/ec2-user/workshop/agent /home/ec2-user/workshop/rutasegura-front
   cd /home/ec2-user/workshop/rutasegura-front
   ```
2. En `index.html` borrar todo el contenido del chat y dejar solo el `<body>` vacío — van a construir encima.
3. Verificar que `npm install` sigue funcionando en ese directorio.

## Paso 2 — Panel de entrada (tipo Uber)

Crear los campos de origen y destino con autocompletado de la API de Google Maps Places. En `index.html`:

```html
<!-- Inputs de ubicación -->
<div class="location-panel">
  <div class="location-input">
    <span class="dot origin"></span>
    <input id="origin-input" type="text" placeholder="¿Desde dónde sales?" autocomplete="off" />
  </div>
  <div class="location-input">
    <span class="dot destination"></span>
    <input id="destination-input" type="text" placeholder="¿A dónde vas?" autocomplete="off" />
  </div>
</div>
```

En `app.js`, inicializar autocompletado restringido a CDMX:
```js
const options = {
  componentRestrictions: { country: "mx" },
  bounds: new google.maps.LatLngBounds(
    new google.maps.LatLng(19.04, -99.37),  // SW CDMX
    new google.maps.LatLng(19.60, -98.94)   // NE CDMX
  ),
  strictBounds: true,
};
const originAC = new google.maps.places.Autocomplete(
  document.getElementById("origin-input"), options
);
const destAC = new google.maps.places.Autocomplete(
  document.getElementById("destination-input"), options
);
```

## Paso 3 — Sliders de peso (las 5 variables)

Agregar debajo de los inputs en `index.html`:

```html
<div class="weights-panel">
  <h3>¿Qué importa más en tu viaje?</h3>

  <label>⚡ Rapidez <span id="val-speed">5</span></label>
  <input type="range" id="w-speed" min="0" max="10" value="5"
         oninput="document.getElementById('val-speed').textContent = this.value" />

  <label>🔒 Seguridad <span id="val-safety">5</span></label>
  <input type="range" id="w-safety" min="0" max="10" value="5"
         oninput="document.getElementById('val-safety').textContent = this.value" />

  <label>🌧 Clima <span id="val-weather">5</span></label>
  <input type="range" id="w-weather" min="0" max="10" value="5"
         oninput="document.getElementById('val-weather').textContent = this.value" />

  <label>💰 Costo <span id="val-cost">5</span></label>
  <input type="range" id="w-cost" min="0" max="10" value="5"
         oninput="document.getElementById('val-cost').textContent = this.value" />

  <label>♿ Accesibilidad <span id="val-access">5</span></label>
  <input type="range" id="w-access" min="0" max="10" value="5"
         oninput="document.getElementById('val-access').textContent = this.value" />
</div>

<button id="search-btn">Buscar ruta</button>
```

## Paso 4 — Mapa con Google Maps JS SDK

Debajo del botón, agregar el contenedor del mapa:

```html
<div id="map"></div>
<div id="route-summary" class="hidden"></div>
```

En `app.js`, inicializar el mapa centrado en CDMX y guardar referencia al `DirectionsRenderer`:

```js
let map, directionsRenderer;

function initMap() {
  map = new google.maps.Map(document.getElementById("map"), {
    center: { lat: 19.4326, lng: -99.1332 },
    zoom: 12,
    disableDefaultUI: true,
    styles: darkMapStyle,   // opcional: definir un estilo oscuro/urbano
  });
  directionsRenderer = new google.maps.DirectionsRenderer({
    map,
    polylineOptions: { strokeColor: "#6C63FF", strokeWeight: 5 },
    suppressMarkers: false,
  });
}
```

Cargar el script de Google Maps al final de `<body>` (la API key la provee el equipo de backend):
```html
<script src="https://maps.googleapis.com/maps/api/js?key=API_KEY&libraries=places&callback=initMap" async defer></script>
```

## Paso 5 — Llamada al backend y renderizado

En `app.js`, conectar el botón con el agente:

```js
document.getElementById("search-btn").addEventListener("click", async () => {
  const originPlace = originAC.getPlace();
  const destPlace   = destAC.getPlace();
  if (!originPlace?.geometry || !destPlace?.geometry) {
    alert("Selecciona origen y destino del menú desplegable.");
    return;
  }

  const payload = {
    origin: {
      address: originPlace.formatted_address,
      lat: originPlace.geometry.location.lat(),
      lng: originPlace.geometry.location.lng(),
    },
    destination: {
      address: destPlace.formatted_address,
      lat: destPlace.geometry.location.lat(),
      lng: destPlace.geometry.location.lng(),
    },
    weights: {
      speed:       Number(document.getElementById("w-speed").value),
      safety:      Number(document.getElementById("w-safety").value),
      weather:     Number(document.getElementById("w-weather").value),
      cost:        Number(document.getElementById("w-cost").value),
      accessibility: Number(document.getElementById("w-access").value),
    },
    sessionId: getOrCreateSessionId(),  // igual que el nube-agent
  };

  setLoading(true);
  try {
    const response = await fetch("/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    const reader = response.body.getReader();
    let agentText = "";

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      const chunk = new TextDecoder().decode(value);
      // parsear SSE igual que el nube-agent
      for (const line of chunk.split("\n")) {
        if (line.startsWith("data: ")) {
          const evt = JSON.parse(line.slice(6));
          if (evt.type === "token") agentText += evt.text;
          if (evt.type === "route") drawRoute(evt.route);   // ver Paso 6
        }
      }
    }
    showSummary(agentText);
  } finally {
    setLoading(false);
  }
});
```

## Paso 6 — Dibujar la ruta en el mapa

Cuando el backend devuelva un evento `{ type: "route", route: { waypoints: [...] } }`, trazar la ruta:

```js
function drawRoute(routeData) {
  // Si el backend devuelve waypoints codificados de Google Directions, usar DirectionsService
  const directionsService = new google.maps.DirectionsService();
  directionsService.route(
    {
      origin: routeData.origin,
      destination: routeData.destination,
      waypoints: (routeData.waypoints || []).map(wp => ({ location: wp, stopover: false })),
      travelMode: google.maps.TravelMode.DRIVING,
    },
    (result, status) => {
      if (status === "OK") directionsRenderer.setDirections(result);
    }
  );
}
```

> **Alternativa más simple para el demo:** si el backend devuelve una `polyline` codificada de Google, decodificarla con `google.maps.geometry.encoding.decodePath` y dibujar un `Polyline` directamente — sin necesidad de llamar a `DirectionsService` de nuevo.

## Paso 7 — Estilos CSS (look Uber/oscuro)

Crear `style.css` con las siguientes variables clave (adaptar al gusto del equipo):

```css
:root {
  --bg: #0f0f0f;
  --panel: #1a1a1a;
  --accent: #6C63FF;
  --text: #f0f0f0;
  --subtext: #888;
  --dot-origin: #6C63FF;
  --dot-dest: #ff6b6b;
}

body { background: var(--bg); color: var(--text); font-family: 'Inter', sans-serif; margin: 0; display: flex; height: 100vh; }
.sidebar { width: 380px; padding: 24px; background: var(--panel); overflow-y: auto; z-index: 10; }
#map { flex: 1; }

.location-input { display: flex; align-items: center; gap: 12px; margin-bottom: 12px; }
.location-input input { flex: 1; background: #262626; border: 1px solid #333; border-radius: 8px; padding: 12px; color: var(--text); font-size: 14px; }
.dot { width: 12px; height: 12px; border-radius: 50%; flex-shrink: 0; }
.dot.origin { background: var(--dot-origin); }
.dot.destination { background: var(--dot-dest); }

.weights-panel { margin: 20px 0; }
.weights-panel label { display: flex; justify-content: space-between; font-size: 13px; margin-bottom: 4px; color: var(--subtext); }
input[type=range] { width: 100%; accent-color: var(--accent); margin-bottom: 14px; }

#search-btn { width: 100%; padding: 14px; background: var(--accent); color: white; border: none; border-radius: 10px; font-size: 15px; font-weight: 600; cursor: pointer; }
#search-btn:hover { background: #5a52d5; }

#route-summary { margin-top: 16px; background: #262626; border-radius: 10px; padding: 16px; font-size: 13px; line-height: 1.6; white-space: pre-wrap; }
.hidden { display: none; }
```

## Checklist Frontend

- [ ] Inputs de origen/destino con autocompletado restringido a CDMX
- [ ] 5 sliders con label y valor numérico en tiempo real
- [ ] Botón "Buscar ruta" activo solo cuando hay origen y destino
- [ ] Estado de carga (spinner / texto "Consultando agente...")
- [ ] Mapa inicializado centrado en CDMX
- [ ] Ruta dibujada sobre el mapa al recibir respuesta del backend
- [ ] Tarjeta de resumen con el texto del agente
- [ ] Layout tipo sidebar izquierda + mapa derecha (responsive para demo)

---

---

# PAREJA 2 — Backend

**Entregables:** Lambda con el agente Strands que recibe origen, destino y pesos, consulta 4–5 herramientas externas, pondera las rutas y devuelve la mejor con su explicación.

## Paso 1 — Crear la estructura del nuevo proyecto

```bash
mkdir -p /home/ec2-user/workshop/rutasegura
cd /home/ec2-user/workshop/rutasegura
mkdir src
```

Copiar `samconfig.toml` del workshop y editar `stack_name` a `rutasegura`.

## Paso 2 — template.yaml (SAM)

Crear `/home/ec2-user/workshop/rutasegura/template.yaml`:

```yaml
AWSTemplateFormatVersion: "2010-09-09"
Transform: AWS::Serverless-2016-10-31

Globals:
  Function:
    Runtime: nodejs22.x
    Timeout: 60
    MemorySize: 512
    PermissionsBoundary: arn:aws:iam::281614735122:policy/hackathon-boundary
    Environment:
      Variables:
        SESSIONS_TABLE: !Ref SessionsTable
        GOOGLE_MAPS_API_KEY: !Ref GoogleMapsApiKey
        OPENWEATHER_API_KEY: !Ref OpenWeatherApiKey

Parameters:
  GoogleMapsApiKey:
    Type: String
    NoEcho: true
  OpenWeatherApiKey:
    Type: String
    NoEcho: true

Resources:
  SessionsTable:
    Type: AWS::DynamoDB::Table
    Properties:
      BillingMode: PAY_PER_REQUEST
      AttributeDefinitions:
        - AttributeName: sessionId
          AttributeType: S
      KeySchema:
        - AttributeName: sessionId
          KeyType: HASH
      TimeToLiveSpecification:
        AttributeName: expiresAt
        Enabled: true

  AgentFunction:
    Type: AWS::Serverless::Function
    Properties:
      Handler: src/handler.handler
      Policies:
        - DynamoDBCrudPolicy:
            TableName: !Ref SessionsTable
      Events:
        Chat:
          Type: Api
          Properties:
            Path: /chat
            Method: post
        StaticFiles:
          Type: Api
          Properties:
            Path: /{proxy+}
            Method: get

Outputs:
  ApiUrl:
    Value: !Sub "https://${ServerlessRestApi}.execute-api.${AWS::Region}.amazonaws.com/Prod"
```

## Paso 3 — Herramientas del agente (`src/tools.mjs`)

Crear las 5 herramientas. Cada una llama a una API externa y devuelve datos estructurados para que el agente los pondere.

```js
import { tool } from "@strands-agents/sdk";
import { z } from "zod";

// ── 1. Rutas base (Google Maps Directions) ───────────────────────────────────
export const getRoutes = tool({
  name: "get_routes",
  description:
    "Obtiene hasta 3 rutas alternativas entre origen y destino en la CDMX usando Google Maps. " +
    "Devuelve duración, distancia y polyline de cada opción.",
  inputSchema: z.object({
    origin_lat:  z.number(),
    origin_lng:  z.number(),
    dest_lat:    z.number(),
    dest_lng:    z.number(),
  }),
  callback: async ({ origin_lat, origin_lng, dest_lat, dest_lng }) => {
    const key = process.env.GOOGLE_MAPS_API_KEY;
    const url = `https://maps.googleapis.com/maps/api/directions/json` +
      `?origin=${origin_lat},${origin_lng}` +
      `&destination=${dest_lat},${dest_lng}` +
      `&alternatives=true&language=es&region=mx&key=${key}`;
    const res = await fetch(url);
    const data = await res.json();
    if (data.status !== "OK") return `Error de Directions API: ${data.status}`;
    return JSON.stringify(data.routes.map((r, i) => ({
      index: i,
      summary: r.summary,
      duration_min: Math.round(r.legs[0].duration.value / 60),
      distance_km: (r.legs[0].distance.value / 1000).toFixed(1),
      polyline: r.overview_polyline.points,
      steps_count: r.legs[0].steps.length,
    })));
  },
});

// ── 2. Clima y riesgo de inundación (OpenWeatherMap) ─────────────────────────
export const getWeather = tool({
  name: "get_weather",
  description:
    "Obtiene condiciones climáticas actuales en el área del destino. " +
    "Indica si hay lluvia intensa, riesgo de inundación, o visibilidad reducida.",
  inputSchema: z.object({
    lat: z.number(),
    lng: z.number(),
  }),
  callback: async ({ lat, lng }) => {
    const key = process.env.OPENWEATHER_API_KEY;
    const url = `https://api.openweathermap.org/data/2.5/weather?lat=${lat}&lon=${lng}&appid=${key}&lang=es&units=metric`;
    const res = await fetch(url);
    const d = await res.json();
    const rain_mm = d.rain?.["1h"] ?? 0;
    return JSON.stringify({
      condition: d.weather?.[0]?.description ?? "desconocido",
      temp_c: d.main?.temp,
      humidity_pct: d.main?.humidity,
      rain_1h_mm: rain_mm,
      flood_risk: rain_mm > 10 ? "alto" : rain_mm > 3 ? "medio" : "bajo",
      visibility_m: d.visibility,
    });
  },
});

// ── 3. Índice de siniestros por zona (datos abiertos CDMX) ───────────────────
export const getSafetyIndex = tool({
  name: "get_safety_index",
  description:
    "Consulta el índice de incidentes delictivos y siniestros viales en las colonias " +
    "que atraviesa una ruta. Retorna un score de 0 (peligroso) a 10 (seguro).",
  inputSchema: z.object({
    route_summary: z.string().describe("Descripción textual de la ruta, e.g. 'Av. Insurgentes, Viaducto'"),
    dest_lat: z.number(),
    dest_lng: z.number(),
  }),
  callback: async ({ route_summary, dest_lat, dest_lng }) => {
    // Fuente: API de Carpetas de Investigación FGJ CDMX (datos.cdmx.gob.mx)
    // En el hackathon puede usarse un mock con datos representativos si la API no está disponible
    // Endpoint real: https://datos.cdmx.gob.mx/api/3/action/datastore_search
    // Para el demo, devolver datos simulados basados en colonias conocidas:
    const highRiskKeywords = ["tepito", "doctores", "guerrero", "transvaal", "morelos"];
    const isHighRisk = highRiskKeywords.some(k => route_summary.toLowerCase().includes(k));
    return JSON.stringify({
      safety_score: isHighRisk ? 3 : 7,
      incident_density: isHighRisk ? "alta" : "media-baja",
      recommendation: isHighRisk
        ? "Zona con alto índice de incidentes. Preferir rutas principales e iluminadas."
        : "Zona con incidencia media-baja. Ruta relativamente segura.",
    });
    // TODO: reemplazar con llamada real a la API de datos abiertos CDMX
  },
});

// ── 4. Costo multimodal (metro + metrobús + taxi) ────────────────────────────
export const getTransportCost = tool({
  name: "get_transport_cost",
  description:
    "Estima el costo del viaje para diferentes combinaciones de transporte: " +
    "solo metro/metrobús, combinado, o taxi/Uber. Útil para usuarios con presupuesto limitado.",
  inputSchema: z.object({
    origin_lat:  z.number(),
    origin_lng:  z.number(),
    dest_lat:    z.number(),
    dest_lng:    z.number(),
    distance_km: z.number(),
  }),
  callback: async ({ distance_km }) => {
    // Tarifas CDMX 2024 (actualizar si cambian)
    const metro_fare = 5;          // tarifa plana
    const metrobus_fare = 7;       // tarifa plana
    const taxi_base = 15;
    const taxi_per_km = 14;
    const uber_base = 25;
    const uber_per_km = 9;

    const taxi_total = taxi_base + distance_km * taxi_per_km;
    const uber_total = uber_base + distance_km * uber_per_km;

    return JSON.stringify({
      options: [
        {
          mode: "Metro + Metrobús",
          cost_mxn: metro_fare + metrobus_fare,
          notes: "Requiere 1 transbordo típico. Tiempo variable por espera.",
        },
        {
          mode: "Solo Metro",
          cost_mxn: metro_fare,
          notes: "Solo si el destino tiene estación cercana (< 10 min caminando).",
        },
        {
          mode: "Taxi de sitio",
          cost_mxn: Math.round(taxi_total),
          notes: "Tarifa estimada. Pedir en sitio autorizado.",
        },
        {
          mode: "Uber / DiDi",
          cost_mxn: Math.round(uber_total),
          notes: "Estimado. Sujeto a surge pricing.",
        },
      ],
    });
  },
});

// ── 5. Accesibilidad (infraestructura CDMX) ──────────────────────────────────
export const getAccessibility = tool({
  name: "get_accessibility",
  description:
    "Evalúa qué tan accesible es la ruta para personas con movilidad reducida, " +
    "usuarios de silla de ruedas o personas mayores. Indica estaciones de metro con elevador, " +
    "cruces con rampas y estado de banquetas.",
  inputSchema: z.object({
    route_summary: z.string(),
    origin_lat:  z.number(),
    origin_lng:  z.number(),
    dest_lat:    z.number(),
    dest_lng:    z.number(),
  }),
  callback: async ({ route_summary }) => {
    // Fuente: datos.cdmx.gob.mx — infraestructura accesible
    // Para el demo, evaluar keywords de la ruta
    const accessibleZones = ["reforma", "polanco", "santa fe", "perisur", "coyoacán", "tlalpan"];
    const isAccessible = accessibleZones.some(z => route_summary.toLowerCase().includes(z));
    return JSON.stringify({
      accessibility_score: isAccessible ? 8 : 4,
      elevator_stations_nearby: isAccessible ? ["Auditorio", "Polanco"] : [],
      ramp_coverage: isAccessible ? "alta" : "media",
      sidewalk_condition: isAccessible ? "buena" : "irregular",
      recommendation: isAccessible
        ? "Ruta con buena infraestructura accesible."
        : "Verificar condición de banquetas. Algunas intersecciones pueden ser difíciles.",
    });
  },
});
```

## Paso 4 — El agente (`src/agent.mjs`)

```js
import { Agent, BedrockModel, tool } from "@strands-agents/sdk";
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, GetCommand, PutCommand } from "@aws-sdk/lib-dynamodb";
import { z } from "zod";
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
  const sorted = Object.entries(weights)
    .sort(([,a],[,b]) => b - a)
    .map(([k, v]) => `${k}=${v}`)
    .join(", ");

  return `Eres RutaSegura, un agente experto en movilidad urbana de la Ciudad de México.
Tu tarea es analizar las rutas disponibles entre el origen y destino dados, y recomendar
la MEJOR ruta según las preferencias del usuario.

Prioridades del usuario (escala 0-10): ${sorted}

Proceso obligatorio:
1. Obtén las rutas base con get_routes.
2. Consulta el clima con get_weather para el área del destino.
3. Evalúa seguridad con get_safety_index para la ruta recomendada.
4. Calcula el costo con get_transport_cost.
5. Evalúa accesibilidad con get_accessibility si el peso de accesibilidad > 5.
6. Pondera los resultados usando los pesos del usuario y elige la ruta óptima.
7. Responde en español con:
   - Ruta recomendada (nombre/descripción)
   - Tiempo estimado y distancia
   - Razones principales de la elección (según los pesos del usuario)
   - Advertencias relevantes (lluvia, zona de riesgo, etc.)
   - Costo estimado del viaje
   - Emite un evento JSON con la polyline de la ruta elegida (ver formato abajo)

Al final de tu respuesta, incluye exactamente esta línea (sin markdown):
ROUTE_DATA:{"polyline":"<encoded_polyline>","origin":"<dir>","destination":"<dir>"}`;
}

export async function* answerWith(payload, sessionId) {
  const { origin, destination, weights } = payload;
  const history = await loadHistory(sessionId);

  const message = `Por favor encuentra la mejor ruta desde "${origin.address}" hasta "${destination.address}".
Coordenadas origen: ${origin.lat}, ${origin.lng}
Coordenadas destino: ${destination.lat}, ${destination.lng}`;

  const agent = new Agent({
    model,
    systemPrompt: buildSystemPrompt(weights),
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

  // Extraer y emitir los datos de la ruta para el mapa
  const routeMatch = fullText.match(/ROUTE_DATA:(\{.*\})/);
  if (routeMatch) {
    try {
      const routeData = JSON.parse(routeMatch[1]);
      yield { type: "route", route: routeData };
    } catch (_) {}
  }

  await saveHistory(sessionId, agent.messages);
}
```

## Paso 5 — Handler HTTP (`src/handler.mjs`)

Igual al patrón del workshop, con SSE streaming:

```js
import { answerWith } from "./agent.mjs";

export const handler = async (event) => {
  const path = event.path || event.rawPath || "/";

  // Servir frontend estático
  if (event.httpMethod === "GET" || event.requestContext?.http?.method === "GET") {
    return serveStatic(path);
  }

  // Endpoint del agente
  const body = JSON.parse(event.body || "{}");
  const { origin, destination, weights, sessionId } = body;

  if (!origin || !destination) {
    return { statusCode: 400, body: JSON.stringify({ error: "origin y destination son requeridos" }) };
  }

  const chunks = [];
  for await (const event of answerWith({ origin, destination, weights }, sessionId)) {
    chunks.push(`data: ${JSON.stringify(event)}\n\n`);
  }

  return {
    statusCode: 200,
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
    },
    body: chunks.join(""),
  };
};

function serveStatic(path) {
  // Aquí montar los archivos del frontend (copiarlos al bundle)
  // O redirigir a la URL de CloudFront del frontend
  return {
    statusCode: 200,
    headers: { "Content-Type": "text/html" },
    body: "<html><body>RutaSegura API - OK</body></html>",
  };
}
```

## Paso 6 — Obtener API Keys

1. **Google Maps API Key** (requerida para Directions + Places + Maps JS):
   - Ir a [console.cloud.google.com](https://console.cloud.google.com)
   - Activar: Directions API, Places API, Maps JavaScript API
   - Crear credencial → API Key → restringir a tu dominio

2. **OpenWeatherMap API Key** (gratuita):
   - Registrarse en [openweathermap.org](https://openweathermap.org/api)
   - Current Weather Data API es gratuita (1,000 llamadas/día)

3. **Datos abiertos CDMX** (sin key para el demo):
   - `https://datos.cdmx.gob.mx/api/3/action/datastore_search`
   - No requiere autenticación para consultas básicas

## Paso 7 — Deploy

```bash
cd /home/ec2-user/workshop/rutasegura
npm install @strands-agents/sdk @aws-sdk/client-dynamodb @aws-sdk/lib-dynamodb zod

sam build
sam deploy \
  --stack-name rutasegura \
  --parameter-overrides \
    GoogleMapsApiKey=TU_KEY_AQUI \
    OpenWeatherApiKey=TU_KEY_AQUI \
  --resolve-s3 \
  --capabilities CAPABILITY_IAM \
  --region us-east-1
```

## Paso 8 — Prueba rápida del agente (sin frontend)

```bash
ENDPOINT=$(aws cloudformation describe-stacks \
  --stack-name rutasegura \
  --query "Stacks[0].Outputs[?OutputKey=='ApiUrl'].OutputValue" \
  --output text)

curl -X POST "$ENDPOINT/chat" \
  -H "Content-Type: application/json" \
  -d '{
    "origin":      { "address": "Ángel de la Independencia, CDMX", "lat": 19.4270, "lng": -99.1676 },
    "destination": { "address": "Xochimilco, CDMX", "lat": 19.2627, "lng": -99.1046 },
    "weights":     { "speed": 3, "safety": 8, "weather": 7, "cost": 5, "accessibility": 2 },
    "sessionId":   "test-001"
  }'
```

## Checklist Backend

- [ ] `template.yaml` con `PermissionsBoundary` en Globals
- [ ] DynamoDB para sesiones creada en el template
- [ ] Las 5 herramientas implementadas en `src/tools.mjs`
- [ ] System prompt dinámico que refleja los pesos del usuario
- [ ] Agente llama todas las herramientas relevantes antes de responder
- [ ] El agente emite `ROUTE_DATA:` al final con la polyline
- [ ] Handler parsea y re-emite el evento `{ type: "route", route: {...} }`
- [ ] `sam deploy` exitoso con las dos API keys como parámetros
- [ ] Prueba curl devuelve texto en streaming con la ruta recomendada

---

---

## Punto de integración (ambas parejas)

Cuando backend tenga el endpoint arriba, frontend solo necesita:

1. Reemplazar la URL del `fetch` por la URL del API Gateway del stack `rutasegura`.
2. Confirmar que el evento `{ type: "route", route: { polyline, origin, destination } }` llega correctamente y dibuja la ruta.
3. Ajustar el formato de la polyline si es necesario (codificada vs array de coords).

**Contrato del evento de ruta:**
```json
{
  "type": "route",
  "route": {
    "polyline": "<google_encoded_polyline_string>",
    "origin": "Dirección de origen",
    "destination": "Dirección de destino"
  }
}
```

---

## Criterios de éxito para el demo

| Criterio | Descripción |
|---|---|
| Funcional | El usuario ingresa origen/destino y recibe una ruta en el mapa |
| Diferenciación | Cambiar los sliders produce rutas y justificaciones distintas |
| Relevancia | El agente menciona lluvia, zonas de riesgo o costo cuando el slider correspondiente es alto |
| Presentación | La UI es limpia, tipo Uber, y la ruta se ve claramente en el mapa |
| Pitch | Explicar claramente la problemática CDMX lluvia + inseguridad |

---

*Última actualización: 2026-08-08 — Hackathon Amazon Dev Days*
