# RIFFBOX

La boîte à outils du guitariste : accordeur, métronome, carnet d’idées, grilles, gammes et accords,
justesse vocale, tonalité d’un morceau à l’écoute, setlists et prompteur live. Application web installable (PWA), qui fonctionne
hors ligne ; toutes les données restent sur l’appareil (export et import dans Réglages).

## Lancer

```sh
npm install
npm run dev        # développement, http://localhost:5173
npm run build      # version de production dans dist/
npm run preview    # sert dist/ sur http://localhost:4173
```

Le micro (accordeur, voix, enregistrement) demande `localhost` ou une adresse en https.

## Compartiments de l'accueil

Sur l'accueil, **Modifier** puis **+ Nouveau compartiment** : vous lui donnez le nom que vous voulez (Outils, Entraînement, Organisation…, ou une suggestion). Pour y ranger une pédale : **▤ Ranger** sur la pédale, ou glissez-la par sa poignée ⠿ dans le compartiment (l'écran défile tout seul près du bord). Le nom se modifie directement, ↑ ↓ changent l'ordre, ✕ supprime le compartiment sans perdre ses pédales (elles reviennent dans « Non classées »). Hors modification, toucher le titre d'un compartiment le replie. Les compartiments suivent la synchronisation Google Drive (`home.sections`, et `sec` sur chaque pédale de `home.layout`).

Les pédales ont le même dessin partout : accueil, Pratiquer et catalogue « + Ajouter une pédale ».

## Backing tracks perso

Pratiquer › Backing tracks : dans le lecteur de chaque backing track (« Blues en La »…), « Son : RIFFBOX / Mon
fichier ». On y associe un fichier audio (MP3, M4A, WAV, OGG…) et on choisit l’un ou l’autre ; le son RIFFBOX
reste inchangé (suite d’accords, grille, ton, tempo). Le fichier se joue en boucle, ralenti ou accéléré de 50
à 150 % sans changer de ton. « Mes fichiers » garde en plus des fichiers indépendants. Tout suit les sauvegardes
et le transfert vers la tablette.

## Coach

Pratiquer › Coach : un bilan de 5 minutes (objectifs, styles, temps par jour, puis trois tests au micro :
changements d’accords en une minute, penta mineure au métronome, régularité du grattage au clic), ou le
niveau indiqué à la main. Le coach compose chaque jour une routine dans le temps choisi, adaptée au niveau de
chaque compétence (la plus faible d’abord), dont chaque étape ouvre l’outil déjà réglé (tempo, gamme, backing
track). « Revenir à ma routine » rend la routine personnelle.

### Coach dans la durée

Après chaque exercice à tempo de la routine du coach (échauffement, accords, rythme, gammes), le
joueur dit comment c’était : **Facile** (+4 BPM la fois suivante), **Juste** (même tempo, +2 après
deux fois de suite) ou **Difficile** (−4). L’écran Coach montre le **bilan de la semaine** (minutes,
jours joués, tempos gagnés, un conseil) et propose le **test du mois** quatre semaines après le
dernier bilan : les trois tests, comparés au précédent et au bilan de départ (`coach.progress`,
`coach.tests`, synchronisés).

## Relever un morceau

Pratiquer → Relever : un enregistrement (MP3, WAV, M4A…) ralenti sans changer sa hauteur (50 à 100 %),
un passage bouclé de A à B (vérifié à chaque image, pour une boucle serrée), transposé par demi-tons
sans changer la vitesse (`pitchShift.ts` : deux têtes de lecture dans une courte ligne à retard,
relayées en fondu, en AudioWorklet). Forme d’onde pour se repérer ; espace, flèches, A et B au clavier.
Le fichier reste sur l’appareil, avec sa vitesse, sa boucle et sa transposition.

## Recueil PDF

Dans une setlist, « PDF du set » ; dans Morceaux, « Recueil PDF » (toute la bibliothèque). Un vrai
fichier PDF (A4), partagé ou téléchargé : pour une setlist, une première page avec l’ordre, les heures
prévues, les durées et les mémos ; puis chaque morceau, accords en gras au-dessus des syllabes
(police à chasse fixe), sections, infos et mémo, transposé comme au prompteur. Écrit à la main
(`songbookPdf.ts`, polices standard Courier et Helvetica) : aucune bibliothèque, marche hors ligne.

