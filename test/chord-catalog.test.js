import test from 'node:test';
import assert from 'node:assert/strict';

import {
  catalogShapes,
  OPEN_CHORDS,
  openShapes,
  searchCatalog,
  toChordModel,
} from '../src/renderer/js/chord-catalog.js';
import { playedFrets } from '../src/renderer/js/chord-model.js';
import { detectChordName, detectChordNames } from '../src/renderer/js/chord-namer.js';
import { chordKey } from '../src/renderer/js/chord-name.js';

test('le catalogue couvre les douze toniques et bien plus que les positions ouvertes', () => {
  const shapes = catalogShapes();
  const roots = new Set(shapes.map((shape) => shape.name.match(/^[A-G][#b]?/)[0]));

  assert.ok(shapes.length > 250, `seulement ${shapes.length} positions`);
  assert.equal(roots.size, 12);
  assert.equal(openShapes().length, OPEN_CHORDS.length);
});

test('les suffixes usuels sont représentés', () => {
  const names = new Set(catalogShapes().map((shape) => shape.name));

  for (const name of ['Cm', 'C7', 'Cm7', 'Cmaj7', 'C6', 'Cm6', 'C9', 'Cadd9', 'Csus2', 'Csus4', 'C7sus4', 'Cm7b5', 'Cdim7', 'Caug', 'C5']) {
    assert.ok(names.has(name), `${name} manquant`);
  }
});

/* La relecture de chaque position valide à la fois les doigtés saisis à la main
   et les formes mobiles transposées sur les douze toniques. */
test('chaque position du catalogue se relit comme son nom', () => {
  const failures = catalogShapes()
    .filter((shape) => !detectChordNames(playedFrets(shape.chord)).map(chordKey).includes(chordKey(shape.name)))
    .map((shape) => `${shape.name} (case ${shape.startFret}) → ${detectChordNames(playedFrets(shape.chord)).join(' / ') || 'rien'}`);

  assert.deepEqual(failures, []);
});

test('chaque position porte ses doigtés et déclare le sort de chaque corde', () => {
  const isFretted = (chord, string) =>
    chord.dots.some((dot) => dot.string === string) ||
    chord.barres.some((barre) => string >= barre.from && string <= barre.to);

  const broken = catalogShapes().filter(({ chord }) => {
    const hasFingering = chord.fingers.some((finger) => finger > 0);
    // A string is either fretted, or explicitly marked open or muted — never left implicit.
    const undecided = chord.markers.some((marker, string) => marker === null && !isFretted(chord, string));
    return !hasFingering || undecided;
  });

  assert.deepEqual(broken.map((shape) => `${shape.name} (case ${shape.startFret})`), []);
});

test('les cordes étouffées et à vide sont marquées', () => {
  const chord = toChordModel(OPEN_CHORDS.find((entry) => entry.name === 'C'));

  assert.deepEqual(chord.markers, ['muted', null, null, 'open', null, 'open']);
  assert.deepEqual(chord.fingers, [0, 3, 2, 0, 1, 0]);
});

test('un barré du catalogue devient un vrai barré', () => {
  const chord = toChordModel(OPEN_CHORDS.find((entry) => entry.name === 'F'));

  assert.deepEqual(chord.barres, [{ row: 0, from: 0, to: 5 }]);
  assert.deepEqual(
    chord.dots.map((dot) => [dot.string, dot.row]).sort(),
    [[1, 2], [2, 2], [3, 1]],
  );
});

test('une forme haute décale la case de départ', () => {
  const chord = toChordModel({ name: 'Test', frets: ['x', 7, 9, 9, 8, 7], fingers: [0, 1, 3, 4, 2, 1] });

  assert.equal(chord.startFret, 7);
  assert.deepEqual(chord.dots.map((dot) => dot.row).sort(), [0, 0, 1, 2, 2]);
});

test('catalogShapes fournit des identifiants uniques', () => {
  const shapes = catalogShapes();
  assert.equal(new Set(shapes.map((shape) => shape.id)).size, shapes.length);
});

/* ---------- Recherche ---------- */

test('la recherche classe les correspondances exactes en premier', () => {
  const results = searchCatalog('am7');

  assert.equal(results[0].name, 'Am7');
  assert.ok(results.every((shape) => shape.name.toLowerCase().includes('am7')));
});

test('la recherche accepte l autre écriture d une altération', () => {
  const flats = searchCatalog('bb7');
  const sharps = searchCatalog('a#7');

  // Mêmes positions...
  assert.deepEqual(
    sharps.map((shape) => shape.chord.dots),
    flats.map((shape) => shape.chord.dots),
  );
  assert.deepEqual(
    sharps.map((shape) => shape.startFret),
    flats.map((shape) => shape.startFret),
  );

  // ...mais affichées dans l'écriture demandée.
  assert.ok(flats.every((shape) => shape.name.startsWith('Bb')));
  assert.ok(sharps.every((shape) => shape.name.startsWith('A#')));
});

test('choisir une position trouvée par son autre écriture la nomme ainsi', () => {
  const [shape] = searchCatalog('a#9');

  assert.equal(shape.name, 'A#9');
  assert.equal(shape.chord.nameOverride, 'A#9');
  assert.equal(searchCatalog('bb9')[0].chord.nameOverride, 'Bb9');
});

test('chercher une tonique remonte toutes ses couleurs', () => {
  const names = new Set(searchCatalog('f#').map((shape) => shape.name));

  assert.ok(names.has('F#'));
  assert.ok(names.has('F#m7'));
  assert.ok(names.has('F#maj7'));
});

test('une recherche vide ne renvoie rien', () => {
  assert.deepEqual(searchCatalog('   '), []);
});

/* ---------- Lectures multiples ---------- */

test('un même doigté propose ses différentes lectures', () => {
  const readings = detectChordNames([null, 0, 2, 0, 1, 0]);

  assert.equal(readings[0], 'Am7');
  assert.ok(readings.includes('C6/A'), `lectures : ${readings.join(' / ')}`);
});

test('la lecture principale reste celle de detectChordName', () => {
  const frets = [null, 3, 2, 0, 1, 0];

  assert.equal(detectChordNames(frets)[0], detectChordName(frets));
});

test('les lectures sont uniques et limitées', () => {
  const readings = detectChordNames([0, 2, 2, 1, 0, 0]);

  assert.equal(new Set(readings).size, readings.length);
  assert.ok(readings.length <= 6);
});

test('aucune lecture pour une forme non identifiable', () => {
  assert.deepEqual(detectChordNames([0, 1, null, null, null, null]), []);
});
