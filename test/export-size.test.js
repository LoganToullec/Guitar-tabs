import assert from 'node:assert/strict';
import test from 'node:test';

import { createChord } from '../src/renderer/js/chord-model.js';
import { diagramSize } from '../src/renderer/js/diagram-renderer.js';
import {
  CHORD_WIDTH_MM,
  chordUnitsPerInch,
  clampChordWidthMm,
  CLIPBOARD_DPI,
} from '../src/renderer/js/export.js';

const MM_PER_INCH = 25.4;

/** The chord charts of the reference sheet: 3500x4280 px laid out 2,05 cm wide. */
const REFERENCE = { aspect: 3500 / 4280, widthMm: 20.5 };

const openChord = () => ({
  ...createChord(),
  dots: [
    { string: 0, row: 1 },
    { string: 3, row: 1 },
    { string: 4, row: 0 },
  ],
  markers: [null, 'open', 'open', null, null, 'muted'],
});

/** What Word lays down for a copy: the clipboard carries pixels, never a density. */
const pastedMm = (millimetres) => {
  const { width } = diagramSize(openChord(), { trimEmptyFingers: true });
  const pixels = Math.round((width * CLIPBOARD_DPI) / chordUnitsPerInch(millimetres));
  return (pixels / CLIPBOARD_DPI) * MM_PER_INCH;
};

test('an exported chord keeps the proportions of the reference chart', () => {
  // Arrange
  const chord = openChord();

  // Act
  const { width, height } = diagramSize(chord, { trimEmptyFingers: true });

  // Assert
  assert.ok(
    Math.abs(width / height - REFERENCE.aspect) < 0.01,
    `aspect ${width / height} is not the reference ${REFERENCE.aspect}`,
  );
});

test('the default width is the one the reference sheet prints at', () => {
  // Act
  const millimetres = pastedMm(CHORD_WIDTH_MM.default);

  // Assert
  assert.ok(
    Math.abs(millimetres - REFERENCE.widthMm) < 1,
    `a paste would be ${millimetres.toFixed(1)} mm wide, not ${REFERENCE.widthMm} mm`,
  );
});

test('a chord is pasted at the width the slider asks for', () => {
  for (const millimetres of [CHORD_WIDTH_MM.min, 30, 45, CHORD_WIDTH_MM.max]) {
    // Act
    const actual = pastedMm(millimetres);

    // Assert — rounding to whole pixels is the only slack allowed
    assert.ok(
      Math.abs(actual - millimetres) <= MM_PER_INCH / CLIPBOARD_DPI,
      `asked for ${millimetres} mm, Word would lay down ${actual.toFixed(2)} mm`,
    );
  }
});

test('a width out of the slider range is brought back inside it', () => {
  // Assert
  assert.equal(clampChordWidthMm(0), CHORD_WIDTH_MM.min);
  assert.equal(clampChordWidthMm(500), CHORD_WIDTH_MM.max);
  assert.equal(clampChordWidthMm('abc'), CHORD_WIDTH_MM.default);
  assert.equal(clampChordWidthMm(30), 30);
});
