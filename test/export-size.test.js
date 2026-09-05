import assert from 'node:assert/strict';
import test from 'node:test';

import { createChord } from '../src/renderer/js/chord-model.js';
import { diagramSize } from '../src/renderer/js/diagram-renderer.js';
import { CLIPBOARD_DPI, UNITS_PER_INCH } from '../src/renderer/js/export.js';

const CM_PER_INCH = 2.54;

/** The chord charts of the reference sheet: 3500x4280 px laid out 2,05 cm wide. */
const REFERENCE = { aspect: 3500 / 4280, widthCm: 2.05 };

const openChord = () => ({
  ...createChord(),
  dots: [
    { string: 0, row: 1 },
    { string: 3, row: 1 },
    { string: 4, row: 0 },
  ],
  markers: [null, 'open', 'open', null, null, 'muted'],
});

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

test('a copied chord is the pixel size Word lays down at 96 dpi', () => {
  // Arrange — the clipboard carries no density, so pixels are the only size there is
  const { width } = diagramSize(openChord(), { trimEmptyFingers: true });

  // Act
  const pixels = Math.round((width * CLIPBOARD_DPI) / UNITS_PER_INCH.chord);
  const centimetres = (pixels / CLIPBOARD_DPI) * CM_PER_INCH;

  // Assert
  assert.ok(
    Math.abs(centimetres - REFERENCE.widthCm) < 0.1,
    `a paste would be ${centimetres.toFixed(2)} cm wide, not ${REFERENCE.widthCm} cm`,
  );
});
