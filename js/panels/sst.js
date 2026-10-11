/* Panneau « Température de la mer » + couche des points de mesure + indicateurs clés. */
(function () {
  const MT = window.MT;

  // --- Indicateurs clés (bandeau supérieur) ------------------------------------
  MT.kpis = {};
  const KPI_ORDER = ['sst-mean', 'sst-max', 'sst-min', 'mhw', 'waves', 'wind'];
  MT.setKpi = function (id, kpi) {
    MT.kpis[id] = kpi;
    const box = document.getElementById('kpis');
    box.innerHTML = KPI_ORDER.filter((k) => MT.kpis[k]).map((k) => {
      const v = MT.kpis[k];
      return `<div class="kpi" ${v.color ? `style="--accent:${v.color}"` : ''}>
        <div class="kpi-label">${v.label}</div>
        <div class="kpi-value">${v.value}</div>
        <div class="kpi-sub">${v.sub || ''}</div>
      </div>`;
    }).join('');
  };

  // --- Couche des points de mesure ----------------------------------------------
  let stationsLayer = null;
  const markers = {};
  MT.buildStationsLayer = function () {
    stationsLayer = L.layerGroup();
    MT.stations.forEach((s) => {
      const m = L.circleMarker([s.lat, s.lon], {
        pane: 'stations', radius: 9, weight: 2, color: '#fff', fillOpacity: 0.95, fillColor: MT.sstColor(null)
      });
      m.on('click', () => MT.selectStation(s.id));
      m.bindTooltip('', { direction: 'top', offset: [0, -8] });
      markers[s.id] = m;
      stationsLayer.addLayer(m);
    });
    updateMarkers();
    return stationsLayer;
  };

  function updateMarkers() {
    MT.stations.forEach((s) => {
      const m = markers[s.id];
      if (!m) return;
      const sst = s.marine && s.marine.current ? s.marine.current.sea_surface_temperature : null;
      const hs = s.marine && s.marine.current ? s.marine.current.wave_height : null;
      const wind = s.weather && s.weather.current ? s.weather.current.wind_speed_10m : null;
      const sel = s.id === MT.selectedStation;
      m.setStyle({ fillColor: MT.sstColor(sst), color: sel ? '#0d1b2a' : '#fff', weight: sel ? 3 : 2 });
      m.setRadius(sel ? 12 : 9);
      m.setTooltipContent(
        `<b>${MT.escape(s.name)}</b><br>Eau : ${MT.num(sst)} °C · Vagues : ${MT.num(hs)} m · Vent : ${MT.num(wind, 0)} nds`
      );
    });
  }

  // --- Panneau -------------------------------------------------------------------
  const body = () => document.querySelector('#panel-sst .card-body');

  function init() {
    body().innerHTML = `
      <div class="split">
        <div class="table-scroll tall"><table class="table clickable" id="sst-table">
          <thead><tr><th>Point</th><th class="num">Eau (°C)</th><th class="num">Δ 3 j</th><th class="num">Max 7 j</th></tr></thead>
          <tbody></tbody>
        </table></div>
        <div>
          <div class="chart-title" id="sst-chart-title"></div>
          <div class="chart-box"><canvas id="sst-chart"></canvas></div>
          <p class="hint">Trait plein : 3 derniers jours (analyse) · pointillés : prévision 7 jours. Modèles Météo-France / ECMWF
            agrégés par Open-Meteo, précision limitée près des côtes.</p>
        </div>
      </div>`;
    document.getElementById('sst-table').addEventListener('click', (e) => {
      const tr = e.target.closest('tr[data-id]');
      if (tr) MT.selectStation(tr.dataset.id);
    });
  }

  function render() {
    const tbody = document.querySelector('#sst-table tbody');
    if (!tbody) return;
    let zone = null;
    tbody.innerHTML = MT.stations.map((s) => {
      const now = s.marine && s.marine.current ? s.marine.current.sea_surface_temperature : null;
      const past = MT.hourlyAt(s.marine, 'sea_surface_temperature', 72);
      const delta = now != null && past != null ? now - past : null;
      const future = s.marine && s.marine.hourly
        ? Math.max(...s.marine.hourly.sea_surface_temperature.filter((v, i) => v != null && new Date(s.marine.hourly.time[i]) > new Date()))
        : null;
      const head = s.zone !== zone ? `<tr class="group-row"><td colspan="4">${s.zone}</td></tr>` : '';
      zone = s.zone;
      return `${head}<tr data-id="${s.id}" class="${s.id === MT.selectedStation ? 'selected' : ''}">
        <td><span class="swatch round" style="background:${MT.sstColor(now)}"></span>${MT.escape(s.name)}</td>
        <td class="num strong">${MT.num(now)}</td>
        <td class="num ${delta > 0.05 ? 'up' : delta < -0.05 ? 'down' : ''}">${delta == null ? '—' : (delta > 0 ? '+' : '') + MT.num(delta)}</td>
        <td class="num">${Number.isFinite(future) ? MT.num(future) : '—'}</td>
      </tr>`;
    }).join('');
    renderChart();
    updateMarkers();
    updateKpis();
  }

  function renderChart() {
    const s = MT.station();
    document.getElementById('sst-chart-title').textContent = `${s.name} — température de surface (°C)`;
    if (!s.marine || !s.marine.hourly) return;
    const h = s.marine.hourly;
    const now = Date.now();
    const labels = h.time.map((t) => new Date(t));
    const past = h.sea_surface_temperature.map((v, i) => (labels[i].getTime() <= now ? v : null));
    const fut = h.sea_surface_temperature.map((v, i) => (labels[i].getTime() >= now - 3600e3 ? v : null));
    MT.chart('sst', document.getElementById('sst-chart'), {
      type: 'line',
      data: {
        labels: labels.map((d) => d.toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric' }) + ' ' + d.getHours() + 'h'),
        datasets: [
          { label: 'Observé / analysé', data: past, borderColor: '#1c7ed6', backgroundColor: 'rgba(28,126,214,.08)', fill: true, pointRadius: 0, tension: 0.3, spanGaps: true },
          { label: 'Prévision', data: fut, borderColor: '#1c7ed6', borderDash: [5, 4], pointRadius: 0, tension: 0.3, spanGaps: true }
        ]
      },
      options: {
        interaction: { mode: 'index', intersect: false },
        scales: { x: { ticks: { maxTicksLimit: 10, autoSkip: true } }, y: { title: { display: true, text: '°C' } } },
        plugins: { tooltip: { callbacks: { label: (c) => `${c.dataset.label} : ${MT.num(c.parsed.y)} °C` } } }
      }
    });
  }

  function updateKpis() {
    const withSst = MT.stations.filter((s) => s.marine && s.marine.current && s.marine.current.sea_surface_temperature != null);
    if (withSst.length) {
      const vals = withSst.map((s) => s.marine.current.sea_surface_temperature);
      const mean = MT.mean(vals);
      const max = withSst.reduce((a, b) => (b.marine.current.sea_surface_temperature > a.marine.current.sea_surface_temperature ? b : a));
      const min = withSst.reduce((a, b) => (b.marine.current.sea_surface_temperature < a.marine.current.sea_surface_temperature ? b : a));
      MT.setKpi('sst-mean', { label: 'Eau — moyenne façade', value: `${MT.num(mean)} °C`, sub: `${withSst.length} points`, color: MT.sstColor(mean) });
      MT.setKpi('sst-max', { label: 'Eau la plus chaude', value: `${MT.num(max.marine.current.sea_surface_temperature)} °C`, sub: max.name, color: MT.sstColor(max.marine.current.sea_surface_temperature) });
      MT.setKpi('sst-min', { label: 'Eau la plus froide', value: `${MT.num(min.marine.current.sea_surface_temperature)} °C`, sub: min.name, color: MT.sstColor(min.marine.current.sea_surface_temperature) });
    }
    const withWaves = MT.stations.filter((s) => s.marine && s.marine.current && s.marine.current.wave_height != null);
    if (withWaves.length) {
      const w = withWaves.reduce((a, b) => (b.marine.current.wave_height > a.marine.current.wave_height ? b : a));
      MT.setKpi('waves', { label: 'Vagues — maximum', value: `${MT.num(w.marine.current.wave_height)} m`, sub: w.name, color: '#1864ab' });
    }
    const withWind = MT.stations.filter((s) => s.weather && s.weather.current);
    if (withWind.length) {
      const w = withWind.reduce((a, b) => (b.weather.current.wind_gusts_10m > a.weather.current.wind_gusts_10m ? b : a));
      const c = w.weather.current;
      MT.setKpi('wind', {
        label: 'Rafales — maximum', value: `${MT.num(c.wind_gusts_10m, 0)} nds`,
        sub: `${w.name} · ${MT.compass(c.wind_direction_10m)} · force ${MT.beaufort(c.wind_speed_10m)}`, color: '#5f3dc4'
      });
    }
    document.getElementById('sst-tag').textContent = MT.lastUpdate ? `Open-Meteo · ${MT.fmtDateTimeFr(MT.lastUpdate)}` : 'Open-Meteo';
  }

  MT.on('init', init);
  MT.on('data', render);
  MT.on('station', render);
})();
