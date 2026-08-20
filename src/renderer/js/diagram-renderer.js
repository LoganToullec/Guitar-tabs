/** Renders a chord model as standalone SVG markup (used both on screen and for export). */

import { MAX_FINGER } from './chord-model.js';
import { escapeXml } from './xml.js';
import { fitTitleSize } from './sheet-title.js';

/**
 * Proportions are those of a printed chord chart: margins as wide as one string gap,
 * a title sitting right on top of the markers, and a grid running down to the edge.
 * Everything is expressed in `stringGap` units, so the whole diagram scales from there.
 */
export const LAYOUT = {
  stringGap: 28,
  fretGap: 33,
  gridLeft: 28,
  gridTop: 74,
  /** Right margin, mirroring `gridLeft` when nothing has to be written beside the grid. */
  sidePad: 28,
  /** Wider right margin, used only when a start-fret label has to fit there. */
  positionPad: 44,
  bottomPad: 5,
  /** Band under the grid for the fingering row, drawn only when it carries something. */
  fingerRow: 28,
  fingerOffset: 21,
  titleY: 28,
  titleTop: 0,
  titleHeight: 34,
  titleSize: 30,
  markerY: 51,
  dotRadius: 9,
  barreHeight: 19,
};

const INK = '#14161c';
const MUTED_INK = '#9aa1ad';
const FONT = "Arial, 'Helvetica Neue', Helvetica, sans-serif";
const POSITION_SIZE = 14;

export const stringX = (string) => LAYOUT.gridLeft + string * LAYOUT.stringGap;
export const rowCenterY = (row) => LAYOUT.gridTop + row * LAYOUT.fretGap + LAYOUT.fretGap / 2;

/** An open position needs no `3fr` label, so it keeps the narrow symmetric margin. */
const sidePadOf = (chord) => (chord.startFret === 1 ? LAYOUT.sidePad : LAYOUT.positionPad);

/**
 * @param {object} chord chord model
 * @param {{trimEmptyFingers?: boolean}} [options] drop the fingering row when it is unused,
 *   which keeps exports and chord shelves compact (the editor keeps it as a click target)
 */
export const diagramSize = (chord, { trimEmptyFingers = false } = {}) => {
  const usesFingers = chord.fingers.some((finger) => finger > 0);
  const fingerRow = trimEmptyFingers && !usesFingers ? 0 : LAYOUT.fingerRow;

  return {
    width: LAYOUT.gridLeft + (chord.stringCount - 1) * LAYOUT.stringGap + sidePadOf(chord),
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
        const arm = 7.5;
        return (
          `<line x1="${x - arm}" y1="${y - arm}" x2="${x + arm}" y2="${y + arm}" stroke="${INK}" stroke-width="2.6" stroke-linecap="round"/>` +
          `<line x1="${x - arm}" y1="${y + arm}" x2="${x + arm}" y2="${y - arm}" stroke="${INK}" stroke-width="2.6" stroke-linecap="round"/>`
        );
      }
      if (marker === 'open') {
        return `<circle cx="${x}" cy="${y}" r="7" fill="none" stroke="${INK}" stroke-width="2.4"/>`;
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
    ? `<rect x="${LAYOUT.gridLeft - 1}" y="${LAYOUT.gridTop - 7}" width="${right - LAYOUT.gridLeft + 2}" height="8" fill="${INK}"/>`
    : '';

  return `${nut}${frets}${strings}`;
};

const renderPositionLabel = (chord) => {
  if (chord.startFret === 1) return '';
  // Clear of the dot that may sit on the outermost string, which reaches `dotRadius` past it.
  const x = gridRight(chord) + LAYOUT.dotRadius + 4;
  const y = rowCenterY(0) + 5;
  return `<text x="${x}" y="${y}" text-anchor="start" font-family="${FONT}" font-size="${POSITION_SIZE}" fill="${INK}">${chord.startFret}fr</text>`;
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
        gridBottom(chord) + LAYOUT.fingerOffset - 15,
        LAYOUT.stringGap,
        24,
        `data-action="finger" data-string="${string}"`,
      ),
    )
    .join('');

  const position = hitRect(
    gridRight(chord) + 3,
    LAYOUT.gridTop,
    sidePadOf(chord) - 5,
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
  const { width } = diagramSize(chord, options);
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
