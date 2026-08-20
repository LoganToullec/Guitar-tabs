/** Renders a tablature model as standalone SVG markup (screen and export). */

import { escapeXml } from './xml.js';
import { fitTitleSize } from './sheet-title.js';
import { measureSteps, nextOnString, STRING_LABELS } from './tab-model.js';

export const TAB_LAYOUT = {
  padX: 18,
  labelWidth: 20,
  titleTop: 2,
  titleHeight: 28,
  titleY: 22,
  titleSize: 21,
  /** Air below the title band: deliberately almost none, the way a paper tab reads. */
  titleGap: 2,
  /** Room above the first system when no title is drawn — the top fret labels need it. */
  topPad: 10,
  /** Band above each system where chord labels are written. */
  chordLane: 20,
  /** Extra band for the P.M. brackets, only when the tab uses palm mutes. */
  pmLane: 15,
  chordSize: 13.5,
  stringGap: 18,
  minColWidth: 17,
  systemGap: 26,
  bottomPad: 10,
  noteSize: 12.5,
  linkSize: 10.5,
  /** Room for an articulation trailing off the last column. */
  overhang: 18,
};

const INK = '#14161c';
const RULE = '#3d424e';
const MUTED_INK = '#9aa1ad';
const PAPER = '#ffffff';
const FONT = "Arial, 'Helvetica Neue', Helvetica, sans-serif";
const NOTE_CHAR_WIDTH = 7.3;
const CHORD_CHAR_WIDTH = 7.6;
const LABEL_PADDING = 4;
const SLIDES = ['/', '\\'];

export const gridLeft = () => TAB_LAYOUT.padX + TAB_LAYOUT.labelWidth;

/** Ghost notes, harmonics, tapping and vibrato all read as decorations around the fret. */
export const noteLabel = (note) => {
  const core = `${note.ghost ? '(' : ''}${note.fret}${note.ghost ? ')' : ''}`;
  const bracketed = note.harmonic ? `<${core}>` : core;
  return `${note.tap ? 't' : ''}${bracketed}${note.vibrato ? '~' : ''}`;
};

const labelWidth = (note) => noteLabel(note).length * NOTE_CHAR_WIDTH + LABEL_PADDING;

/* ---------- Layout ---------- */

const systemOfBar = (tab, bar) => Math.floor(bar / tab.barsPerLine);
const systemCount = (tab) => Math.max(1, Math.ceil(tab.measures.length / tab.barsPerLine));
const hasPalmMute = (tab) => tab.notes.some((note) => note.palmMute);
const systemHeight = (tab) => (tab.stringCount - 1) * TAB_LAYOUT.stringGap;

/**
 * A title band is only worth its space when something is written in it. The editor keeps
 * it whatever happens, because the title field is an input laid over that band; an export
 * or an embedded tab drops it as soon as the tablature has no title.
 *
 * @param {object} tab tablature model
 * @param {{interactive?: boolean, withTitle?: boolean}} options
 */
const showsTitle = (tab, { interactive = false, withTitle = true } = {}) =>
  withTitle !== false && (interactive || Boolean(tab.title));

/** The chord rail is a click target in the editor, so it stays even when it is empty. */
const showsChordLane = (tab, { interactive = false } = {}) => interactive || tab.chords.length > 0;

const systemTopY = (layout, system) => layout.top + system * (layout.block + TAB_LAYOUT.systemGap);

const stringsTopY = (layout, system) => systemTopY(layout, system) + layout.lane;

/** Top row is the thinnest string, so the index is mirrored. */
const stringY = (tab, layout, system, string) =>
  stringsTopY(layout, system) + (tab.stringCount - 1 - string) * TAB_LAYOUT.stringGap;

/**
 * Columns are as wide as their widest label, so `<12>` never runs into its neighbour.
 * The whole geometry is resolved once per render and looked up by `bar:step`.
 */
