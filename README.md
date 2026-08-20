# GuitarTabs

Petite application desktop (Electron) pour écrire de la guitare, en quatre modes :

- **Accord** — une grille de manche cliquable, avec barrés, croix de cordes étouffées,
  doigtés, case de départ et **détection automatique du nom de l'accord**.
- **Tablature** — une tablature linéaire à six lignes pour le fingerstyle, les riffs
  et les intros, avec mesures de longueur libre, techniques et retour à la ligne.
- **Chanson** — une partition complète qui assemble les diagrammes d'accords, une
  rythmique, des tablatures et les paroles avec les accords placés au-dessus des mots.
- **Bibliothèque** — les chansons enregistrées, rangées par artiste et par dossier.

Portable : un seul exécutable, rien à installer.

## Interface

Tout se pilote au clic, sans formulaire : le sélecteur de mode en haut à gauche,
la barre d'outils flottante en haut à droite (fichier, annuler/rétablir, exports),
la feuille blanche au centre, et un dock en bas propre à chaque mode.
Chaque bouton a une infobulle. `Ctrl+1` à `Ctrl+4` basculent d'un mode à l'autre.

## Mode Accord

| Geste | Effet |
|---|---|
| **Clic** sur une case de la grille | Poser / retirer un point |
| **Clic droit** sur un point | Créer ou défaire un barré (3 cordes consécutives minimum) |
| **Clic au-dessus** d'une corde | Rien → ○ (corde à vide) → ✕ (corde étouffée) |
| **Clic en dessous** d'une corde | Doigt 1 → 5 (clic droit pour reculer) |
| **Clic sur la zone « 3fr »** | Case de départ suivante (clic droit : précédente) |
| **Clic sur le titre** | Saisir un nom d'accord manuel |

Raccourcis : `Ctrl+Z` / `Ctrl+Y` annuler-rétablir, `Ctrl+S` enregistrer, `Ctrl+O` ouvrir,
`Ctrl+N` nouveau, `Ctrl+E` export PNG, `Ctrl+Maj+C` copier l'image.

### Nom de l'accord

Le nom est déduit des cordes jouées (accordage standard **E A D G B E**) et s'écrit
directement en haut de la feuille — le champ est éditable pour forcer un nom, et l'icône
✨ qui apparaît alors permet de revenir à la détection automatique.

Une corde sans point et sans marque est considérée **à vide**, comme sur un tab ;
une corde marquée ✕ est ignorée. Si la forme ne correspond à aucun accord connu, le titre
affiche le placeholder *« Accord non reconnu »* en gris.

La détection couvre les triades, sus2/sus4, power chords, 6, 7, maj7, m7, m7b5, dim7, 9, 11, 13,
les altérations courantes et les renversements (notés `C/E`).

### Plusieurs lectures pour un même doigté

Un doigté a rarement un seul nom juste : `Am7` et `C6/A`, c'est la même poignée. La barre
**Lectures**, sous la feuille, propose toutes les lectures valables classées de la plus
probable à la moins probable ; un clic adopte celle qu'on veut, l'icône ✨ revient à
l'automatique. La barre disparaît quand il n'y a qu'une lecture.

### Bibliothèque d'accords

Le dock donne accès à un catalogue de **363 positions**, chacune avec sa case de départ,
ses doigtés, ses cordes à vide et ses cordes étouffées :

- **34 positions ouvertes** écrites à la main, parce qu'elles sont idiomatiques ;
- le reste vient de **formes mobiles transposées sur les douze toniques** — comme un
  guitariste pense les barrés. Trois familles : fondamentale sur mi grave, sur la, et sur ré.

Couleurs disponibles : majeur, m, 5, 6, m6, 7, m7, maj7, m7b5, dim7, aug, sus2, sus4,
7sus4, 9, add9. Soit `Ebm7`, `F#maj7`, `Bb9`, `C#sus4`… la plupart des positions à trois
ou quatre voix qu'on rencontre.

La fenêtre s'ouvre sur les positions ouvertes ; **la recherche** donne accès au reste :
tapez `am7`, `f#`, `maj7`, `Bb9`… Les deux écritures d'une altération marchent (`Bb` et
`A#` donnent le même résultat), et une tonique seule remonte toutes ses couleurs.

Deux boutons :

- **Bibliothèque d'accords** — ouvre le catalogue ; un clic charge la position dans l'éditeur.
- **Enregistrer cet accord** — range la grille courante sous son nom dans « Mes accords ».
  Le même nom remplace la position précédente ; clic droit sur une vignette pour l'oublier.

