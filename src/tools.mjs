import { tool } from "@strands-agents/sdk";
import { z } from "zod";

// Funciones directas para pre-fetch paralelo desde el handler
export async function fetchRoutes(origin_lat, origin_lng, dest_lat, dest_lng) {
  const key = process.env.GOOGLE_MAPS_API_KEY;
  const res = await fetch("https://routes.googleapis.com/directions/v2:computeRoutes", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Goog-Api-Key": key,
      "X-Goog-FieldMask": [
        "routes.duration", "routes.distanceMeters",
        "routes.polyline", "routes.travelAdvisory",
        "routes.legs.steps.navigationInstruction",
      ].join(","),
    },
    body: JSON.stringify({
      origin:      { location: { latLng: { latitude: origin_lat, longitude: origin_lng } } },
      destination: { location: { latLng: { latitude: dest_lat,   longitude: dest_lng   } } },
      travelMode: "DRIVE",
      computeAlternativeRoutes: true,
      routingPreference: "TRAFFIC_AWARE",
      languageCode: "es", regionCode: "MX",
    }),
  });
  const data = await res.json();
  if (!data.routes?.length) throw new Error(`Routes API: ${JSON.stringify(data.error ?? data)}`);
  return data.routes.map((r, i) => ({
    index: i,
    summary: `Ruta ${i + 1}`,
    duration_min: Math.round(parseInt(r.duration ?? "0") / 60),
    distance_km: (r.distanceMeters / 1000).toFixed(1),
    polyline: r.polyline?.encodedPolyline ?? "",
    main_roads: (r.legs?.[0]?.steps ?? [])
      .map(s => s.navigationInstruction?.instructions ?? "")
      .filter(s => s.length > 3).slice(0, 5),
  }));
}

export async function fetchWeather(lat, lng) {
  const key = process.env.OPENWEATHER_API_KEY;
  const res = await fetch(
    `https://api.openweathermap.org/data/2.5/weather?lat=${lat}&lon=${lng}&appid=${key}&lang=es&units=metric`
  );
  const d = await res.json();
  const rain_mm = d.rain?.["1h"] ?? 0;
  const flood_risk = rain_mm > 15 ? "muy_alto" : rain_mm > 10 ? "alto" : rain_mm > 3 ? "medio" : "bajo";
  return {
    condition: d.weather?.[0]?.description ?? "despejado",
    temp_c: d.main?.temp,
    rain_1h_mm: rain_mm,
    flood_risk,
    alert: flood_risk === "muy_alto" ? "⚠️ Lluvia intensa. Riesgo de encharcamientos." :
           flood_risk === "alto"     ? "🌧 Lluvia moderada. Posibles encharcamientos." :
           flood_risk === "medio"    ? "🌦 Lluvia ligera." : null,
  };
}

export function evalSafety(route_summary) {
  const text = route_summary.toLowerCase();
  const coloniaMatch = Object.entries(COLONIA_OVERRIDES).filter(([k]) => text.includes(k));
  const alcaldiaMatch = Object.entries(ALCALDIA_SCORES).filter(([k]) => text.includes(k));
  let score, zones = [];
  if (coloniaMatch.length) {
    score = Math.round(coloniaMatch.reduce((s, [, v]) => s + v, 0) / coloniaMatch.length);
    zones = coloniaMatch.map(([k]) => k);
  } else if (alcaldiaMatch.length) {
    score = Math.round(alcaldiaMatch.reduce((s, [, v]) => s + v, 0) / alcaldiaMatch.length);
    zones = alcaldiaMatch.map(([k]) => k);
  } else {
    score = 5;
  }
  const hourCDMX = ((new Date().getUTCHours() - 6) + 24) % 24;
  const isNight = hourCDMX >= 22 || hourCDMX < 5;
  if (isNight && score > 2) score = Math.max(1, score - 2);
  return {
    safety_score: score,
    zones_analyzed: zones,
    is_night: isNight,
    recommendation:
      score <= 3 ? "Zona de alta incidencia. Usar Uber/taxi, evitar caminar." :
      score <= 5 ? "Incidencia media. Mantenerse en vialidades principales." :
      score <= 7 ? "Incidencia baja. Ruta relativamente segura." :
                   "Muy baja incidencia. Ruta segura.",
  };
}

export function calcCost(distance_km, duration_min) {
  const taxi = Math.round(15.80 + distance_km * 14.20 + duration_min * 1.40);
  const app  = Math.round(25   + distance_km * 9     + duration_min * 0.80);
  return [
    { mode: "Metro (solo)",    cost_mxn: 5,    notes: "Si hay estación cercana." },
    { mode: "Metro + Metrobús",cost_mxn: 12,   notes: "1-2 transbordos típicos." },
    { mode: "Taxi de sitio",   cost_mxn: taxi, notes: "Con taxímetro." },
    { mode: "Uber / DiDi",     cost_mxn: app,  notes: "Sin surge pricing." },
  ];
}

