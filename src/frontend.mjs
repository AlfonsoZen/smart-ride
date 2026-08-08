export const FRONTEND_HTML = `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" />
  <title>Smart Ride</title>
  <link rel="preconnect" href="https://fonts.googleapis.com" />
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap" rel="stylesheet" />
  <style>
    :root {
      --bg:         #0a0a0f;
      --surface:    #13131a;
      --surface2:   #1c1c28;
      --border:     #2a2a3a;
      --accent:     #6C63FF;
      --accent2:    #8B5CF6;
      --safe:       #22c55e;
      --fast:       #f59e0b;
      --danger:     #ef4444;
      --text:       #f0f0ff;
      --subtext:    #8888aa;
      --card-radius: 20px;
    }
    * { box-sizing: border-box; margin: 0; padding: 0; -webkit-tap-highlight-color: transparent; }
    html, body { height: 100%; overflow: hidden; background: var(--bg); color: var(--text); font-family: 'Inter', sans-serif; }

    /* ── SCREENS ── */
    .screen { position: absolute; inset: 0; display: flex; flex-direction: column; overflow: hidden; transition: opacity .35s, transform .35s; }
    .screen.hidden  { opacity: 0; pointer-events: none; transform: translateY(24px); }
    .screen.visible { opacity: 1; pointer-events: all; transform: none; }

    /* ── MAP BACKGROUND (all screens that show map use this) ── */
    #map-canvas { position: absolute; inset: 0; width: 100%; height: 100%; z-index: 0; background: #1a1a2e; }
    .map-overlay { position: absolute; inset: 0; z-index: 1; pointer-events: none; }
    .map-overlay.active { pointer-events: all; }

    /* ── SPLASH SCREEN ── */
    #screen-splash {
      background: linear-gradient(145deg, #0d0d1a 0%, #1a0a2e 50%, #0a1a2e 100%);
      align-items: center; justify-content: center; z-index: 100;
    }
    .splash-logo { text-align: center; animation: fadeSlideUp .8s ease both; }
    .splash-icon {
      width: 96px; height: 96px; border-radius: 28px;
      background: linear-gradient(135deg, var(--accent), var(--accent2));
      display: flex; align-items: center; justify-content: center;
      margin: 0 auto 20px; box-shadow: 0 0 60px rgba(108,99,255,.5);
      animation: pulse 2s ease-in-out infinite;
    }
    .splash-icon svg { width: 52px; height: 52px; }
    .splash-title { font-size: 36px; font-weight: 800; letter-spacing: -1px; }
    .splash-title span { background: linear-gradient(135deg, #a89dff, #6C63FF); -webkit-background-clip: text; -webkit-text-fill-color: transparent; }
    .splash-sub { color: var(--subtext); font-size: 14px; margin-top: 8px; }
    .splash-dots { display: flex; gap: 8px; justify-content: center; margin-top: 48px; }
    .splash-dots span {
      width: 8px; height: 8px; border-radius: 50%; background: var(--border);
      animation: dotPulse 1.4s ease-in-out infinite;
    }
    .splash-dots span:nth-child(2) { animation-delay: .2s; }
    .splash-dots span:nth-child(3) { animation-delay: .4s; }

    /* ── INPUT SCREEN ── */
    #screen-input { background: var(--bg); z-index: 10; }
    .input-header {
      padding: 56px 24px 20px;
      background: linear-gradient(180deg, var(--bg) 80%, transparent);
    }
    .app-logo { display: flex; align-items: center; gap: 10px; margin-bottom: 20px; }
    .app-logo .icon {
      width: 36px; height: 36px; border-radius: 10px;
      background: linear-gradient(135deg, var(--accent), var(--accent2));
      display: flex; align-items: center; justify-content: center;
    }
    .app-logo .icon svg { width: 20px; height: 20px; }
    .app-logo .name { font-size: 18px; font-weight: 700; }
    .input-title { font-size: 26px; font-weight: 800; line-height: 1.2; margin-bottom: 6px; }
    .input-subtitle { color: var(--subtext); font-size: 13px; }

    .input-body { flex: 1; overflow-y: auto; padding: 0 24px 24px; }

    .location-card {
      background: var(--surface); border: 1px solid var(--border);
      border-radius: var(--card-radius); overflow: hidden; margin-bottom: 16px;
    }
    .location-row {
      display: flex; align-items: center; gap: 14px; padding: 16px;
      position: relative;
    }
    .location-row + .location-row { border-top: 1px solid var(--border); }
    .loc-dot-wrap { display: flex; flex-direction: column; align-items: center; gap: 3px; flex-shrink: 0; }
    .loc-dot { width: 12px; height: 12px; border-radius: 50%; }
    .loc-dot.origin { background: var(--accent); box-shadow: 0 0 8px rgba(108,99,255,.6); }
    .loc-dot.dest   { background: var(--danger); box-shadow: 0 0 8px rgba(239,68,68,.6); }
    .loc-line { width: 2px; height: 24px; background: linear-gradient(var(--accent), var(--danger)); opacity: .3; }
    .loc-input {
      flex: 1; background: transparent; border: none; outline: none;
      color: var(--text); font-size: 15px; font-weight: 500; min-width: 0;
    }
    .loc-input::placeholder { color: #444466; font-weight: 400; }

    .section-title { font-size: 11px; font-weight: 600; color: var(--subtext); letter-spacing: .8px; text-transform: uppercase; margin: 20px 0 12px; }

    .weights-grid { display: flex; flex-direction: column; gap: 12px; }
    .weight-item { background: var(--surface); border: 1px solid var(--border); border-radius: 14px; padding: 14px 16px; }
    .weight-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px; }
    .weight-label-row { display: flex; align-items: center; gap: 8px; font-size: 14px; font-weight: 500; }
    .weight-value { font-size: 18px; font-weight: 700; color: var(--accent); min-width: 22px; text-align: right; }
    .weight-bar-track { height: 6px; background: var(--border); border-radius: 3px; position: relative; }
    .weight-bar-fill { height: 100%; border-radius: 3px; background: linear-gradient(90deg, var(--accent), var(--accent2)); transition: width .2s; }
    input.weight-range {
      position: absolute; inset: -8px 0; width: 100%; opacity: 0; cursor: pointer; height: 22px;
    }

    .search-btn {
      width: 100%; padding: 18px; margin-top: 20px; margin-bottom: 8px;
      background: linear-gradient(135deg, var(--accent), var(--accent2));
      color: white; border: none; border-radius: 16px;
      font-size: 16px; font-weight: 700; cursor: pointer;
      box-shadow: 0 8px 32px rgba(108,99,255,.4);
      transition: transform .15s, box-shadow .15s;
    }
    .search-btn:hover:not(:disabled) { transform: translateY(-1px); box-shadow: 0 12px 40px rgba(108,99,255,.5); }
    .search-btn:active:not(:disabled) { transform: translateY(1px); }
    .search-btn:disabled { opacity: .5; cursor: not-allowed; transform: none; }

    /* ── LOADING SCREEN ── */
    #screen-loading { background: var(--bg); align-items: center; justify-content: center; z-index: 20; }
    .loading-inner { text-align: center; max-width: 320px; padding: 40px 24px; }
    .loading-spinner {
      width: 72px; height: 72px; border-radius: 50%; margin: 0 auto 28px;
      background: conic-gradient(var(--accent) 0%, transparent 70%);
      animation: spin 1s linear infinite;
      display: flex; align-items: center; justify-content: center;
      position: relative;
    }
    .loading-spinner::after {
      content: ''; position: absolute; inset: 6px;
      border-radius: 50%; background: var(--bg);
    }
    .loading-title { font-size: 20px; font-weight: 700; margin-bottom: 8px; }
    .loading-sub { font-size: 13px; color: var(--subtext); line-height: 1.6; }
    .loading-steps { margin-top: 28px; display: flex; flex-direction: column; gap: 10px; }
    .loading-step {
      display: flex; align-items: center; gap: 12px;
      background: var(--surface); border-radius: 12px; padding: 12px 16px;
      font-size: 13px; transition: all .3s;
    }
    .loading-step.active { border: 1px solid var(--accent); color: var(--text); }
    .loading-step.done   { border: 1px solid var(--safe); color: var(--safe); }
    .loading-step.idle   { border: 1px solid var(--border); color: var(--subtext); }
    .step-icon { font-size: 18px; flex-shrink: 0; }

    /* ── RESULT SCREEN ── */
    #screen-result { z-index: 5; }
    #map-canvas { }

    .result-sheet {
      position: absolute; bottom: 0; left: 0; right: 0;
      background: var(--surface);
      border-radius: 28px 28px 0 0;
      max-height: 55vh;
      overflow-y: auto;
      z-index: 10;
      box-shadow: 0 -8px 40px rgba(0,0,0,.6);
    }
    .sheet-handle { width: 40px; height: 4px; background: var(--border); border-radius: 2px; margin: 12px auto 0; }
    .sheet-body { padding: 16px 20px 32px; }

    .route-badge {
      display: inline-flex; align-items: center; gap: 6px;
      border-radius: 8px; padding: 4px 12px; font-size: 12px; font-weight: 600;
      margin-bottom: 10px;
    }
    .badge-safe  { background: rgba(34,197,94,.15); color: var(--safe); border: 1px solid rgba(34,197,94,.3); }
    .badge-fast  { background: rgba(245,158,11,.15); color: var(--fast); border: 1px solid rgba(245,158,11,.3); }

    .route-title { font-size: 18px; font-weight: 700; margin-bottom: 4px; line-height: 1.3; }
    .route-meta { display: flex; gap: 16px; color: var(--subtext); font-size: 13px; margin-bottom: 14px; }
    .route-meta span { display: flex; align-items: center; gap: 4px; }

    .stats-row { display: flex; gap: 10px; margin-bottom: 14px; }
    .stat-chip {
      flex: 1; background: var(--surface2); border-radius: 12px; padding: 10px 12px;
      text-align: center;
    }
    .stat-chip .val { font-size: 18px; font-weight: 700; }
    .stat-chip .lbl { font-size: 10px; color: var(--subtext); text-transform: uppercase; letter-spacing: .5px; margin-top: 2px; }
    .stat-chip.green .val { color: var(--safe); }
    .stat-chip.amber .val { color: var(--fast); }
    .stat-chip.purple .val { color: var(--accent); }

    .agent-output {
      background: var(--surface2); border-radius: 14px; padding: 14px;
      font-size: 13px; line-height: 1.7; color: #cccce8;
      white-space: pre-wrap; max-height: 200px; overflow-y: auto;
      border: 1px solid var(--border);
    }

    .tool-chips { display: flex; flex-wrap: wrap; gap: 6px; margin-bottom: 12px; }
    .tool-chip {
      display: flex; align-items: center; gap: 5px;
      background: var(--surface2); border: 1px solid var(--border);
      border-radius: 8px; padding: 4px 10px; font-size: 11px; color: var(--subtext);
    }
    .tool-chip.active { border-color: var(--accent); color: var(--accent); }
    .tool-chip.done   { border-color: var(--safe);   color: var(--safe); }

    .nav-btn {
      width: 100%; padding: 16px; margin-top: 14px;
      border: none; border-radius: 14px; font-size: 15px; font-weight: 700;
      cursor: pointer; display: flex; align-items: center; justify-content: center; gap: 8px;
    }
    .nav-btn.primary { background: linear-gradient(135deg, var(--safe), #16a34a); color: white; }
    .nav-btn.secondary { background: var(--surface2); color: var(--text); border: 1px solid var(--border); }
    .back-btn {
      position: absolute; top: 56px; left: 20px; z-index: 20;
      width: 44px; height: 44px; background: var(--surface2);
      border: 1px solid var(--border); border-radius: 50%;
      display: flex; align-items: center; justify-content: center;
      cursor: pointer; backdrop-filter: blur(10px);
    }

    /* ── NAVIGATION SCREEN ── */
    #screen-nav { z-index: 5; }
    .nav-top-bar {
      position: absolute; top: 0; left: 0; right: 0; z-index: 20;
      padding: 52px 20px 16px;
      background: linear-gradient(180deg, rgba(10,10,15,.95) 70%, transparent);
    }
    .nav-instruction {
      background: var(--surface); border-radius: 16px; padding: 16px;
      display: flex; align-items: center; gap: 14px;
      border: 1px solid var(--border);
      box-shadow: 0 4px 20px rgba(0,0,0,.5);
    }
    .nav-arrow {
      width: 48px; height: 48px; border-radius: 12px; flex-shrink: 0;
      background: linear-gradient(135deg, var(--accent), var(--accent2));
      display: flex; align-items: center; justify-content: center;
    }
    .nav-arrow svg { width: 28px; height: 28px; }
    .nav-dist { font-size: 13px; color: var(--subtext); }
    .nav-street { font-size: 17px; font-weight: 700; line-height: 1.2; }

    .nav-bottom-bar {
      position: absolute; bottom: 0; left: 0; right: 0; z-index: 20;
      padding: 16px 20px 32px;
      background: linear-gradient(0deg, rgba(10,10,15,.98) 60%, transparent);
    }
    .nav-eta-row { display: flex; gap: 12px; margin-bottom: 14px; }
    .eta-chip {
      flex: 1; background: var(--surface); border: 1px solid var(--border);
      border-radius: 14px; padding: 12px; text-align: center;
    }
    .eta-val { font-size: 22px; font-weight: 800; }
    .eta-lbl { font-size: 11px; color: var(--subtext); text-transform: uppercase; letter-spacing: .5px; }
    .nav-safety-bar {
      background: var(--surface); border: 1px solid var(--border);
      border-radius: 14px; padding: 12px 16px;
      display: flex; align-items: center; gap: 12px;
      margin-bottom: 14px; font-size: 13px;
    }
    .safety-score-pill {
      display: flex; align-items: center; gap: 6px;
      background: rgba(34,197,94,.15); border: 1px solid rgba(34,197,94,.3);
      border-radius: 8px; padding: 4px 10px; color: var(--safe); font-weight: 700; font-size: 14px;
    }
    .stop-nav-btn {
      width: 100%; padding: 16px; background: var(--danger);
      border: none; border-radius: 14px; color: white;
      font-size: 15px; font-weight: 700; cursor: pointer;
    }

    /* ── SVG MAP PLACEHOLDER ── */
    .map-placeholder {
      position: absolute; inset: 0;
      background: #111122;
      overflow: hidden;
    }
    .map-grid {
      position: absolute; inset: 0;
      background-image:
        linear-gradient(rgba(108,99,255,.04) 1px, transparent 1px),
        linear-gradient(90deg, rgba(108,99,255,.04) 1px, transparent 1px);
      background-size: 40px 40px;
    }
    .map-route-line {
      position: absolute; top: 30%; left: 20%; right: 15%; bottom: 25%;
      border: 3px solid var(--accent);
      border-radius: 40px;
      box-shadow: 0 0 20px rgba(108,99,255,.5);
    }
    .map-route-line.safe-route {
      border-color: var(--safe);
      box-shadow: 0 0 20px rgba(34,197,94,.5);
    }
    .map-marker {
      position: absolute;
      width: 14px; height: 14px; border-radius: 50%; border: 3px solid white;
    }
    .map-marker.start  { background: var(--accent); top: 28%; left: 18%; }
    .map-marker.end    { background: var(--danger); bottom: 23%; right: 13%; }
    .map-street { position: absolute; background: #1e1e32; border-radius: 2px; }
    .map-label {
      position: absolute; font-size: 10px; color: #444466; font-weight: 500;
      letter-spacing: .3px;
    }
    .map-car {
      position: absolute;
      width: 28px; height: 28px;
      background: var(--accent);
      border-radius: 8px;
      display: flex; align-items: center; justify-content: center;
      border: 2px solid white;
      box-shadow: 0 0 16px rgba(108,99,255,.8);
      animation: carMove 3s ease-in-out infinite;
    }

    /* ── ANIMATIONS ── */
    @keyframes fadeSlideUp {
      from { opacity: 0; transform: translateY(20px); }
      to   { opacity: 1; transform: translateY(0); }
    }
    @keyframes pulse {
      0%, 100% { box-shadow: 0 0 40px rgba(108,99,255,.4); }
      50%       { box-shadow: 0 0 80px rgba(108,99,255,.7); }
    }
    @keyframes dotPulse {
      0%, 80%, 100% { background: var(--border); transform: scale(1); }
      40% { background: var(--accent); transform: scale(1.4); }
    }
    @keyframes spin { to { transform: rotate(360deg); } }
    @keyframes carMove {
      0%   { left: 20%; top: 45%; }
      33%  { left: 40%; top: 38%; }
      66%  { left: 60%; top: 50%; }
      100% { left: 20%; top: 45%; }
    }
    @keyframes shimmer {
      0%   { opacity: .6; }
      50%  { opacity: 1; }
      100% { opacity: .6; }
    }

    /* ── ALERTS ── */
    .alert-banner {
      display: flex; align-items: center; gap: 10px;
      background: rgba(245,158,11,.12); border: 1px solid rgba(245,158,11,.3);
      border-radius: 12px; padding: 12px 14px; margin-bottom: 12px; font-size: 13px;
    }
    .alert-banner.danger { background: rgba(239,68,68,.12); border-color: rgba(239,68,68,.3); color: #fca5a5; }
    .alert-banner.safe   { background: rgba(34,197,94,.12); border-color: rgba(34,197,94,.3); color: #86efac; }
  </style>
</head>
<body>

<!-- ───── SPLASH ───── -->
<div id="screen-splash" class="screen visible">
  <div class="splash-logo">
    <div class="splash-icon">
      <svg viewBox="0 0 52 52" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path d="M26 6C18.268 6 12 12.268 12 20C12 30 26 46 26 46C26 46 40 30 40 20C40 12.268 33.732 6 26 6Z" fill="white" fill-opacity=".9"/>
        <circle cx="26" cy="20" r="6" fill="rgba(108,99,255,1)"/>
      </svg>
    </div>
    <div class="splash-title">Smart<span>Ride</span></div>
    <div class="splash-sub">Rutas inteligentes para la CDMX</div>
    <div class="splash-dots">
      <span></span><span></span><span></span>
    </div>
  </div>
</div>

<!-- ───── INPUT ───── -->
<div id="screen-input" class="screen hidden">
  <div class="input-header">
    <div class="app-logo">
      <div class="icon">
        <svg viewBox="0 0 20 20" fill="none">
          <path d="M10 2C6.686 2 4 4.686 4 8C4 13 10 18 10 18C10 18 16 13 16 8C16 4.686 13.314 2 10 2Z" fill="white" fill-opacity=".9"/>
          <circle cx="10" cy="8" r="2.5" fill="rgba(108,99,255,1)"/>
        </svg>
      </div>
      <span class="name">SmartRide</span>
    </div>
    <div class="input-title">¿A dónde vas hoy?</div>
    <div class="input-subtitle">El agente encontrará tu ruta óptima</div>
  </div>

  <div class="input-body">
    <div class="location-card">
      <div class="location-row">
        <div class="loc-dot-wrap">
          <div class="loc-dot origin"></div>
          <div class="loc-line"></div>
        </div>
        <input class="loc-input" id="inp-origin" type="text" placeholder="¿Desde dónde sales?" value="Ángel de la Independencia, CDMX" />
      </div>
      <div class="location-row">
        <div class="loc-dot-wrap">
          <div class="loc-dot dest"></div>
        </div>
        <input class="loc-input" id="inp-dest" type="text" placeholder="¿A dónde vas?" value="Xochimilco, CDMX" />
      </div>
    </div>

    <div class="section-title">Prioridades del viaje</div>

    <div class="weights-grid">
      <div class="weight-item" id="wi-speed">
        <div class="weight-header">
          <div class="weight-label-row"><span>⚡</span> Rapidez</div>
          <div class="weight-value" id="wv-speed">5</div>
        </div>
        <div class="weight-bar-track">
          <div class="weight-bar-fill" id="wb-speed" style="width:50%"></div>
          <input type="range" class="weight-range" id="w-speed" min="0" max="10" value="5"
                 oninput="updateWeight('speed',this.value)" />
        </div>
      </div>
      <div class="weight-item" id="wi-safety">
        <div class="weight-header">
          <div class="weight-label-row"><span>🔒</span> Seguridad</div>
          <div class="weight-value" id="wv-safety">5</div>
        </div>
        <div class="weight-bar-track">
          <div class="weight-bar-fill" id="wb-safety" style="width:50%"></div>
          <input type="range" class="weight-range" id="w-safety" min="0" max="10" value="5"
                 oninput="updateWeight('safety',this.value)" />
        </div>
      </div>
      <div class="weight-item" id="wi-weather">
        <div class="weight-header">
          <div class="weight-label-row"><span>🌧</span> Clima</div>
          <div class="weight-value" id="wv-weather">5</div>
        </div>
        <div class="weight-bar-track">
          <div class="weight-bar-fill" id="wb-weather" style="width:50%"></div>
          <input type="range" class="weight-range" id="w-weather" min="0" max="10" value="5"
                 oninput="updateWeight('weather',this.value)" />
        </div>
      </div>
      <div class="weight-item" id="wi-cost">
        <div class="weight-header">
          <div class="weight-label-row"><span>💰</span> Costo</div>
          <div class="weight-value" id="wv-cost">5</div>
        </div>
        <div class="weight-bar-track">
          <div class="weight-bar-fill" id="wb-cost" style="width:50%"></div>
          <input type="range" class="weight-range" id="w-cost" min="0" max="10" value="5"
                 oninput="updateWeight('cost',this.value)" />
        </div>
      </div>
      <div class="weight-item" id="wi-access">
        <div class="weight-header">
          <div class="weight-label-row"><span>♿</span> Accesibilidad</div>
          <div class="weight-value" id="wv-access">5</div>
        </div>
        <div class="weight-bar-track">
          <div class="weight-bar-fill" id="wb-access" style="width:50%"></div>
          <input type="range" class="weight-range" id="w-access" min="0" max="10" value="5"
                 oninput="updateWeight('access',this.value)" />
        </div>
      </div>
    </div>

    <button class="search-btn" id="search-btn" onclick="buscarRuta()">
      Buscar ruta óptima
    </button>
  </div>
</div>

<!-- ───── LOADING ───── -->
<div id="screen-loading" class="screen hidden">
  <div class="loading-inner">
    <div class="loading-spinner"></div>
    <div class="loading-title">Analizando rutas</div>
    <div class="loading-sub">El agente está consultando condiciones en tiempo real</div>
    <div class="loading-steps" id="loading-steps">
      <div class="loading-step idle" id="step-routes"><span class="step-icon">🗺</span> Buscando rutas alternativas</div>
      <div class="loading-step idle" id="step-weather"><span class="step-icon">🌧</span> Consultando clima actual</div>
      <div class="loading-step idle" id="step-safety"><span class="step-icon">🔒</span> Evaluando seguridad por zona</div>
      <div class="loading-step idle" id="step-cost"><span class="step-icon">💰</span> Calculando costos</div>
      <div class="loading-step idle" id="step-access"><span class="step-icon">♿</span> Verificando accesibilidad</div>
    </div>
  </div>
</div>

<!-- ───── RESULT ───── -->
<div id="screen-result" class="screen hidden">
  <div class="map-placeholder" id="map-result">
    <div class="map-grid"></div>
    <!-- Streets -->
    <div class="map-street" style="left:0;right:0;top:45%;height:18px;background:#1e1e35;"></div>
    <div class="map-street" style="left:35%;top:0;bottom:0;width:14px;background:#1e1e35;"></div>
    <div class="map-street" style="left:0;right:0;top:60%;height:10px;background:#191928;"></div>
    <div class="map-label" style="left:10%;top:41%">Insurgentes Sur</div>
    <div class="map-label" style="left:37%;top:15%;transform:rotate(90deg)">Periférico</div>

    <div class="map-route-line safe-route" id="result-route-line"></div>
    <div class="map-marker start" id="result-marker-start"></div>
    <div class="map-marker end" id="result-marker-end"></div>
  </div>

  <button class="back-btn" onclick="showScreen('input')" title="Volver">
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none"><path d="M12 4L6 10L12 16" stroke="white" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/></svg>
  </button>

  <div class="result-sheet" id="result-sheet">
    <div class="sheet-handle"></div>
    <div class="sheet-body">
      <div id="result-badge" class="route-badge badge-safe">🛡 Ruta más segura</div>
      <div class="route-title" id="result-title">Calculando ruta óptima...</div>
      <div class="route-meta" id="result-meta">
        <span>⏱ -- min</span>
        <span>📍 -- km</span>
      </div>
      <div class="stats-row" id="stats-row">
        <div class="stat-chip green"><div class="val" id="stat-safety">--</div><div class="lbl">Seguridad</div></div>
        <div class="stat-chip amber"><div class="val" id="stat-time">--</div><div class="lbl">Tiempo</div></div>
        <div class="stat-chip purple"><div class="val" id="stat-cost">--</div><div class="lbl">Costo min</div></div>
      </div>
      <div class="tool-chips" id="tool-chips"></div>
      <div class="agent-output" id="agent-output">Consultando al agente...</div>
      <button class="nav-btn primary" onclick="startNavigation()">
        <svg width="18" height="18" viewBox="0 0 18 18" fill="none"><path d="M9 1L17 9L9 17M17 9H1" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>
        Iniciar navegación
      </button>
      <button class="nav-btn secondary" onclick="showScreen('input')" style="margin-top:8px;">
        Modificar ruta
      </button>
    </div>
  </div>
</div>

<!-- ───── NAVIGATION ───── -->
<div id="screen-nav" class="screen hidden">
  <div class="map-placeholder" id="map-nav">
    <div class="map-grid"></div>
    <div class="map-street" style="left:0;right:0;top:45%;height:22px;background:#1e1e35;"></div>
    <div class="map-street" style="left:30%;top:0;bottom:0;width:16px;background:#1e1e35;"></div>
    <div class="map-street" style="left:0;right:0;top:62%;height:10px;background:#191928;"></div>
    <div class="map-route-line safe-route"></div>
    <div class="map-marker end" style="bottom:22%;right:12%;"></div>
    <div class="map-car" id="nav-car">
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M2 11L3 5H13L14 11" stroke="white" stroke-width="1.5"/><rect x="1" y="11" width="14" height="3" rx="1.5" fill="white" fill-opacity=".8"/><circle cx="4.5" cy="14" r="1" fill="white"/><circle cx="11.5" cy="14" r="1" fill="white"/></svg>
    </div>
  </div>

  <div class="nav-top-bar">
    <div class="nav-instruction">
      <div class="nav-arrow">
        <svg viewBox="0 0 28 28" fill="none"><path d="M14 6V22M14 6L8 12M14 6L20 12" stroke="white" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/></svg>
      </div>
      <div>
        <div class="nav-dist" id="nav-dist-text">En 300 m</div>
        <div class="nav-street" id="nav-street-text">Continuar por Insurgentes Sur</div>
      </div>
    </div>
  </div>

  <div class="nav-bottom-bar">
    <div class="nav-eta-row">
      <div class="eta-chip">
        <div class="eta-val" id="nav-eta">--</div>
        <div class="eta-lbl">Min restantes</div>
      </div>
      <div class="eta-chip">
        <div class="eta-val" id="nav-dist">--</div>
        <div class="eta-lbl">Km restantes</div>
      </div>
      <div class="eta-chip" id="nav-arrival-chip">
        <div class="eta-val" id="nav-arrival">--</div>
        <div class="eta-lbl">Llegada est.</div>
      </div>
    </div>
    <div class="nav-safety-bar">
      <div class="safety-score-pill" id="nav-safety-pill">
        🛡 <span id="nav-safety-score">7</span>/10
      </div>
      <span style="color:var(--subtext);font-size:13px;" id="nav-safety-label">Zona segura — ruta validada</span>
    </div>
    <button class="stop-nav-btn" onclick="stopNavigation()">
      Detener navegación
    </button>
  </div>
</div>

<script>
  const sessionId = "s-" + Math.random().toString(36).slice(2, 9);
  let currentRoute = null;
  let navInterval  = null;
  let navEta       = 35;
  let navDist      = 12.4;

  // ── SCREEN SWITCHER ──
  function showScreen(id) {
    document.querySelectorAll(".screen").forEach(s => {
      s.classList.toggle("visible", s.id === "screen-" + id);
      s.classList.toggle("hidden",  s.id !== "screen-" + id);
    });
  }

  // ── SPLASH → INPUT ──
  window.addEventListener("load", () => {
    setTimeout(() => showScreen("input"), 2200);
  });

  // ── WEIGHT SLIDERS ──
  function updateWeight(name, val) {
    document.getElementById("wv-" + name).textContent = val;
    document.getElementById("wb-" + name).style.width = (val * 10) + "%";
  }

  // ── TOOL STEPS ──
  const TOOL_STEP_MAP = {
    get_routes:        "routes",
    get_weather:       "weather",
    get_safety_index:  "safety",
    get_transport_cost:"cost",
    get_accessibility: "access",
  };

  function markStep(toolName) {
    const key = TOOL_STEP_MAP[toolName];
    if (!key) return;
    // mark previous active as done
    document.querySelectorAll(".loading-step.active").forEach(el => {
      el.classList.remove("active"); el.classList.add("done");
    });
    const el = document.getElementById("step-" + key);
    if (el) { el.classList.remove("idle"); el.classList.add("active"); }
  }

  function allStepsDone() {
    document.querySelectorAll(".loading-step").forEach(el => {
      el.classList.remove("idle","active"); el.classList.add("done");
    });
  }

  // ── RESULT RENDERING ──
  function renderResult(text, tools) {
    // Strip ROUTE_DATA line
    const clean = text.replace(/\\nROUTE_DATA:.*$/s, "").trim();
    document.getElementById("agent-output").textContent = clean || "Ruta analizada.";

    // Detect if safest or fastest route from weights
    const safetyW = parseInt(document.getElementById("w-safety").value);
    const speedW  = parseInt(document.getElementById("w-speed").value);
    const isSafe  = safetyW >= speedW;

    const badge = document.getElementById("result-badge");
    if (isSafe) {
      badge.className = "route-badge badge-safe";
      badge.textContent = "🛡 Ruta más segura";
    } else {
      badge.className = "route-badge badge-fast";
      badge.textContent = "⚡ Ruta más rápida";
    }

    // Extract duration and distance from text
    const timeMatch = clean.match(/(\\d+)\\s*min/i);
    const distMatch = clean.match(/(\\d+\\.?\\d*)\\s*km/i);
    const costMatch = clean.match(/\\$\\s*(\\d+)|Metro[^\\d]*(\\d+)\\s*MXN/i);

    const mins = timeMatch ? timeMatch[1] : "--";
    const kms  = distMatch ? distMatch[1] : "--";

    document.getElementById("result-meta").innerHTML =
      "<span>⏱ " + mins + " min</span><span>📍 " + kms + " km</span>";

    document.getElementById("stat-time").textContent   = mins !== "--" ? mins + "m" : "--";
    document.getElementById("stat-safety").textContent = isSafe ? "Alto" : "Med";
    document.getElementById("stat-cost").textContent   = "\\$5";

    // Route line color
    document.getElementById("result-route-line").className =
      "map-route-line " + (isSafe ? "safe-route" : "");

    // Store for nav
    currentRoute = { mins, kms };
  }

  function addToolChip(toolName, state) {
    const labels = {
      get_routes:         "🗺 Rutas",
      get_weather:        "🌧 Clima",
      get_safety_index:   "🔒 Seguridad",
      get_transport_cost: "💰 Costo",
      get_accessibility:  "♿ Accesibilidad",
    };
    const chips = document.getElementById("tool-chips");
    const existing = document.getElementById("chip-" + toolName);
    if (existing) {
      existing.className = "tool-chip " + state;
      return;
    }
    const chip = document.createElement("div");
    chip.id = "chip-" + toolName;
    chip.className = "tool-chip " + state;
    chip.textContent = labels[toolName] ?? toolName;
    chips.appendChild(chip);
  }

  // ── MAIN FETCH ──
  async function buscarRuta() {
    const origin      = document.getElementById("inp-origin").value.trim();
    const destination = document.getElementById("inp-dest").value.trim();
    if (!origin || !destination) { alert("Ingresa origen y destino."); return; }

    document.getElementById("search-btn").disabled = true;

    // Reset loading steps
    document.querySelectorAll(".loading-step").forEach(el => {
      el.className = "loading-step idle";
    });
    document.getElementById("tool-chips").innerHTML = "";
    document.getElementById("agent-output").textContent = "Consultando al agente...";

    showScreen("loading");

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

    let fullText = "";

    try {
      const res = await fetch("/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const reader = res.body.getReader();
      const dec    = new TextDecoder();

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        for (const line of dec.decode(value).split("\\n")) {
          if (!line.trim()) continue;
          try {
            const evt = JSON.parse(line);
            if (evt.type === "token") {
              fullText += evt.text;
              // live-update output while on result screen
              const out = document.getElementById("agent-output");
              if (out) out.textContent = fullText.replace(/\\nROUTE_DATA:.*$/s, "").trim();
            } else if (evt.type === "tool") {
              markStep(evt.name);
              addToolChip(evt.name, "active");
              // mark all previous chips done
              document.querySelectorAll(".tool-chip:not(#chip-" + evt.name + ")").forEach(c => {
                if (c.className.includes("active")) { c.className = "tool-chip done"; }
              });
            } else if (evt.type === "route") {
              currentRoute = evt.route;
            } else if (evt.type === "done") {
              allStepsDone();
              document.querySelectorAll(".tool-chip").forEach(c => c.className = "tool-chip done");
              showScreen("result");
              renderResult(fullText, []);
            } else if (evt.type === "error") {
              allStepsDone();
              showScreen("result");
              document.getElementById("agent-output").textContent = "⚠️ " + evt.text;
            }
          } catch (_) {}
        }
      }

      // Fallback: if done event never came
      if (document.getElementById("screen-loading").classList.contains("visible")) {
        allStepsDone();
        showScreen("result");
        renderResult(fullText, []);
      }

    } catch (err) {
      allStepsDone();
      showScreen("result");
      document.getElementById("agent-output").textContent = "❌ Error de red: " + err.message;
    } finally {
      document.getElementById("search-btn").disabled = false;
    }
  }

  // ── NAVIGATION ──
  function startNavigation() {
    const mins = currentRoute?.mins ?? "35";
    const kms  = currentRoute?.kms  ?? "12.4";

    navEta  = parseInt(mins)  || 35;
    navDist = parseFloat(kms) || 12.4;

    document.getElementById("nav-eta").textContent    = navEta;
    document.getElementById("nav-dist").textContent   = navDist.toFixed(1);

    // ETA clock
    const now = new Date();
    now.setMinutes(now.getMinutes() + navEta);
    document.getElementById("nav-arrival").textContent =
      now.getHours().toString().padStart(2,"0") + ":" +
      now.getMinutes().toString().padStart(2,"0");

    const safetyW = parseInt(document.getElementById("w-safety").value);
    const scoreVal = safetyW >= 7 ? 8 : safetyW >= 5 ? 6 : 4;
    document.getElementById("nav-safety-score").textContent = scoreVal;
    document.getElementById("nav-safety-label").textContent =
      scoreVal >= 7 ? "Zona segura — ruta validada" :
      scoreVal >= 5 ? "Zona moderada — mantente alerta" :
                      "Zona con riesgo — preferir vialidades principales";

    showScreen("nav");

    // Simulate nav countdown
    navInterval = setInterval(() => {
      navEta  = Math.max(0, navEta - 1);
      navDist = Math.max(0, navDist - navDist / (navEta + 1));
      document.getElementById("nav-eta").textContent   = navEta;
      document.getElementById("nav-dist").textContent  = navDist.toFixed(1);

      // Cycle instructions
      const instructions = [
        ["En 300 m", "Continuar por Insurgentes Sur"],
        ["En 200 m", "Girar a la derecha en Tlalpan"],
        ["En 500 m", "Continuar recto"],
        ["En 100 m", "Mantener carril izquierdo"],
      ];
      const idx = Math.floor(Date.now() / 8000) % instructions.length;
      document.getElementById("nav-dist-text").textContent  = instructions[idx][0];
      document.getElementById("nav-street-text").textContent = instructions[idx][1];

      if (navEta === 0) { clearInterval(navInterval); }
    }, 3000);
  }

  function stopNavigation() {
    if (navInterval) clearInterval(navInterval);
    showScreen("result");
  }
</script>
</body>
</html>`;
