# Catalogue des sources

Légende de la colonne « Vérification » :

- **Doc** : point d'accès et identifiant confirmés par la documentation officielle.
- **Auto** : l'identifiant exact est recherché à l'exécution dans le catalogue du service (GetCapabilities), avec une valeur par défaut en repli.
- **À tester** : identifiant d'après la documentation, mais non confirmé en conditions réelles.

Dans tous les cas, le panneau « État des sources » donne le résultat réel dans votre navigateur.

## Intégrées au tableau de bord

| Donnée | Service / point d'accès | Fréquence | Clé | Licence | Vérification |
|---|---|---|---|---|---|
| Température de l'eau, vagues, houle (points) | Open-Meteo Marine — `marine-api.open-meteo.com/v1/marine` | horaire, prévision 7 j | non | CC BY 4.0 | Doc |
| Vent, rafales, température de l'air | Open-Meteo — `api.open-meteo.com/v1/forecast` | horaire, prévision 7 j | non | CC BY 4.0 | Doc |
| Historique de température depuis 1993 | Open-Meteo Marine (`start_date`, réanalyse ERA5-Ocean) | journalier | non | CC BY 4.0 | Doc |
| Température de surface satellite (MUR, 1 km) | NASA GIBS WMS — `GHRSST_L4_MUR_Sea_Surface_Temperature` | quotidien, J-1, depuis 2002 | non | NASA open data | Doc |
| Anomalie de température satellite | NASA GIBS WMS — `GHRSST_L4_MUR_Sea_Surface_Temperature_Anomalies` (variante `_v4.1_STD` en secours) | quotidien | non | NASA open data | À tester |
| Image satellite couleurs naturelles | NASA GIBS WMS — `VIIRS_SNPP_CorrectedReflectance_TrueColor` (secours : MODIS Terra) | quotidien | non | NASA open data | Doc |
| Température, courants (modèle) | Copernicus Marine WMTS — `MEDSEA_ANALYSISFORECAST_PHY_006_013` | journalier, prévision J+9 | non (WMTS public) | Copernicus Marine | Auto |
| Chlorophylle (modèle) | Copernicus Marine WMTS — `MEDSEA_ANALYSISFORECAST_BGC_006_014` | journalier | non | Copernicus Marine | Auto |
| Hauteur des vagues (modèle) | Copernicus Marine WMTS — `MEDSEA_ANALYSISFORECAST_WAV_006_017` (`VHM0`) | horaire | non | Copernicus Marine | Auto |
| Densité du trafic | EMODnet Human Activities WMS (`*_st_All_avg`) | annuel | non | CC BY 4.0 | Auto |
| Câbles (eaux françaises, SHOM) | EMODnet Human Activities WMS — `shomcables` | variable | non | CC BY 4.0 | Auto |
| Parcs éoliens en mer | EMODnet Human Activities WMS — `windfarmspoly` | variable | non | CC BY 4.0 | Auto |
| Pipelines, plateformes, aquaculture | EMODnet Human Activities WMS | variable | non | CC BY 4.0 | Auto |
| Câbles sous-marins (monde) | ArcGIS « Worldwide Submarine Cables » (d'après TeleGeography) | variable | non | non commercial | À tester |
| Parcs naturels marins, parcs nationaux, Natura 2000 (SIC, ZPS), réserves naturelles | IGN Géoplateforme WMTS `PROTECTEDAREAS.*` (secours : WMS-V) | variable | non | Etalab 2.0 | À tester |
| Habitats des fonds marins | EMODnet Seabed Habitats WMS (`eusm*_eunis2019_full`) | variable | non | CC BY 4.0 | Auto |
| Évolution du trait de côte | Cerema Géolittoral WMS — `n_evolution_trait_cote_s` | pluriannuel | non | Etalab 2.0 | Auto |
| Balisage maritime | OpenSeaMap (tuiles) | continu | non | CC BY-SA | Doc |
| Observations d'espèces | GBIF API (`species/match`, `occurrence/search`, tuiles `v2/map`) | continu | non | CC0 / CC BY | Doc |
| Photos d'observations | iNaturalist API v1 | continu | non | CC (par observation) | Doc |
| Trafic AIS (panneau) | VesselFinder, carte intégrée gratuite | temps réel | non | conditions VesselFinder | À tester |
| Trafic AIS (carte) | AISStream.io WebSocket | temps réel | **oui (gratuite)** | conditions AISStream | À tester |
| Actualités | Google Actualités RSS, lu via un relais CORS public | continu | non | — | À tester |
| Fonds de carte | Esri Light Gray Canvas, OpenStreetMap, IGN (Plan IGN v2, cartes littorales SHOM/IGN, photographies aériennes) | — | non | ODbL / Etalab | Doc |

## Repérées, non intégrées (pas d'accès machine, ou accès nécessitant un relais)

| Source | Intérêt | Pourquoi pas encore |
|---|---|---|
| Meteociel — température de la mer | relevés de bouées et stations | pas d'API, lecture interdite depuis une autre page |
| Ifremer MARC — modèles de vagues | prévisions fines (rangs 0 à 2) | images sans API ; données via le serveur de l'Ifremer |
| HTMNET (MIO) | sondes de température côtières de haute fréquence | pas d'API publique |
| DIRM Méditerranée — bases de données | référentiel des données de la façade | portail de liens ; les jeux de données sont repris via EMODnet et la Géoplateforme |
| Candhis (Cerema) | houlographes côtiers | pas d'API publique |
| SHOM data.shom.fr / REFMAR | marées, marégraphes | à étudier (CORS non garanti) |
| Copernicus Marine (téléchargement) | données brutes MED-MFC | nécessite un compte et un relais (le WMTS public suffit pour les cartes) |
| Global Fishing Watch | activité de pêche | jeton d'accès à ne pas exposer dans une page publique |
| MAPAMED (MedPAN) | aires marines protégées de toute la Méditerranée | à étudier |
| T-MEDNet | températures in situ, mortalités massives | pas d'API publique |
| Météo-France (API) | vigilance, bulletins marine | clé requise et CORS à vérifier |

## Références

- Hobday A. J. *et al.* (2016), « A hierarchical approach to defining marine heatwaves », *Progress in Oceanography*, 141, 227-238.
- Copernicus Marine, *How to use the WMTS* : https://help.marine.copernicus.eu/en/articles/6478168-how-to-use-the-copernicus-marine-web-map-tile-service-wmts
- Cerema, *Indicateur national de l'érosion côtière* : https://www.geolittoral.developpement-durable.gouv.fr/indicateur-national-de-l-erosion-cotiere-a1510.html
