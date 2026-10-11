/*
 * Panneau « Faune & flore » : espèces emblématiques ou invasives de la façade.
 * GBIF (agrège notamment OBIS, INPN et iNaturalist) : nombre d'observations par an dans la zone + carte de densité.
 * iNaturalist : dernières observations avec photos.
 */
(function () {
  const MT = window.MT;
  const [W, S, E, N] = MT.config.bbox;
  const WKT = `POLYGON((${W} ${S},${E} ${S},${E} ${N},${W} ${N},${W} ${S}))`;
  const body = () => document.querySelector('#panel-biodiv .card-body');

  const SPECIES = [
    { group: 'Mammifères marins', fr: 'Grand dauphin', sci: 'Tursiops truncatus' },
    { group: 'Mammifères marins', fr: 'Dauphin bleu et blanc', sci: 'Stenella coeruleoalba' },
    { group: 'Mammifères marins', fr: 'Rorqual commun', sci: 'Balaenoptera physalus' },
    { group: 'Mammifères marins', fr: 'Cachalot', sci: 'Physeter macrocephalus' },
    { group: 'Reptiles', fr: 'Tortue caouanne', sci: 'Caretta caretta' },
    { group: 'Poissons', fr: 'Mérou brun', sci: 'Epinephelus marginatus' },
    { group: 'Poissons', fr: 'Requin peau-bleue', sci: 'Prionace glauca' },
    { group: 'Poissons', fr: 'Barracuda à bouche jaune', sci: 'Sphyraena viridensis' },
    { group: 'Invertébrés', fr: 'Grande nacre', sci: 'Pinna nobilis' },
    { group: 'Invertébrés', fr: 'Corail rouge', sci: 'Corallium rubrum' },
    { group: 'Invertébrés', fr: 'Méduse pélagique', sci: 'Pelagia noctiluca' },
    { group: 'Flore', fr: 'Posidonie', sci: 'Posidonia oceanica' },
    { group: 'Espèces invasives', fr: 'Crabe bleu', sci: 'Callinectes sapidus' },
    { group: 'Espèces invasives', fr: 'Poisson-lion', sci: 'Pterois miles' },
    { group: 'Espèces invasives', fr: 'Caulerpe', sci: 'Caulerpa cylindracea' },
    { group: 'Espèces invasives', fr: 'Poisson-lapin', sci: 'Siganus luridus' }
  ];

  let current = MT.store.get('species') || SPECIES[0].sci;
  let taxon = { gbif: null, inat: null };
  let mapLayer = null, tileLayer = null, inatMarkers = null;

  MT.status.define('gbif', { name: 'GBIF (occurrences)', category: 'Biodiversité', url: 'https://www.gbif.org/' });
  MT.status.define('inat', { name: 'iNaturalist (observations)', category: 'Biodiversité', url: 'https://www.inaturalist.org/' });

  function init() {
    const groups = [...new Set(SPECIES.map((s) => s.group))];
    body().innerHTML = `
      <div class="toolbar">
        <label for="bio-species">Espèce</label>
        <select id="bio-species">
          ${groups.map((g) => `<optgroup label="${g}">${SPECIES.filter((s) => s.group === g)
            .map((s) => `<option value="${s.sci}">${s.fr} (${s.sci})</option>`).join('')}</optgroup>`).join('')}
          <option value="__custom">Autre espèce…</option>
        </select>
        <input id="bio-custom" type="text" placeholder="Nom scientifique" hidden>
        <span class="muted" id="bio-total"></span>
      </div>
      <div class="split even">
        <div>
          <div class="chart-title">Observations par an dans la zone (GBIF)</div>
          <div class="chart-box"><canvas id="bio-years"></canvas></div>
          <p class="hint">Le nombre d’observations reflète aussi l’effort d’observation (essor des sciences participatives
            après 2015), pas seulement l’abondance de l’espèce.</p>
        </div>
        <div>
          <div class="chart-title">Dernières observations avec photo (iNaturalist)</div>
          <div class="inat-grid" id="bio-inat"></div>
        </div>
      </div>`;
    const sel = document.getElementById('bio-species');
    const custom = document.getElementById('bio-custom');
    if (!SPECIES.some((s) => s.sci === current)) {
      custom.hidden = false; custom.value = current; sel.value = '__custom';
    } else sel.value = current;
    sel.addEventListener('change', () => {
      custom.hidden = sel.value !== '__custom';
      if (sel.value !== '__custom') choose(sel.value); else custom.focus();
    });
    custom.addEventListener('change', () => custom.value.trim() && choose(custom.value.trim()));
    choose(current);
  }

  async function choose(sci) {
    current = sci;
    MT.store.set('species', sci);
    document.getElementById('bio-total').textContent = 'Recherche…';
    await Promise.all([loadGbif(sci), loadInat(sci)]);
  }

  async function loadGbif(sci) {
    MT.status.set('gbif', { state: 'pending' });
    try {
      const match = await MT.fetchJSON(`https://api.gbif.org/v1/species/match?name=${encodeURIComponent(sci)}`);
      if (!match.usageKey) throw new Error('espèce inconnue de GBIF');
      taxon.gbif = match.usageKey;
      const thisYear = new Date().getFullYear();
      const res = await MT.fetchJSON(
        `https://api.gbif.org/v1/occurrence/search?taxonKey=${match.usageKey}&geometry=${encodeURIComponent(WKT)}` +
        `&limit=0&facet=year&facetLimit=200&year=1980,${thisYear}`
      );
      if (sci !== current) return;
      const counts = {};
      ((res.facets && res.facets[0] && res.facets[0].counts) || []).forEach((c) => (counts[c.name] = c.count));
      const years = [];
      for (let y = 1980; y <= thisYear; y++) years.push(y);
      document.getElementById('bio-total').innerHTML =
        `<b>${res.count.toLocaleString('fr-FR')}</b> observations géolocalisées dans la zone · ` +
        `<a href="https://www.gbif.org/occurrence/search?taxon_key=${match.usageKey}&geometry=${encodeURIComponent(WKT)}" target="_blank" rel="noopener">voir sur GBIF</a>`;
      MT.chart('bio-years', document.getElementById('bio-years'), {
        type: 'bar',
        data: { labels: years, datasets: [{ label: 'Observations', data: years.map((y) => counts[y] || 0), backgroundColor: '#2b8a3e' }] },
        options: { plugins: { legend: { display: false } }, scales: { x: { ticks: { maxTicksLimit: 10 } }, y: { beginAtZero: true } } }
      });
      MT.status.set('gbif', { state: 'ok', message: `${sci} : ${res.count} occurrences` });
      updateTiles();
    } catch (e) {
      document.getElementById('bio-total').textContent = `GBIF : ${e.message}`;
      MT.status.set('gbif', { state: 'error', message: e.message });
    }
  }

  async function loadInat(sci) {
    const box = document.getElementById('bio-inat');
    box.innerHTML = '<p class="muted">Chargement…</p>';
    MT.status.set('inat', { state: 'pending' });
    try {
      const t = await MT.fetchJSON(`https://api.inaturalist.org/v1/taxa?q=${encodeURIComponent(sci)}&per_page=1&locale=fr`);
      if (!t.results || !t.results.length) throw new Error('espèce inconnue d’iNaturalist');
      taxon.inat = t.results[0].id;
      const obs = await MT.fetchJSON(
        `https://api.inaturalist.org/v1/observations?taxon_id=${taxon.inat}&swlat=${S}&swlng=${W}&nelat=${N}&nelng=${E}` +
        '&photos=true&order_by=observed_on&order=desc&per_page=12&locale=fr'
      );
      if (sci !== current) return;
      const items = obs.results || [];
      box.innerHTML = items.length
        ? items.map((o) => {
            const photo = o.photos && o.photos[0] ? o.photos[0].url.replace('square', 'small') : '';
            return `<a class="inat-card" href="${MT.escape(o.uri)}" target="_blank" rel="noopener">
              <img src="${MT.escape(photo)}" alt="" loading="lazy">
              <span>${o.observed_on ? MT.fmtDateFr(o.observed_on) : ''}<br><small>${MT.escape((o.place_guess || '').slice(0, 40))}</small></span>
            </a>`;
          }).join('')
        : '<p class="muted">Aucune observation avec photo dans la zone.</p>';
      updateInatMarkers(items);
      MT.status.set('inat', { state: 'ok', message: `${obs.total_results} observations dans la zone` });
    } catch (e) {
      box.innerHTML = `<p class="muted">iNaturalist : ${MT.escape(e.message)}</p>`;
      MT.status.set('inat', { state: 'error', message: e.message });
    }
  }

  // --- Couche cartographique -------------------------------------------------------
  function tileUrl() {
    return `https://api.gbif.org/v2/map/occurrence/density/{z}/{x}/{y}@1x.png?srs=EPSG:3857&style=classic.point&taxonKey=${taxon.gbif}`;
  }
  function updateTiles() {
    if (!mapLayer || !taxon.gbif) return;
    if (tileLayer) tileLayer.setUrl(tileUrl());
    else { tileLayer = L.tileLayer(tileUrl(), { pane: 'overlays', opacity: 0.9 }); mapLayer.addLayer(tileLayer); }
  }
  let lastInat = [];
  function updateInatMarkers(items) {
    lastInat = items;
    if (!inatMarkers) return;
    inatMarkers.clearLayers();
    items.filter((o) => o.geojson).forEach((o) => {
      const [lon, lat] = o.geojson.coordinates;
      L.circleMarker([lat, lon], { pane: 'vectors', radius: 6, color: '#fff', weight: 2, fillColor: '#2b8a3e', fillOpacity: 1 })
        .bindPopup(`<b>${MT.escape((o.taxon && (o.taxon.preferred_common_name || o.taxon.name)) || current)}</b><br>
          ${o.observed_on ? MT.fmtDateFr(o.observed_on) : ''}<br>${MT.escape(o.place_guess || '')}<br>
          <a href="${MT.escape(o.uri)}" target="_blank" rel="noopener">Voir l’observation</a>`)
        .addTo(inatMarkers);
    });
  }

  MT.biodiv = {
    createMapLayer() {
      mapLayer = L.layerGroup();
      inatMarkers = L.layerGroup().addTo(mapLayer);
      tileLayer = null;
      updateTiles();
      updateInatMarkers(lastInat);
      return mapLayer;
    }
  };

  MT.on('init', init);
})();
