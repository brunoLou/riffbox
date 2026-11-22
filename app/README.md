# RIFFBOX

La boîte à outils du guitariste : accordeur, métronome, carnet d’idées, grilles, gammes et accords,
justesse vocale, setlists et prompteur de scène. Application web installable (PWA), qui fonctionne
hors ligne ; toutes les données restent sur l’appareil (export et import dans Réglages).

## Lancer

```sh
npm install
npm run dev        # développement, http://localhost:5173
npm run build      # version de production dans dist/
npm run preview    # sert dist/ sur http://localhost:4173
```

Le micro (accordeur, voix, enregistrement) demande `localhost` ou une adresse en https.

## Tablette

Sur un écran tactile plus large qu’un téléphone (ou une fois l’app installée), l’app passe en plein
écran, sans cadre : la plupart des écrans forment une colonne centrée de 720 px ; le prompteur prend
toute la largeur avec des paroles 1,45 fois plus grandes, les gammes et les accords montrent le manche
entier, et la grille, en paysage, place la roue des quintes à côté des accords. Sur un ordinateur,
l’app reste présentée dans son cadre de téléphone.

## Essayer sur un téléphone (sans déployer)

```sh
npm run phone      # compile, puis sert l’app en https sur le réseau local (port 5443)
```

La commande affiche l’adresse à ouvrir sur le téléphone, et un QR code à scanner. Le téléphone et
l’ordinateur doivent être sur le même Wi-Fi. Le certificat est local (auto-signé) : le téléphone
affiche un avertissement à accepter une fois. Micro, son, maintien de l’écran et pédalier sont alors
utilisables ; l’installation sur l’écran d’accueil et le mode hors ligne demandent un vrai
certificat, donc un déploiement. Si le téléphone n’arrive pas à se connecter, autorisez Node.js
dans le pare-feu de l’ordinateur. Autre port : `PORT=6000 npm run phone`.

## Tester

```sh
npm test           # tests unitaires (Vitest) : logique musicale, accords, gammes, détection de hauteur, score vocal…
npm run test:e2e   # tests de bout en bout (Playwright) : chaque parcours de l’app dans Chromium
npm run test:all   # les deux
```

Sur une nouvelle machine, installez d’abord le navigateur de test : `npx playwright install chromium`.

Les tests de bout en bout compilent l’app et la servent eux-mêmes (`vite preview`, port 4173).
Le micro y est simulé par des sons générés à la volée (cordes de guitare, voix chantée), écrits
dans le dossier temporaire du système.

| Fichier | Ce qui est vérifié |
| --- | --- |
| `tests/unit/music.test.ts` | transposition (bémols conservés), ChordPro, degrés |
| `tests/unit/chords.test.ts` | les 720 positions d’accords : notes justes, basse, écart jouable, 5 formes CAGED |
| `tests/unit/fingering.test.ts` | doigtés (accords ouverts, barrés, toutes les positions jouables à 4 doigts), renversements sur chaque groupe de cordes |
| `tests/unit/scales.test.ts` | les 936 positions de gammes, noms et relatives |
| `tests/unit/pitch.test.ts` | détection de hauteur YIN sur des sons synthétiques (< 3 cents) |
| `tests/unit/voice.test.ts` | score vocal, octaves, placement dans la tessiture |
| `tests/unit/chordpro.test.ts` | ChordPro : tonalités, directives d’autres apps, recueils, aller-retour des exemples |
| `tests/unit/chordDetect.test.ts` | reconnaissance d’accords sur des grattages synthétisés (positions, harmoniques, désaccord, bruit) |
| `tests/unit/chordFollow.test.ts` | suivi de la position dans le morceau à partir des accords entendus |
| `tests/unit/sync.test.ts` | transfert entre appareils : dates de modification, version la plus récente, suppressions transmises |
| `tests/unit/tools.test.ts` | capodastre, grilles et morceaux, backing tracks, fichiers de sauvegarde |
| `tests/e2e/smoke.spec.ts` | chaque écran s’ouvre, navigation, anciennes adresses, micro refusé |
| `tests/e2e/accueil.spec.ts` | tuiles, glisser-déposer, clavier, taille, catalogue, rétablir |
| `tests/e2e/accordeur-*.spec.ts` | accordeur au micro : La +10 cents, Mi grave −20 cents, mode manuel |
| `tests/e2e/metronome.spec.ts` | bouton rotatif, tap tempo, signatures, grooves, accents |
| `tests/e2e/idee.spec.ts` | « + Idée » partout : enregistrement sur place par-dessus l’écran, note écrite, tempo et ton repris de l’écran |
| `tests/e2e/carnet.spec.ts` | filtres (dont le tempo), écoute, enregistrement conservé, nommage et étiquettes, idée texte, suppression |
| `tests/e2e/grilles.spec.ts` | boucle sonore, édition, diagramme d’un accord de la grille, riff → grille → setlist → scène |
| `tests/e2e/morceaux.spec.ts` | bibliothèque, saisie des paroles, aperçu, scène, import et export ChordPro |
| `tests/e2e/setlists.spec.ts` | setlists, réordonnancement, pédalier, transposition, défilement |
| `tests/e2e/pedalier.spec.ts` | voyant du pédalier, écran maintenu allumé (Wake Lock simulé), apprentissage des touches, pédalier sur le métronome, la grille, les backing tracks et la routine |
| `tests/e2e/pratiquer.spec.ts` | routine minutée, graphique, backing tracks |
| `tests/e2e/routine.spec.ts` | routine modifiable : durées, noms, ajout, ordre, retrait, temps du jour gardé, rétablir |
| `tests/e2e/voix.spec.ts` | accordeur vocal, tessiture, tonalité + capo, exercice et prise |
| `tests/e2e/accords-gammes.spec.ts` | bibliothèques d’accords (doigts, renversements) et de gammes |
| `tests/e2e/rappel.spec.ts` | rappel de sauvegarde : seulement avec du contenu perso, « Plus tard », fréquence, désactivation |
| `tests/e2e/reglages.spec.ts` | thèmes, effacement des exemples, réinitialisation, sauvegarde et fusion |
| `tests/e2e/design.spec.ts` | design system : couleurs et leurs valeurs dans les deux thèmes, composants vivants |
| `tests/e2e/accessibilite.spec.ts` | axe-core (WCAG 2.2 AA) sur les 27 écrans dans les deux thèmes et sur les feuilles ouvertes ; feuilles au clavier ; focus visible |
| `tests/e2e/tablette.spec.ts` | tablette (iPad) : plein écran, colonne, prompteur large, manche entier, grille en deux colonnes |
| `tests/e2e/suivre.spec.ts` | « Suivre ma guitare » : faux micro jouant les accords de Minuit Shuffle, le texte suit |
| `tests/e2e/transfert.spec.ts` | téléphone ⇄ tablette : deux appareils simulés s’échangent leurs données dans les deux sens |
| `tests/e2e/voyants.spec.ts` | voyants de l’accueil : allumés par un vrai usage du jour, éteints le lendemain |
| `tests/e2e/pwa.spec.ts` | installable, hors ligne, polices embarquées |
