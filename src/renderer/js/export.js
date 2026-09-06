/** Turns the diagram SVG into files the user can reuse elsewhere. */

import { withPixelDensity } from './png-density.js';

const PNG_SCALE = 4;

/**
 * What a pasted bitmap is worth on a page. Windows hands the clipboard a raw DIB, which
 * carries no resolution at all, so Word reads it at 96 dpi and a 4x chord diagram lands
 * eight inches wide. The pixel count is therefore the only lever on the pasted size: a
 * copy is rasterised at exactly `unitsPerInch / 96` of the drawing, so Word puts it down
 * at the size it is meant to print. The PNG and SVG exports keep the full resolution,
 * since a file can state its own density.
 *
 * It is also, by definition, the number of CSS pixels in an inch: a preview drawn at this
 * many pixels per inch is life-size on screen.
 */
export const CLIPBOARD_DPI = 96;

const MM_PER_INCH = 25.4;

/** Width of an open position: whatever its shape, a chord is drawn at one scale. */
const NOMINAL_CHORD_WIDTH = 196;

/**
 * Bounds of the export-width slider, in millimetres, for the modes that carry one. A chord
 * defaults to the width of a printed chart, a tablature to the text column of an A4 page
 * with 1,27 cm margins — which is exactly how wide a tab sits on a song sheet.
 */
export const EXPORT_WIDTH_MM = {
  chord: { min: 15, max: 60, step: 1, default: 21 },
  tab: { min: 60, max: 260, step: 5, default: 185 },
};

const storageKey = (mode) => `guitartabs.${mode}-width-mm`;

export const clampExportWidthMm = (mode, value) => {
  const bounds = EXPORT_WIDTH_MM[mode];
  if (!bounds) return 0;

  const millimetres = Math.round(Number(value));
  if (!Number.isFinite(millimetres)) return bounds.default;
  return Math.min(bounds.max, Math.max(bounds.min, millimetres));
};

/**
 * The chosen export width. Kept in the browser store rather than in the document: it is a
 * property of the page the images are going onto, not of the music being written.
 */
export const exportWidthMm = (mode) => {
  const bounds = EXPORT_WIDTH_MM[mode];
  if (!bounds) return 0;

  try {
    const stored = globalThis.localStorage?.getItem(storageKey(mode));
    return stored === null || stored === undefined ? bounds.default : clampExportWidthMm(mode, stored);
  } catch {
    return bounds.default;
  }
};

export const setExportWidthMm = (mode, value) => {
  const millimetres = clampExportWidthMm(mode, value);
  try {
    globalThis.localStorage?.setItem(storageKey(mode), String(millimetres));
  } catch {
    // A store the app cannot write to only costs the setting its memory, not the export.
  }
  return millimetres;
};

/**
 * The drawing the chosen width is measured against. A chord keeps one scale whatever it
 * holds, so it is measured against a nominal open position and a barred shape simply runs
 * a little wider; a tablature is laid out to the chosen width whatever it contains, the way
 * a paragraph fills its column, so it is measured against itself.
 */
const referenceWidth = (mode, sheetWidth) => (mode === 'chord' ? NOMINAL_CHORD_WIDTH : sheetWidth);

/** Drawing units per printed inch for a sheet laid out `millimetres` wide. */
export const unitsPerInchFor = (mode, sheetWidth, millimetres) =>
  referenceWidth(mode, sheetWidth) / (clampExportWidthMm(mode, millimetres) / MM_PER_INCH);

/**
 * How many drawing units make one printed inch, per kind of sheet. Exports carry this as
 * their pixel density, so a diagram or a tablature drops into a document at the width picked
 * in the dock — no manual resizing.
 */
export const unitsPerInch = (mode, sheetWidth) =>
  EXPORT_WIDTH_MM[mode] ? unitsPerInchFor(mode, sheetWidth, exportWidthMm(mode)) : 96;

const svgObjectUrl = (svg) =>
  URL.createObjectURL(new Blob([svg], { type: 'image/svg+xml;charset=utf-8' }));

/**
 * @param {string} svg standalone SVG markup
 * @param {number} width drawing width in SVG units
 * @param {number} height drawing height in SVG units
 * @param {{scale?: number, unitsPerInch?: number}} [options]
 */
export const svgToPngDataUrl = (svg, width, height, { scale = PNG_SCALE, unitsPerInch = 0 } = {}) =>
  new Promise((resolve, reject) => {
    const url = svgObjectUrl(svg);
    const image = new Image();

    image.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = Math.round(width * scale);
      canvas.height = Math.round(height * scale);

      const context = canvas.getContext('2d');
      context.fillStyle = '#ffffff';
      context.fillRect(0, 0, canvas.width, canvas.height);
      context.drawImage(image, 0, 0, canvas.width, canvas.height);

      URL.revokeObjectURL(url);
      resolve(withPixelDensity(canvas.toDataURL('image/png'), unitsPerInch * scale));
    };

    image.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('Le rendu PNG a échoué.'));
    };

    image.src = url;
  });

/**
 * Restates the SVG box in inches so a document lays it out at the same physical size as
 * the PNG. The `viewBox` is left alone, so the drawing simply scales into the new box.
 */
export const withPhysicalSize = (svg, width, height, unitsPerInch) => {
  if (!(unitsPerInch > 0)) return svg;
  const inches = (value) => `${(value / unitsPerInch).toFixed(3)}in`;

  return svg.replace(
    /^(<svg[^>]*?)width="[^"]*" height="[^"]*"/,
    `$1width="${inches(width)}" height="${inches(height)}"`,
  );
};

/** Keeps only characters that are safe in a file name on Windows and macOS. */
export const toFileName = (name, extension, fallback = 'accord') => {
  const cleaned = (name ?? '').replace(/[\\/:*?"<>|#]/g, '_').trim();
  return `${cleaned === '' ? fallback : cleaned}.${extension}`;
};
