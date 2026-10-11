/*
 * Configuration de MedTracker.
 *
 * Ce fichier contient les valeurs par défaut et est versionné.
 * Pour vos réglages personnels (clés d'API), copiez-le en `js/config.js`
 * et remplacez `MEDTRACKER_DEFAULTS` par `MEDTRACKER_CONFIG` : seules les
 * clés présentes dans config.js remplacent les valeurs ci-dessous.
 * `js/config.js` est ignoré par git : vos clés ne seront jamais publiées.
 */
window.MEDTRACKER_DEFAULTS = {
  // Clé gratuite AISStream (https://aisstream.io) pour afficher les navires
  // en direct sur la carte. Vide = seule la carte VesselFinder intégrée est utilisée.
  aisstreamKey: '',

  // Fréquence d'actualisation automatique des données (minutes).
  refreshMinutes: 30,

  // Relais CORS publics utilisés pour lire les flux RSS d'actualités
  // (un navigateur ne peut pas lire un flux RSS d'un autre site sans relais).
  // `{url}` est remplacé par l'adresse encodée du flux. Essayés dans l'ordre.
  corsProxies: [
    'https://api.allorigins.win/raw?url={url}',
    'https://corsproxy.io/?url={url}',
    'https://api.codetabs.com/v1/proxy?quest={url}'
  ],

  // Emprise de la façade méditerranéenne française [ouest, sud, est, nord].
  bbox: [2.9, 41.2, 10.0, 43.95],

  // Période de référence de la climatologie (vagues de chaleur marines).
  climatologyStart: 1993,
  climatologyEnd: 2022
};
