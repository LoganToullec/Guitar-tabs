import assert from 'node:assert/strict';
import test from 'node:test';

import { createChord } from '../src/renderer/js/chord-model.js';
import { createTab } from '../src/renderer/js/tab-model.js';
import { diagramSize } from '../src/renderer/js/diagram-renderer.js';
import { tabSize } from '../src/renderer/js/tab-renderer.js';
import {
  clampExportWidthMm,
  CLIPBOARD_DPI,
  EXPORT_WIDTH_MM,
  unitsPerInchFor,
} from '../src/renderer/js/export.js';

const MM_PER_INCH = 25.4;

/** The chord charts of the reference sheet: 3500x4280 px laid out 2,05 cm wide. */
const REFERENCE_CHORD = { aspect: 3500 / 4280, widthMm: 20.5 };

/** Its tablatures: the full text column of an A4 page with 1,27 cm margins. */
const REFERENCE_TAB_MM = 184.6;

const openChord = () => ({
  ...createChord(),
  dots: [
    { string: 0, row: 1 },
    { string: 3, row: 1 },
    { string: 4, row: 0 },
  ],
  markers: [null, 'open', 'open', null, null, 'muted'],
});

const sheetWidth = {
  chord: () => diagramSize(openChord(), { trimEmptyFingers: true }).width,
  tab: () => tabSize(createTab()).width,
};

/** What Word lays down for a copy: the clipboard carries pixels, never a density. */
const pastedMm = (mode, millimetres) => {
  const width = sheetWidth[mode]();
  const pixels = Math.round((width * CLIPBOARD_DPI) / unitsPerInchFor(mode, width, millimetres));
  return (pixels / CLIPBOARD_DPI) * MM_PER_INCH;
};

test('an exported chord keeps the proportions of the reference chart', () => {
  // Arrange
  const chord = openChord();

  // Act
  const { width, height } = diagramSize(chord, { trimEmptyFingers: true });

  // Assert
  assert.ok(
    Math.abs(width / height - REFERENCE_CHORD.aspect) < 0.01,
    `aspect ${width / height} is not the reference ${REFERENCE_CHORD.aspect}`,
  );
});

test('the default chord width is the one the reference sheet prints at', () => {
  // Act
  const millimetres = pastedMm('chord', EXPORT_WIDTH_MM.chord.default);

  // Assert
  assert.ok(
    Math.abs(millimetres - REFERENCE_CHORD.widthMm) < 1,
    `a paste would be ${millimetres.toFixed(1)} mm wide, not ${REFERENCE_CHORD.widthMm} mm`,
  );
});

test('the default tablature width is the text column of the reference sheet', () => {
  // Act
  const millimetres = pastedMm('tab', EXPORT_WIDTH_MM.tab.default);

  // Assert
  assert.ok(
    Math.abs(millimetres - REFERENCE_TAB_MM) < 1,
    `a paste would be ${millimetres.toFixed(1)} mm wide, not ${REFERENCE_TAB_MM} mm`,
  );
});

test('a sheet is pasted at the width the slider asks for', () => {
  for (const mode of ['chord', 'tab']) {
    const bounds = EXPORT_WIDTH_MM[mode];

    for (const millimetres of [bounds.min, bounds.default, bounds.max]) {
      // Act
      const actual = pastedMm(mode, millimetres);

      // Assert — rounding to whole pixels is the only slack allowed
      assert.ok(
        Math.abs(actual - millimetres) <= MM_PER_INCH / CLIPBOARD_DPI,
        `${mode}: asked for ${millimetres} mm, Word would lay down ${actual.toFixed(2)} mm`,
      );
    }
  }
});

test('a chord keeps one scale whatever its shape', () => {
  // Arrange — a position away from the nut carries a "3fr" label, so it draws wider
  const barred = { ...openChord(), startFret: 3 };

  // Act
  const open = unitsPerInchFor('chord', diagramSize(openChord(), { trimEmptyFingers: true }).width, 30);
  const moved = unitsPerInchFor('chord', diagramSize(barred, { trimEmptyFingers: true }).width, 30);

  // Assert
  assert.equal(open, moved);
});

test('a width out of the slider range is brought back inside it', () => {
  // Assert
  assert.equal(clampExportWidthMm('chord', 0), EXPORT_WIDTH_MM.chord.min);
  assert.equal(clampExportWidthMm('chord', 500), EXPORT_WIDTH_MM.chord.max);
  assert.equal(clampExportWidthMm('chord', 'abc'), EXPORT_WIDTH_MM.chord.default);
  assert.equal(clampExportWidthMm('chord', 30), 30);

  assert.equal(clampExportWidthMm('tab', 10), EXPORT_WIDTH_MM.tab.min);
  assert.equal(clampExportWidthMm('tab', 900), EXPORT_WIDTH_MM.tab.max);
  assert.equal(clampExportWidthMm('tab', 120), 120);
});
