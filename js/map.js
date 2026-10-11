/* Carte Leaflet, fonds de carte et gestionnaire de couches (panneau, temps, état, repli). */
(function () {
  const MT = window.MT;

  // --- Carte ---------------------------------------------------------------
  MT.initMap = function () {
    const map = (MT.map = L.map('map', {
      center: [42.65, 6.1],
      zoom: 7,
      minZoom: 4,
      maxZoom: 16,
      zoomControl: false,
      worldCopyJump: true
    }));
    L.control.zoom({ position: 'topright' }).addTo(map);
    L.control.scale({ imperial: false, position: 'bottomright' }).addTo(map);

    const geopf = (layer, fmt) =>
      'https://data.geopf.fr/wmts?SERVICE=WMTS&REQUEST=GetTile&VERSION=1.0.0&STYLE=normal&TILEMATRIXSET=PM' +
      `&LAYER=${layer}&FORMAT=${fmt}&TILEMATRIX={z}&TILEROW={y}&TILECOL={x}`;

    const bases = {
      'Clair (CARTO)': L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', {
        subdomains: 'abcd', maxZoom: 19,
        attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> © <a href="https://carto.com/">CARTO</a>'
      }),
      'OpenStreetMap': L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 19, attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
      }),
      'Plan IGN': L.tileLayer(geopf('GEOGRAPHICALGRIDSYSTEMS.PLANIGNV2', 'image/png'), {
        maxZoom: 19, attribution: '© <a href="https://geoservices.ign.fr/">IGN</a>'
      }),
      'Cartes littorales (SHOM/IGN)': L.tileLayer(geopf('GEOGRAPHICALGRIDSYSTEMS.COASTALMAPS', 'image/png'), {
        maxZoom: 16, attribution: '© SHOM / IGN'
      }),
      'Photographies aériennes (IGN)': L.tileLayer(geopf('ORTHOIMAGERY.ORTHOPHOTOS', 'image/jpeg'), {
        maxZoom: 19, attribution: '© IGN'
      })
    };
    const savedBase = MT.store.get('base');
    (bases[savedBase] || bases['Clair (CARTO)']).addTo(map);
    L.control.layers(bases, null, { position: 'topright' }).addTo(map);
    map.on('baselayerchange', (e) => MT.store.set('base', e.name));

    // Panes pour garder un ordre d'empilement stable.
    [['rasters', 300], ['overlays', 410], ['vectors', 420], ['stations', 650]].forEach(([n, z]) => {
      map.createPane(n).style.zIndex = z;
    });
    map.getPane('vectors').style.pointerEvents = 'auto';
    return map;
  };

  // --- Lecture des GetCapabilities (pour trouver les identifiants de couches) ----
  const capsCache = {};
  MT.getCapabilities = function (url) {
    if (!capsCache[url]) {
      capsCache[url] = MT.fetchText(url, { timeout: 40000 }).then((xml) => {
        const doc = new DOMParser().parseFromString(xml, 'text/xml');
        const out = [];
        for (const layer of doc.getElementsByTagName('*')) {
          if (layer.localName !== 'Layer') continue;
          let name = null, title = null;
          for (const c of layer.children) {
            if (c.localName === 'Name' || c.localName === 'Identifier') name = c.textContent.trim();
            if (c.localName === 'Title') title = c.textContent.trim();
          }
          if (name) out.push({ name, title: title || '' });
        }
        return out;
      });
    }
    return capsCache[url];
  };

  // Renvoie le dernier identifiant (souvent la version la plus récente) qui correspond.
  MT.resolveLayerName = async function (capsUrl, regex, fallback) {
    try {
      const layers = await MT.getCapabilities(capsUrl);
      const hits = layers.filter((l) => regex.test(l.name) || regex.test(l.title)).map((l) => l.name).sort();
      return hits.length ? { name: hits[hits.length - 1], resolved: true } : { name: fallback, resolved: false, why: 'aucune couche correspondante' };
    } catch (e) {
      return { name: fallback, resolved: false, why: e.message };
    }
  };

  // --- Gestion du temps -------------------------------------------------------
  MT.selectedDate = MT.today();
  MT.layerDate = function (def) {
    if (def.time === 'gibs') return MT.minIso(MT.selectedDate, MT.addDays(MT.today(), -1));
    if (def.time === 'cmems') return MT.minIso(MT.selectedDate, MT.addDays(MT.today(), 9));
    return MT.selectedDate;
  };
  function timeParam(def) {
    const d = MT.layerDate(def);
    if (def.time === 'cmems') return `${d}T${def.timeOfDay || '00:00:00'}.000Z`;
    return d;
  }

  // --- Gestionnaire de couches ---------------------------------------------------
  MT.layerDefs = [];
  MT.groups = [];
  MT.addGroup = (id, name) => MT.groups.push({ id, name });
  MT.addLayer = function (def) {
    def.opacity = def.opacity == null ? 0.8 : def.opacity;
    MT.layerDefs.push(def);
    MT.status.define('layer:' + def.id, {
      name: def.name, category: 'Carte · ' + (MT.groups.find((g) => g.id === def.group) || {}).name,
      url: def.source && def.source.url
    });
  };

  // Construit l'objet Leaflet correspondant à une définition (éventuellement l'alternative).
  async function build(def, variant) {
    const d = variant || def;
    const pane = d.pane || (d.type === 'factory' ? 'vectors' : 'overlays');
    if (d.type === 'xyz') {
      return L.tileLayer(d.url.replace('{time}', timeParam(def)), Object.assign({ pane, opacity: def.opacity }, d.options));
    }
    if (d.type === 'wms') {
      const params = Object.assign({ format: 'image/png', transparent: true, version: '1.1.1', pane, opacity: def.opacity }, d.params);
      if (d.resolve) {
        const r = await MT.resolveLayerName(d.resolve.caps, d.resolve.match, d.params.layers);
        params.layers = r.name;
        def.resolvedNote = r.resolved ? `couche « ${r.name} »` : `identifiant par défaut « ${r.name} » (${r.why})`;
      }
      if (def.time) params.time = timeParam(def);
      return L.tileLayer.wms(d.url, Object.assign(params, d.options));
    }
    if (d.type === 'cmems') {
      const caps = `https://wmts.marine.copernicus.eu/teroWmts/${d.product}?SERVICE=WMTS&REQUEST=GetCapabilities&VERSION=1.0.0`;
      const r = await MT.resolveLayerName(caps, d.match, d.fallback);
      def.cmemsLayer = r.name;
      def.resolvedNote = r.resolved ? `couche « ${r.name} »` : `identifiant par défaut « ${r.name} » (${r.why})`;
      const url = () =>
        'https://wmts.marine.copernicus.eu/teroWmts?SERVICE=WMTS&REQUEST=GetTile&VERSION=1.0.0' +
        `&LAYER=${encodeURIComponent(r.name)}&STYLE=${encodeURIComponent(d.style || '')}` +
        '&TILEMATRIXSET=EPSG:3857&TILEMATRIX={z}&TILEROW={y}&TILECOL={x}&FORMAT=image/png' +
        `&TIME=${encodeURIComponent(timeParam(def))}`;
      def.legendUrl =
        'https://wmts.marine.copernicus.eu/teroWmts?SERVICE=WMTS&REQUEST=GetLegend&VERSION=1.0.0' +
        `&LAYER=${encodeURIComponent(r.name)}&STYLE=${encodeURIComponent(d.style || '')}&FORMAT=image/png`;
      const layer = L.tileLayer(url(), { pane, opacity: def.opacity, maxNativeZoom: 10, maxZoom: 16 });
      layer._mtUrl = url;
      return layer;
    }
    if (d.type === 'factory') return d.create(def);
    throw new Error('type de couche inconnu');
  }

  function track(def, layer) {
    def.loads = 0;
    def.errors = 0;
    if (!layer.on || !(layer instanceof L.GridLayer)) return;
    layer.on('tileload', () => { def.loads++; report(def); });
    layer.on('tileerror', () => { def.errors++; report(def); });
  }

  function report(def) {
    const note = def.resolvedNote ? ` — ${def.resolvedNote}` : '';
    const alt = def.usingAlt ? ' (source de secours)' : '';
    if (def.loads > 0) {
      MT.status.set('layer:' + def.id, {
        state: def.errors > def.loads ? 'partial' : 'ok',
        message: `${def.loads} tuiles chargées${def.errors ? `, ${def.errors} en erreur` : ''}${alt}${note}`
      });
    } else if (def.errors >= 4) {
      if (def.alt && !def.usingAlt) {
        def.usingAlt = true;
        MT.status.set('layer:' + def.id, { state: 'pending', message: 'source principale en échec, essai de la source de secours…' });
        refresh(def);
        return;
      }
      MT.status.set('layer:' + def.id, { state: 'error', message: `aucune tuile chargée (${def.errors} erreurs)${alt}${note}` });
    }
    updateDot(def);
  }

  // Met à jour la pastille d'état sans reconstruire la ligne (évite de casser un curseur en cours d'usage).
  function updateDot(def) {
    const dot = document.querySelector(`.layer-row[data-id="${def.id}"] .dot`);
    const st = MT.status.get('layer:' + def.id) || {};
    if (dot) { dot.className = `dot ${st.state || 'idle'}`; dot.title = st.message || ''; }
  }

  async function enable(def) {
    if (def.layer) return;
    MT.status.set('layer:' + def.id, { state: 'pending', message: 'chargement…' });
    try {
      const layer = await build(def, def.usingAlt ? def.alt : null);
      if (!def.active) return; // désactivée entre-temps
      def.layer = layer;
      track(def, layer);
      layer.addTo(MT.map);
      if (!(layer instanceof L.GridLayer)) {
        MT.status.set('layer:' + def.id, { state: 'ok', message: def.statusMessage || 'chargée' });
      }
    } catch (e) {
      MT.status.set('layer:' + def.id, { state: 'error', message: e.message });
    }
    renderRow(def);
  }

  function disable(def) {
    if (def.layer) {
      MT.map.removeLayer(def.layer);
      if (def.onRemove) def.onRemove(def);
    }
    def.layer = null;
    renderRow(def);
  }

  function refresh(def) {
    disable(def);
    if (def.active) enable(def);
  }

  MT.setLayerActive = function (id, active) {
    const def = MT.layerDefs.find((d) => d.id === id);
    if (!def) return;
    def.active = active;
    active ? enable(def) : disable(def);
    saveState();
  };
  MT.refreshLayer = (id) => {
    const def = MT.layerDefs.find((d) => d.id === id);
    if (def) refresh(def);
  };

  // Changement de date : on met à jour uniquement les couches temporelles.
  MT.on('date', () => {
    MT.layerDefs.filter((d) => d.time && d.layer).forEach((def) => {
      def.loads = 0; def.errors = 0;
      if (def.layer._mtUrl) def.layer.setUrl(def.layer._mtUrl());
      else if (def.layer.setParams) def.layer.setParams({ time: timeParam(def) });
      else if (def.layer.setUrl) def.layer.setUrl((def.usingAlt ? def.alt : def).url.replace('{time}', timeParam(def)));
    });
    updateDateBadge();
  });

  function updateDateBadge() {
    const active = MT.layerDefs.filter((d) => d.time && d.active);
    const badge = document.getElementById('map-date-badge');
    if (!active.length) { badge.hidden = true; return; }
    badge.hidden = false;
    badge.innerHTML = active.map((d) => `<div><b>${MT.escape(d.short || d.name)}</b> : ${MT.fmtDateFr(MT.layerDate(d))}</div>`).join('');
  }

  // --- Persistance ------------------------------------------------------------------
  function saveState() {
    MT.store.set('layers', MT.layerDefs.reduce((acc, d) => ((acc[d.id] = { a: !!d.active, o: d.opacity }), acc), {}));
    updateDateBadge();
  }

  // --- Panneau des couches ---------------------------------------------------------
  function rowHtml(def) {
    const st = MT.status.get('layer:' + def.id) || {};
    const legend = def.legendUrl || def.legendHtml;
    return `
      <div class="layer-row ${def.active ? 'on' : ''}" data-id="${def.id}">
        <label class="layer-main">
          <input type="checkbox" ${def.active ? 'checked' : ''}>
          <span class="layer-name">${MT.escape(def.name)}</span>
          ${def.active ? `<span class="dot ${st.state || 'idle'}" title="${MT.escape(st.message || '')}"></span>` : ''}
        </label>
        <button class="btn icon small info" aria-label="Informations">i</button>
        <div class="layer-extra" ${def.showInfo ? '' : 'hidden'}>
          <p>${def.desc || ''}</p>
          ${def.source ? `<p class="muted">Source : <a href="${MT.escape(def.source.url)}" target="_blank" rel="noopener">${MT.escape(def.source.name)}</a>${def.source.licence ? ` · ${MT.escape(def.source.licence)}` : ''}</p>` : ''}
        </div>
        ${def.active && def.type !== 'factory' ? `
          <div class="layer-opacity"><input type="range" min="0.1" max="1" step="0.05" value="${def.opacity}" aria-label="Opacité"></div>` : ''}
        ${def.active && legend ? `<div class="layer-legend">${def.legendHtml || `<img src="${MT.escape(def.legendUrl)}" alt="Légende" onerror="this.parentNode.hidden=true">`}</div>` : ''}
      </div>`;
  }

  function renderRow(def) {
    const old = document.querySelector(`.layer-row[data-id="${def.id}"]`);
    if (old) old.replaceWith(MT.el(rowHtml(def)));
  }

  MT.renderLayerPanel = function () {
    const list = document.getElementById('layer-list');
    list.innerHTML = MT.groups.map((g) => `
      <details class="layer-group" open>
        <summary>${MT.escape(g.name)}</summary>
        ${MT.layerDefs.filter((d) => d.group === g.id).map(rowHtml).join('')}
      </details>`).join('');

    list.addEventListener('change', (e) => {
      const row = e.target.closest('.layer-row');
      if (row && e.target.type === 'checkbox') MT.setLayerActive(row.dataset.id, e.target.checked);
    });
    list.addEventListener('input', (e) => {
      const row = e.target.closest('.layer-row');
      if (!row || e.target.type !== 'range') return;
      const def = MT.layerDefs.find((d) => d.id === row.dataset.id);
      def.opacity = Number(e.target.value);
      if (def.layer && def.layer.setOpacity) def.layer.setOpacity(def.opacity);
      saveState();
    });
    list.addEventListener('click', (e) => {
      if (!e.target.classList.contains('info')) return;
      const def = MT.layerDefs.find((d) => d.id === e.target.closest('.layer-row').dataset.id);
      def.showInfo = !def.showInfo;
      renderRow(def);
    });

    const panel = document.getElementById('layer-panel');
    document.getElementById('layer-panel-toggle').addEventListener('click', (e) => {
      panel.classList.toggle('collapsed');
      e.target.textContent = panel.classList.contains('collapsed') ? '+' : '–';
    });
    L.DomEvent.disableScrollPropagation(panel);
    L.DomEvent.disableClickPropagation(panel);
  };

  MT.activateInitialLayers = function () {
    const saved = MT.store.get('layers') || {};
    MT.layerDefs.forEach((d) => {
      if (saved[d.id]) { d.active = saved[d.id].a; d.opacity = saved[d.id].o; } else d.active = !!d.default;
    });
    MT.renderLayerPanel();
    MT.layerDefs.filter((d) => d.active).forEach(enable);
    updateDateBadge();
  };
})();