// ── 1. Rutas base — Google Maps Directions API (con tráfico en tiempo real) ──

export const getRoutes = tool({
  name: "get_routes",
  description:
    "Obtiene hasta 3 rutas alternativas entre origen y destino en la CDMX. " +
    "Devuelve duración real con tráfico en minutos, distancia en km, resumen de vialidades y " +
    "la polyline codificada de cada opción. Llama esto PRIMERO antes de cualquier otra herramienta.",
  inputSchema: z.object({
    origin_lat:  z.number().describe("Latitud del punto de origen"),
    origin_lng:  z.number().describe("Longitud del punto de origen"),
    dest_lat:    z.number().describe("Latitud del destino"),
    dest_lng:    z.number().describe("Longitud del destino"),
  }),
  callback: async ({ origin_lat, origin_lng, dest_lat, dest_lng }) => {
    const key = process.env.GOOGLE_MAPS_API_KEY;

    // Routes API v2 — autorizada en el proyecto, incluye tráfico en tiempo real
    const res = await fetch("https://routes.googleapis.com/directions/v2:computeRoutes", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Goog-Api-Key": key,
        "X-Goog-FieldMask": [
          "routes.duration",
          "routes.distanceMeters",
          "routes.polyline",
          "routes.travelAdvisory",
          "routes.legs.steps.navigationInstruction",
        ].join(","),
      },
      body: JSON.stringify({
        origin:      { location: { latLng: { latitude: origin_lat, longitude: origin_lng } } },
        destination: { location: { latLng: { latitude: dest_lat,   longitude: dest_lng   } } },
        travelMode:  "DRIVE",
        computeAlternativeRoutes: true,
        routingPreference: "TRAFFIC_AWARE",
        languageCode: "es",
        regionCode: "MX",
      }),
    });
    const data = await res.json();

    if (!data.routes?.length) {
      return `Error de Routes API: ${JSON.stringify(data.error ?? data)}`;
    }

    const routes = data.routes.map((r, i) => {
      const durationSec   = parseInt(r.duration ?? "0");
      const staticSec     = parseInt(r.travelAdvisory?.transitFare ?? "0") || durationSec;
      const trafficDelay  = Math.max(0, Math.round((durationSec - staticSec) / 60));

      return {
        index: i,
        summary: `Ruta ${i + 1}`,
        duration_min: Math.round(durationSec / 60),
        traffic_delay_min: trafficDelay,
        traffic_condition:
          trafficDelay > 20 ? "tráfico_muy_alto" :
          trafficDelay > 10 ? "tráfico_alto" :
          trafficDelay > 4  ? "tráfico_moderado" : "fluido",
        distance_km: (r.distanceMeters / 1000).toFixed(1),
        polyline: r.polyline?.encodedPolyline ?? "",
        main_roads: (r.legs?.[0]?.steps ?? [])
          .map(s => s.navigationInstruction?.instructions ?? "")
          .filter(s => s.length > 3)
          .slice(0, 6),
      };
    });

    return JSON.stringify(routes);
  },
});

// ── 2. Clima y riesgo de inundación — OpenWeatherMap ────────────────────────

export const getWeather = tool({
  name: "get_weather",
  description:
    "Obtiene las condiciones climáticas actuales en el área del destino. " +
    "Informa lluvia en mm/h, temperatura, humedad y nivel de riesgo de inundación.",
  inputSchema: z.object({
    lat: z.number().describe("Latitud del punto a consultar (usar coordenadas del destino)"),
    lng: z.number().describe("Longitud del punto a consultar"),
  }),
  callback: async ({ lat, lng }) => {
    const key = process.env.OPENWEATHER_API_KEY;
    const url =
      `https://api.openweathermap.org/data/2.5/weather` +
      `?lat=${lat}&lon=${lng}&appid=${key}&lang=es&units=metric`;

    const res = await fetch(url);
    const d   = await res.json();

    if (d.cod && d.cod !== 200) {
      return `Error de OpenWeather: ${d.message}`;
    }

    const rain_mm  = d.rain?.["1h"] ?? 0;
    const flood_risk =
      rain_mm > 15 ? "muy_alto" :
      rain_mm > 10 ? "alto" :
      rain_mm >  3 ? "medio" : "bajo";

    return JSON.stringify({
      condition:     d.weather?.[0]?.description ?? "despejado",
      temp_c:        d.main?.temp,
      humidity_pct:  d.main?.humidity,
      rain_1h_mm:    rain_mm,
      flood_risk,
      visibility_m:  d.visibility ?? 10000,
      wind_kmh:      d.wind?.speed ? Math.round(d.wind.speed * 3.6) : 0,
      alert:
        flood_risk === "muy_alto" ? "⚠️ Lluvia intensa. Riesgo alto de encharcamientos." :
        flood_risk === "alto"     ? "🌧 Lluvia moderada-fuerte. Posibles encharcamientos." :
        flood_risk === "medio"    ? "🌦 Lluvia ligera. Verificar zonas bajas." : null,
    });
  },
});