const buildLayout = (tab, options = {}) => {
  const widest = new Map();
  for (const note of tab.notes) {
    const key = `${note.bar}:${note.step}`;
    widest.set(key, Math.max(widest.get(key) ?? 0, labelWidth(note)));
  }

  const columns = new Map();
  const systems = [];

  for (let system = 0; system < systemCount(tab); system += 1) {
    const bars = tab.measures.map((_, bar) => bar).filter((bar) => systemOfBar(tab, bar) === system);

    let x = gridLeft();
    const boundaries = [x];

    for (const bar of bars) {
      for (let step = 0; step < measureSteps(tab, bar); step += 1) {
        const key = `${bar}:${step}`;
        const width = Math.max(TAB_LAYOUT.minColWidth, (widest.get(key) ?? 0) + 2);
        columns.set(key, { x, width, system });
        x += width;
      }
      boundaries.push(x);
    }

    systems.push({ bars, boundaries, right: x });
  }

  const withTitle = showsTitle(tab, options);
  const lane =
    (showsChordLane(tab, options) ? TAB_LAYOUT.chordLane : 0) +
    (hasPalmMute(tab) ? TAB_LAYOUT.pmLane : 0);

  return {
    columns,
    systems,
    right: Math.max(...systems.map((system) => system.right)),
    withTitle,
    top: withTitle ? TAB_LAYOUT.titleTop + TAB_LAYOUT.titleHeight + TAB_LAYOUT.titleGap : TAB_LAYOUT.topPad,
    lane,
    block: lane + systemHeight(tab),
  };
};

const columnOf = (layout, bar, step) => layout.columns.get(`${bar}:${step}`) ?? null;
const columnCenter = (column) => column.x + column.width / 2;

/**
 * @param {object} tab tablature model
 * @param {{interactive?: boolean, withTitle?: boolean}} [options] must match the options the
 *   tablature is rendered with, since they decide whether a title band is reserved
 */
export const tabSize = (tab, options = {}) => {
  const layout = buildLayout(tab, options);
  const systems = systemCount(tab);

  return {
    width: layout.right + TAB_LAYOUT.padX + TAB_LAYOUT.overhang,
    height:
      layout.top +
      systems * layout.block +
      (systems - 1) * TAB_LAYOUT.systemGap +
      TAB_LAYOUT.bottomPad,
  };
};

/* ---------- Pieces ---------- */

const renderTitle = (tab, { name, isPlaceholder }, width) => {
  const size = fitTitleSize(name, width, TAB_LAYOUT, isPlaceholder);
  const fill = isPlaceholder ? MUTED_INK : INK;
  const style = isPlaceholder ? ' font-style="italic"' : ' font-weight="700"';
  return `<text x="${width / 2}" y="${TAB_LAYOUT.titleY}" text-anchor="middle" font-family="${FONT}" font-size="${size}"${style} fill="${fill}">${escapeXml(name)}</text>`;
};

const renderSystemFrame = (tab, layout, index) => {
  const system = layout.systems[index];
  const left = gridLeft();
  const top = stringsTopY(layout, index);
  const bottom = top + systemHeight(tab);

  const strings = Array.from({ length: tab.stringCount }, (_, string) => {
    const y = stringY(tab, layout, index, string);
    return `<line x1="${left}" y1="${y}" x2="${system.right}" y2="${y}" stroke="${RULE}" stroke-width="1.1"/>`;
  }).join('');

  const labels = Array.from({ length: tab.stringCount }, (_, string) => {
    const y = stringY(tab, layout, index, string) + 4;
    return `<text x="${left - 7}" y="${y}" text-anchor="end" font-family="${FONT}" font-size="11.5" fill="${MUTED_INK}">${STRING_LABELS[string]}</text>`;
  }).join('');

  const barlines = system.boundaries
    .map((x) => `<line x1="${x}" y1="${top}" x2="${x}" y2="${bottom}" stroke="${INK}" stroke-width="1.4"/>`)
    .join('');

  return `${strings}${labels}${barlines}`;
};

