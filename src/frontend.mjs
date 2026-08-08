export const FRONTEND_HTML = `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>RutaSegura CDMX</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { background: #0f0f0f; color: #f0f0f0; font-family: 'Inter', sans-serif; padding: 32px; max-width: 680px; margin: auto; }
    h1 { color: #6C63FF; margin-bottom: 8px; }
    p.sub { color: #888; margin-bottom: 24px; font-size: 13px; }

    .location-panel {
      background: #1a1a1a; border: 1px solid #2a2a2a; border-radius: 12px; overflow: hidden;
    }
    .location-row {
      display: flex; align-items: center; gap: 12px; padding: 14px 16px;
    }
    .location-row + .location-row { border-top: 1px solid #2a2a2a; }
    .dot { width: 10px; height: 10px; border-radius: 50%; flex-shrink: 0; }
    .dot.origin      { background: #6C63FF; }
    .dot.destination { background: #ff6b6b; }
    .location-row input {
      flex: 1; background: transparent; border: none; outline: none;
      color: #f0f0f0; font-size: 14px; min-width: 0;
    }
    .location-row input::placeholder { color: #555; }

    .divider { height: 1px; background: #2a2a2a; margin: 20px 0; }

    .weights-panel h3 { font-size: 13px; color: #888; font-weight: 500; margin-bottom: 14px; }
    .weight-row { display: flex; align-items: center; gap: 10px; margin-bottom: 12px; }
    .weight-label { font-size: 13px; width: 160px; flex-shrink: 0; }
    input[type=range] { flex: 1; accent-color: #6C63FF; }
    .weight-val { font-size: 13px; color: #6C63FF; font-weight: 700; width: 18px; text-align: right; }

    button {
      margin-top: 20px; width: 100%; padding: 14px;
      background: #6C63FF; color: white; border: none; border-radius: 10px;
      font-size: 15px; font-weight: 600; cursor: pointer; transition: background .15s;
    }
    button:hover:not(:disabled) { background: #5a52d5; }
    button:disabled { opacity: 0.45; cursor: not-allowed; }

    #tools { margin-top: 14px; min-height: 20px; }
    .tool-badge {
      display: inline-block; background: #1e1a3a; color: #a89dff;
      border-radius: 4px; padding: 2px 8px; font-size: 11px; margin: 2px;
    }
    #output {
      margin-top: 12px; background: #1a1a1a; border-radius: 10px;
      padding: 16px; font-size: 13px; line-height: 1.7; white-space: pre-wrap;
      min-height: 60px; border: 1px solid #2a2a2a; color: #ddd;
    }
  </style>
</head>
<body>
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
    <h3>¿QUÉ IMPORTA MÁS EN TU VIAJE?</h3>

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

  <div id="tools"></div>
  <div id="output">La recomendación del agente aparecerá aquí.</div>

  <script>
    const sessionId = "s-" + Math.random().toString(36).slice(2, 9);

    async function buscarRuta() {
      const origin      = document.getElementById("origin").value.trim();
      const destination = document.getElementById("destination").value.trim();
      if (!origin || !destination) {
        alert("Ingresa origen y destino.");
        return;
      }

      const btn   = document.getElementById("go-btn");
      const out   = document.getElementById("output");
      const tools = document.getElementById("tools");
      btn.disabled   = true;
      out.textContent = "⏳ Geocodificando y consultando al agente...";
      tools.innerHTML = "";

      const payload = {
        sessionId,
        origin,
        destination,
        weights: {
          speed:         parseInt(document.getElementById("w-speed").value),
          safety:        parseInt(document.getElementById("w-safety").value),
          weather:       parseInt(document.getElementById("w-weather").value),
          cost:          parseInt(document.getElementById("w-cost").value),
          accessibility: parseInt(document.getElementById("w-access").value),
        },
      };

      try {
        const res = await fetch("/chat", {
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
                text += evt.text;
                out.textContent = text.replace(/\\nROUTE_DATA:.*$/s, "").trim();
              } else if (evt.type === "tool") {
                const labels = {
                  get_routes: "🗺 Buscando rutas",
                  get_weather: "🌧 Consultando clima",
                  get_safety_index: "🔒 Evaluando seguridad",
                  get_transport_cost: "💰 Calculando costo",
                  get_accessibility: "♿ Verificando accesibilidad",
                };
                tools.innerHTML += '<span class="tool-badge">' + (labels[evt.name] ?? evt.name) + '</span>';
              } else if (evt.type === "route") {
                console.log("Ruta para el mapa:", evt.route);
              } else if (evt.type === "error") {
                out.textContent = "❌ " + evt.text;
              }
            } catch (_) {}
          }
        }
      } catch (err) {
        out.textContent = "❌ Error de red: " + err.message;
      } finally {
        btn.disabled = false;
      }
    }
  </script>
</body>
</html>`;
