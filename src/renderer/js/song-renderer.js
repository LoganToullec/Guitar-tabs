/** Composes a whole song sheet — chord shelf, strumming, tablature and lyrics — as one SVG page. */

import { escapeXml } from './xml.js';
import { fitTitleSize } from './sheet-title.js';
import { resolveChordName } from './chord-name.js';
import { diagramSize, renderChordBody } from './diagram-renderer.js';
import { renderTabBody, tabSize } from './tab-renderer.js';
import { longestLineLength } from './lyrics.js';

export const SONG_LAYOUT = {
  padX: 30,
  titleTop: 6,
  titleHeight: 38,
  titleY: 34,
  titleSize: 26,
  artistSize: 13.5,
  blockGap: 26,
  minWidth: 620,
  maxWidth: 1180,
  bottomPad: 28,
  chordScale: 0.72,
  chordGap: 14,
  lyricSize: 13,
  lyricLineHeight: 19,
  chordRowHeight: 17,
  sectionHeight: 26,
  strumBeat: 27,
  strumArrow: 26,
  strumTop: 20,
};

const INK = '#14161c';
const MUTED_INK = '#8a8f9a';
const PAPER = '#ffffff';
const FONT = "Arial, 'Helvetica Neue', Helvetica, sans-serif";
const MONO = "'Courier New', Courier, monospace";
const MONO_RATIO = 0.6;
const BEAT_LABELS = { 8: ['1', '&', '2', '&', '3', '&', '4', '&'], 16: ['1', 'e', '&', 'a'] };

export const charWidth = () => SONG_LAYOUT.lyricSize * MONO_RATIO;

/** Every lyric line reserves its chord row, so the on-sheet editor has a fixed grid. */
export const lineBandHeight = (line) =>
  line.section ? SONG_LAYOUT.sectionHeight : SONG_LAYOUT.chordRowHeight + SONG_LAYOUT.lyricLineHeight;

/** An embedded tablature carries neither its own title nor an empty chord rail. */
const EMBEDDED_TAB = { interactive: false, withTitle: false };

const beatLabel = (subdivision, index) =>
  subdivision === 16
    ? BEAT_LABELS[16][index % 4] === '1'
      ? String(Math.floor(index / 4) + 1)
      : BEAT_LABELS[16][index % 4]
    : BEAT_LABELS[8][index % 8];

const headerHeight = (song) => (song.artist ? 74 : 54);

/* ---------- Measuring ---------- */

/** A shelf diagram is read at a glance, so it drops an unused fingering row like an export. */
const SHELF_CHORD = { interactive: false, trimEmptyFingers: true };

const chordTile = (chord) => {
  const size = diagramSize(chord, SHELF_CHORD);
  return { width: size.width * SONG_LAYOUT.chordScale, height: size.height * SONG_LAYOUT.chordScale };
};

/**
 * Packs the chord shelf into rows that fit the page. Each entry carries its own index:
 * the same chord object can legitimately appear twice, so `indexOf` would be wrong.
 */
const packChords = (block, width) => {
  const rows = [];
  let row = [];
  let used = 0;

  for (const [index, chord] of block.chords.entries()) {
    const tile = chordTile(chord);
    const needed = tile.width + (row.length > 0 ? SONG_LAYOUT.chordGap : 0);

    if (row.length > 0 && used + needed > width) {
      rows.push(row);
      row = [];
      used = 0;
    }
    row.push({ chord, tile, index });
    used += row.length > 1 ? tile.width + SONG_LAYOUT.chordGap : tile.width;
  }
  if (row.length > 0) rows.push(row);
  return rows;
};

const lyricsHeight = (lines) => lines.reduce((total, line) => total + lineBandHeight(line), 0);

/**
 * On screen the chord shelf lives in its own drawer so it stays visible while the sheet
 * scrolls; the exported page still carries it, because a printed sheet needs it.
 */
const isDrawerBlock = (block, interactive) => interactive && block.type === 'chords';

const blockHeight = (block, width, interactive = false) => {
  if (isDrawerBlock(block, interactive)) return 0;

  switch (block.type) {
    case 'chords':
      return packChords(block, width).reduce(
        (total, row) => total + Math.max(...row.map((entry) => entry.tile.height)) + SONG_LAYOUT.chordGap,
        0,
      ) - SONG_LAYOUT.chordGap;
    case 'strum':
      return SONG_LAYOUT.strumTop + SONG_LAYOUT.strumArrow + 22;
    case 'tab':
      return tabSize(block.tab, EMBEDDED_TAB).height;
    case 'lyrics':
      return lyricsHeight(block.lines);
    default:
      return 0;
  }
};

