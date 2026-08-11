/** Renders a chord model as standalone SVG markup (used both on screen and for export). */

import { MAX_FINGER } from './chord-model.js';
import { escapeXml } from './xml.js';
import { fitTitleSize } from './sheet-title.js';

export const LAYOUT = {
  stringGap: 28,
  fretGap: 34,
  gridLeft: 44,
  gridTop: 72,
  sidePad: 44,
  bottomPad: 20,
  fingerOffset: 30,
  titleY: 32,
  titleTop: 4,
  titleHeight: 38,
  titleSize: 26,
  markerY: 56,
  dotRadius: 9,
  barreHeight: 19,
};

const INK = '#14161c';
const MUTED_INK = '#9aa1ad';
const FONT = "Arial, 'Helvetica Neue', Helvetica, sans-serif";

export const stringX = (string) => LAYOUT.gridLeft + string * LAYOUT.stringGap;
export const rowCenterY = (row) => LAYOUT.gridTop + row * LAYOUT.fretGap + LAYOUT.fretGap / 2;

/**
 * @param {object} chord chord model
 * @param {{trimEmptyFingers?: boolean}} [options] drop the fingering row when it is unused,
 *   which keeps chord shelves compact on a song sheet (the editor keeps it as a click target)
 */
export const diagramSize = (chord, { trimEmptyFingers = false } = {}) => {
  const usesFingers = chord.fingers.some((finger) => finger > 0);
  const fingerRow = trimEmptyFingers && !usesFingers ? 0 : LAYOUT.fingerOffset;

  return {
    width: LAYOUT.gridLeft + (chord.stringCount - 1) * LAYOUT.stringGap + LAYOUT.sidePad,
    height: LAYOUT.gridTop + chord.fretCount * LAYOUT.fretGap + fingerRow + LAYOUT.bottomPad,
  };
};

const gridRight = (chord) => stringX(chord.stringCount - 1);
const gridBottom = (chord) => LAYOUT.gridTop + chord.fretCount * LAYOUT.fretGap;

const renderTitle = (chord, { name, isPlaceholder }, width) => {
  const size = fitTitleSize(name, width, LAYOUT, isPlaceholder);
  const fill = isPlaceholder ? MUTED_INK : INK;
  const style = isPlaceholder ? ' font-style="italic"' : ' font-weight="700"';
  return `<text x="${width / 2}" y="${LAYOUT.titleY}" text-anchor="middle" font-family="${FONT}" font-size="${size}"${style} fill="${fill}">${escapeXml(name)}</text>`;
};

const renderMarkers = (chord) =>
  chord.markers
    .map((marker, string) => {
      const x = stringX(string);
      const y = LAYOUT.markerY;
      if (marker === 'muted') {
        const arm = 6.5;
        return (
          `<line x1="${x - arm}" y1="${y - arm}" x2="${x + arm}" y2="${y + arm}" stroke="${INK}" stroke-width="2.4" stroke-linecap="round"/>` +
          `<line x1="${x - arm}" y1="${y + arm}" x2="${x + arm}" y2="${y - arm}" stroke="${INK}" stroke-width="2.4" stroke-linecap="round"/>`
        );
      }
      if (marker === 'open') {
        return `<circle cx="${x}" cy="${y}" r="6" fill="none" stroke="${INK}" stroke-width="2.2"/>`;
      }
      return '';
    })
    .join('');

const renderGrid = (chord) => {
  const right = gridRight(chord);
  const bottom = gridBottom(chord);
  const isOpenPosition = chord.startFret === 1;

  const strings = chord.markers
    .map((_, string) => {
      const x = stringX(string);
      return `<line x1="${x}" y1="${LAYOUT.gridTop}" x2="${x}" y2="${bottom}" stroke="${INK}" stroke-width="1.6"/>`;
    })
    .join('');

  const frets = Array.from({ length: chord.fretCount + 1 }, (_, row) => {
    if (row === 0 && isOpenPosition) return '';
    const y = LAYOUT.gridTop + row * LAYOUT.fretGap;
    return `<line x1="${LAYOUT.gridLeft}" y1="${y}" x2="${right}" y2="${y}" stroke="${INK}" stroke-width="1.6"/>`;
  }).join('');

  const nut = isOpenPosition
    ? `<rect x="${LAYOUT.gridLeft - 1}" y="${LAYOUT.gridTop - 6}" width="${right - LAYOUT.gridLeft + 2}" height="6.5" fill="${INK}"/>`
    : '';

  return `${nut}${frets}${strings}`;
};

