/*
 * Panneau « Évolution long terme & vagues de chaleur marines ».
 * Historique horaire de température de surface (Open-Meteo, réanalyse ERA5-Ocean puis modèles récents),
 * agrégé en moyennes journalières, climatologie de référence et détection des vagues de chaleur
 * selon la méthode de Hobday et al. (2016) : au moins 5 jours au-dessus du 90e centile saisonnier.
 */
(function () {
  const MT = window.MT;
  const body = () => document.querySelector('#panel-climate .card-body');
  const START_YEAR = MT.config.climatologyStart;
  const CLIM_END = MT.config.climatologyEnd;
  const CATEGORIES = ['', 'modérée', 'forte', 'sévère', 'extrême'];
  const CAT_COLORS = ['', '#f59f00', '#e8590c', '#c92a2a', '#5c0f1f'];

  function init() {
    body().innerHTML = `
      <div class="toolbar">
        <span id="clim-station"></span>
        <button class="btn primary" id="clim-load">Analyser l’historique depuis ${START_YEAR}</button>
        <span class="muted" id="clim-msg"></span>
      </div>
      <div id="clim-content" hidden>
        <div class="mhw-banner" id="mhw-banner"></div>
        <div class="split even">
          <div>
            <div class="chart-title">12 derniers mois vs normale (${START_YEAR}–${CLIM_END})</div>
            <div class="chart-box"><canvas id="clim-year"></canvas></div>
          </div>
          <div>
            <div class="chart-title">Température moyenne annuelle et tendance</div>
            <div class="chart-box"><canvas id="clim-trend"></canvas></div>
          </div>
        </div>
        <p class="hint">Méthode : moyennes journalières, normale et 90<sup>e</sup> centile calculés pour chaque jour de l’année
          (fenêtre de ±5 jours) sur ${START_YEAR}–${CLIM_END}. Vague de chaleur marine = au moins 5 jours consécutifs
          au-dessus du 90<sup>e</sup> centile (Hobday et al., 2016). Données de réanalyse à résolution modérée : ordre de
          grandeur fiable, valeurs locales indicatives. Les années incomplètes sont exclues de la tendance.</p>
      </div>`;
    document.getElementById('clim-load').addEventListener('click', () => analyse(true));
    showStation();
  }

  function showStation() {
    const s = MT.station();
    document.getElementById('clim-station').innerHTML = `Point : <b>${MT.escape(s.name)}</b>`;
    const cached = MT.store.get('hist:' + s.id);
    if (cached && cached.until >= MT.addDays(MT.today(), -7)) analyse(false);
    else {
      document.getElementById('clim-content').hidden = true;
      document.getElementById('clim-msg').textContent = 'Téléchargement d’environ 5 Mo, quelques secondes.';
    }
  }

  // Télécharge (ou relit en cache) les moyennes journalières du point choisi.
  async function getDaily(s, force) {
    const cached = MT.store.get('hist:' + s.id);
    if (cached && !force && cached.until >= MT.addDays(MT.today(), -7)) return cached;
    const end = MT.addDays(MT.today(), -1);
    const base =
      'https://marine-api.open-meteo.com/v1/marine?' +
      `latitude=${s.lat}&longitude=${s.lon}&hourly=sea_surface_temperature&timeformat=unixtime&cell_selection=sea` +
      `&start_date=${START_YEAR}-01-01&end_date=${end}`;
    let json;
    try {
      json = await MT.fetchJSON(base, { timeout: 90000 });
    } catch (e) {
      // Certaines configurations exigent de préciser explicitement la réanalyse.
      json = await MT.fetchJSON(base + '&models=era5_ocean', { timeout: 90000 });
    }
    const t = json.hourly.time, v = json.hourly.sea_surface_temperature;
    const sums = {};
    for (let i = 0; i < t.length; i++) {
      if (v[i] == null) continue;
      const day = MT.isoDate(new Date(t[i] * 1000));
      const a = (sums[day] = sums[day] || [0, 0]);
      a[0] += v[i]; a[1]++;
    }
    const days = Object.keys(sums).sort();
    const out = { until: end, start: days[0], days, values: days.map((d) => Math.round((sums[d][0] / sums[d][1]) * 100) / 100) };
    MT.store.set('hist:' + s.id, out);
    return out;
  }

  const doy = (iso) => {
    const d = new Date(iso + 'T12:00:00');
    const start = new Date(d.getFullYear(), 0, 1, 12);
    return Math.min(365, Math.round((d - start) / 864e5) + 1); // 29 février fusionné avec le 1er mars
  };

  function climatology(hist) {
    const byDoy = Array.from({ length: 367 }, () => []);
    hist.days.forEach((d, i) => {
      const y = +d.slice(0, 4);
      if (y < START_YEAR || y > CLIM_END) return;
      const k = doy(d);
      for (let w = -5; w <= 5; w++) byDoy[((k + w - 1 + 365) % 365) + 1].push(hist.values[i]);
    });
    const mean = [], p90 = [];
    for (let k = 1; k <= 365; k++) { mean[k] = MT.mean(byDoy[k]); p90[k] = MT.percentile(byDoy[k], 0.9); }
    return { mean, p90 };
  }

  // Détecte les épisodes (≥ 5 jours au-dessus du 90e centile) et leur catégorie.
  function detectMhw(hist, clim) {
    const flags = hist.days.map((d, i) => {
      const k = doy(d);
      return clim.p90[k] != null && hist.values[i] > clim.p90[k];
    });
    const events = [];
    let start = null;
    for (let i = 0; i <= flags.length; i++) {
      if (flags[i] && start == null) start = i;
      if (!flags[i] && start != null) {
        if (i - start >= 5) events.push({ start, end: i - 1 });
        start = null;
      }
    }
    events.forEach((ev) => {
      let peak = 0, peakCat = 1;
      for (let i = ev.start; i <= ev.end; i++) {
        const k = doy(hist.days[i]);
        const anom = hist.values[i] - clim.mean[k];
        const cat = Math.min(4, Math.max(1, Math.floor(anom / (clim.p90[k] - clim.mean[k]))));
        if (anom > peak) { peak = anom; peakCat = cat; }
      }
      ev.peak = peak; ev.category = peakCat; ev.days = ev.end - ev.start + 1;
    });
    return { flags, events };
  }

  async function analyse(force) {
    const s = MT.station();
    const btn = document.getElementById('clim-load');
    const msg = document.getElementById('clim-msg');
    btn.disabled = true;
    msg.textContent = 'Chargement de l’historique…';
    MT.status.set('openmeteo-history', { state: 'pending' });
    try {
      const hist = await getDaily(s, force);
      if (s.id !== MT.selectedStation) return;
      if (+hist.start.slice(0, 4) > CLIM_END - 10) throw new Error(`historique trop court (début ${hist.start})`);
      const clim = climatology(hist);
      const mhw = detectMhw(hist, clim);
      MT.status.set('openmeteo-history', { state: 'ok', message: `${s.name} : ${hist.days.length} jours depuis ${hist.start}` });
      msg.textContent = `Historique du ${MT.fmtDateFr(hist.start)} au ${MT.fmtDateFr(hist.until)}.`;
      document.getElementById('clim-content').hidden = false;
      renderBanner(s, hist, clim, mhw);
      renderYear(hist, clim, mhw);
      renderTrend(hist);
    } catch (e) {
      msg.textContent = `Échec : ${e.message}`;
      MT.status.set('openmeteo-history', { state: 'error', message: e.message });
    } finally {
      btn.disabled = false;
      btn.textContent = 'Recharger l’historique';
    }
  }

  function renderBanner(s, hist, clim, mhw) {
    const last = hist.days.length - 1;
    const k = doy(hist.days[last]);
    const anom = hist.values[last] - clim.mean[k];
    const ongoing = mhw.events.find((ev) => ev.end === last);
    const yearAgo = MT.addDays(MT.today(), -365);
    const recent = mhw.events.filter((ev) => hist.days[ev.start] >= yearAgo);
    const daysInMhw = recent.reduce((a, ev) => a + ev.days, 0);

    document.getElementById('mhw-banner').innerHTML = `
      <div class="mhw-cell ${ongoing ? 'alert' : ''}" ${ongoing ? `style="--accent:${CAT_COLORS[ongoing.category]}"` : ''}>
        <span class="wx-label">Situation au ${MT.fmtDateFr(hist.days[last])}</span>
        <span class="wx-value">${ongoing ? `Vague de chaleur ${CATEGORIES[ongoing.category]}` : 'Pas de vague de chaleur'}</span>
        <span class="wx-sub">${ongoing ? `depuis ${ongoing.days} jours` : 'selon le seuil du 90<sup>e</sup> centile'}</span>
      </div>
      <div class="mhw-cell">
        <span class="wx-label">Anomalie du jour</span>
        <span class="wx-value ${anom > 0 ? 'up' : 'down'}">${anom > 0 ? '+' : ''}${MT.num(anom)} °C</span>
        <span class="wx-sub">${MT.num(hist.values[last])} °C pour une normale de ${MT.num(clim.mean[k])} °C</span>
      </div>
      <div class="mhw-cell">
        <span class="wx-label">12 derniers mois</span>
        <span class="wx-value">${daysInMhw} jours</span>
        <span class="wx-sub">en vague de chaleur (${recent.length} épisode${recent.length > 1 ? 's' : ''})</span>
      </div>`;

    document.getElementById('climate-tag').textContent = s.name;
    MT.setKpi('mhw', {
      label: `Anomalie — ${s.name}`,
      value: `${anom > 0 ? '+' : ''}${MT.num(anom)} °C`,
      sub: ongoing ? `Vague de chaleur ${CATEGORIES[ongoing.category]} (${ongoing.days} j)` : 'Pas de vague de chaleur',
      color: ongoing ? CAT_COLORS[ongoing.category] : anom > 0 ? '#e8590c' : '#1c7ed6'
    });
  }

  function renderYear(hist, clim, mhw) {
    const from = Math.max(0, hist.days.length - 365);
    const days = hist.days.slice(from);
    const vals = hist.values.slice(from);
    const mean = days.map((d) => clim.mean[doy(d)]);
    const p90 = days.map((d) => clim.p90[doy(d)]);
    const inMhw = days.map((d, i) => (mhw.flags[from + i] && mhw.events.some((ev) => from + i >= ev.start && from + i <= ev.end) ? vals[i] : null));
    MT.chart('clim-year', document.getElementById('clim-year'), {
      type: 'line',
      data: {
        labels: days.map((d) => new Date(d + 'T12:00:00').toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })),
        datasets: [
          { label: 'Vague de chaleur', data: inMhw, borderColor: 'transparent', backgroundColor: 'rgba(232,85,61,.45)', fill: { target: 2 }, pointRadius: 0, spanGaps: false },
          { label: 'Température', data: vals, borderColor: '#1c7ed6', pointRadius: 0, borderWidth: 1.5, tension: 0.2 },
          { label: '90e centile', data: p90, borderColor: '#e8590c', borderDash: [4, 3], pointRadius: 0, borderWidth: 1 },
          { label: 'Normale', data: mean, borderColor: '#868e96', pointRadius: 0, borderWidth: 1 }
        ]
      },
      options: {
        interaction: { mode: 'index', intersect: false },
        scales: { x: { ticks: { maxTicksLimit: 12 } }, y: { title: { display: true, text: '°C' } } },
        plugins: { tooltip: { filter: (i) => i.datasetIndex !== 0, callbacks: { label: (c) => `${c.dataset.label} : ${MT.num(c.parsed.y)} °C` } } }
      }
    });
  }

  function renderTrend(hist) {
    const byYear = {};
    hist.days.forEach((d, i) => {
      const y = +d.slice(0, 4);
      (byYear[y] = byYear[y] || []).push(hist.values[i]);
    });
    const years = Object.keys(byYear).map(Number).filter((y) => byYear[y].length >= 360).sort();
    const means = years.map((y) => MT.mean(byYear[y]));
    const tr = MT.linearTrend(years, means);
    const fit = tr ? years.map((y) => tr.intercept + tr.slope * y) : [];
    MT.chart('clim-trend', document.getElementById('clim-trend'), {
      data: {
        labels: years,
        datasets: [
          { type: 'bar', label: 'Moyenne annuelle', data: means, backgroundColor: means.map((m) => MT.sstColor(m)) },
          { type: 'line', label: tr ? `Tendance : ${tr.slope > 0 ? '+' : ''}${MT.num(tr.slope * 10, 2)} °C / décennie` : 'Tendance', data: fit, borderColor: '#212529', borderWidth: 2, pointRadius: 0 }
        ]
      },
      options: {
        scales: {
          y: { min: Math.floor(Math.min(...means) - 0.5), max: Math.ceil(Math.max(...means) + 0.5), title: { display: true, text: '°C' } },
          x: { ticks: { maxTicksLimit: 12 } }
        },
        plugins: { tooltip: { callbacks: { label: (c) => `${c.dataset.label.split(':')[0]} : ${MT.num(c.parsed.y, 2)} °C` } } }
      }
    });
  }

  MT.on('init', init);
  MT.on('station', showStation);
})();
