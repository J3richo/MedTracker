/* Catalogue des couches cartographiques. Chaque entrée documente sa source. */
(function () {
  const MT = window.MT;
  const [W, S, E, N] = MT.config.bbox;

  const GIBS_WMS = 'https://gibs.earthdata.nasa.gov/wms/epsg3857/best/wms.cgi';
  const EMODNET_HA = 'https://ows.emodnet-humanactivities.eu/wms';
  const EMODNET_HA_CAPS = EMODNET_HA + '?SERVICE=WMS&REQUEST=GetCapabilities&VERSION=1.1.1';
  const EMODNET_SH = 'https://ows.emodnet-seabedhabitats.eu/geoserver/emodnet_view/wms';
  const GEOPF_WMTS = (layer) =>
    'https://data.geopf.fr/wmts?SERVICE=WMTS&REQUEST=GetTile&VERSION=1.0.0&STYLE=normal&TILEMATRIXSET=PM' +
    `&LAYER=${layer}&FORMAT=image/png&TILEMATRIX={z}&TILEROW={y}&TILECOL={x}`;
  const GEOPF_WMSV = 'https://data.geopf.fr/wms-v/ows';
  const CEREMA_WMS = 'https://geolittoral-data.cerema.fr/server/services/flux_ogc/Geolittoral_WMS/MapServer/WMSServer';

  const SRC = {
    openmeteo: { name: 'Open-Meteo', url: 'https://open-meteo.com/', licence: 'CC BY 4.0' },
    gibs: { name: 'NASA GIBS / Worldview', url: 'https://www.earthdata.nasa.gov/engage/open-data-services-software/earthdata-developer-portal/gibs-api', licence: 'Données ouvertes NASA' },
    cmems: { name: 'Copernicus Marine (MED-MFC)', url: 'https://marine.copernicus.eu/fr/a-propos/producteurs/med-mfc', licence: 'Licence Copernicus Marine (libre, citation requise)' },
    emodnet: { name: 'EMODnet Human Activities', url: 'https://emodnet.ec.europa.eu/en/human-activities', licence: 'CC BY 4.0' },
    emodnetSh: { name: 'EMODnet Seabed Habitats', url: 'https://emodnet.ec.europa.eu/en/seabed-habitats', licence: 'CC BY 4.0' },
    geopf: { name: 'IGN Géoplateforme (données INPN / MNHN)', url: 'https://cartes.gouv.fr/', licence: 'Licence Ouverte Etalab 2.0' },
    cerema: { name: 'Cerema — Géolittoral', url: 'https://www.geolittoral.developpement-durable.gouv.fr/indicateur-national-de-l-erosion-cotiere-a1510.html', licence: 'Licence Ouverte Etalab 2.0' },
    cables: { name: 'Worldwide Submarine Cables (ArcGIS, d’après TeleGeography)', url: 'https://services.arcgis.com/6DIQcwlPy8knb6sg/ArcGIS/rest/services/SubmarineCables/FeatureServer', licence: 'Usage non commercial — tracés schématiques' },
    openseamap: { name: 'OpenSeaMap', url: 'https://openseamap.org/', licence: 'CC BY-SA 2.0' }
  };

  MT.addGroup('ocean', 'Océan & température');
  MT.addGroup('meteo', 'Vagues & météo');
  MT.addGroup('traffic', 'Trafic maritime');
  MT.addGroup('protect', 'Zones protégées');
  MT.addGroup('infra', 'Câbles & installations offshore');
  MT.addGroup('biodiv', 'Faune & flore');
  MT.addGroup('coast', 'Trait de côte');

  // ---------------------------------------------------------------- Océan
  MT.addLayer({
    id: 'stations', group: 'ocean', name: 'Points de mesure (température, vagues, vent)', type: 'factory', default: true,
    desc: '19 points au large des côtes françaises. Cliquez sur un point pour l’analyser dans les panneaux. Couleur = température de surface actuelle.',
    source: SRC.openmeteo,
    create: () => MT.buildStationsLayer(),
    statusMessage: `${MT.stations.length} points`
  });

  MT.addLayer({
    id: 'gibs-sst', group: 'ocean', name: 'Température de surface — satellite (MUR)', short: 'SST satellite',
    type: 'wms', url: GIBS_WMS, time: 'gibs', opacity: 0.75,
    params: { layers: 'GHRSST_L4_MUR_Sea_Surface_Temperature' },
    desc: 'Analyse quotidienne multi-satellites GHRSST MUR (~1 km). Disponible depuis 2002, avec ~1 jour de décalage. Utilisez le sélecteur de date pour remonter le temps.',
    source: SRC.gibs,
    legendHtml: legendGradient(['#2c3e94', '#36a3c9', '#a6d854', '#f2c94c', '#e8553d', '#a3172c'], 'froid', 'chaud')
  });

  MT.addLayer({
    id: 'gibs-ssta', group: 'ocean', name: 'Anomalie de température — satellite', short: 'Anomalie SST', default: true,
    type: 'wms', url: GIBS_WMS, time: 'gibs', opacity: 0.7,
    params: { layers: 'GHRSST_L4_MUR_Sea_Surface_Temperature_Anomalies' },
    alt: { type: 'wms', url: GIBS_WMS, params: { layers: 'GHRSST_L4_MUR_Sea_Surface_Temperature_Anomalies_v4.1_STD' } },
    desc: 'Écart à la normale saisonnière (climatologie MUR). Rouge = plus chaud que d’habitude : repère visuel des vagues de chaleur marines.',
    source: SRC.gibs,
    legendHtml: legendGradient(['#2166ac', '#92c5de', '#f7f7f7', '#f4a582', '#b2182b'], 'plus froid', 'plus chaud')
  });

  MT.addLayer({
    id: 'cmems-temp', group: 'ocean', name: 'Température — modèle Copernicus (prévision J+9)', short: 'Température modèle',
    type: 'cmems', product: 'MEDSEA_ANALYSISFORECAST_PHY_006_013', time: 'cmems', opacity: 0.75,
    match: /phy-tem_anfc.*P1D-m.*\/thetao$/,
    fallback: 'MEDSEA_ANALYSISFORECAST_PHY_006_013/cmems_mod_med_phy-tem_anfc_4.2km_P1D-m_202511/thetao',
    style: 'cmap:thermal',
    desc: 'Modèle d’analyse et de prévision de la Méditerranée (moyenne journalière, surface, 4,2 km). Accepte une date future jusqu’à J+9.',
    source: SRC.cmems
  });

  MT.addLayer({
    id: 'cmems-cur', group: 'ocean', name: 'Courants de surface — Copernicus', short: 'Courants',
    type: 'cmems', product: 'MEDSEA_ANALYSISFORECAST_PHY_006_013', time: 'cmems', opacity: 0.8,
    match: /phy-cur_anfc.*P1D-m.*\/sea_water_velocity$/,
    fallback: 'MEDSEA_ANALYSISFORECAST_PHY_006_013/cmems_mod_med_phy-cur_anfc_4.2km_P1D-m_202511/sea_water_velocity',
    style: '',
    desc: 'Vitesse des courants de surface (moyenne journalière) : courant Liguro-Provençal, tourbillons du golfe du Lion…',
    source: SRC.cmems
  });

  MT.addLayer({
    id: 'cmems-chl', group: 'ocean', name: 'Chlorophylle — Copernicus', short: 'Chlorophylle',
    type: 'cmems', product: 'MEDSEA_ANALYSISFORECAST_BGC_006_014', time: 'cmems', opacity: 0.8,
    match: /bgc-pft_anfc.*P1D-m.*\/chl$/,
    fallback: 'MEDSEA_ANALYSISFORECAST_BGC_006_014/cmems_mod_med_bgc-pft_anfc_4.2km_P1D-m_202411/chl',
    style: 'cmap:algae,logScale',
    desc: 'Concentration en chlorophylle (indicateur du phytoplancton et des panaches du Rhône).',
    source: SRC.cmems
  });

  MT.addLayer({
    id: 'gibs-truecolor', group: 'ocean', name: 'Image satellite du jour (VIIRS)', short: 'Image satellite',
    type: 'wms', url: GIBS_WMS, time: 'gibs', opacity: 1, pane: 'rasters',
    params: { layers: 'VIIRS_SNPP_CorrectedReflectance_TrueColor', format: 'image/jpeg', transparent: false },
    alt: { type: 'wms', url: GIBS_WMS, params: { layers: 'MODIS_Terra_CorrectedReflectance_TrueColor', format: 'image/jpeg', transparent: false } },
    desc: 'Vue « couleurs naturelles » quotidienne : nuages, panaches turbides, efflorescences planctoniques.',
    source: SRC.gibs
  });

  // ---------------------------------------------------------------- Vagues & météo
  MT.addLayer({
    id: 'cmems-waves', group: 'meteo', name: 'Hauteur des vagues — Copernicus', short: 'Vagues',
    type: 'cmems', product: 'MEDSEA_ANALYSISFORECAST_WAV_006_017', time: 'cmems', timeOfDay: '12:00:00', opacity: 0.75,
    match: /wav_anfc.*PT1H-i.*\/VHM0$/,
    fallback: 'MEDSEA_ANALYSISFORECAST_WAV_006_017/cmems_mod_med_wav_anfc_4.2km_PT1H-i_202411/VHM0',
    style: '',
    desc: 'Hauteur significative des vagues (houle + mer du vent) à midi UTC du jour choisi, modèle méditerranéen.',
    source: SRC.cmems
  });

  // ---------------------------------------------------------------- Trafic
  MT.addLayer({
    id: 'ais-live', group: 'traffic', name: 'Navires en direct (AISStream)', type: 'factory',
    desc: 'Positions AIS en temps réel. Nécessite une clé gratuite aisstream.io dans js/config.js (voir README).',
    source: { name: 'AISStream.io', url: 'https://aisstream.io/', licence: 'Gratuit, clé requise' },
    create: () => MT.ais.createLayer(),
    onRemove: () => MT.ais.stop()
  });

  MT.addLayer({
    id: 'vessel-density', group: 'traffic', name: 'Densité du trafic (moyenne annuelle)',
    type: 'wms', url: EMODNET_HA, opacity: 0.7,
    params: { layers: 'emodnet:2022_st_All_avg' },
    resolve: { caps: EMODNET_HA_CAPS, match: /_st_all_avg$|vesseldensity_all/i },
    desc: 'Densité de navires (heures de présence par km² et par mois), tous types confondus, dernière année disponible.',
    source: SRC.emodnet
  });

  MT.addLayer({
    id: 'seamarks', group: 'traffic', name: 'Balisage maritime (OpenSeaMap)', type: 'xyz', opacity: 1,
    url: 'https://tiles.openseamap.org/seamark/{z}/{x}/{y}.png',
    options: { maxZoom: 18, attribution: '© OpenSeaMap' },
    desc: 'Phares, bouées, chenaux et zones réglementées (visible à partir du zoom 9 environ).',
    source: SRC.openseamap
  });

  // ---------------------------------------------------------------- Zones protégées
  const protectedLayer = (id, ign, name, desc, color, isDefault) =>
    MT.addLayer({
      id, group: 'protect', name, type: 'xyz', url: GEOPF_WMTS(ign), opacity: 0.6, default: isDefault,
      options: { maxZoom: 18, attribution: '© IGN / MNHN-INPN' },
      alt: { type: 'wms', url: GEOPF_WMSV, params: { layers: ign, version: '1.3.0' } },
      desc, source: SRC.geopf,
      legendHtml: `<span class="swatch" style="background:${color}"></span> ${MT.escape(name)}`
    });
  protectedLayer('pnm', 'PROTECTEDAREAS.PNM', 'Parcs naturels marins', 'Parc naturel marin du golfe du Lion, du cap Corse et de l’Agriate.', '#2e86de', true);
  protectedLayer('pn', 'PROTECTEDAREAS.PN', 'Parcs nationaux', 'Dont Port-Cros et les Calanques (cœurs marins).', '#27ae60', true);
  protectedLayer('sic', 'PROTECTEDAREAS.SIC', 'Natura 2000 — Habitats (SIC/ZSC)', 'Sites désignés au titre de la directive Habitats (herbiers de posidonie, récifs…).', '#8e44ad', false);
  protectedLayer('zps', 'PROTECTEDAREAS.ZPS', 'Natura 2000 — Oiseaux (ZPS)', 'Zones de protection spéciale au titre de la directive Oiseaux.', '#d35400', false);
  protectedLayer('rn', 'PROTECTEDAREAS.RN', 'Réserves naturelles', 'Dont Scandola, Bouches de Bonifacio, Cerbère-Banyuls.', '#c0392b', false);

  // ---------------------------------------------------------------- Infrastructures
  MT.addLayer({
    id: 'cables', group: 'infra', name: 'Câbles sous-marins (monde)', type: 'factory', default: true,
    desc: 'Câbles de télécommunication internationaux (tracés schématiques). Marseille est l’un des principaux hubs mondiaux.',
    source: SRC.cables,
    create: (def) => loadCables(def)
  });
  MT.addLayer({
    id: 'shomcables', group: 'infra', name: 'Câbles — eaux françaises (SHOM)', type: 'wms', url: EMODNET_HA, opacity: 0.9,
    params: { layers: 'emodnet:shomcables' },
    resolve: { caps: EMODNET_HA_CAPS, match: /^(emodnet:)?shomcables$/i },
    desc: 'Câbles sous-marins (télécom et énergie) recensés par le SHOM dans les eaux françaises.',
    source: SRC.emodnet
  });
  MT.addLayer({
    id: 'windfarms', group: 'infra', name: 'Parcs éoliens en mer', type: 'wms', url: EMODNET_HA, opacity: 0.9, default: true,
    params: { layers: 'emodnet:windfarmspoly' },
    resolve: { caps: EMODNET_HA_CAPS, match: /^(emodnet:)?windfarmspoly$/i },
    desc: 'Parcs éoliens offshore (projets, en construction, en service), dont les fermes pilotes flottantes du golfe du Lion.',
    source: SRC.emodnet
  });
  MT.addLayer({
    id: 'pipelines', group: 'infra', name: 'Pipelines', type: 'wms', url: EMODNET_HA, opacity: 0.9,
    params: { layers: 'emodnet:pipelines' },
    resolve: { caps: EMODNET_HA_CAPS, match: /^(emodnet:)?pipelines$/i },
    desc: 'Gazoducs et oléoducs sous-marins.', source: SRC.emodnet
  });
  MT.addLayer({
    id: 'platforms', group: 'infra', name: 'Plateformes offshore', type: 'wms', url: EMODNET_HA, opacity: 0.9,
    params: { layers: 'emodnet:platforms' },
    resolve: { caps: EMODNET_HA_CAPS, match: /platform/i },
    desc: 'Installations offshore (hydrocarbures, etc.).', source: SRC.emodnet
  });
  MT.addLayer({
    id: 'aquaculture', group: 'infra', name: 'Aquaculture (pisciculture)', type: 'wms', url: EMODNET_HA, opacity: 0.9,
    params: { layers: 'emodnet:finfish' },
    resolve: { caps: EMODNET_HA_CAPS, match: /finfish/i },
    desc: 'Fermes piscicoles en mer.', source: SRC.emodnet
  });

  // ---------------------------------------------------------------- Faune & flore
  MT.addLayer({
    id: 'gbif', group: 'biodiv', name: 'Observations de l’espèce choisie (GBIF)', type: 'factory', default: true,
    desc: 'Densité des observations de l’espèce sélectionnée dans le panneau « Faune & flore ».',
    source: { name: 'GBIF', url: 'https://www.gbif.org/', licence: 'CC0 / CC BY selon les jeux de données' },
    create: () => MT.biodiv.createMapLayer()
  });
  MT.addLayer({
    id: 'habitats', group: 'biodiv', name: 'Habitats des fonds marins (EUNIS)', type: 'wms', url: EMODNET_SH, opacity: 0.7,
    params: { layers: 'eusm2023_eunis2019_full' },
    resolve: { caps: EMODNET_SH + '?SERVICE=WMS&REQUEST=GetCapabilities&VERSION=1.1.1', match: /^(emodnet_view:)?eusm\d{4}_eunis2019_full$/i },
    desc: 'Carte des habitats benthiques (herbiers, roches, sédiments) selon la classification EUNIS.',
    source: SRC.emodnetSh
  });

  // ---------------------------------------------------------------- Trait de côte
  MT.addLayer({
    id: 'erosion', group: 'coast', name: 'Évolution du trait de côte (Cerema)', type: 'wms', url: CEREMA_WMS, opacity: 1,
    params: { layers: 'n_evolution_trait_cote_s', version: '1.3.0' },
    resolve: { caps: CEREMA_WMS + '?SERVICE=WMS&REQUEST=GetCapabilities', match: /evolution.*trait.*c[oô]te|[ée]rosion/i },
    desc: 'Indicateur national de l’érosion côtière : tendance d’évolution du trait de côte sur plus de 50 ans (recul en rouge, avancée en vert). Hors Corse.',
    source: SRC.cerema
  });

  // ---------------------------------------------------------------- Aides
  function legendGradient(colors, left, right) {
    return `<div class="gradient" style="background:linear-gradient(90deg,${colors.join(',')})"></div>
      <div class="gradient-labels"><span>${left}</span><span>${right}</span></div>`;
  }
  MT.legendGradient = legendGradient;

  // Câbles : interrogation d'un service ArcGIS public (CORS autorisé) limité à l'emprise.
  async function loadCables(def) {
    const base = SRC.cables.url;
    const info = await MT.fetchJSON(base + '?f=json');
    const lyr = (info.layers || []).find((l) => /line|cable/i.test(l.name)) || (info.layers || [])[0];
    if (!lyr) throw new Error('aucune couche dans le service');
    const q = `${base}/${lyr.id}/query?where=1%3D1&outFields=*&returnGeometry=true&f=geojson` +
      `&geometry=${W - 2},${S - 1.5},${E + 2},${N + 0.5}&geometryType=esriGeometryEnvelope&inSR=4326&spatialRel=esriSpatialRelIntersects&outSR=4326`;
    const gj = await MT.fetchJSON(q);
    const palette = ['#0b7285', '#5f3dc4', '#c2255c', '#e67700', '#2b8a3e', '#1864ab', '#862e9c'];
    let i = 0;
    const layer = L.geoJSON(gj, {
      pane: 'vectors',
      style: () => ({ color: palette[i++ % palette.length], weight: 2, opacity: 0.85 }),
      onEachFeature: (f, l) => {
        const p = f.properties || {};
        const name = p.name || p.Name || p.NAME || p.cable_name || 'Câble';
        const extra = Object.entries(p)
          .filter(([k, v]) => v && /ready|rfs|year|owner|length|landing/i.test(k))
          .map(([k, v]) => `<div><small>${MT.escape(k)} : ${MT.escape(v)}</small></div>`).join('');
        l.bindPopup(`<b>${MT.escape(name)}</b>${extra}`);
        l.on('mouseover', () => l.setStyle({ weight: 4 }));
        l.on('mouseout', () => l.setStyle({ weight: 2 }));
      }
    });
    def.statusMessage = `${(gj.features || []).length} câbles dans l’emprise`;
    return layer;
  }
})();