const contentWidth = (song) => {
  let widest = SONG_LAYOUT.minWidth;

  for (const block of song.blocks) {
    if (block.type === 'lyrics') {
      widest = Math.max(widest, longestLineLength(block.lines) * charWidth());
    } else if (block.type === 'tab') {
      widest = Math.max(widest, tabSize(block.tab, EMBEDDED_TAB).width);
    } else if (block.type === 'strum') {
      widest = Math.max(widest, block.subdivision * SONG_LAYOUT.strumBeat);
    }
  }

  return Math.min(Math.ceil(widest), SONG_LAYOUT.maxWidth);
};

export const songSize = (song, { interactive = false } = {}) => {
  const width = contentWidth(song);
  const blocks = song.blocks.reduce(
    (total, block) =>
      isDrawerBlock(block, interactive) ? total : total + blockHeight(block, width, interactive) + SONG_LAYOUT.blockGap,
    0,
  );

  return {
    width: Math.round(width + SONG_LAYOUT.padX * 2),
    height: Math.round(headerHeight(song) + blocks + SONG_LAYOUT.bottomPad),
  };
};

/* ---------- Drawing ---------- */

const renderHeader = (song, width, interactive) => {
  const title = interactive
    ? ''
    : `<text x="${width / 2}" y="${SONG_LAYOUT.titleY}" text-anchor="middle" font-family="${FONT}" font-size="${fitTitleSize(song.title || 'Chanson sans titre', width, SONG_LAYOUT, !song.title)}" ${song.title ? 'font-weight="700"' : 'font-style="italic"'} fill="${song.title ? INK : MUTED_INK}">${escapeXml(song.title || 'Chanson sans titre')}</text>`;

  const artist = song.artist
    ? `<text x="${width / 2}" y="${SONG_LAYOUT.titleY + 24}" text-anchor="middle" font-family="${FONT}" font-size="${SONG_LAYOUT.artistSize}" fill="${MUTED_INK}">${escapeXml(song.artist)}</text>`
    : '';

  return title + artist;
};

const renderChordShelf = (block, x, y, width) => {
  let output = '';
  let cursorY = y;

  for (const row of packChords(block, width)) {
    const rowHeight = Math.max(...row.map((entry) => entry.tile.height));
    let cursorX = x;

    for (const entry of row) {
      const resolved = resolveChordName(entry.chord);
      output +=
        `<g transform="translate(${cursorX} ${cursorY}) scale(${SONG_LAYOUT.chordScale})">` +
        `${renderChordBody(entry.chord, { ...resolved, ...SHELF_CHORD })}</g>` +
        `<rect x="${cursorX}" y="${cursorY}" width="${entry.tile.width}" height="${entry.tile.height}" fill="transparent" class="hit" data-action="diagram" data-block="${block.id}" data-index="${entry.index}"/>`;
      cursorX += entry.tile.width + SONG_LAYOUT.chordGap;
    }
    cursorY += rowHeight + SONG_LAYOUT.chordGap;
  }
  return output;
};

const strokeGlyph = (stroke, x, top, height) => {
  const bottom = top + height;
  const stem = `<line x1="${x}" y1="${top}" x2="${x}" y2="${bottom}" stroke="${INK}" stroke-width="1.7" stroke-linecap="round"/>`;

  if (stroke === 'd') {
    return `${stem}<path d="M${x - 4.5} ${bottom - 6} L${x} ${bottom} L${x + 4.5} ${bottom - 6}" fill="none" stroke="${INK}" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"/>`;
  }
  if (stroke === 'u') {
    return `${stem}<path d="M${x - 4.5} ${top + 6} L${x} ${top} L${x + 4.5} ${top + 6}" fill="none" stroke="${INK}" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"/>`;
  }
  if (stroke === 'x') {
    const middle = (top + bottom) / 2;
    return (
      `<line x1="${x - 4}" y1="${middle - 4}" x2="${x + 4}" y2="${middle + 4}" stroke="${INK}" stroke-width="1.9" stroke-linecap="round"/>` +
      `<line x1="${x - 4}" y1="${middle + 4}" x2="${x + 4}" y2="${middle - 4}" stroke="${INK}" stroke-width="1.9" stroke-linecap="round"/>`
    );
  }
  return '';
};