const renderNote = (tab, layout, note) => {
  const column = columnOf(layout, note.bar, note.step);
  if (!column) return '';

  const x = columnCenter(column);
  const y = stringY(tab, layout, column.system, note.string);
  const label = noteLabel(note);
  const box = labelWidth(note);

  return (
    `<rect x="${x - box / 2}" y="${y - TAB_LAYOUT.noteSize / 2 - 2}" width="${box}" height="${TAB_LAYOUT.noteSize + 4}" fill="${PAPER}"/>` +
    `<text x="${x}" y="${y + TAB_LAYOUT.noteSize * 0.36}" text-anchor="middle" font-family="${FONT}" font-size="${TAB_LAYOUT.noteSize}" font-weight="700" fill="${INK}">${escapeXml(label)}</text>`
  );
};

/**
 * Articulations are drawn between the two notes they join, the way they read in a tab:
 * a letter for hammer-ons, pull-offs, bends and releases, a slanted line for slides.
 */
const renderLink = (tab, layout, note) => {
  if (!note.link) return '';

  const column = columnOf(layout, note.bar, note.step);
  if (!column) return '';

  const y = stringY(tab, layout, column.system, note.string);
  const from = columnCenter(column) + labelWidth(note) / 2;

  const target = nextOnString(tab, note);
  const targetColumn = target ? columnOf(layout, target.bar, target.step) : null;
  const linked = targetColumn && targetColumn.system === column.system;
  const to = linked
    ? columnCenter(targetColumn) - labelWidth(target) / 2
    : from + TAB_LAYOUT.minColWidth * 0.7;

  if (SLIDES.includes(note.link)) {
    const rise = note.link === '/' ? -3.5 : 3.5;
    return `<line x1="${from + 1}" y1="${y - rise}" x2="${to - 1}" y2="${y + rise}" stroke="${INK}" stroke-width="1.6" stroke-linecap="round"/>`;
  }

  const middle = (from + to) / 2;
  const box = TAB_LAYOUT.linkSize;
  return (
    `<rect x="${middle - box / 2}" y="${y - box / 2 - 1}" width="${box}" height="${box + 2}" fill="${PAPER}"/>` +
    `<text x="${middle}" y="${y + box * 0.36}" text-anchor="middle" font-family="${FONT}" font-size="${box}" font-style="italic" font-weight="700" fill="${INK}">${escapeXml(note.link)}</text>`
  );
};

/** Chord labels start on their column and are pulled back if they would run off the line. */
const renderChords = (tab, layout) =>
  tab.chords
    .map((chord) => {
      const column = columnOf(layout, chord.bar, chord.step);
      if (!column) return '';

      const textWidth = chord.text.length * CHORD_CHAR_WIDTH;
      const limit = layout.systems[column.system].right + TAB_LAYOUT.overhang - textWidth;
      const x = Math.min(column.x + 1, limit);
      const y = systemTopY(layout, column.system) + TAB_LAYOUT.chordLane - 9;

      return `<text x="${x}" y="${y}" font-family="${FONT}" font-size="${TAB_LAYOUT.chordSize}" font-weight="700" fill="${INK}">${escapeXml(chord.text)}</text>`;
    })
    .join('');

/** Consecutive palm-muted columns share one "P.M." bracket. */
const renderPalmMutes = (tab, layout) => {
  if (!hasPalmMute(tab)) return '';

  const muted = tab.notes
    .filter((note) => note.palmMute)
    .map((note) => ({ note, column: columnOf(layout, note.bar, note.step) }))
    .filter((entry) => entry.column)
    .sort((a, b) => a.column.x - b.column.x);

  const runs = [];
  for (const { column } of muted) {
    const last = runs.at(-1);
    const right = column.x + column.width;

    if (last && last.system === column.system && column.x <= last.right + 1) {
      last.right = Math.max(last.right, right);
    } else {
      runs.push({ system: column.system, left: column.x, right });
    }
  }

  const TEXT_WIDTH = 24;
  return runs
    .map((run) => {
      // The bracket hangs just above the top string, whether or not a chord rail sits over it.
      const y = stringsTopY(layout, run.system) - 4;
      const dash =
        run.right > run.left + TEXT_WIDTH
          ? `<line x1="${run.left + TEXT_WIDTH}" y1="${y - 3}" x2="${run.right}" y2="${y - 3}" stroke="${INK}" stroke-width="1.1" stroke-dasharray="3 3"/>`
          : '';

      return `<text x="${run.left + 1}" y="${y}" font-family="${FONT}" font-size="10.5" font-style="italic" fill="${INK}">P.M.</text>${dash}`;
    })
    .join('');
};

