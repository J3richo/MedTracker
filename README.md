# MedTracker — tableau de bord de la Méditerranée française

Tableau de bord de veille personnelle sur la façade méditerranéenne française (Occitanie, PACA, Corse),
inspiré de [World Monitor](https://www.worldmonitor.app/). Il est conçu comme une simple page HTML :
**aucune installation, aucun serveur**.

## Lancer

1. Téléchargez ou clonez le dépôt.
2. Double-cliquez sur `index.html` : la page s'ouvre dans votre navigateur (Chrome, Firefox ou Edge récents).
3. Une connexion Internet est nécessaire, car toutes les données sont lues en direct.

Le panneau **État des sources**, en bas de page, indique pour chaque source si elle a répondu. Les couches de carte
ne sont testées qu'une fois cochées.

## Contenu

| Module | Ce qu'il affiche | Source principale |
|---|---|---|
| Indicateurs clés | Température de l'eau (moyenne, extrêmes), vagues, rafales, anomalie du point choisi | Open-Meteo |
| Carte | Fond clair, 7 familles de couches activables, opacité réglable, curseur de date | voir [SOURCES.md](SOURCES.md) |
| Température de la mer | 19 points de mesure, variation sur 3 jours, prévision sur 7 jours | Open-Meteo Marine |
| Météo marine | Vent, rafales, force Beaufort, vagues et houle, prévision sur 7 jours | Open-Meteo |
| Long terme & vagues de chaleur | Historique depuis 1993, normale saisonnière, tendance en °C par décennie, détection des vagues de chaleur marines (méthode Hobday) | Open-Meteo (réanalyse ERA5-Ocean) |
| Trafic maritime | Carte AIS VesselFinder intégrée ; navires en direct sur la carte principale si une clé AISStream est fournie | VesselFinder, AISStream |
| Faune & flore | 16 espèces suivies (cétacés, tortue, posidonie, grande nacre, espèces invasives…) : observations par an, carte de densité, dernières photos | GBIF, iNaturalist |
| Actualités | Revue de presse thématique sur 30 jours | Google Actualités (RSS) |
| Liens utiles | Sources consultables mais non intégrables (Meteociel, MARC, HTMNET, DIRM…) | — |

**Curseur de date** (en haut de la page) : il s'applique aux couches satellite (depuis 2002) et Copernicus
(prévisions jusqu'à J+9). La date appliquée à chaque couche est rappelée en bas à droite de la carte.

## Clés d'API (facultatif)

Tout fonctionne sans clé, à l'exception des navires en direct sur la carte principale.

1. Copiez `js/config.example.js` en `js/config.js`.
2. Dans `js/config.js`, remplacez `window.MEDTRACKER_DEFAULTS` par `window.MEDTRACKER_CONFIG` et ne gardez
   que les réglages que vous modifiez, par exemple :
   ```js
   window.MEDTRACKER_CONFIG = { aisstreamKey: 'votre-clé' };
   ```
3. Le fichier `js/config.js` est ignoré par git : votre clé ne sera pas publiée.

| Service | Pour quoi faire | Inscription |
|---|---|---|
| AISStream | Navires en direct sur la carte | https://aisstream.io (connexion avec un compte GitHub, gratuit) |

Remarque : AISStream ne garantit pas les connexions depuis un navigateur. Si le panneau « État des sources » indique
une erreur malgré une clé valide, c'est la limite de l'option « page HTML seule ». Il faudra alors un petit relais
local (voir l'évolution prévue ci-dessous).

## Limites connues

- **Une page sans serveur ne peut lire que les sources qui l'autorisent (CORS).** Meteociel, Ifremer MARC et HTMNET
  n'offrent pas d'accès machine : ils figurent dans « Liens utiles ».
- **Les actualités passent par un relais CORS public** (allorigins.win, avec deux relais de secours). Ces services
  gratuits sont parfois lents ou indisponibles.
- **Points de mesure** : ce sont des points de modèles, pas des bouées. La précision est limitée près des côtes.
- **Les identifiants des couches Copernicus et EMODnet changent avec les versions des produits.** La page interroge
  les catalogues (GetCapabilities) pour trouver l'identifiant à jour, et utilise une valeur par défaut si le
  catalogue est inaccessible. Le détail s'affiche dans « État des sources ».
- **Les observations d'espèces reflètent aussi l'effort d'observation**, pas seulement l'abondance des espèces.

## Structure

```
index.html            page unique
css/style.css         thème clair
js/config.example.js  réglages par défaut (copier en js/config.js)
js/util.js            requêtes, dates, formats, statistiques
js/data.js            points de mesure et données Open-Meteo
js/status.js          registre « État des sources »
js/map.js             carte, gestionnaire de couches, résolution des identifiants, repli
js/layers.js          catalogue des couches (une entrée par source)
js/panels/*.js        un fichier par panneau
SOURCES.md            catalogue détaillé des sources
```

Pour ajouter une couche, ajoutez une entrée `MT.addLayer({...})` dans `js/layers.js`, sur le modèle des
entrées existantes.

## Évolutions envisagées

- Petit relais local ou hébergé : AIS fiable, flux RSS officiels (Préfecture maritime), Global Fishing Watch,
  Copernicus en accès authentifié, mise en cache.
- Publication sur GitHub Pages, puis application installable (PWA).
- Marégraphes du SHOM, houlographes Candhis, qualité des eaux de baignade, séismes (EMSC).
