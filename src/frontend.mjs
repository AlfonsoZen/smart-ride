export const FRONTEND_HTML = `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>RutaSegura CDMX</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }

    body {
      background: #0f0f0f; color: #f0f0f0;
      font-family: 'Inter', -apple-system, sans-serif;
      display: flex; height: 100vh; overflow: hidden;
    }

    /* ── Sidebar ── */
    #sidebar {
      width: 380px; min-width: 380px; height: 100vh;
      background: #141414; display: flex; flex-direction: column;
      overflow-y: auto; z-index: 10;
      border-right: 1px solid #1f1f1f;
    }
    #sidebar-inner { padding: 24px; flex: 1; }

    h1 { font-size: 20px; font-weight: 700; color: #f0f0f0; margin-bottom: 2px; }
    .sub { color: #555; font-size: 12px; margin-bottom: 20px; }

    /* ── Inputs de ubicación ── */
    .location-panel {
      background: #1a1a1a; border: 1px solid #2a2a2a;
      border-radius: 12px; overflow: hidden;
    }
    .location-row { display: flex; align-items: center; gap: 12px; padding: 13px 16px; }
    .location-row + .location-row { border-top: 1px solid #222; }
    .dot { width: 10px; height: 10px; border-radius: 50%; flex-shrink: 0; }
    .dot.origin      { background: #6C63FF; }
    .dot.destination { background: #ff6b6b; }
    .location-row input {
      flex: 1; background: transparent; border: none; outline: none;
      color: #f0f0f0; font-size: 14px; min-width: 0;
    }
    .location-row input::placeholder { color: #444; }

    .divider { height: 1px; background: #1f1f1f; margin: 18px 0; }

    /* ── Sliders ── */
    .weights-panel h3 {
      font-size: 10px; letter-spacing: .08em; color: #555;
      font-weight: 600; margin-bottom: 14px; text-transform: uppercase;
    }
    .weight-row { display: flex; align-items: center; gap: 10px; margin-bottom: 11px; }
    .weight-label { font-size: 12px; width: 150px; flex-shrink: 0; color: #bbb; }
    input[type=range] { flex: 1; accent-color: #6C63FF; cursor: pointer; }
    .weight-val { font-size: 13px; color: #6C63FF; font-weight: 700; width: 16px; text-align: right; }

    /* ── Botón ── */
    #go-btn {
      margin-top: 20px; width: 100%; padding: 13px;
      background: #6C63FF; color: white; border: none; border-radius: 10px;
      font-size: 14px; font-weight: 600; cursor: pointer; transition: background .15s;
    }
    #go-btn:hover:not(:disabled) { background: #5a52d5; }
    #go-btn:disabled { opacity: 0.4; cursor: not-allowed; }

    /* ── Estado de carga ── */
    #status-bar {
      margin-top: 14px; min-height: 22px;
      display: flex; align-items: center; gap: 8px; flex-wrap: wrap;
    }
    .spinner {
      width: 14px; height: 14px; border: 2px solid #333;
      border-top-color: #6C63FF; border-radius: 50%;
      animation: spin .7s linear infinite; flex-shrink: 0;
    }
    @keyframes spin { to { transform: rotate(360deg); } }
    #active-tool { font-size: 12px; color: #a89dff; }

    #tools { display: flex; flex-wrap: wrap; gap: 4px; margin-top: 8px; }
    .tool-badge {
      background: #1e1a3a; color: #a89dff;
      border-radius: 4px; padding: 2px 8px; font-size: 11px;
    }
    .tool-badge.done { color: #6ddb8b; background: #0f2a1a; }

    /* ── Output de texto ── */
    #output {
      margin-top: 12px; background: #1a1a1a; border-radius: 10px;
      padding: 14px; font-size: 12px; line-height: 1.75; white-space: pre-wrap;
      min-height: 60px; border: 1px solid #222; color: #ccc;
      max-height: 300px; overflow-y: auto;
    }

    /* ── Mapa ── */
    #map { flex: 1; height: 100vh; }
  </style>
</head>
<body>
  <div id="sidebar">
    <div id="sidebar-inner">
      <h1>RutaSegura CDMX</h1>
      <p class="sub">Encuentra la mejor ruta según lo que más te importa.</p>

      <div class="location-panel">
        <div class="location-row">
          <span class="dot origin"></span>
          <input type="text" id="origin" placeholder="¿Desde dónde sales?" value="Ángel de la Independencia, CDMX" />
        </div>
        <div class="location-row">
          <span class="dot destination"></span>
          <input type="text" id="destination" placeholder="¿A dónde vas?" value="Xochimilco, CDMX" />
        </div>
      </div>

      <div class="divider"></div>

      <div class="weights-panel">
        <h3>¿Qué importa más en tu viaje?</h3>

        <div class="weight-row">
          <span class="weight-label">⚡ Rapidez</span>
          <input type="range" id="w-speed" min="0" max="10" value="5"
                 oninput="document.getElementById('lv-speed').textContent=this.value" />
          <span class="weight-val" id="lv-speed">5</span>
        </div>
        <div class="weight-row">
          <span class="weight-label">🔒 Seguridad</span>
          <input type="range" id="w-safety" min="0" max="10" value="5"
                 oninput="document.getElementById('lv-safety').textContent=this.value" />
          <span class="weight-val" id="lv-safety">5</span>
        </div>
        <div class="weight-row">
          <span class="weight-label">🌧 Clima</span>
          <input type="range" id="w-weather" min="0" max="10" value="5"
                 oninput="document.getElementById('lv-weather').textContent=this.value" />
          <span class="weight-val" id="lv-weather">5</span>
        </div>
        <div class="weight-row">
          <span class="weight-label">💰 Costo</span>
          <input type="range" id="w-cost" min="0" max="10" value="5"
                 oninput="document.getElementById('lv-cost').textContent=this.value" />
          <span class="weight-val" id="lv-cost">5</span>
        </div>
        <div class="weight-row">
          <span class="weight-label">♿ Accesibilidad</span>
          <input type="range" id="w-access" min="0" max="10" value="5"
                 oninput="document.getElementById('lv-access').textContent=this.value" />
          <span class="weight-val" id="lv-access">5</span>
        </div>
      </div>

      <button id="go-btn" onclick="buscarRuta()">Buscar ruta</button>

      <div id="status-bar"></div>
      <div id="tools"></div>
      <div id="output">La recomendación del agente aparecerá aquí.</div>
    </div>
  </div>

  <div id="map"></div>

  <script>
    const TOOL_LABELS = {
      get_routes:          "🗺 Buscando rutas",
      get_weather:         "🌧 Consultando clima",
      get_safety_index:    "🔒 Evaluando seguridad",
      get_transport_cost:  "💰 Calculando costo",
      get_accessibility:   "♿ Verificando accesibilidad",
    };

    let map, mapsReady = false, routeLine = null, markerOrigin = null, markerDest = null;

    function initMap() {
      map = new google.maps.Map(document.getElementById("map"), {
        center: { lat: 19.4326, lng: -99.1332 },
        zoom: 12,
        disableDefaultUI: true,
        zoomControl: true,
        styles: [
          { elementType: "geometry",            stylers: [{ color: "#1a1a2e" }] },
          { elementType: "labels.text.fill",    stylers: [{ color: "#8888aa" }] },
          { elementType: "labels.text.stroke",  stylers: [{ color: "#1a1a2e" }] },
          { featureType: "road",         elementType: "geometry",      stylers: [{ color: "#2a2a4a" }] },
          { featureType: "road.highway", elementType: "geometry",      stylers: [{ color: "#3a3a6a" }] },
          { featureType: "road",         elementType: "labels.text.fill", stylers: [{ color: "#6666aa" }] },
          { featureType: "water",        elementType: "geometry",      stylers: [{ color: "#0d0d1a" }] },
          { featureType: "poi",          elementType: "geometry",      stylers: [{ color: "#1e1e3a" }] },
          { featureType: "transit",      elementType: "geometry",      stylers: [{ color: "#222244" }] },
          { featureType: "landscape",    elementType: "geometry",      stylers: [{ color: "#16162a" }] },
          { featureType: "administrative", elementType: "geometry.stroke", stylers: [{ color: "#2a2a5a" }] },
        ],
      });
      mapsReady = true;
    }

    function drawRoute(routeData) {
      if (!mapsReady || !routeData.polyline) return;

      // Decodificar polyline directamente — no llama a Directions API
      const path = google.maps.geometry.encoding.decodePath(routeData.polyline);

      if (routeLine) routeLine.setMap(null);
      routeLine = new google.maps.Polyline({
        path,
        map,
        strokeColor:   "#6C63FF",
        strokeWeight:  5,
        strokeOpacity: 0.9,
      });

      // Marcadores de origen y destino
      if (markerOrigin) markerOrigin.setMap(null);
      if (markerDest)   markerDest.setMap(null);
      markerOrigin = new google.maps.Marker({ position: path[0],              map, title: routeData.origin });
      markerDest   = new google.maps.Marker({ position: path[path.length - 1], map, title: routeData.destination });

      // Centrar mapa en la ruta
      const bounds = new google.maps.LatLngBounds();
      path.forEach(p => bounds.extend(p));
      map.fitBounds(bounds, { top: 40, right: 40, bottom: 40, left: 40 });
    }

    function setActiveTool(name) {
      const bar = document.getElementById("status-bar");
      if (!name) { bar.innerHTML = ""; return; }
      bar.innerHTML =
        '<div class="spinner"></div>' +
        '<span id="active-tool">' + (TOOL_LABELS[name] ?? name) + '...</span>';
    }

    function addDoneBadge(name) {
      document.getElementById("tools").innerHTML +=
        '<span class="tool-badge done">' + (TOOL_LABELS[name] ?? name) + ' ✓</span>';
    }
  </script>
  <script src="https://maps.googleapis.com/maps/api/js?key=AIzaSyAQqa_a-T2DG0BOHkePnpGBWPlkNIp97mY&libraries=places,geometry&callback=initMap" async defer></script>
  <script>
    const sessionId = "s-" + Math.random().toString(36).slice(2, 9);
    // Construir URL del chat respetando el stage de API Gateway (/prod/chat)
    const CHAT_URL = window.location.href.replace(/\\/$/, "") + "/chat";
    let lastTool = null;

    async function buscarRuta() {
      const origin      = document.getElementById("origin").value.trim();
      const destination = document.getElementById("destination").value.trim();
      if (!origin || !destination) { alert("Ingresa origen y destino."); return; }

      const btn  = document.getElementById("go-btn");
      const out  = document.getElementById("output");
      btn.disabled = true;
      out.textContent = "";
      document.getElementById("tools").innerHTML = "";
      document.getElementById("status-bar").innerHTML =
        '<div class="spinner"></div><span id="active-tool">Geocodificando dirección...</span>';
      lastTool = null;

      const payload = {
        sessionId, origin, destination,
        weights: {
          speed:         parseInt(document.getElementById("w-speed").value),
          safety:        parseInt(document.getElementById("w-safety").value),
          weather:       parseInt(document.getElementById("w-weather").value),
          cost:          parseInt(document.getElementById("w-cost").value),
          accessibility: parseInt(document.getElementById("w-access").value),
        },
      };

      try {
        const res = await fetch(CHAT_URL, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });

        const reader = res.body.getReader();
        const dec    = new TextDecoder();
        let text     = "";

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          for (const line of dec.decode(value).split("\\n")) {
            if (!line.trim()) continue;
            try {
              const evt = JSON.parse(line);
              if (evt.type === "token") {
                // Marcar herramienta anterior como completada cuando llega el primer token
                if (lastTool) { addDoneBadge(lastTool); lastTool = null; setActiveTool(null); }
                text += evt.text;
                out.textContent = text.replace(/\\nROUTE_DATA:.*$/s, "").trim();
              } else if (evt.type === "tool") {
                if (lastTool) addDoneBadge(lastTool);
                lastTool = evt.name;
                setActiveTool(evt.name);
              } else if (evt.type === "route") {
                drawRoute(evt.route);
              } else if (evt.type === "done") {
                setActiveTool(null);
              } else if (evt.type === "error") {
                setActiveTool(null);
                out.textContent = "❌ " + evt.text;
              }
            } catch (_) {}
          }
        }
      } catch (err) {
        document.getElementById("status-bar").innerHTML = "";
        out.textContent = "❌ Error de red: " + err.message;
      } finally {
        btn.disabled = false;
        setActiveTool(null);
      }
    }
  </script>
</body>
</html>`;
