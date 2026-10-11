/* Stations virtuelles le long de la façade et chargement des données Open-Meteo. */
(function () {
  const MT = window.MT;

  // Points légèrement au large pour tomber dans une maille « mer » des modèles.
  MT.stations = [
    { id: 'banyuls', name: 'Banyuls-sur-Mer', zone: 'Occitanie', lat: 42.48, lon: 3.17 },
    { id: 'leucate', name: 'Leucate', zone: 'Occitanie', lat: 42.92, lon: 3.10 },
    { id: 'sete', name: 'Sète', zone: 'Occitanie', lat: 43.36, lon: 3.72 },
    { id: 'graudroi', name: 'Le Grau-du-Roi', zone: 'Occitanie', lat: 43.45, lon: 4.12 },
    { id: 'fos', name: 'Golfe de Fos', zone: 'PACA', lat: 43.32, lon: 4.88 },
    { id: 'marseille', name: 'Marseille (Planier)', zone: 'PACA', lat: 43.19, lon: 5.23 },
    { id: 'laciotat', name: 'La Ciotat', zone: 'PACA', lat: 43.14, lon: 5.60 },
    { id: 'toulon', name: 'Toulon', zone: 'PACA', lat: 43.05, lon: 5.95 },
    { id: 'porquerolles', name: 'Porquerolles', zone: 'PACA', lat: 42.96, lon: 6.21 },
    { id: 'sttropez', name: 'Saint-Tropez', zone: 'PACA', lat: 43.24, lon: 6.75 },
    { id: 'cannes', name: 'Cannes (Lérins)', zone: 'PACA', lat: 43.48, lon: 7.05 },
    { id: 'nice', name: 'Nice', zone: 'PACA', lat: 43.64, lon: 7.30 },
    { id: 'menton', name: 'Menton', zone: 'PACA', lat: 43.74, lon: 7.53 },
    { id: 'calvi', name: 'Calvi', zone: 'Corse', lat: 42.60, lon: 8.72 },
    { id: 'ajaccio', name: 'Ajaccio', zone: 'Corse', lat: 41.88, lon: 8.66 },
    { id: 'bonifacio', name: 'Bonifacio', zone: 'Corse', lat: 41.33, lon: 9.15 },
    { id: 'portovecchio', name: 'Porto-Vecchio', zone: 'Corse', lat: 41.60, lon: 9.40 },
    { id: 'bastia', name: 'Bastia', zone: 'Corse', lat: 42.70, lon: 9.52 },
    { id: 'capcorse', name: 'Cap Corse', zone: 'Corse', lat: 43.05, lon: 9.36 }
  ];

  MT.selectedStation = MT.store.get('station') || 'marseille';
  MT.selectStation = function (id) {
    if (!MT.stations.some((s) => s.id === id)) return;
    MT.selectedStation = id;
    MT.store.set('station', id);
    MT.emit('station', id);
  };
  MT.station = (id) => MT.stations.find((s) => s.id === (id || MT.selectedStation));

  const lats = () => MT.stations.map((s) => s.lat).join(',');
  const lons = () => MT.stations.map((s) => s.lon).join(',');

  // Open-Meteo renvoie un tableau quand plusieurs coordonnées sont demandées.
  const asArray = (j) => (Array.isArray(j) ? j : [j]);

  MT.loadMarine = async function () {
    const url =
      'https://marine-api.open-meteo.com/v1/marine?' +
      `latitude=${lats()}&longitude=${lons()}` +
      '&current=sea_surface_temperature,wave_height,wave_direction,wave_period,swell_wave_height' +
      '&hourly=sea_surface_temperature,wave_height,wave_period,swell_wave_height' +
      '&past_days=3&forecast_days=7&timezone=Europe%2FParis&cell_selection=sea';
    MT.status.set('openmeteo-marine', { state: 'pending' });
    try {
      const data = asArray(await MT.fetchJSON(url));
      data.forEach((d, i) => (MT.stations[i].marine = d));
      MT.status.set('openmeteo-marine', { state: 'ok', message: `${data.length} points` });
    } catch (e) {
      MT.status.set('openmeteo-marine', { state: 'error', message: e.message });
    }
  };

  MT.loadWeather = async function () {
    const url =
      'https://api.open-meteo.com/v1/forecast?' +
      `latitude=${lats()}&longitude=${lons()}` +
      '&current=temperature_2m,wind_speed_10m,wind_direction_10m,wind_gusts_10m,weather_code' +
      '&hourly=wind_speed_10m,wind_gusts_10m,wind_direction_10m' +
      '&forecast_days=7&wind_speed_unit=kn&timezone=Europe%2FParis';
    MT.status.set('openmeteo-weather', { state: 'pending' });
    try {
      const data = asArray(await MT.fetchJSON(url));
      data.forEach((d, i) => (MT.stations[i].weather = d));
      MT.status.set('openmeteo-weather', { state: 'ok', message: `${data.length} points` });
    } catch (e) {
      MT.status.set('openmeteo-weather', { state: 'error', message: e.message });
    }
  };

  MT.loadAll = async function () {
    await Promise.all([MT.loadMarine(), MT.loadWeather()]);
    MT.lastUpdate = new Date();
    MT.emit('data', MT.stations);
  };

  // Valeur de la série horaire `key` la plus proche de l'instant `hoursAgo`.
  MT.hourlyAt = function (series, key, hoursAgo = 0) {
    if (!series || !series.hourly || !series.hourly[key]) return null;
    const target = Date.now() - hoursAgo * 3600e3;
    const times = series.hourly.time;
    let best = null, bestDiff = Infinity;
    for (let i = 0; i < times.length; i++) {
      const diff = Math.abs(new Date(times[i]).getTime() - target);
      if (diff < bestDiff && series.hourly[key][i] != null) { best = series.hourly[key][i]; bestDiff = diff; }
    }
    return best;
  };

  // Codes météo WMO (Open-Meteo) → libellé court.
  MT.weatherLabel = function (code) {
    const map = {
      0: 'Ciel clair', 1: 'Peu nuageux', 2: 'Partiellement nuageux', 3: 'Couvert',
      45: 'Brouillard', 48: 'Brouillard givrant', 51: 'Bruine', 53: 'Bruine', 55: 'Bruine forte',
      61: 'Pluie faible', 63: 'Pluie', 65: 'Pluie forte', 66: 'Pluie verglaçante', 67: 'Pluie verglaçante',
      71: 'Neige', 73: 'Neige', 75: 'Neige forte', 80: 'Averses', 81: 'Averses', 82: 'Fortes averses',
      95: 'Orage', 96: 'Orage grêle', 99: 'Orage grêle'
    };
    return map[code] || '—';
  };
})();
