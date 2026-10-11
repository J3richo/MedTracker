/*
 * Panneau « Trafic maritime ».
 * - Carte AIS intégrée de VesselFinder (gratuite, sans clé) dans le panneau.
 * - Optionnel : flux AIS en direct AISStream.io (clé gratuite) affiché sur la carte principale.
 */
(function () {
  const MT = window.MT;
  const body = () => document.querySelector('#panel-ais .card-body');
  const TYPES = [
    [[30, 30], 'Pêche', '#2b8a3e'], [[60, 69], 'Passagers', '#1c7ed6'], [[70, 79], 'Cargo', '#e67700'],
    [[80, 89], 'Pétrolier / chimiquier', '#c92a2a'], [[36, 37], 'Plaisance', '#ae3ec9'], [[31, 35], 'Remorquage / spécial', '#495057'],
    [[50, 59], 'Service (pilote, SAR…)', '#0b7285']
  ];
  const typeOf = (code) => TYPES.find(([r]) => code >= r[0] && code <= r[1]) || [null, 'Autre / inconnu', '#868e96'];

  let ws = null, layer = null, ships = {}, pruneTimer = null, retry = 0;

  function init() {
    const [w, s, e, n] = MT.config.bbox;
    const srcdoc = `<!doctype html><html><head><style>html,body{margin:0;height:100%}</style></head><body>
      <script>var width="100%";var height="100%";var latitude="${((s + n) / 2).toFixed(2)}";var longitude="${((w + e) / 2).toFixed(2)}";
      var zoom="7";var names=false;var show_track=false;</` + `script>
      <script src="https://www.vesselfinder.com/aismap.js"></` + `script></body></html>`;
    body().innerHTML = `
      <div class="ais-live" id="ais-live"></div>
      <div class="embed"><iframe title="Carte AIS VesselFinder" sandbox="allow-scripts allow-same-origin allow-popups" loading="lazy"></iframe></div>
      <p class="hint">Carte intégrée <a href="https://www.vesselfinder.com/" target="_blank" rel="noopener">VesselFinder</a>
        (couverture AIS terrestre, gratuite). Pour afficher les navires sur la carte principale, ajoutez une clé
        <a href="https://aisstream.io/" target="_blank" rel="noopener">AISStream</a> dans <code>js/config.js</code> et activez
        la couche « Navires en direct ». Les flux AIS publics ne couvrent pas tous les navires (militaires, petits bateaux…).</p>`;
    body().querySelector('iframe').srcdoc = srcdoc;
    MT.status.define('vesselfinder', { name: 'VesselFinder (carte intégrée)', category: 'Trafic', url: 'https://www.vesselfinder.com/', state: 'ok', message: 'carte intégrée (non vérifiable depuis la page)' });
    renderLive();
  }

  function renderLive() {
    const box = document.getElementById('ais-live');
    if (!box) return;
    const list = Object.values(ships);
    if (!MT.config.aisstreamKey) {
      box.innerHTML = '';
      document.getElementById('ais-tag').textContent = 'VesselFinder';
      return;
    }
    const counts = {};
    list.forEach((sh) => { const t = typeOf(sh.type)[1]; counts[t] = (counts[t] || 0) + 1; });
    document.getElementById('ais-tag').textContent = layer ? `${list.length} navires suivis` : 'AISStream inactif';
    box.innerHTML = layer
      ? `<div class="chips">${Object.entries(counts).sort((a, b) => b[1] - a[1]).map(([t, c]) =>
          `<span class="chip"><span class="swatch round" style="background:${(TYPES.find((x) => x[1] === t) || [0, 0, '#868e96'])[2]}"></span>${t} : ${c}</span>`).join('')}</div>`
      : '<p class="muted">Activez la couche « Navires en direct (AISStream) » pour suivre les navires sur la carte.</p>';
  }

  function shipIcon(sh) {
    const color = typeOf(sh.type)[2];
    const rot = sh.cog != null && sh.cog < 360 ? sh.cog : 0;
    return L.divIcon({
      className: 'ship-icon',
      iconSize: [14, 14],
      html: `<svg viewBox="0 0 14 14" width="14" height="14" style="transform:rotate(${rot}deg)"><path d="M7 1 L11 13 L7 10 L3 13 Z" fill="${color}" stroke="#fff" stroke-width="1"/></svg>`
    });
  }

  function upsert(mmsi, patch) {
    const sh = (ships[mmsi] = Object.assign(ships[mmsi] || { mmsi }, patch, { seen: Date.now() }));
    if (sh.lat == null) return;
    const popup = `<b>${MT.escape(sh.name || 'MMSI ' + mmsi)}</b><br>${typeOf(sh.type)[1]}<br>
      Vitesse : ${MT.num(sh.sog)} nds · Cap : ${sh.cog != null ? Math.round(sh.cog) + '°' : '—'}
      ${sh.dest ? `<br>Destination : ${MT.escape(sh.dest)}` : ''}<br>
      <a href="https://www.vesselfinder.com/vessels/details/${mmsi}" target="_blank" rel="noopener">Fiche navire</a>`;
    if (!sh.marker) {
      sh.marker = L.marker([sh.lat, sh.lon], { icon: shipIcon(sh), pane: 'vectors' }).bindPopup(popup);
      layer.addLayer(sh.marker);
    } else {
      sh.marker.setLatLng([sh.lat, sh.lon]).setIcon(shipIcon(sh)).setPopupContent(popup);
    }
  }

  function connect() {
    const [w, s, e, n] = MT.config.bbox;
    ws = new WebSocket('wss://stream.aisstream.io/v0/stream');
    MT.status.set('aisstream', { state: 'pending', message: 'connexion…' });
    ws.onopen = () => {
      retry = 0;
      ws.send(JSON.stringify({
        APIKey: MT.config.aisstreamKey,
        BoundingBoxes: [[[s, w], [n, e]]],
        FilterMessageTypes: ['PositionReport', 'ShipStaticData', 'StandardClassBPositionReport']
      }));
      MT.status.set('aisstream', { state: 'ok', message: 'connecté, en attente de messages…' });
    };
    ws.onmessage = async (evt) => {
      const raw = typeof evt.data === 'string' ? evt.data : await evt.data.text();
      const msg = JSON.parse(raw);
      if (msg.error) { MT.status.set('aisstream', { state: 'error', message: msg.error }); return; }
      const meta = msg.MetaData || {};
      const m = msg.Message || {};
      const mmsi = meta.MMSI;
      if (!mmsi || !layer) return;
      const name = (meta.ShipName || '').trim();
      if (m.PositionReport || m.StandardClassBPositionReport) {
        const p = m.PositionReport || m.StandardClassBPositionReport;
        upsert(mmsi, { lat: p.Latitude, lon: p.Longitude, sog: p.Sog, cog: p.TrueHeading < 360 ? p.TrueHeading : p.Cog, name: name || undefined });
      } else if (m.ShipStaticData) {
        const d = m.ShipStaticData;
        upsert(mmsi, { type: d.Type, dest: (d.Destination || '').trim(), name: (d.Name || name).trim() });
      }
      MT.status.set('aisstream', { state: 'ok', message: `${Object.keys(ships).length} navires reçus` });
    };
    ws.onerror = () => MT.status.set('aisstream', { state: 'error', message: 'connexion refusée (clé invalide, service indisponible ou navigateur non autorisé)' });
    ws.onclose = () => {
      if (!layer) return;
      retry++;
      if (retry <= 5) setTimeout(() => layer && connect(), 3000 * retry);
      else MT.status.set('aisstream', { state: 'error', message: 'connexion perdue après 5 tentatives' });
    };
  }

  MT.ais = {
    createLayer() {
      MT.status.define('aisstream', { name: 'AISStream (navires en direct)', category: 'Trafic', url: 'https://aisstream.io/' });
      if (!MT.config.aisstreamKey) throw new Error('clé AISStream absente : voir js/config.js');
      layer = L.layerGroup();
      ships = {};
      connect();
      // Retire les navires silencieux depuis plus de 30 minutes.
      pruneTimer = setInterval(() => {
        const limit = Date.now() - 30 * 60e3;
        Object.values(ships).forEach((sh) => {
          if (sh.seen < limit) { if (sh.marker) layer.removeLayer(sh.marker); delete ships[sh.mmsi]; }
        });
        renderLive();
      }, 15e3);
      renderLive();
      return layer;
    },
    stop() {
      layer = null;
      clearInterval(pruneTimer);
      if (ws) { ws.onclose = null; ws.close(); ws = null; }
      ships = {};
      MT.status.set('aisstream', { state: 'idle', message: 'couche désactivée' });
      renderLive();
    }
  };

  MT.on('init', init);
})();