const renderStrum = (block, x, y, interactive) => {
  const header =
    `<text x="${x}" y="${y + 11}" font-family="${FONT}" font-size="12.5" font-weight="700" fill="${INK}">${escapeXml(block.label || 'Rythmique')}</text>` +
    (block.bpm > 0
      ? `<text x="${x + (block.label || 'Rythmique').length * 7 + 12}" y="${y + 11}" font-family="${FONT}" font-size="11.5" fill="${MUTED_INK}">${block.bpm} bpm</text>`
      : '');

  const top = y + SONG_LAYOUT.strumTop;
  const beats = block.strokes
    .map((stroke, index) => {
      const beatX = x + index * SONG_LAYOUT.strumBeat + SONG_LAYOUT.strumBeat / 2;
      // The off-beats are written "&", which has to be escaped or the whole page stops
      // being valid XML and the export silently fails.
      const label = `<text x="${beatX}" y="${top + SONG_LAYOUT.strumArrow + 15}" text-anchor="middle" font-family="${FONT}" font-size="11" fill="${MUTED_INK}">${escapeXml(beatLabel(block.subdivision, index))}</text>`;
      const hit = interactive
        ? `<rect x="${beatX - SONG_LAYOUT.strumBeat / 2}" y="${top - 4}" width="${SONG_LAYOUT.strumBeat}" height="${SONG_LAYOUT.strumArrow + 22}" rx="5" fill="transparent" class="hit" data-action="stroke" data-block="${block.id}" data-index="${index}"/>`
        : '';
      return strokeGlyph(stroke, beatX, top, SONG_LAYOUT.strumArrow) + label + hit;
    })
    .join('');

  return header + beats;
};

const renderLyrics = (block, x, y) => {
  const step = charWidth();
  let output = '';
  let cursorY = y;

  for (const line of block.lines) {
    if (line.section) {
      cursorY += SONG_LAYOUT.sectionHeight;
      output += `<text x="${x}" y="${cursorY - 7}" font-family="${FONT}" font-size="13" font-weight="700" fill="${INK}">${escapeXml(line.text)}</text>`;
      continue;
    }

    output += line.chords
      .map(
        (chord) =>
          `<text x="${x + chord.index * step}" y="${cursorY + SONG_LAYOUT.chordRowHeight - 4}" font-family="${MONO}" font-size="${SONG_LAYOUT.lyricSize}" font-weight="700" fill="${INK}">${escapeXml(chord.name)}</text>`,
      )
      .join('');

    cursorY += lineBandHeight(line);
    if (line.text.trim() !== '') {
      output += `<text x="${x}" y="${cursorY - 5}" font-family="${MONO}" font-size="${SONG_LAYOUT.lyricSize}" fill="${INK}" xml:space="preserve">${escapeXml(line.text)}</text>`;
    }
  }
  return output;
};

const renderBlock = (block, x, y, width, interactive, selectedId) => {
  const height = blockHeight(block, width);
  const selection =
    interactive && block.id === selectedId
      ? `<rect x="${x - 10}" y="${y - 8}" width="${width + 20}" height="${height + 16}" rx="8" fill="none" stroke="#e0921f" stroke-width="1.6"/>`
      : '';

  const picker = interactive
    ? `<rect x="${x - 10}" y="${y - 8}" width="${width + 20}" height="${height + 16}" rx="8" fill="transparent" class="hit hit-block" data-action="block" data-block="${block.id}"/>`
    : '';

  switch (block.type) {
    case 'chords':
      return picker + renderChordShelf(block, x, y, width) + selection;
    case 'strum':
      return picker + renderStrum(block, x, y, interactive) + selection;
    case 'tab':
      return (
        picker +
        `<g transform="translate(${x} ${y})">${renderTabBody(block.tab, EMBEDDED_TAB)}</g>` +
        selection
      );
    case 'lyrics':
      // On screen an HTML layer sits here so the words can be typed straight on the sheet.
      return interactive ? selection : renderLyrics(block, x, y);
    default:
      return '';
  }
};

/**
 * Where each block lands on the page, so the on-sheet editors can be laid over it.
 * @returns {{id: string, type: string, x: number, y: number, width: number, height: number}[]}
 */
export const blockPositions = (song, { interactive = false } = {}) => {
  const width = contentWidth(song);
  const positions = [];
  let y = headerHeight(song);

  for (const block of song.blocks) {
    if (isDrawerBlock(block, interactive)) continue;
    const height = blockHeight(block, width, interactive);
    positions.push({ id: block.id, type: block.type, x: SONG_LAYOUT.padX, y, width, height });
    y += height + SONG_LAYOUT.blockGap;
  }

  return positions;
};

export const renderSongBody = (song, options) => {
  const width = contentWidth(song);
  const pageWidth = width + SONG_LAYOUT.padX * 2;
  const interactive = options.interactive === true;

  let output = renderHeader(song, pageWidth, interactive);
  let y = headerHeight(song);

  for (const block of song.blocks) {
    if (isDrawerBlock(block, interactive)) continue;
    output += renderBlock(block, SONG_LAYOUT.padX, y, width, interactive, options.selectedId);
    y += blockHeight(block, width, interactive) + SONG_LAYOUT.blockGap;
  }

  return output;
};

/**
 * @param {object} song song model
 * @param {{interactive?: boolean, selectedId?: string}} options
 * @returns {string} standalone `<svg>` markup
 */
export const renderSongSvg = (song, options = {}) => {
  const { width, height } = songSize(song, { interactive: options.interactive === true });
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">` +
    `<rect width="${width}" height="${height}" fill="${PAPER}"/>${renderSongBody(song, options)}</svg>`
  );
};