## Pédalier MIDI

Réglages → Pédalier MIDI (Chrome, Android ou ordinateur) : « Connecter », puis « Apprendre » pour
chaque pédale (droite, gauche, milieu) et un appui sur l’interrupteur voulu (note, CC ou programme ;
le relâchement ne compte pas). Les interrupteurs déclenchent ensuite les mêmes actions qu’un pédalier
Bluetooth dans chaque écran (prompteur, métronome, looper, grille, backing, routine). La connexion
revient seule au lancement ; réglage propre à l’appareil.

## Fiche de concert

Dans une setlist (« Modifier ») : un **mémo par morceau** (accordage, capo, son, qui lance l’intro),
affiché dans la liste et en haut du prompteur ; le **temps entre deux morceaux** (30 s par défaut),
d’où la durée réelle du set et, si le concert est daté, l’heure prévue de chaque titre ; une
**check-list « Avant de monter sur scène »** prête à l’emploi, à cocher, compléter, et décocher pour
le concert suivant. Tout voyage avec la setlist (synchronisée).

## Tablatures dans le carnet

Carnet → « + Tab » (nouveau riff) ou « Tablature » sur une idée : une grille six cordes × temps
(croches) à toucher, un pavé de cases (0–12, +12 pour 13–24, × étouffée, effacer), le curseur avance
tout seul. La tab s’affiche en texte (Mi aigu en haut, à copier), s’écoute au tempo de l’idée et se
synchronise avec l’idée (`Idea.tab`).

## Progrès

Pratiquer → Voir mes progrès (ou depuis le Coach) : minutes de pratique par semaine sur douze
semaines (barre touchée = valeur, vue en tableau), tempos de chaque exercice du coach séance après
séance (une courbe par exercice, jusqu’au prochain tempo prévu), bilans du coach (départ → dernier
test) et réussite à l’oreille.

## Métronome entraîneur

Métronome → Entraîneur : **tempo qui monte** (+N BPM toutes les N mesures jusqu’au tempo visé, puis
retour au tempo de départ à l’arrêt) et **mesures muettes** (jouer N mesures, couper M : on garde le
tempo seul). Le moteur compte les mesures qu’il programme (`hooks.onBar`, `hooks.muted`) : tempo et
silences changent pile au début d’une mesure.

## Oreille

Pratiquer → Oreille, trois exercices à trois niveaux : **Intervalles** (deux notes au piano, l’une
après l’autre ou ensemble : quarte, quinte, octave, puis tierces, puis tous), **Accords** (un accord
gratté : majeur/mineur, puis 7, maj7, m7, puis sus4, diminué, augmenté) et **Jouer l’accord** (l’app
nomme un accord, au hasard ou choisi ; le micro le reconnaît parmi ceux du niveau). La bonne réponse
s’affiche après chaque essai ; réussite par exercice et réponse « à revoir » gardées (`ear.stats`).

## Looper

Pratiquer › Looper : une boucle de 1 à 8 mesures au tempo choisi, enregistrée après une mesure de
décompte, puis des couches superposées, chacune exactement une boucle (capture au micro à l’échantillon
près, AudioWorklet). Le retard entre le haut-parleur et le micro est retiré de chaque couche : estimé,
réglable, ou mesuré par des bips (sans casque). Pédalier : → enregistrer, espace lecture, ← annuler.
Un limiteur sur la sortie évite la saturation quel que soit le nombre de couches ; « Fusionner » réunit
les couches audibles en une pour libérer la mémoire. La boucle va dans le carnet, ou s’exporte en pistes
WAV (chaque couche et le mix) pour un logiciel de musique.

## Importer des morceaux

