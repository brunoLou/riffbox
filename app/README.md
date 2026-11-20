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
| `tests/unit/scales.test.ts` | les 936 positions de gammes, noms et relatives |
| `tests/unit/pitch.test.ts` | détection de hauteur YIN sur des sons synthétiques (< 3 cents) |
| `tests/unit/voice.test.ts` | score vocal, octaves, placement dans la tessiture |
| `tests/unit/tools.test.ts` | capodastre, grilles et morceaux, backing tracks, fichiers de sauvegarde |
| `tests/e2e/smoke.spec.ts` | chaque écran s’ouvre, navigation, anciennes adresses, micro refusé |
| `tests/e2e/accueil.spec.ts` | tuiles, glisser-déposer, clavier, taille, catalogue, rétablir |
| `tests/e2e/accordeur-*.spec.ts` | accordeur au micro : La +10 cents, Mi grave −20 cents, mode manuel |
| `tests/e2e/metronome.spec.ts` | bouton rotatif, tap tempo, signatures, grooves, accents |
| `tests/e2e/carnet.spec.ts` | filtres, écoute, enregistrement conservé après rechargement, suppression |
| `tests/e2e/grilles.spec.ts` | boucle sonore, édition, riff → grille → setlist → scène |
| `tests/e2e/morceaux.spec.ts` | bibliothèque, saisie des paroles, aperçu, scène |
| `tests/e2e/setlists.spec.ts` | setlists, réordonnancement, pédalier, transposition, défilement |
| `tests/e2e/pedalier.spec.ts` | voyant du pédalier, écran maintenu allumé sur scène (Wake Lock simulé) |
| `tests/e2e/pratiquer.spec.ts` | routine minutée, graphique, backing tracks |
| `tests/e2e/voix.spec.ts` | accordeur vocal, tessiture, tonalité + capo, exercice et prise |
| `tests/e2e/accords-gammes.spec.ts` | bibliothèques d’accords et de gammes |
| `tests/e2e/reglages.spec.ts` | thèmes, effacement des exemples, réinitialisation, sauvegarde et fusion |
| `tests/e2e/pwa.spec.ts` | installable, hors ligne, polices embarquées |
