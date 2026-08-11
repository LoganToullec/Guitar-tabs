import test from 'node:test';
import assert from 'node:assert/strict';

import {
  createChord,
  cycleFinger,
  cycleMarker,
  isBlank,
  parseChord,
  playedFrets,
  setFretCount,
  setStartFret,
  toggleBarre,
  toggleNote,
} from '../src/renderer/js/chord-model.js';

const withDots = (chord, cells) => cells.reduce((acc, [string, row]) => toggleNote(acc, string, row), chord);

test('poser un point ne modifie pas l accord d origine', () => {
  const chord = createChord();
  const next = toggleNote(chord, 2, 1);

  assert.equal(chord.dots.length, 0);
  assert.deepEqual(next.dots, [{ string: 2, row: 1 }]);
});

test('recliquer sur un point le retire', () => {
  const chord = toggleNote(createChord(), 2, 1);
  assert.equal(toggleNote(chord, 2, 1).dots.length, 0);
});

test('un nouveau point déplace celui déjà posé sur la corde', () => {
  const chord = withDots(createChord(), [[2, 1], [2, 3]]);
  assert.deepEqual(chord.dots, [{ string: 2, row: 3 }]);
});

test('un barré exige trois cordes consécutives', () => {
  const chord = withDots(createChord(), [[0, 0], [1, 0]]);
  const { chord: next, error } = toggleBarre(chord, 0, 0);

  assert.match(error, /3 cordes/);
  assert.equal(next, chord);
});

test('un barré remplace les points de la série', () => {
  const chord = withDots(createChord(), [[1, 0], [2, 0], [3, 0]]);
  const { chord: next, error } = toggleBarre(chord, 2, 0);

  assert.equal(error, null);
  assert.deepEqual(next.barres, [{ row: 0, from: 1, to: 3 }]);
  assert.equal(next.dots.length, 0);
});

test('un clic droit sur un barré le redécompose en points', () => {
  const barred = toggleBarre(withDots(createChord(), [[1, 0], [2, 0], [3, 0]]), 2, 0).chord;
  const { chord: next } = toggleBarre(barred, 2, 0);

  assert.equal(next.barres.length, 0);
  assert.equal(next.dots.length, 3);
});

test('un clic gauche dans un barré retire seulement cette corde', () => {
  const barred = toggleBarre(withDots(createChord(), [[1, 0], [2, 0], [3, 0]]), 2, 0).chord;
  const next = toggleNote(barred, 2, 0);

  assert.equal(next.barres.length, 0);
  assert.deepEqual(
    next.dots.map((dot) => dot.string).sort(),
    [1, 3],
  );
});

test('étouffer une corde retire son point et son doigté', () => {
  const chord = cycleFinger(toggleNote(createChord(), 4, 2), 4);
  const muted = cycleMarker(cycleMarker(chord, 4), 4);

  assert.equal(muted.markers[4], 'muted');
  assert.equal(muted.dots.length, 0);
  assert.equal(muted.fingers[4], 0);
});

test('les cases jouées tiennent compte du barré, des points et de la case de départ', () => {
  const shape = withDots(createChord(), [[0, 0], [1, 0], [2, 0], [3, 0], [4, 0], [5, 0]]);
  const barred = toggleBarre(shape, 0, 0).chord;
  const withMelody = withDots(barred, [[1, 2], [2, 2], [3, 1]]);
  const moved = setStartFret(withMelody, 3);

  // Forme de mi barrée en case 3 : le sol majeur barré.
  assert.deepEqual(playedFrets(moved), [3, 5, 5, 4, 3, 3]);
});

test('une grille intacte est considérée comme vide', () => {
  assert.equal(isBlank(createChord()), true);
  assert.equal(isBlank(toggleNote(createChord(), 0, 0)), false);
  assert.equal(isBlank(cycleMarker(createChord(), 0)), false);
});

test('une corde étouffée ne joue pas', () => {
  const chord = cycleMarker(cycleMarker(createChord(), 0), 0);
  assert.deepEqual(playedFrets(chord), [null, 0, 0, 0, 0, 0]);
});

test('réduire la grille supprime les points hors cadre', () => {
  const chord = withDots(createChord(), [[0, 4], [1, 1]]);
  const smaller = setFretCount(chord, 3);

  assert.deepEqual(smaller.dots, [{ string: 1, row: 1 }]);
});

test('la case de départ reste dans les bornes', () => {
  assert.equal(setStartFret(createChord(), 0).startFret, 1);
  assert.equal(setStartFret(createChord(), 99).startFret, 22);
});

test('parseChord rétablit un accord enregistré', () => {
  const barred = toggleBarre(
    withDots(createChord(), [[0, 0], [1, 0], [2, 0]]),
    1,
    0,
  ).chord;
  const chord = cycleFinger(setStartFret(barred, 5), 3, 2);

  assert.deepEqual(parseChord(JSON.parse(JSON.stringify(chord))), chord);
});

test('parseChord neutralise des données incohérentes', () => {
  const chord = parseChord({
    startFret: -4,
    fretCount: 99,
    dots: [{ string: 42, row: 42 }],
    barres: [{ row: 0, from: 3, to: 1 }],
    markers: ['bogus', 'muted'],
    fingers: [9, -1],
    nameOverride: 42,
  });

  assert.equal(chord.startFret, 1);
  assert.equal(chord.fretCount, 7);
  assert.deepEqual(chord.dots, [{ string: 5, row: 6 }]);
  assert.deepEqual(chord.barres, [{ row: 0, from: 1, to: 3 }]);
  assert.deepEqual(chord.markers, [null, 'muted', null, null, null, null]);
  assert.deepEqual(chord.fingers, [5, 0, 0, 0, 0, 0]);
  assert.equal(chord.nameOverride, null);
});