/* ---------- Interaction layer ---------- */

const slotRect = (column, y, height, attributes) =>
  `<rect x="${column.x}" y="${y}" width="${column.width}" height="${height}" rx="4" ${attributes}/>`;

const chordLaneY = (layout, system) => systemTopY(layout, system) + 1;

const renderCursor = (tab, layout, cursor) => {
  const column = cursor ? columnOf(layout, cursor.bar, cursor.step) : null;
  if (!column) return '';

  const inChordLane = cursor.lane === 'chords';
  const y = inChordLane
    ? chordLaneY(layout, column.system)
    : stringY(tab, layout, column.system, cursor.string) - TAB_LAYOUT.stringGap / 2;
  const height = inChordLane ? TAB_LAYOUT.chordLane - 2 : TAB_LAYOUT.stringGap;

  return slotRect(column, y, height, 'fill="none" stroke="#e0921f" stroke-width="1.8"');
};

const renderHitAreas = (tab, layout) => {
  const cells = [];

  tab.measures.forEach((measure, bar) => {
    for (let step = 0; step < measure.steps; step += 1) {
      const column = columnOf(layout, bar, step);
      if (!column) continue;

      cells.push(
        slotRect(
          column,
          chordLaneY(layout, column.system),
          TAB_LAYOUT.chordLane - 2,
          `fill="transparent" class="hit" data-action="chord" data-bar="${bar}" data-step="${step}"`,
        ),
      );

      for (let string = 0; string < tab.stringCount; string += 1) {
        cells.push(
          slotRect(
            column,
            stringY(tab, layout, column.system, string) - TAB_LAYOUT.stringGap / 2,
            TAB_LAYOUT.stringGap,
            `fill="transparent" class="hit" data-action="cell" data-bar="${bar}" data-step="${step}" data-string="${string}"`,
          ),
        );
      }
    }
  });

  return `<g class="hit-layer">${cells.join('')}</g>`;
};

/**
 * Tablature contents without the `<svg>` wrapper, so a song sheet can embed it.
 *
 * @param {object} tab tablature model
 * @param {{name?: string, isPlaceholder?: boolean, interactive?: boolean, cursor?: object, withTitle?: boolean}} options
 * @returns {string} SVG fragment
 */
export const renderTabBody = (tab, options) => {
  const layout = buildLayout(tab, options);
  const { width } = tabSize(tab, options);

  // On screen the title is an HTML input laid over the band the layout reserves for it.
  let body = layout.withTitle && !options.interactive ? renderTitle(tab, options, width) : '';

  for (let system = 0; system < layout.systems.length; system += 1) {
    body += renderSystemFrame(tab, layout, system);
  }
  for (const note of tab.notes) {
    body += renderNote(tab, layout, note);
  }
  for (const note of tab.notes) {
    body += renderLink(tab, layout, note);
  }
  body += renderChords(tab, layout) + renderPalmMutes(tab, layout);

  if (options.interactive) {
    body += renderCursor(tab, layout, options.cursor) + renderHitAreas(tab, layout);
  }
  return body;
};

/** @returns {string} standalone `<svg>` markup */
export const renderTabSvg = (tab, options) => {
  const { width, height } = tabSize(tab, options);
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">` +
    `<rect width="${width}" height="${height}" fill="${PAPER}"/>${renderTabBody(tab, options)}</svg>`
  );
};