Live › Morceaux › « Importer… » : fichiers ChordPro, PDF (créés par ordinateur, pas scannés) et texte où
les accords sont écrits au-dessus des paroles ; « Coller… » pour une grille copiée sur un site. Chaque accord
est placé sur la syllabe sous laquelle il est écrit (par sa position, même en police proportionnelle) ; les
noms français (Lam, Sol7) deviennent des lettres ; sections, capo, tempo, titre et artiste sont repris, la
tonalité est déduite des accords ; un recueil PDF est découpé à chaque titre. Les PDF sont lus sur
l’appareil avec pdf.js (Mozilla, licence Apache 2.0).

## Chercher un morceau sur le web

Live → Morceaux → « Chercher… » : titre et artiste, puis le navigateur s’ouvre sur une recherche
« accords paroles ». On copie la grille sur la page choisie, puis « Coller depuis le presse-papiers »
la convertit en ChordPro (avec aperçu), au nom du morceau cherché. On peut copier la page entière
(« Tout sélectionner ») : `extractSong` y retrouve la chanson (sections, accords au-dessus des paroles),
garde le titre, l’artiste, la tonalité et le capo affichés par le site, et laisse menus et commentaires. Sur Android (app installée),
« Partager → RIFFBOX » depuis la page envoie le texte sélectionné directement à l’import
(`share_target` du manifeste, adresse `/share-target`). L’app ne récupère jamais les pages elle-même :
les sites de grilles l’interdisent et les paroles sont protégées.

## Exporter vers un logiciel de musique

Réglages › « Exporter pour un logiciel de musique » : tous les enregistrements (carnet, prises vocales) en
WAV 24 bits 48 kHz, mono pour une prise de micro, dans un .zip avec un index (`index.csv`). Le nom de
chaque fichier donne la date, le titre, le tempo et la tonalité ; le fichier contient aussi le tempo
et la tonique (bloc « acid », lu par Ableton Live et FL Studio) et le titre (LIST/INFO, lu par Reaper).
Un enregistrement seul : « WAV ↓ » dans le carnet.

## Synchronisation Google Drive

Réglages → Synchronisation → « Connecter Google Drive », sur chaque appareil. Les données (idées,
grilles, morceaux, setlists, enregistrements, backing tracks perso…) se synchronisent ensuite toutes
seules (ainsi que le pédalier de l’accueil) : au démarrage, au retour sur l’app, 15 s après un changement et toutes les 5 minutes. Elles
vont dans le dossier caché de l’app dans le Drive du joueur (`drive.appdata` : le reste du Drive
n’est jamais lu). Fusion : la version la plus récente de chaque élément gagne, les suppressions
voyagent. Quand Google redemande la connexion (environ toutes les heures), un bouton
« ↻ Synchroniser » apparaît sur l’accueil.

L’identifiant OAuth Google de l’app est dans `GOOGLE_CLIENT_ID` (`src/lib/googleDrive.ts`, public) ;
sans lui, la carte l’explique et le transfert par fichier reste disponible.

**Connexion durable.** Google ne donne à une app web qu’une autorisation d’une heure. La petite
fonction Vercel `app/api/drive-token.ts` garde l’autorisation longue (« refresh token ») dans un cookie
`HttpOnly` et redonne une autorisation à la demande : la synchronisation continue sans rien demander.
Elle a besoin du secret du client OAuth dans les variables d’environnement Vercel
(`GOOGLE_CLIENT_SECRET`) ; sans lui, l’app garde la reconnexion d’une heure. En mode « Test » chez
Google, l’autorisation longue expire au bout de 7 jours : publier l’app (Google Auth Platform → Cible
→ Publier) la rend permanente.

## Ordinateur

Sur un écran d’au moins 900 px avec une souris, l’app quitte son cadre de téléphone : les onglets
deviennent une barre latérale, les écrans une colonne large et centrée ; le live, la grille (roue des quintes
à côté des accords) et le manche prennent toute la largeur ; l’accueil range quatre pédales par ligne.
On peut déposer des fichiers sur la fenêtre : PDF, ChordPro ou texte vont à l’import des morceaux, l’audio
dans « Mes fichiers » des backing tracks. « / » ou Ctrl+F (Cmd+F) cherche un morceau. Chrome et Edge
proposent d’installer l’app, qui a alors sa fenêtre et fonctionne hors ligne.

