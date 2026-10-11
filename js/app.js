/* Démarrage : carte, panneaux, date, horloge et actualisation périodique. */
(function () {
  const MT = window.MT;

  MT.status.define('openmeteo-marine', { name: 'Open-Meteo Marine (eau, vagues)', category: 'Mesures', url: 'https://open-meteo.com/en/docs/marine-weather-api' });
  MT.status.define('openmeteo-weather', { name: 'Open-Meteo Météo (vent, air)', category: 'Mesures', url: 'https://open-meteo.com/en/docs/meteofrance-api' });
  MT.status.define('openmeteo-history', { name: 'Open-Meteo historique (ERA5-Ocean)', category: 'Mesures', url: 'https://open-meteo.com/en/docs/marine-weather-api', message: 'à la demande' });

  function setupDate() {
    const input = document.getElementById('date-input');
    input.min = '2002-06-01';
    input.max = MT.addDays(MT.today(), 9);
    input.value = MT.selectedDate;
    const set = (iso) => {
      if (!iso || iso < input.min || iso > input.max) return;
      MT.selectedDate = iso;
      input.value = iso;
      MT.emit('date', iso);
    };
    input.addEventListener('change', () => set(input.value));
    document.getElementById('date-prev').addEventListener('click', () => set(MT.addDays(MT.selectedDate, -1)));
    document.getElementById('date-next').addEventListener('click', () => set(MT.addDays(MT.selectedDate, 1)));
    document.getElementById('date-today').addEventListener('click', () => set(MT.today()));
  }

  function setupClock() {
    const tick = () => {
      const now = new Date();
      document.getElementById('clock-local').textContent = now.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
      document.getElementById('clock-utc').textContent = 'UTC ' + now.toISOString().slice(11, 16);
      if (MT.lastUpdate) document.getElementById('last-update').textContent = MT.timeAgo(MT.lastUpdate);
    };
    tick();
    setInterval(tick, 15e3);
  }

  async function refresh() {
    const btn = document.getElementById('refresh');
    btn.disabled = true;
    btn.textContent = 'Actualisation…';
    await MT.loadAll();
    MT.emit('refresh');
    btn.disabled = false;
    btn.textContent = 'Actualiser';
    document.getElementById('last-update').textContent = MT.timeAgo(MT.lastUpdate);
  }

  document.addEventListener('DOMContentLoaded', () => {
    if (!window.L) {
      document.body.insertAdjacentHTML('afterbegin',
        '<div class="fatal">Impossible de charger la bibliothèque cartographique (Leaflet). Vérifiez votre connexion Internet.</div>');
      return;
    }
    MT.initMap();
    MT.emit('init');
    MT.activateInitialLayers();
    setupDate();
    setupClock();
    document.getElementById('refresh').addEventListener('click', refresh);
    refresh();
    setInterval(refresh, Math.max(5, MT.config.refreshMinutes) * 60e3);
  });
})();