// ── 3. Índice de seguridad — Datos Abiertos CDMX (FGJ) ──────────────────────

// Score por alcaldía basado en incidencia delictiva FGJ CDMX 2024
// Fuente: datos.cdmx.gob.mx/dataset/carpetas-de-investigacion-fgj
const ALCALDIA_SCORES = {
  "cuauhtemoc":              3,  // Centro histórico, Tepito, Guerrero
  "venustiano carranza":     3,  // Aeropuerto, Jardín Balbuena, Merced
  "iztapalapa":              3,  // Mayor volumen de carpetas de la CDMX
  "gustavo a madero":        4,  // Lindavista, Vallejo, Tepeyac
  "azcapotzalco":            5,
  "alvaro obregon":          5,  // Santa Fe (seguro), Mixcoac, Observatorio
  "miguel hidalgo":          6,  // Polanco (seguro), Tacubaya, Popotla
  "iztacalco":               5,
  "tlahuac":                 4,
  "xochimilco":              5,
  "coyoacan":                6,  // Zona universitaria, Pedregal
  "tlalpan":                 6,
  "magdalena contreras":     6,
  "cuajimalpa":              6,  // Santa Fe corporativo
  "milpa alta":              7,
  "benito juarez":           8,  // Narvarte, Del Valle, Portales — menor incidencia
};

// Ajustes por colonia específica
const COLONIA_OVERRIDES = {
  // Alto riesgo
  "tepito":        2, "guerrero":      2, "morelos":       2,
  "transvaal":     2, "peralvillo":    2, "la merced":     2,
  "doctores":      3, "obrera":        3, "buenavista":    3,
  "tránsito":      3, "jamaica":       3, "viaducto":      4,
  // Bajo riesgo
  "polanco":       9, "lomas de chapultepec": 9, "santa fe": 8,
  "pedregal":      8, "condesa":       8, "roma":          8,
  "narvarte":      8, "del valle":     8, "coyoacan":      7,
  "reforma":       7, "chapultepec":   7, "interlomas":    8,
  "satelite":      8, "perisur":       8, "florida":       8,
};

export const getSafetyIndex = tool({
  name: "get_safety_index",
  description:
    "Evalúa el nivel de seguridad de una ruta basado en datos de incidencia delictiva " +
    "y siniestros viales FGJ CDMX 2024. Devuelve score de 0 (peligroso) a 10 (seguro).",
  inputSchema: z.object({
    route_summary: z.string().describe("Descripción de la ruta, vialidades y colonias que atraviesa"),
    dest_lat: z.number().describe("Latitud del destino"),
    dest_lng: z.number().describe("Longitud del destino"),
  }),
  callback: async ({ route_summary, dest_lat, dest_lng }) => {
    const text = route_summary.toLowerCase();

    // 1. Buscar overrides de colonia (más específico)
    const coloniaMatches = Object.entries(COLONIA_OVERRIDES)
      .filter(([k]) => text.includes(k));

    // 2. Buscar por alcaldía
    const alcaldiaMatches = Object.entries(ALCALDIA_SCORES)
      .filter(([k]) => text.includes(k));

    let score;
    let matchedZones = [];

    if (coloniaMatches.length > 0) {
      score = Math.round(
        coloniaMatches.reduce((sum, [, v]) => sum + v, 0) / coloniaMatches.length
      );
      matchedZones = coloniaMatches.map(([k]) => k);
    } else if (alcaldiaMatches.length > 0) {
      score = Math.round(
        alcaldiaMatches.reduce((sum, [, v]) => sum + v, 0) / alcaldiaMatches.length
      );
      matchedZones = alcaldiaMatches.map(([k]) => k);
    } else {
      score = 5; // sin datos suficientes → media
    }

    // Ajuste nocturno: 22:00–05:00 CDMX (UTC-6)
    const hourCDMX = ((new Date().getUTCHours() - 6) + 24) % 24;
    const isNight  = hourCDMX >= 22 || hourCDMX < 5;
    if (isNight && score > 2) score = Math.max(1, score - 2);

    const density =
      score <= 3 ? "alta" :
      score <= 5 ? "media-alta" :
      score <= 7 ? "media-baja" : "baja";

    return JSON.stringify({
      safety_score: score,
      incident_density: density,
      zones_analyzed: matchedZones,
      is_night_hours: isNight,
      hour_cdmx: hourCDMX,
      data_source: "FGJ CDMX — Carpetas de investigación 2024",
      recommendation:
        score <= 3
          ? "Zona de alta incidencia. Usar transporte cerrado (Uber/taxi), evitar caminar."
          : score <= 5
          ? "Zona de incidencia media. Mantenerse en vialidades principales e iluminadas."
          : score <= 7
          ? "Zona con baja incidencia. Ruta relativamente segura."
          : "Zona con muy baja incidencia. Ruta segura.",
    });
  },
});

