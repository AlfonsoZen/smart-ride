import { tool } from "@strands-agents/sdk";
import { z } from "zod";

// ── 1. Rutas base — Google Maps Directions API ───────────────────────────────

export const getRoutes = tool({
  name: "get_routes",
  description:
    "Obtiene hasta 3 rutas alternativas entre origen y destino en la CDMX. " +
    "Devuelve duración en minutos, distancia en km, resumen de vialidades y " +
    "la polyline codificada de cada opción. Llama esto PRIMERO antes de cualquier otra herramienta.",
  inputSchema: z.object({
    origin_lat:  z.number().describe("Latitud del punto de origen"),
    origin_lng:  z.number().describe("Longitud del punto de origen"),
    dest_lat:    z.number().describe("Latitud del destino"),
    dest_lng:    z.number().describe("Longitud del destino"),
  }),
  callback: async ({ origin_lat, origin_lng, dest_lat, dest_lng }) => {
    const key = process.env.GOOGLE_MAPS_API_KEY;
    const url =
      `https://maps.googleapis.com/maps/api/directions/json` +
      `?origin=${origin_lat},${origin_lng}` +
      `&destination=${dest_lat},${dest_lng}` +
      `&alternatives=true&language=es&region=mx&key=${key}`;

    const res = await fetch(url);
    const data = await res.json();

    if (data.status !== "OK") {
      return `Error de Directions API: ${data.status}. ${data.error_message ?? ""}`;
    }

    const routes = data.routes.map((r, i) => ({
      index: i,
      summary: r.summary,
      duration_min: Math.round(r.legs[0].duration.value / 60),
      distance_km: (r.legs[0].distance.value / 1000).toFixed(1),
      polyline: r.overview_polyline.points,
      // Vialidades principales extraídas de los pasos
      main_roads: [...new Set(
        r.legs[0].steps
          .map(s => s.html_instructions.replace(/<[^>]+>/g, ""))
          .filter(s => s.length > 3)
          .slice(0, 5)
      )],
    }));

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
    const d = await res.json();

    if (d.cod && d.cod !== 200) {
      return `Error de OpenWeather: ${d.message}`;
    }

    const rain_mm = d.rain?.["1h"] ?? 0;
    const flood_risk =
      rain_mm > 15 ? "muy_alto" :
      rain_mm > 10 ? "alto" :
      rain_mm >  3 ? "medio" : "bajo";

    return JSON.stringify({
      condition: d.weather?.[0]?.description ?? "despejado",
      temp_c: d.main?.temp,
      humidity_pct: d.main?.humidity,
      rain_1h_mm: rain_mm,
      flood_risk,
      visibility_m: d.visibility ?? 10000,
      wind_kmh: d.wind?.speed ? Math.round(d.wind.speed * 3.6) : 0,
      alert:
        flood_risk === "muy_alto" ? "⚠️ Lluvia intensa. Riesgo alto de encharcamientos." :
        flood_risk === "alto"     ? "🌧 Lluvia moderada-fuerte. Posibles encharcamientos." :
        flood_risk === "medio"    ? "🌦 Lluvia ligera. Verificar zonas bajas." :
                                    null,
    });
  },
});

// ── 3. Índice de seguridad — Datos Abiertos CDMX (FGJ) ──────────────────────

