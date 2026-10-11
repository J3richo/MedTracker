/* Panneau « Météo marine » : vent et vagues par point, prévision 7 jours du point choisi. */
(function () {
  const MT = window.MT;
  const body = () => document.querySelector('#panel-weather .card-body');

  function init() {
    body().innerHTML = `
      <div class="station-pick">
        <label for="wx-station">Point</label>
        <select id="wx-station">${MT.stations.map((s) => `<option value="${s.id}">${MT.escape(s.name)}</option>`).join('')}</select>
      </div>
      <div class="wx-now" id="wx-now"></div>
      <div class="chart-box"><canvas id="wx-chart"></canvas></div>
      <details class="more">
        <summary>Tous les points</summary>
        <div class="table-scroll"><table class="table clickable" id="wx-table">
          <thead><tr><th>Point</th><th class="num">Vent</th><th class="num">Rafales</th><th class="num">Vagues</th></tr></thead>
          <tbody></tbody>
        </table></div>
      </details>
      <p class="hint">Vent en nœuds (direction d’origine, flèche = sens de déplacement). Pour la navigation, consultez
        les bulletins officiels de Météo-France.</p>`;
    document.getElementById('wx-station').addEventListener('change', (e) => MT.selectStation(e.target.value));
    document.getElementById('wx-table').addEventListener('click', (e) => {
      const tr = e.target.closest('tr[data-id]');
      if (tr) MT.selectStation(tr.dataset.id);
    });
  }

  function render() {
    const s = MT.station();
    document.getElementById('wx-station').value = s.id;
    const w = s.weather && s.weather.current;
    const m = s.marine && s.marine.current;
    document.getElementById('wx-now').innerHTML = `
      <div class="wx-cell"><span class="wx-label">Vent</span>
        <span class="wx-value">${w ? `${MT.arrow(w.wind_direction_10m)} ${MT.num(w.wind_speed_10m, 0)} nds` : '—'}</span>
        <span class="wx-sub">${w ? `${MT.compass(w.wind_direction_10m)} · force ${MT.beaufort(w.wind_speed_10m)} · rafales ${MT.num(w.wind_gusts_10m, 0)}` : ''}</span></div>
      <div class="wx-cell"><span class="wx-label">Vagues</span>
        <span class="wx-value">${m ? `${MT.arrow(m.wave_direction)} ${MT.num(m.wave_height)} m` : '—'}</span>
        <span class="wx-sub">${m ? `${MT.compass(m.wave_direction)} · période ${MT.num(m.wave_period)} s · houle ${MT.num(m.swell_wave_height)} m` : ''}</span></div>
      <div class="wx-cell"><span class="wx-label">Air</span>
        <span class="wx-value">${w ? `${MT.num(w.temperature_2m)} °C` : '—'}</span>
        <span class="wx-sub">${w ? MT.weatherLabel(w.weather_code) : ''}</span></div>`;

    document.querySelector('#wx-table tbody').innerHTML = MT.stations.map((st) => {
      const ww = st.weather && st.weather.current, mm = st.marine && st.marine.current;
      return `<tr data-id="${st.id}" class="${st.id === s.id ? 'selected' : ''}">
        <td>${MT.escape(st.name)}</td>
        <td class="num">${ww ? `${MT.arrow(ww.wind_direction_10m)} ${MT.num(ww.wind_speed_10m, 0)}` : '—'}</td>
        <td class="num">${ww ? MT.num(ww.wind_gusts_10m, 0) : '—'}</td>
        <td class="num">${mm ? MT.num(mm.wave_height) + ' m' : '—'}</td></tr>`;
    }).join('');

    renderChart(s);
  }

  function renderChart(s) {
    if (!s.weather || !s.weather.hourly) return;
    const now = Date.now() - 3600e3;
    const wh = s.weather.hourly;
    const idx = wh.time.map((t, i) => [new Date(t), i]).filter(([d]) => d.getTime() >= now);
    // Aligne les vagues (série marine) sur les heures de la série météo.
    const waveByTime = {};
    if (s.marine && s.marine.hourly) s.marine.hourly.time.forEach((t, i) => (waveByTime[t] = s.marine.hourly.wave_height[i]));
    MT.chart('wx', document.getElementById('wx-chart'), {
      data: {
        labels: idx.map(([d]) => d.toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric' }) + ' ' + d.getHours() + 'h'),
        datasets: [
          { type: 'line', label: 'Vent (nds)', data: idx.map(([, i]) => wh.wind_speed_10m[i]), borderColor: '#5f3dc4', pointRadius: 0, tension: 0.3, yAxisID: 'y' },
          { type: 'line', label: 'Rafales (nds)', data: idx.map(([, i]) => wh.wind_gusts_10m[i]), borderColor: '#b197fc', borderDash: [4, 3], pointRadius: 0, tension: 0.3, yAxisID: 'y' },
          { type: 'bar', label: 'Vagues (m)', data: idx.map(([, i]) => waveByTime[wh.time[i]]), backgroundColor: 'rgba(24,100,171,.35)', yAxisID: 'y2', barPercentage: 1, categoryPercentage: 1 }
        ]
      },
      options: {
        interaction: { mode: 'index', intersect: false },
        scales: {
          x: { ticks: { maxTicksLimit: 8 } },
          y: { position: 'left', title: { display: true, text: 'nœuds' }, beginAtZero: true },
          y2: { position: 'right', title: { display: true, text: 'm' }, beginAtZero: true, grid: { display: false } }
        }
      }
    });
  }

  MT.on('init', init);
  MT.on('data', render);
  MT.on('station', render);
})();