Depuis le mode Chanson, le **+** du tiroir ouvre le même catalogue et ajoute la position
choisie directement à la partition. Vos accords sont rangés dans le même `library.json`
que les chansons.

## Mode Tablature

Six lignes (E A D G B e), découpées en mesures. On clique une case pour y poser le
curseur, puis on tape.

| Geste | Effet |
|---|---|
| **Clic** sur une case | Y placer le curseur |
| **Chiffres** | Écrire la case jouée (2 chiffres possibles : `12`) |
| **Espace** ou **Entrée** | Avancer d'une colonne (les barres de mesure se traversent) |
| **Flèches** | Déplacer le curseur (haut = corde plus aiguë) |
| **Retour arrière** | Effacer le dernier caractère |
| **Clic droit** sur une case | Vider la case |

### Mesures de longueur libre

Chaque mesure a **sa propre longueur** : rien n'oblige deux mesures voisines à contenir
le même nombre de notes. Le stepper « cases » du dock agit sur la mesure où se trouve le
curseur, et la palette permet d'**insérer** (`Inser`) ou de **supprimer** une case
exactement à la position du curseur — le reste de la mesure se décale.

Les colonnes s'élargissent d'elles-mêmes quand une case porte une étiquette longue
(`<12>`, `(15)`), donc deux notes voisines ne se chevauchent jamais.

### Techniques

La palette au-dessus du dock reflète et modifie la note sélectionnée ; chaque bouton a
aussi un raccourci clavier.

| Technique | Touche | Rendu |
|---|---|---|
| Hammer-on / pull-off | `h` `p` | lettre entre les deux notes de la corde |
| Bend / relâché | `b` `r` | lettre entre les deux notes |
| Slide montant / descendant | `/` `\\` | trait incliné entre les deux notes |
| Ghost note | `g` | `(5)` |
| Note morte | `x` | `x` |
| Harmonique | `n` | `<12>` |
| Vibrato | `~` | `7~` |
| Tapping | `t` | `t7` |
| Palm mute | `m` | `P.M.` et ligne pointillée au-dessus de la portée |

