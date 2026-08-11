import test from 'node:test';
import assert from 'node:assert/strict';

import { detectChordName } from '../src/renderer/js/chord-namer.js';

const cases = [
  ['reconnaît un mi majeur ouvert', [0, 2, 2, 1, 0, 0], 'E'],
  ['reconnaît un la mineur ouvert', [null, 0, 2, 2, 1, 0], 'Am'],
  ['reconnaît un do majeur ouvert', [null, 3, 2, 0, 1, 0], 'C'],
  ['reconnaît un sol majeur ouvert', [3, 2, 0, 0, 0, 3], 'G'],
  ['reconnaît un ré majeur ouvert', [null, null, 0, 2, 3, 2], 'D'],
  ['reconnaît un fa barré en case 1', [1, 3, 3, 2, 1, 1], 'F'],
  ['reconnaît un si bémol barré en case 1', [null, 1, 3, 3, 3, 1], 'Bb'],
  ['reconnaît un accord de septième', [0, 2, 0, 1, 0, 0], 'E7'],
  ['reconnaît une septième mineure', [null, 0, 2, 0, 1, 0], 'Am7'],
  ['reconnaît une septième majeure', [null, 3, 2, 0, 0, 0], 'Cmaj7'],
  ['reconnaît un sus4', [null, null, 0, 2, 3, 3], 'Dsus4'],
  ['reconnaît un sus2', [null, null, 0, 2, 3, 0], 'Dsus2'],
  ['reconnaît un power chord', [3, 5, null, null, null, null], 'G5'],
  ['note la basse en accord renversé', [0, 3, 2, 0, 1, 0], 'C/E'],
];

for (const [title, frets, expected] of cases) {
  test(title, () => {
    assert.equal(detectChordName(frets), expected);
  });
}

test('renvoie null quand aucune corde ne sonne', () => {
  assert.equal(detectChordName([null, null, null, null, null, null]), null);
});

test('renvoie null pour un intervalle non identifiable', () => {
  assert.equal(detectChordName([0, 1, null, null, null, null]), null);
});

test('renvoie null quand une seule hauteur est jouée', () => {
  assert.equal(detectChordName([0, null, null, null, null, 0]), null);
});
