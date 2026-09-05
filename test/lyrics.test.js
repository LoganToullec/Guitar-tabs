import assert from 'node:assert/strict';
import test from 'node:test';

import { emptyLine, parseLyrics, spliceLines } from '../src/renderer/js/lyrics.js';

const line = (text, chords = []) => ({ text, section: false, chords });

test('keeps blank lines, so a stanza break survives an import', () => {
  // Arrange
  const text = "J'ai un rêve\n\nJe rêve d'eau";

  // Act
  const lines = parseLyrics(text);

  // Assert
  assert.equal(lines.length, 3);
  assert.deepEqual(lines[1], emptyLine());
});

test('splices a whole pasted song into the line the caret sits on', () => {
  // Arrange
  const target = line('');

  // Act
  const { lines, caret } = spliceLines(target, 0, 0, '[Refrain]\nPêcher, pêcher\n\nPêcheur');

  // Assert
  assert.deepEqual(
    lines.map((entry) => [entry.text, entry.section]),
    [
      ['Refrain', true],
      ['Pêcher, pêcher', false],
      ['', false],
      ['Pêcheur', false],
    ],
  );
  assert.deepEqual(caret, { line: 3, index: 7 });
});

test('the words around the caret keep the first and last pasted lines', () => {
  // Arrange
  const target = line('Je dedans');

  // Act — the caret sits between « Je » and « dedans »
  const { lines, caret } = spliceLines(target, 3, 3, "rêve\nd'eau ");

  // Assert
  assert.deepEqual(
    lines.map((entry) => entry.text),
    ['Je rêve', "d'eau dedans"],
  );
  assert.deepEqual(caret, { line: 1, index: 6 });
});

test('a pasted section heading never swallows the words around it', () => {
  // Act — a heading arriving first keeps the words before the caret on their own line
  const opening = spliceLines(line('Ah !'), 4, 4, '[Pont]\nRêver');
  // …and one arriving last keeps the words after it on theirs
  const closing = spliceLines(line('Rêver'), 0, 0, 'Pêcheur\n[Pont]');

  // Assert
  assert.deepEqual(
    opening.lines.map((entry) => [entry.text, entry.section]),
    [
      ['Ah !', false],
      ['Pont', true],
      ['Rêver', false],
    ],
  );
  assert.deepEqual(
    closing.lines.map((entry) => [entry.text, entry.section]),
    [
      ['Pêcheur', false],
      ['Pont', true],
      ['Rêver', false],
    ],
  );
});

test('chords stay on their word when a paste pushes it along', () => {
  // Arrange
  const target = line('rêve', [{ index: 0, name: 'C/E' }]);

  // Act — type-in a new first word, so the chord slides right by its length
  const { lines } = spliceLines(target, 0, 0, 'Je\n');

  // Assert
  assert.deepEqual(lines[0].chords, []);
  assert.deepEqual(lines[1].chords, [{ index: 0, name: 'C/E' }]);
});