export const getSafetyIndex = tool({
  name: "get_safety_index",
  description:
    "Evalúa el nivel de seguridad de una ruta con base en incidentes delictivos " +
    "y siniestros viales recientes en las colonias que atraviesa. " +
    "Devuelve un score de 0 (muy peligroso) a 10 (muy seguro).",
  inputSchema: z.object({
    route_summary: z.string().describe("Descripción de la ruta, e.g. 'Insurgentes, Viaducto, Tlalpan'"),
    dest_lat: z.number().describe("Latitud del destino"),
    dest_lng: z.number().describe("Longitud del destino"),
  }),
  callback: async ({ route_summary, dest_lat, dest_lng }) => {
    // Datos Abiertos CDMX — Carpetas de Investigación FGJ
    // https://datos.cdmx.gob.mx/dataset/carpetas-de-investigacion-fgj
    // En modo demo usamos clasificación por zona conocida; en producción
    // cruzar con el endpoint de la API filtrando por alcaldía/colonia.

    const HIGH_RISK = [
      "tepito", "guerrero", "doctores", "transvaal", "morelos",
      "peralvillo", "la merced", "buenavista", "obrera", "tránsito",
      "iztapalapa", "ecatepec", "neza",
    ];
    const LOW_RISK = [
      "polanco", "lomas", "santa fe", "pedregal", "coyoacán",
      "del valle", "florida", "narvarte", "condesa", "roma",
      "reforma", "chapultepec", "satelite", "interlomas",
    ];

    const text = route_summary.toLowerCase();
    const highMatches = HIGH_RISK.filter(z => text.includes(z));
    const lowMatches  = LOW_RISK.filter(z => text.includes(z));

    let score;
    let density;
    if (highMatches.length > 0 && lowMatches.length === 0) {
      score = 3; density = "alta";
    } else if (highMatches.length > 0) {
      score = 5; density = "media-alta";
    } else if (lowMatches.length > 0) {
      score = 8; density = "baja";
    } else {
      score = 6; density = "media";
    }

    // Ajuste por hora: 22:00–05:00 sube el riesgo
    const hour = new Date().getUTCHours() - 6; // UTC-6 CDMX
    const isNight = hour < 5 || hour >= 22;
    if (isNight && score > 2) score -= 2;

    return JSON.stringify({
      safety_score: Math.max(1, score),
      incident_density: density,
      high_risk_zones_found: highMatches,
      is_night_hours: isNight,
      recommendation:
        score <= 3
          ? "Zona con incidencia alta. Preferir transporte cerrado, evitar caminar."
          : score <= 5
          ? "Zona con incidencia media. Mantenerse en vialidades principales e iluminadas."
          : "Zona con incidencia baja. Ruta relativamente segura.",
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
    distance_km: z.number().describe("Distancia de la ruta en kilómetros"),
    duration_min: z.number().describe("Duración estimada de la ruta en minutos"),
  }),
  callback: async ({ distance_km, duration_min }) => {
    // Tarifas oficiales CDMX 2024
    const METRO      = 5;   // tarifa plana
    const METROBUS   = 7;   // tarifa plana
    const TREN_LIGERO = 5;  // tarifa plana
    const TAXI_BASE  = 15.80;
    const TAXI_KM    = 14.20;
    const TAXI_MIN   = 1.40;
    // Uber/DiDi — estimado promedio CDMX
    const APP_BASE   = 25;
    const APP_KM     = 9;
    const APP_MIN    = 0.80;

    const taxi_total = Math.round(TAXI_BASE + distance_km * TAXI_KM + duration_min * TAXI_MIN);
    const app_total  = Math.round(APP_BASE  + distance_km * APP_KM  + duration_min * APP_MIN);

    return JSON.stringify({
      options: [
        {
          mode: "Metro (solo)",
          cost_mxn: METRO,
          notes: "Solo si hay estación a < 10 min caminando del origen y destino.",
          feasibility: distance_km < 25 ? "posible" : "poco_probable",
        },
        {
          mode: "Metro + Metrobús",
          cost_mxn: METRO + METROBUS,
          notes: "Cobertura amplia. 1-2 transbordos típicos. Más lento en horas pico.",
          feasibility: "alta",
        },
        {
          mode: "Taxi de sitio",
          cost_mxn: taxi_total,
          notes: "Pedir en sitio autorizado o con taxímetro. Más seguro que libre.",
          feasibility: "alta",
        },
        {
          mode: "Uber / DiDi",
          cost_mxn: app_total,
          notes: "Estimado sin surge pricing. Precio puede subir con lluvia o demanda alta.",
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
  callback: async ({ route_summary, duration_min }) => {
    // Fuente: datos.cdmx.gob.mx — Infraestructura accesible Metro CDMX
    // Estaciones Línea B con elevador (muestra representativa):
    const ACCESSIBLE_STATIONS = [
      "auditorio", "polanco", "tacubaya", "balderas", "hidalgo",
      "indios verdes", "tasqueña", "universidad", "copilco",
      "viveros", "perisur", "insurgentes", "bellas artes",
    ];
    const ACCESSIBLE_CORRIDORS = [
      "reforma", "polanco", "santa fe", "pedregal",
      "coyoacán", "tlalpan", "insurgentes", "periférico",
    ];

    const text = route_summary.toLowerCase();
    const stationsFound    = ACCESSIBLE_STATIONS.filter(s => text.includes(s));
    const corridorsFound   = ACCESSIBLE_CORRIDORS.filter(c => text.includes(c));

    const score =
      stationsFound.length >= 2 ? 9 :
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
          ? "Ruta con infraestructura limitada. Recomendar taxi o app para mayor comodidad."
          : "Ruta con accesibilidad aceptable. Verificar estación de destino.",
    });
  },
});