Les liaisons (`h p b r / \`) relient la note à la **suivante jouée sur la même corde**,
même par-dessus une barre de mesure.

### Accords au-dessus de la portée

La bande au-dessus de chaque ligne est un rail d'accords : un clic dessus (ou flèche
haut depuis la corde aiguë) y place le curseur, et on tape le nom — `Am`, `Fmaj7`,
`C/G`, `F#m7b5`… Le libellé se pose sur **n'importe quelle colonne**, pas seulement en
début de mesure, et se recale automatiquement s'il déborderait de la ligne.

Le dock règle le nombre de mesures, la longueur de la mesure courante et le nombre de
mesures par ligne — au-delà, la tablature repart à la ligne comme sur un tab papier.

### Titre facultatif

Le titre n'est qu'une commodité d'édition : à l'export, une tablature sans titre n'en
réserve pas la place, et une tablature qui en porte un le colle juste au-dessus de la
portée. Une tablature reprise dans une chanson laisse toujours son titre de côté, la
partition ayant déjà le sien.

## Mode Chanson

La partition est une pile de **sections** que l'on empile, réordonne et supprime depuis
le panneau de droite. Chaque section se rend sur la même feuille, exportable d'un bloc.

| Section | Comment l'ajouter |
|---|---|
| **Accords** | Depuis le mode Accord, bouton « Ajouter à la chanson » — les diagrammes s'alignent en haut de la partition et passent à la ligne tout seuls |
| **Tablature** | Depuis le mode Tablature, même bouton |
| **Rythmique** | Bouton du dock. Nom, tempo, croches ou doubles ; on clique les flèches **sur la partition** pour cycler ↓ → ↑ → ✕ (clic droit pour reculer) |
| **Paroles** | Bouton du dock, puis on écrit directement sur la partition |

Clic sur une section de la partition pour la sélectionner.

### Tiroir d'accords

À l'écran, les diagrammes ne sont pas posés en haut de la feuille : ils vivent dans un
**tiroir épinglé à gauche**, donc ils restent visibles quel que soit l'endroit de la
chanson qu'on est en train de lire. Le tiroir se replie d'un clic sur son chevron, et un
clic droit (ou la croix au survol) retire un accord.

L'**export**, lui, garde la rangée d'accords en tête de page : une partition imprimée doit
se suffire à elle-même.

### Défilement automatique

Le dock a un bouton lecture/pause et un curseur de vitesse (4 à 120 px/s). **Barre
d'espace** pour démarrer ou arrêter, et un coup de molette reprend la main immédiatement.
Le défilement s'arrête tout seul en bas de la partition et en changeant de mode.

### Paroles et accords

Les paroles s'écrivent **directement sur la partition**, ligne par ligne, à l'endroit où
elles s'impriment :

| Geste | Effet |
|---|---|
| **Entrée** | Passer à la ligne (coupe la ligne au curseur) |
| **Retour arrière** en début de ligne | Recoller à la ligne précédente |
| **Flèches haut / bas** | Passer d'une ligne à l'autre |
| **Maj+Tab** | Basculer la ligne en titre de section (*Couplet*, *Refrain*…) |
| **Clic dans la bande au-dessus d'une ligne** | Poser un accord sur le mot visé |
| **Clic sur un accord** | Le changer · **clic droit** : l'enlever |

Aucun crochet à taper : le clic ouvre un sélecteur qui propose **les accords déjà présents
dans la chanson** (ceux du tiroir, plus ceux déjà placés), avec un champ libre pour tout
autre nom. L'accord se cale automatiquement sur le début du mot cliqué, et suit le mot
quand on insère ou supprime du texte avant lui.

Le format à crochets (`[Am]`) reste compris **à l'import**, donc coller une grille
ChordPro fonctionne toujours.

### Contrôle des accords

Le panneau signale en permanence les **accords appelés par les paroles dont la partition
ne montre pas la position** — le lecteur serait sinon obligé de deviner. Les enharmoniques
sont rapprochés (`A#` et `Bb` sont le même accord), les suffixes non (`Am` ≠ `Amaj7`), et
un diagramme dont le nom n'est pas reconnu ne compte pas comme défini. Quand tout est
couvert, le panneau signale à l'inverse les diagrammes qu'aucune ligne n'utilise.

### Import des paroles

Le panneau de droite sert uniquement à **chercher** des paroles : un champ libre (artiste,
titre, les deux…) interroge [LRCLIB](https://lrclib.net), une base communautaire libre sans
clé d'API, et **tous les résultats s'affichent** avec artiste, album et durée. Un clic sur
le bon remplit la partition, et complète le titre et l'artiste s'ils étaient vides.

La requête part du **processus principal** (le renderer reste isolé) et n'envoie que ce qui
est tapé dans le champ. Les paroles récupérées restent la propriété de leurs ayants droit —
l'import est là pour un usage personnel.

### Tiroir et panneau

Le tiroir d'accords (à gauche) affiche des **vignettes** sur deux colonnes, faites pour un
coup d'œil, pas pour un déchiffrage. Le tiroir **et** le panneau de droite se replient
chacun d'un clic sur leur chevron ; la partition se recentre à chaque fois.

## Mode Bibliothèque

Depuis le mode Chanson, le bouton **« Enregistrer dans la bibliothèque »** range la
partition courante. Tant qu'on reste sur la même chanson, réenregistrer **met à jour**
son entrée ; « Nouveau » repart d'une fiche vierge.

- **Artistes** — l'artiste saisi sur la partition est enregistré une fois pour toutes.
  Le champ Artiste de la fiche propose ensuite les artistes connus par auto-complétion,
  donc une deuxième chanson s'attribue au même artiste en deux frappes. La casse est
  ignorée (« radiohead » retrouve « Radiohead »), et un artiste sans plus aucune chanson
  disparaît de la liste tout seul.
- **Dossiers** — créés dans la colonne de gauche, avec le compte de chansons. Supprimer
  un dossier ne supprime jamais les chansons : elles retournent dans « Hors dossier ».
- **Tri** — par artiste (avec en-têtes de groupe), par titre ou par date de modification.
  Un champ de recherche filtre sur le titre et l'artiste.
- **Ouvrir** — double-clic sur une chanson (ou le bouton de sa fiche) la charge dans le
  mode Chanson ; les enregistrements suivants mettent à jour cette entrée.

La bibliothèque est écrite dans `library.json`, dans le dossier de données utilisateur
d'Electron (`%APPDATA%\GuitarTabs` sous Windows, `~/Library/Application Support/GuitarTabs`
sous macOS) — donc en dehors de l'exécutable portable. L'écriture passe par un fichier
temporaire renommé, pour qu'une sauvegarde interrompue ne tronque jamais le fichier.

### Export

- **PNG** : rendu 4× (fond blanc), prêt à coller dans un document.
- **SVG** : vectoriel, redimensionnable sans perte.

Les deux portent leur **taille d'impression**, pas seulement leur nombre de pixels : un
diagramme d'accord se pose à environ 2 cm de large, une tablature à la largeur d'un tab
papier. Collé dans Word, l'export arrive donc à la bonne échelle sans être redimensionné
à la main.

- **Copier** : met l'image PNG dans le presse-papiers.
- **Enregistrer / Ouvrir** : fichier `.gtab` (JSON) pour retravailler la feuille plus tard.
  Le fichier porte son mode, et l'ouverture bascule automatiquement dessus.

## Développement

```bash
npm install
npm start      # lance l'application
npm test       # tests unitaires (modèle + reconnaissance d'accords)
```

`npm start` passe par `tools/run-electron.cjs`, qui retire `ELECTRON_RUN_AS_NODE` de
l'environnement — sans ça, un lancement depuis un terminal intégré VS Code démarre
Electron en mode Node et l'application ne s'ouvre pas.

## Icône

La source est [build/icon.svg](build/icon.svg). Après modification :

```bash
npm run icons   # régénère build/icon.png, build/icon.ico et build/icon.icns
```

Le script rastérise le SVG dans un rendu Electron, puis assemble les conteneurs `.ico`
et `.icns` à la main (aucune dépendance externe). Le résumé est écrit dans
`build/icons.log` car le processus principal d'Electron n'a pas de console attachée
sous Windows.

## Build portable

```bash
npm run dist:win   # -> dist/GuitarTabs-1.0.0-portable.exe   (un seul .exe, aucune installation)
npm run dist:mac   # -> dist/GuitarTabs-1.0.0-<arch>-portable.zip  (contient GuitarTabs.app)
```

Le build macOS doit être lancé **depuis un Mac** (electron-builder a besoin des outils
Apple pour produire un `.app`). Le `.app` n'étant pas signé, au premier lancement il faut
faire *clic droit → Ouvrir*, ou lever la quarantaine :
`xattr -cr /chemin/vers/GuitarTabs.app`.

## Architecture

```
src/main/main.cjs            Processus principal : fenêtre, protocole app://, dialogues, presse-papiers
src/main/preload.cjs         Pont IPC exposé au renderer (contextIsolation activée)
src/renderer/index.html      Interface
src/renderer/styles.css      Thème « liquid glass »
src/renderer/js/app.js              Coquille : sélecteur de mode, barre d'outils, fichiers
src/renderer/js/chord-view.js       Contrôleur du mode Accord
src/renderer/js/tab-view.js         Contrôleur du mode Tablature
src/renderer/js/song-view.js        Contrôleur du mode Chanson (panneau de sections)
src/renderer/js/library-view.js     Contrôleur du mode Bibliothèque
src/renderer/js/library-model.js    Modèle immuable de la bibliothèque (artistes, dossiers)
src/renderer/js/chord-model.js      Modèle immuable de l'accord (points, barrés, marques, doigtés)
src/renderer/js/chord-namer.js      Reconnaissance d'accord à partir des cases jouées
src/renderer/js/chord-name.js       Règle de nommage partagée (manuel / détecté / placeholder)
src/renderer/js/chord-catalog.js    Catalogue de positions courantes
src/renderer/js/catalog-view.js     Fenêtre de la bibliothèque d'accords
src/renderer/js/diagram-renderer.js Génération du SVG de la grille (affichage et export)
src/renderer/js/tab-model.js        Modèle immuable de la tablature (mesures, notes, techniques)
src/renderer/js/tab-renderer.js     Génération du SVG de la tablature
src/renderer/js/song-model.js       Modèle immuable de la partition (sections)
src/renderer/js/song-renderer.js    Composition de la page complète
src/renderer/js/lyrics.js           Lignes de paroles, accords positionnés, import ChordPro
src/renderer/js/lyrics-editor.js    Édition des paroles posée sur la partition
src/renderer/js/autoscroll.js       Défilement automatique de la feuille
src/renderer/js/dom.js              Petits utilitaires DOM partagés
src/renderer/js/sheet-title.js      Titre éditable superposé au SVG
src/renderer/js/icons.js            Jeu d'icônes SVG inline
src/renderer/js/history.js          Pile annuler / rétablir
src/renderer/js/export.js           SVG → PNG, taille d'impression, noms de fichiers
src/renderer/js/png-density.js      Densité (pHYs) inscrite dans le PNG exporté
tools/make-icons.cjs         Génération des icônes de l'application
tools/run-electron.cjs       Lanceur Electron à environnement nettoyé
test/                        Tests unitaires (node:test)
```
 
 