const renderPositionLabel = (chord) => {
  if (chord.startFret === 1) return '';
  const x = gridRight(chord) + 12;
  const y = rowCenterY(0) + 6;
  return `<text x="${x}" y="${y}" text-anchor="start" font-family="${FONT}" font-size="16" fill="${INK}">${chord.startFret}fr</text>`;
};

const renderNotes = (chord) => {
  const dots = chord.dots
    .map(
      (dot) =>
        `<circle cx="${stringX(dot.string)}" cy="${rowCenterY(dot.row)}" r="${LAYOUT.dotRadius}" fill="${INK}"/>`,
    )
    .join('');

  const barres = chord.barres
    .map((barre) => {
      const left = stringX(barre.from) - LAYOUT.dotRadius;
      const width = stringX(barre.to) - stringX(barre.from) + LAYOUT.dotRadius * 2;
      const y = rowCenterY(barre.row) - LAYOUT.barreHeight / 2;
      return `<rect x="${left}" y="${y}" width="${width}" height="${LAYOUT.barreHeight}" rx="${LAYOUT.barreHeight / 2}" fill="${INK}"/>`;
    })
    .join('');

  return `${barres}${dots}`;
};

const renderFingers = (chord) => {
  const y = gridBottom(chord) + LAYOUT.fingerOffset;
  return chord.fingers
    .map((finger, string) =>
      finger > 0 && finger <= MAX_FINGER
        ? `<text x="${stringX(string)}" y="${y}" text-anchor="middle" font-family="${FONT}" font-size="17" font-weight="600" fill="${INK}">${finger}</text>`
        : '',
    )
    .join('');
};

const hitRect = (x, y, width, height, attributes) =>
  `<rect x="${x}" y="${y}" width="${width}" height="${height}" rx="7" fill="transparent" class="hit" ${attributes}/>`;

const renderHitAreas = (chord) => {
  const halfString = LAYOUT.stringGap / 2;

  const markers = chord.markers
    .map((_, string) =>
      hitRect(stringX(string) - halfString, LAYOUT.markerY - 15, LAYOUT.stringGap, 30, `data-action="marker" data-string="${string}"`),
    )
    .join('');

  const cells = chord.markers
    .flatMap((_, string) =>
      Array.from({ length: chord.fretCount }, (_, row) =>
        hitRect(
          stringX(string) - halfString,
          LAYOUT.gridTop + row * LAYOUT.fretGap,
          LAYOUT.stringGap,
          LAYOUT.fretGap,
          `data-action="cell" data-string="${string}" data-row="${row}"`,
        ),
      ),
    )
    .join('');

  const fingers = chord.fingers
    .map((_, string) =>
      hitRect(
        stringX(string) - halfString,
        gridBottom(chord) + LAYOUT.fingerOffset - 18,
        LAYOUT.stringGap,
        26,
        `data-action="finger" data-string="${string}"`,
      ),
    )
    .join('');

  const position = hitRect(
    gridRight(chord) + 4,
    LAYOUT.gridTop,
    LAYOUT.sidePad - 6,
    LAYOUT.fretGap,
    'data-action="position"',
  );

  return `<g class="hit-layer">${markers}${cells}${fingers}${position}</g>`;
};

/**
 * Diagram contents without the `<svg>` wrapper, so a song sheet can place several of
 * them inside one page.
 *
 * On screen the title is an HTML input overlaid on the reserved title band, so the
 * interactive variant leaves that band empty; exports draw the real text.
 *
 * @param {object} chord chord model
 * @param {{name: string, isPlaceholder?: boolean, interactive?: boolean}} options
 * @returns {string} SVG fragment
 */
export const renderChordBody = (chord, options) => {
  const { width } = diagramSize(chord);
  return (
    (options.interactive ? '' : renderTitle(chord, options, width)) +
    renderMarkers(chord) +
    renderGrid(chord) +
    renderPositionLabel(chord) +
    renderNotes(chord) +
    renderFingers(chord) +
    (options.interactive ? renderHitAreas(chord) : '')
  );
};

/** @returns {string} standalone `<svg>` markup */
export const renderChordSvg = (chord, options) => {
  const { width, height } = diagramSize(chord, options);
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">` +
    `<rect width="${width}" height="${height}" fill="#ffffff"/>${renderChordBody(chord, options)}</svg>`
  );
};
