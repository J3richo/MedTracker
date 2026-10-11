/* Panneau « Liens utiles » : sources consultables mais non intégrables directement dans la page. */
(function () {
  const MT = window.MT;
  const LINKS = [
    ['Observations & prévisions', [
      ['Météo-France — bulletins côtiers et large', 'https://meteofrance.com/meteo-marine'],
      ['Meteociel — température de la mer', 'https://www.meteociel.fr/observations-meteo/temperature-de-la-mer.php'],
      ['Ifremer MARC — modèles de vagues Méditerranée', 'https://marc.ifremer.fr/resultats/vagues/modeles_mediterranee'],
      ['Candhis — houlographes (Cerema)', 'https://candhis.cerema.fr/'],
      ['HTMNET — stations de température (MIO)', 'https://htmnet.mio.osupytheas.fr/HTMNET/squel.php?content=displayHtMnetStations.php'],
      ['T-MEDNet — températures et mortalités', 'https://t-mednet.org/'],
      ['Copernicus Marine — visualiseur MyOcean', 'https://data.marine.copernicus.eu/viewer/expert'],
      ['SHOM — data.shom.fr (marées, marégraphes)', 'https://data.shom.fr/']
    ]],
    ['Réglementation & sécurité', [
      ['Préfecture maritime de la Méditerranée', 'https://www.premar-mediterranee.gouv.fr/'],
      ['DIRM Méditerranée — bases de données', 'https://www.dirm.mediterranee.developpement-durable.gouv.fr/les-differentes-bases-de-donnees-existantes-a2787.html'],
      ['Géolittoral — portail de la mer et du littoral', 'https://www.geolittoral.developpement-durable.gouv.fr/']
    ]],
    ['Trafic & infrastructures', [
      ['VesselFinder', 'https://www.vesselfinder.com/'],
      ['MarineTraffic', 'https://www.marinetraffic.com/'],
      ['Global Fishing Watch — activité de pêche', 'https://globalfishingwatch.org/map'],
      ['Submarine Cable Map (TeleGeography)', 'https://www.submarinecablemap.com/']
    ]],
    ['Biodiversité & espaces protégés', [
      ['MAPAMED — aires marines protégées (MedPAN)', 'https://www.mapamed.org/'],
      ['INPN — espaces protégés', 'https://inpn.mnhn.fr/'],
      ['OBIS — biodiversité marine', 'https://obis.org/'],
      ['DONIA / MEDTRIX — herbiers et ancrages', 'https://medtrix.fr/']
    ]]
  ];

  MT.on('init', () => {
    document.querySelector('#panel-links .card-body').innerHTML = LINKS.map(([title, links]) => `
      <h3>${title}</h3>
      <ul class="links">${links.map(([name, url]) => `<li><a href="${url}" target="_blank" rel="noopener">${name}</a></li>`).join('')}</ul>`
    ).join('');
  });
})();
