/* Utilitaires communs : configuration, requêtes, dates, formats, événements. */
(function () {
  const MT = (window.MT = window.MT || {});

  MT.config = Object.assign({}, window.MEDTRACKER_DEFAULTS || {}, window.MEDTRACKER_CONFIG || {});

  // --- Petit bus d'événements -------------------------------------------
  const listeners = {};
  MT.on = (evt, fn) => (listeners[evt] = listeners[evt] || []).push(fn);
  MT.emit = (evt, payload) => (listeners[evt] || []).forEach((fn) => {
    try { fn(payload); } catch (e) { console.error(`[${evt}]`, e); }
  });

  // --- Requêtes ------------------------------------------------------------
  MT.fetchText = async function (url, { timeout = 25000 } = {}) {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), timeout);
    try {
      const res = await fetch(url, { signal: ctrl.signal });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return await res.text();
    } catch (e) {
      if (e.name === 'AbortError') throw new Error('délai dépassé');
      // Un échec réseau sans statut est presque toujours un blocage CORS.
      if (e instanceof TypeError) throw new Error('inaccessible (réseau ou CORS)');
      throw e;
    } finally {
      clearTimeout(t);
    }
  };

  MT.fetchJSON = async function (url, opts) {
    const text = await MT.fetchText(url, opts);
    const json = JSON.parse(text);
    if (json && json.error && json.reason) throw new Error(json.reason);
    return json;
  };

  // Tente chaque relais CORS configuré jusqu'à obtenir une réponse.
  MT.fetchViaProxy = async function (url, opts) {
    let lastErr;
    for (const p of MT.config.corsProxies || []) {
      try {
        return await MT.fetchText(p.replace('{url}', encodeURIComponent(url)), opts);
      } catch (e) {
        lastErr = e;
      }
    }
    throw lastErr || new Error('aucun relais CORS configuré');
  };

  // --- Dates ---------------------------------------------------------------
  MT.isoDate = (d) => {
    const z = (n) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${z(d.getMonth() + 1)}-${z(d.getDate())}`;
  };
  MT.addDays = (iso, n) => {
    const d = new Date(iso + 'T12:00:00');
    d.setDate(d.getDate() + n);
    return MT.isoDate(d);
  };
  MT.today = () => MT.isoDate(new Date());
  MT.minIso = (a, b) => (a < b ? a : b);

  MT.fmtDateFr = (iso) =>
    new Date(iso + (iso.length === 10 ? 'T12:00:00' : '')).toLocaleDateString('fr-FR', {
      day: 'numeric', month: 'short', year: 'numeric'
    });
  MT.fmtDateTimeFr = (d) =>
    new Date(d).toLocaleString('fr-FR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
  MT.timeAgo = (d) => {
    const s = (Date.now() - new Date(d).getTime()) / 1000;
    if (s < 3600) return `il y a ${Math.max(1, Math.round(s / 60))} min`;
    if (s < 86400) return `il y a ${Math.round(s / 3600)} h`;
    return `il y a ${Math.round(s / 86400)} j`;
  };

  // --- Formats ---------------------------------------------------------------
  MT.num = (v, digits = 1) => (v == null || Number.isNaN(v) ? '—' : Number(v).toFixed(digits).replace('.', ','));
  const DIRS = ['N', 'NNE', 'NE', 'ENE', 'E', 'ESE', 'SE', 'SSE', 'S', 'SSO', 'SO', 'OSO', 'O', 'ONO', 'NO', 'NNO'];
  MT.compass = (deg) => (deg == null ? '—' : DIRS[Math.round(deg / 22.5) % 16]);
  // Flèche indiquant la direction VERS laquelle va le vent/la houle (direction d'origine + 180°).
  MT.arrow = (deg) =>
    deg == null ? '' : `<span class="arrow" style="transform:rotate(${deg + 180}deg)" aria-hidden="true">↑</span>`;
  MT.beaufort = (kn) => {
    const lim = [1, 4, 7, 11, 17, 22, 28, 34, 41, 48, 56, 64];
    let b = 0;
    while (b < lim.length && kn >= lim[b]) b++;
    return b;
  };
  MT.escape = (s) =>
    String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  // Échelle de couleur de la température de surface (°C).
  MT.sstColor = (t) => {
    if (t == null) return '#9aa5b1';
    const stops = [
      [10, '#2c3e94'], [13, '#2f6fbf'], [16, '#36a3c9'], [19, '#3fbf9b'],
      [22, '#a6d854'], [24, '#f2c94c'], [26, '#f2994a'], [28, '#e8553d'], [30, '#a3172c']
    ];
    for (let i = 0; i < stops.length; i++) if (t <= stops[i][0]) return stops[i][1];
    return stops[stops.length - 1][1];
  };

  // --- Statistiques ------------------------------------------------------------
  MT.mean = (arr) => {
    const v = arr.filter((x) => x != null && !Number.isNaN(x));
    return v.length ? v.reduce((a, b) => a + b, 0) / v.length : null;
  };
  MT.percentile = (arr, p) => {
    const v = arr.filter((x) => x != null && !Number.isNaN(x)).sort((a, b) => a - b);
    if (!v.length) return null;
    const idx = (v.length - 1) * p;
    const lo = Math.floor(idx), hi = Math.ceil(idx);
    return v[lo] + (v[hi] - v[lo]) * (idx - lo);
  };
  MT.linearTrend = (xs, ys) => {
    const pts = xs.map((x, i) => [x, ys[i]]).filter((p) => p[1] != null);
    const n = pts.length;
    if (n < 3) return null;
    const mx = pts.reduce((a, p) => a + p[0], 0) / n;
    const my = pts.reduce((a, p) => a + p[1], 0) / n;
    let num = 0, den = 0;
    pts.forEach(([x, y]) => { num += (x - mx) * (y - my); den += (x - mx) ** 2; });
    const slope = num / den;
    return { slope, intercept: my - slope * mx };
  };

  // --- Stockage local tolérant (navigation privée, quotas…) ----------------------
  MT.store = {
    get(key) {
      try { return JSON.parse(localStorage.getItem('medtracker:' + key)); } catch (e) { return null; }
    },
    set(key, val) {
      try { localStorage.setItem('medtracker:' + key, JSON.stringify(val)); } catch (e) { /* quota */ }
    }
  };

  // --- Graphiques -----------------------------------------------------------------
  MT.charts = {};
  MT.chart = function (id, canvas, config) {
    if (MT.charts[id]) MT.charts[id].destroy();
    if (!window.Chart) return null;
    MT.charts[id] = new Chart(canvas, config);
    return MT.charts[id];
  };
  if (window.Chart) {
    Chart.defaults.font.family = getComputedStyle(document.documentElement).getPropertyValue('--font') || 'system-ui';
    Chart.defaults.color = '#51606f';
    Chart.defaults.borderColor = 'rgba(20, 40, 60, 0.08)';
    Chart.defaults.plugins.legend.labels.boxWidth = 12;
    Chart.defaults.maintainAspectRatio = false;
  }

  MT.el = function (html) {
    const t = document.createElement('template');
    t.innerHTML = html.trim();
    return t.content.firstElementChild;
  };
})();
