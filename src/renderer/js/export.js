/** Turns the diagram SVG into files the user can reuse elsewhere. */

import { withPixelDensity } from './png-density.js';

const PNG_SCALE = 4;

/**
 * How many drawing units make one printed inch, per kind of sheet. Exports carry this as
 * their pixel density, so a chord diagram drops into a document at the size of a printed
 * chord chart and a tablature at the width of a paper tab — no manual resizing.
 */
export const UNITS_PER_INCH = { chord: 240, tab: 96, song: 96 };

/**
 * What a pasted bitmap is worth on a page. Windows hands the clipboard a raw DIB, which
 * carries no resolution at all, so Word reads it at 96 dpi and a 4x chord diagram lands
 * eight inches wide. The pixel count is therefore the only lever on the pasted size: a
 * copy is rasterised at exactly `unitsPerInch / 96` of the drawing, so Word puts it down
 * at the size of a printed chord chart. The PNG and SVG exports keep the full resolution,
 * since a file can state its own density.
 */
export const CLIPBOARD_DPI = 96;

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