Sur une grande fenêtre (au moins 1200 px, souris) : **Live en deux volets** — la liste des morceaux
ou des setlists à gauche, le morceau ou la fiche de concert à droite, sans quitter la liste (elle
garde sa recherche, l’élément ouvert est repéré) — et **Accords en deux colonnes** (schéma et
positions à gauche ; piano, manche et « du piano à la guitare » à droite, tout visible d’un coup).
Les écrans s’affichent dans un volet grâce à `PaneContext` (sans onglets, ni barre d’état, ni retour).

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
| `tests/unit/keyDetect.test.ts` | tonalité à l’écoute : 5 progressions dans les 24 tonalités, majeur et relatif mineur départagés par la basse, degré de certitude |
| `tests/unit/suggest.test.ts` | idées d’accords pour la suite : naturels, couleurs, cadences, dans les 12 tons |
| `tests/unit/generate.test.ts` | générateur de grilles : styles, contraste couplet / refrain, accords gardés |
| `tests/unit/lyrics.test.ts` | paroles : syllabes chantées (vers célèbres), rimes, schéma de rimes, dictionnaire de rimes |
| `tests/unit/stress.test.ts` | temps forts : accent des syllabes françaises, accords calés sur la syllabe accentuée |
| `tests/unit/wav.test.ts` | WAV 24 bits (tempo, tonique, titre intégrés), ZIP, mono / stéréo |
| `tests/unit/loop.test.ts` | looper : longueur exacte des boucles, capture au micro à l’échantillon près, mixage, mesure du retard par bips |
| `tests/unit/chordSheet.test.ts` | grilles « accords au-dessus des paroles » (texte et PDF) → ChordPro : noms d’accords anglais et français, sections, capo, tonalité déduite, recueils |
| `tests/unit/coach.test.ts` | coach : niveaux à partir des tests, changements d’accords comptés, régularité au clic (indépendante du retard de l’appareil), attaques détectées, routine du jour adaptée |
| `tests/unit/pedals.test.ts` | pédales de l’accueil toutes différentes : couleur, dessin, commandes et footswitch |
| `tests/unit/cloudSync.test.ts` | synchronisation par un stockage distant : échange entre deux appareils, rien de renvoyé sans changement, suppressions, enregistrements manquants |
| `tests/unit/driveToken.test.ts` | fonction Vercel de connexion durable : échange du code, cookie illisible par la page, renouvellement, refus des autres sites |
| `tests/unit/pageSong.test.ts` | page entière copiée (type Ultimate Guitar) : la chanson seule, avec titre, artiste, tonalité et capo ; une grille seule garde l’import habituel |
| `tests/unit/coachProgress.test.ts` | coach dans la durée : tempos selon le ressenti, une réponse par jour, routine aux tempos atteints, bilan de la semaine, test du mois |
| `tests/unit/pitchShift.test.ts` | transposition sans changer la vitesse : la note entendue est la note transposée (−5 à +7 demi-tons), le niveau reste |
| `tests/unit/ear.test.ts` | oreille : questions du niveau, jamais deux fois la même, accord à jouer reconnu, scores et réponse à revoir |
| `tests/unit/progressStats.test.ts` | progrès : minutes par semaine (lundi–dimanche), tempos séance après séance |
| `tests/unit/tab.test.ts` | tablatures : cases, texte (Mi aigu en haut), notes jouées par colonne, colonnes vides retirées |
| `tests/unit/concert.test.ts` | fiche de concert : heure de début de chaque titre avec les enchaînements, check-list par défaut |
| `tests/unit/midiPedal.test.ts` | MIDI : notes, CC, programmes lus ; appui et relâchement ; un interrupteur par pédale |
| `tests/unit/songbookPdf.test.ts` | recueil PDF : accords placés sur les syllabes, accents, PDF relu par pdf.js (ordre du set, paroles, accord au-dessus du bon mot) |
| `tests/unit/piano.test.ts` | piano : position de pianiste, notes exactes de la guitare, nom de l’accord touché au clavier, notes écrites selon l’accord |
| `tests/unit/store.test.ts` | une valeur enregistrée de la mauvaise forme est ignorée au profit de la valeur par défaut |
| `tests/unit/sync.test.ts` | transfert entre appareils : dates de modification, version la plus récente, suppressions transmises, backing tracks perso avec leur son |
| `tests/unit/tools.test.ts` | capodastre, grilles et morceaux, backing tracks, fichiers de sauvegarde |
| `tests/e2e/smoke.spec.ts` | chaque écran s’ouvre, navigation, anciennes adresses, micro refusé |
| `tests/e2e/accueil.spec.ts` | tuiles, glisser-déposer, clavier, taille, catalogue, rétablir |
| `tests/e2e/accordeur-*.spec.ts` | accordeur au micro : La +10 cents, Mi grave −20 cents, mode manuel |
| `tests/e2e/metronome.spec.ts` | bouton rotatif, tap tempo, signatures, grooves, accents |
| `tests/e2e/idee.spec.ts` | « + Idée » partout : enregistrement sur place par-dessus l’écran, note écrite, tempo et ton repris de l’écran |
| `tests/e2e/carnet.spec.ts` | filtres (dont le tempo), écoute, enregistrement conservé, nommage et étiquettes, idée texte, suppression |
| `tests/e2e/grilles.spec.ts` | boucle sonore, diagrammes des accords joués en direct, édition, diagramme d’un accord, idées pour la suite, grille générée et « Une autre », riff → grille → setlist → scène |
| `tests/e2e/morceaux.spec.ts` | bibliothèque, saisie des paroles, aperçu, rimes et syllabes, accords calés sur les temps forts, scène, import et export ChordPro |
| `tests/e2e/setlists.spec.ts` | setlists, date facultative, suppression, réordonnancement, pédalier, transposition, défilement |
| `tests/e2e/pedalier.spec.ts` | voyant du pédalier, écran maintenu allumé (Wake Lock simulé), apprentissage des touches, pédalier sur le métronome, la grille, les backing tracks et la routine |
| `tests/e2e/pratiquer.spec.ts` | routine minutée, graphique, backing tracks |
| `tests/e2e/routine.spec.ts` | routine modifiable : durées, noms, ajout, ordre, retrait, temps du jour gardé, rétablir |
| `tests/e2e/voix.spec.ts` | accordeur vocal, tessiture, tonalité + capo, exercice et prise |
| `tests/e2e/accords-gammes.spec.ts` | bibliothèques d’accords (doigts, renversements) et de gammes |
| `tests/e2e/rappel.spec.ts` | rappel de sauvegarde : seulement avec du contenu perso, « Plus tard », fréquence, désactivation |
| `tests/e2e/reglages.spec.ts` | thèmes, effacement des exemples, réinitialisation, sauvegarde et fusion |
| `tests/e2e/design.spec.ts` | design system : couleurs et leurs valeurs dans les deux thèmes, composants vivants |
| `tests/e2e/accessibilite.spec.ts` | axe-core (WCAG 2.2 AA) sur les 30 écrans dans les deux thèmes et sur les feuilles ouvertes ; feuilles au clavier ; focus visible |
| `tests/e2e/petits-ecrans.spec.ts` | téléphones de 640 à 780 px de haut : rien ne reste caché sous le bouton principal ou la barre d’onglets |
| `tests/e2e/tablette.spec.ts` | tablette (iPad) : plein écran, colonne, prompteur large, manche entier, grille en deux colonnes |
| `tests/e2e/piano.spec.ts` | clavier de piano : bibliothèque d’accords (pianiste ou notes de la guitare), du piano à la guitare, grilles et prompteur |
| `tests/e2e/metronome-entraineur.spec.ts` | entraîneur : le tempo monte mesure après mesure puis revient ; les mesures muettes ne font vraiment aucun son |
| `tests/e2e/midi.spec.ts` | pédalier MIDI (simulé) : connexion, apprentissage, essai, le métronome commandé au pied |
| `tests/e2e/ordinateur-volets.spec.ts` | grande fenêtre : morceaux et setlists en deux volets (la liste reste), accords en deux colonnes |
| `tests/e2e/erreur.spec.ts` | données abîmées ignorées (les écrans s’ouvrent) ; un écran qui échoue affiche un message, le détail et une sortie |
| `tests/e2e/oreille.spec.ts` | oreille : intervalles et accords avec la réponse montrée, scores gardés ; accord demandé joué au micro (simulé) |
| `tests/e2e/progres.spec.ts` | progrès : douze semaines (graphique et tableau), courbes de tempo, bilans, oreille ; écran vide qui explique |
| `tests/e2e/tablature.spec.ts` | riff en tab : saisie case par case, nommé, affiché, écouté, modifié, gardé |
| `tests/e2e/recueil.spec.ts` | PDF du set et recueil de la bibliothèque téléchargés, avec leurs morceaux |
| `tests/e2e/relever.spec.ts` | relever : forme d’onde, vitesse, boucle A–B respectée, transposition, tout retrouvé au retour |
| `tests/e2e/schemas-live.spec.ts` | prompteur : schémas de l’accord en cours et du suivant, qui suivent la lecture ; masquables |
| `tests/e2e/suivre.spec.ts` | « Suivre ma guitare » : faux micro jouant les accords de Minuit Shuffle, le texte suit |
| `tests/e2e/tonalite-ecoute.spec.ts` | « Quel ton ? » : faux micro jouant un morceau en Ré majeur, gamme ouverte, tonalité appliquée au morceau |
| `tests/e2e/chercher.spec.ts` | chercher sur le web, coller depuis le presse-papiers (nommé d’après la recherche), partage Android reçu, refus du presse-papiers |
| `tests/e2e/concert.spec.ts` | fiche de concert : mémo (aussi au prompteur), enchaînements et heures, check-list gardée puis remise à zéro |
| `tests/e2e/drive.spec.ts` | Google Drive (simulé) : deux appareils connectés s’échangent leurs changements sans fichier, déconnexion |
| `tests/e2e/transfert.spec.ts` | téléphone ⇄ tablette : deux appareils simulés s’échangent leurs données dans les deux sens |
| `tests/e2e/voyants.spec.ts` | voyants de l’accueil : allumés par un vrai usage du jour, éteints le lendemain |
| `tests/e2e/export-daw.spec.ts` | export pour logiciel de musique : vrai enregistrement au faux micro, WAV et ZIP relus en Python (format, tempo, tonique, hauteur du son) |
| `tests/e2e/looper.spec.ts` | looper au faux micro : décompte, couches, pédalier, fusion des couches, pistes WAV d’exactement une boucle, carnet ; tempo d’une grille, retard |
| `tests/e2e/import-pdf.spec.ts` | import d’un vrai PDF (recueil de deux morceaux imprimé par Chromium) et d’un texte collé |
| `tests/e2e/backing-perso.spec.ts` | backing tracks perso : fichier associé à une backing track et choix RIFFBOX / mon fichier (son RIFFBOX inchangé), fichiers indépendants, vitesse, boucle, conservation, suppression |
| `tests/e2e/coach.spec.ts` | coach au faux micro : objectifs, styles, trois tests (accords, gamme, rythme), programme, routine du jour, retour à sa routine ; niveaux indiqués sans test |
| `tests/e2e/ordinateur.spec.ts` | ordinateur (1440 × 900) : barre latérale, colonne large, accueil sur 4 colonnes, grille et roue côte à côte, recherche au clavier, fichiers déposés sur la fenêtre |
| `tests/e2e/pwa.spec.ts` | installable, hors ligne, polices embarquées |

## Données

Le dictionnaire de rimes (`src/data/mots-fr.json`) est dérivé d’OpenSubtitles 2024 via OPUS (licence
ODC-BY), par la liste de fréquences de @zxcvbn-ts/language-fr (MIT) : voir `src/data/NOTICE-mots-fr.md`.