// ── 4. Costo multimodal — Tarifas CDMX 2024 ─────────────────────────────────

export const getTransportCost = tool({
  name: "get_transport_cost",
  description:
    "Estima el costo del viaje para diferentes modos de transporte: " +
    "metro, metrobús, taxi de sitio y app (Uber/DiDi). " +
    "Ideal para usuarios que priorizan el presupuesto.",
  inputSchema: z.object({
    distance_km:  z.number().describe("Distancia de la ruta en kilómetros"),
    duration_min: z.number().describe("Duración estimada de la ruta en minutos"),
  }),
  callback: async ({ distance_km, duration_min }) => {
    const METRO    = 5;
    const METROBUS = 7;
    const TAXI_BASE = 15.80, TAXI_KM = 14.20, TAXI_MIN = 1.40;
    const APP_BASE  = 25,    APP_KM  = 9,     APP_MIN  = 0.80;

    const taxi_total = Math.round(TAXI_BASE + distance_km * TAXI_KM + duration_min * TAXI_MIN);
    const app_total  = Math.round(APP_BASE  + distance_km * APP_KM  + duration_min * APP_MIN);

    return JSON.stringify({
      options: [
        {
          mode: "Metro (solo)", cost_mxn: METRO,
          notes: "Solo si hay estación a < 10 min caminando del origen y destino.",
          feasibility: distance_km < 25 ? "posible" : "poco_probable",
        },
        {
          mode: "Metro + Metrobús", cost_mxn: METRO + METROBUS,
          notes: "Cobertura amplia. 1-2 transbordos. Más lento en horas pico.",
          feasibility: "alta",
        },
        {
          mode: "Taxi de sitio", cost_mxn: taxi_total,
          notes: "Pedir en sitio autorizado o con taxímetro. Más seguro que libre.",
          feasibility: "alta",
        },
        {
          mode: "Uber / DiDi", cost_mxn: app_total,
          notes: "Estimado sin surge pricing. Sube con lluvia o demanda alta.",
          feasibility: "alta",
        },
      ],
      cheapest_mode: "Metro (solo)",
      cheapest_cost_mxn: METRO,
    });
  },
});

// ── 5. Accesibilidad — Infraestructura CDMX ─────────────────────────────────

export const getAccessibility = tool({
  name: "get_accessibility",
  description:
    "Evalúa qué tan accesible es la ruta para personas con movilidad reducida, " +
    "usuarios de silla de ruedas o personas mayores. Indica estaciones con elevador, " +
    "rampas y estado de banquetas en el recorrido.",
  inputSchema: z.object({
    route_summary: z.string().describe("Descripción textual de la ruta"),
    duration_min:  z.number().describe("Duración de la ruta en minutos"),
  }),
  callback: async ({ route_summary }) => {
    const ACCESSIBLE_STATIONS = [
      "auditorio", "polanco", "tacubaya", "balderas", "hidalgo",
      "indios verdes", "tasqueña", "universidad", "copilco",
      "viveros", "perisur", "insurgentes", "bellas artes",
    ];
    const ACCESSIBLE_CORRIDORS = [
      "reforma", "polanco", "santa fe", "pedregal",
      "coyoacán", "tlalpan", "insurgentes", "periférico",
    ];

    const text          = route_summary.toLowerCase();
    const stationsFound = ACCESSIBLE_STATIONS.filter(s => text.includes(s));
    const corridorsFound = ACCESSIBLE_CORRIDORS.filter(c => text.includes(c));

    const score =
      stationsFound.length >= 2  ? 9 :
      stationsFound.length === 1 || corridorsFound.length >= 2 ? 7 :
      corridorsFound.length === 1 ? 5 : 3;

    return JSON.stringify({
      accessibility_score: score,
      accessible_stations_on_route: stationsFound,
      accessible_corridors: corridorsFound,
      ramp_coverage: score >= 7 ? "buena" : score >= 5 ? "parcial" : "limitada",
      sidewalk_condition: score >= 7 ? "buena" : "irregular",
      recommended_transport:
        score >= 7 ? "Metro (con elevador) o app con asistencia" : "Taxi de sitio o app",
      notes:
        score < 5
          ? "Infraestructura limitada. Se recomienda taxi o app para mayor comodidad."
          : "Accesibilidad aceptable. Verificar estación de destino.",
    });
  },
});
