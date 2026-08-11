/**
 * Chord dictionary.
 *
 * Open positions are written by hand because they are idiomatic; everything else comes
 * from **movable shapes** transposed to the twelve roots, which is how a guitarist
 * actually thinks about barre chords. Every entry carries its own fingering, its muted
 * and open strings, and the fret it starts on.
 */

import { createChord } from './chord-model.js';
import { noteName } from './chord-namer.js';

const OPEN_POSITION_LIMIT = 5;

/** Open pitch class of each string, thickest first. */
const STRING_PITCH = [4, 9, 2, 7, 11, 4];

/** Second spelling of the five roots that have one, so searching "Db" finds "C#". */
const ENHARMONIC = { 'C#': 'Db', Eb: 'D#', 'F#': 'Gb', Ab: 'G#', Bb: 'A#' };

/** @type {{name: string, frets: (number|'x')[], fingers: number[], barre?: {fret: number, from: number, to: number}}[]} */
export const OPEN_CHORDS = [
  { name: 'C', frets: ['x', 3, 2, 0, 1, 0], fingers: [0, 3, 2, 0, 1, 0] },
  { name: 'Cmaj7', frets: ['x', 3, 2, 0, 0, 0], fingers: [0, 3, 2, 0, 0, 0] },
  { name: 'C7', frets: ['x', 3, 2, 3, 1, 0], fingers: [0, 3, 2, 4, 1, 0] },
  { name: 'Cadd9', frets: ['x', 3, 2, 0, 3, 0], fingers: [0, 2, 1, 0, 3, 0] },
  { name: 'Csus4', frets: ['x', 3, 3, 0, 1, 1], fingers: [0, 2, 3, 0, 1, 1] },
  { name: 'Cm', frets: ['x', 3, 5, 5, 4, 3], fingers: [0, 1, 3, 4, 2, 1], barre: { fret: 3, from: 1, to: 5 } },

  { name: 'D', frets: ['x', 'x', 0, 2, 3, 2], fingers: [0, 0, 0, 1, 3, 2] },
  { name: 'Dm', frets: ['x', 'x', 0, 2, 3, 1], fingers: [0, 0, 0, 2, 3, 1] },
  { name: 'D7', frets: ['x', 'x', 0, 2, 1, 2], fingers: [0, 0, 0, 2, 1, 3] },
  { name: 'Dm7', frets: ['x', 'x', 0, 2, 1, 1], fingers: [0, 0, 0, 2, 1, 1] },
  { name: 'Dsus2', frets: ['x', 'x', 0, 2, 3, 0], fingers: [0, 0, 0, 1, 3, 0] },
  { name: 'Dsus4', frets: ['x', 'x', 0, 2, 3, 3], fingers: [0, 0, 0, 1, 3, 4] },

  { name: 'E', frets: [0, 2, 2, 1, 0, 0], fingers: [0, 2, 3, 1, 0, 0] },
  { name: 'Em', frets: [0, 2, 2, 0, 0, 0], fingers: [0, 2, 3, 0, 0, 0] },
  { name: 'E7', frets: [0, 2, 0, 1, 0, 0], fingers: [0, 2, 0, 1, 0, 0] },
  { name: 'Em7', frets: [0, 2, 0, 0, 0, 0], fingers: [0, 2, 0, 0, 0, 0] },
  { name: 'Esus4', frets: [0, 2, 2, 2, 0, 0], fingers: [0, 1, 2, 3, 0, 0] },

  { name: 'F', frets: [1, 3, 3, 2, 1, 1], fingers: [1, 3, 4, 2, 1, 1], barre: { fret: 1, from: 0, to: 5 } },
  { name: 'Fmaj7', frets: ['x', 'x', 3, 2, 1, 0], fingers: [0, 0, 3, 2, 1, 0] },
  { name: 'F#m', frets: [2, 4, 4, 2, 2, 2], fingers: [1, 3, 4, 1, 1, 1], barre: { fret: 2, from: 0, to: 5 } },

  { name: 'G', frets: [3, 2, 0, 0, 0, 3], fingers: [2, 1, 0, 0, 0, 3] },
  { name: 'G7', frets: [3, 2, 0, 0, 0, 1], fingers: [3, 2, 0, 0, 0, 1] },
  { name: 'Gsus4', frets: [3, 3, 0, 0, 1, 3], fingers: [2, 3, 0, 0, 1, 4] },
  { name: 'Gm', frets: [3, 5, 5, 3, 3, 3], fingers: [1, 3, 4, 1, 1, 1], barre: { fret: 3, from: 0, to: 5 } },

  { name: 'A', frets: ['x', 0, 2, 2, 2, 0], fingers: [0, 0, 1, 2, 3, 0] },
  { name: 'Am', frets: ['x', 0, 2, 2, 1, 0], fingers: [0, 0, 2, 3, 1, 0] },
  { name: 'A7', frets: ['x', 0, 2, 0, 2, 0], fingers: [0, 0, 2, 0, 3, 0] },
  { name: 'Am7', frets: ['x', 0, 2, 0, 1, 0], fingers: [0, 0, 2, 0, 1, 0] },
  { name: 'Amaj7', frets: ['x', 0, 2, 1, 2, 0], fingers: [0, 0, 2, 1, 3, 0] },
  { name: 'Asus2', frets: ['x', 0, 2, 2, 0, 0], fingers: [0, 0, 1, 2, 0, 0] },
  { name: 'Asus4', frets: ['x', 0, 2, 2, 3, 0], fingers: [0, 0, 1, 2, 3, 0] },

  { name: 'B7', frets: ['x', 2, 1, 2, 0, 2], fingers: [0, 2, 1, 3, 0, 4] },
  { name: 'Bm', frets: ['x', 2, 4, 4, 3, 2], fingers: [0, 1, 3, 4, 2, 1], barre: { fret: 2, from: 1, to: 5 } },
  { name: 'Bb', frets: ['x', 1, 3, 3, 3, 1], fingers: [0, 1, 2, 3, 4, 1], barre: { fret: 1, from: 1, to: 5 } },
];

/**
 * Shapes given as fret offsets from the root, `null` for a muted string. `barre` is the
 * offset the index finger lies on; `minRootFret` keeps a shape off the open strings when
 * it reaches below its root.
 */
const MOVABLE_SHAPES = [
  // Root on the low E string.
  { root: 0, suffix: '', offsets: [0, 2, 2, 1, 0, 0], fingers: [1, 3, 4, 2, 1, 1], barre: 0 },
  { root: 0, suffix: 'm', offsets: [0, 2, 2, 0, 0, 0], fingers: [1, 3, 4, 1, 1, 1], barre: 0 },
  { root: 0, suffix: '5', offsets: [0, 2, 2, null, null, null], fingers: [1, 3, 4, 0, 0, 0] },
  { root: 0, suffix: '7', offsets: [0, 2, 0, 1, 0, 0], fingers: [1, 3, 1, 2, 1, 1], barre: 0 },
  { root: 0, suffix: 'm7', offsets: [0, 2, 0, 0, 0, 0], fingers: [1, 3, 1, 1, 1, 1], barre: 0 },
  { root: 0, suffix: 'maj7', offsets: [0, 2, 1, 1, 0, 0], fingers: [1, 4, 2, 3, 1, 1], barre: 0 },
  { root: 0, suffix: 'm6', offsets: [0, 2, 2, 0, 2, 0], fingers: [1, 2, 3, 1, 4, 1], barre: 0 },
  { root: 0, suffix: 'sus4', offsets: [0, 2, 2, 2, 0, 0], fingers: [1, 2, 3, 4, 1, 1], barre: 0 },
  { root: 0, suffix: '7sus4', offsets: [0, 2, 0, 2, 0, 0], fingers: [1, 3, 1, 4, 1, 1], barre: 0 },
  { root: 0, suffix: '9', offsets: [0, 2, 0, 1, 0, 2], fingers: [1, 3, 1, 2, 1, 4], barre: 0 },
  { root: 0, suffix: 'add9', offsets: [0, 2, 4, 1, 0, 0], fingers: [1, 2, 4, 3, 1, 1], barre: 0 },

  // Root on the A string.
  { root: 1, suffix: '', offsets: [null, 0, 2, 2, 2, 0], fingers: [0, 1, 3, 3, 3, 1], barre: 0 },
  { root: 1, suffix: 'm', offsets: [null, 0, 2, 2, 1, 0], fingers: [0, 1, 3, 4, 2, 1], barre: 0 },
  { root: 1, suffix: '5', offsets: [null, 0, 2, null, null, null], fingers: [0, 1, 3, 0, 0, 0] },
  { root: 1, suffix: '7', offsets: [null, 0, 2, 0, 2, 0], fingers: [0, 1, 3, 1, 4, 1], barre: 0 },
  { root: 1, suffix: 'm7', offsets: [null, 0, 2, 0, 1, 0], fingers: [0, 1, 3, 1, 2, 1], barre: 0 },
  { root: 1, suffix: 'maj7', offsets: [null, 0, 2, 1, 2, 0], fingers: [0, 1, 3, 2, 4, 1], barre: 0 },
  { root: 1, suffix: '6', offsets: [null, 0, 2, 2, 2, 2], fingers: [0, 1, 3, 3, 3, 3], barre: 0 },
  { root: 1, suffix: 'sus4', offsets: [null, 0, 2, 2, 3, 0], fingers: [0, 1, 2, 3, 4, 1], barre: 0 },
  { root: 1, suffix: 'sus2', offsets: [null, 0, 2, 2, 0, 0], fingers: [0, 1, 3, 4, 1, 1], barre: 0 },
  { root: 1, suffix: '7sus4', offsets: [null, 0, 2, 0, 3, 0], fingers: [0, 1, 3, 1, 4, 1], barre: 0 },
  { root: 1, suffix: 'add9', offsets: [null, 0, 2, 4, 2, 0], fingers: [0, 1, 2, 4, 3, 1], barre: 0 },
  { root: 1, suffix: 'm7b5', offsets: [null, 0, 1, 0, 1, null], fingers: [0, 2, 3, 1, 4, 0] },
  { root: 1, suffix: 'aug', offsets: [null, 0, 3, 2, 2, null], fingers: [0, 1, 4, 2, 3, 0] },
  { root: 1, suffix: 'dim7', offsets: [null, 0, 1, -1, 1, null], fingers: [0, 2, 3, 1, 4, 0], minRootFret: 2 },

  // Root on the D string, for the higher voicings.
  { root: 2, suffix: '', offsets: [null, null, 0, 2, 3, 2], fingers: [0, 0, 1, 2, 4, 3] },
  { root: 2, suffix: 'm', offsets: [null, null, 0, 2, 3, 1], fingers: [0, 0, 1, 3, 4, 2] },
  { root: 2, suffix: '7', offsets: [null, null, 0, 2, 1, 2], fingers: [0, 0, 1, 3, 2, 4] },
  { root: 2, suffix: 'm7', offsets: [null, null, 0, 2, 1, 1], fingers: [0, 0, 1, 3, 2, 2] },
  { root: 2, suffix: 'maj7', offsets: [null, null, 0, 2, 2, 2], fingers: [0, 0, 1, 2, 3, 4] },
];

const rootFretOn = (stringIndex, pitchClass) => (((pitchClass - STRING_PITCH[stringIndex]) % 12) + 12) % 12;

const pressedFrets = (entry) => entry.frets.filter((fret) => typeof fret === 'number' && fret > 0);

/** Turns a catalogue line into the chord model the editor and renderers use. */
export const toChordModel = (entry) => {
  const pressed = pressedFrets(entry);
  const highest = pressed.length > 0 ? Math.max(...pressed) : 0;
  const startFret = highest > OPEN_POSITION_LIMIT ? Math.min(...pressed) : 1;

  const base = createChord();
  const markers = entry.frets.map((fret) => (fret === 'x' ? 'muted' : fret === 0 ? 'open' : null));
  const fingers = base.fingers.map((_, string) => entry.fingers?.[string] ?? 0);

  const barres = entry.barre
    ? [{ row: entry.barre.fret - startFret, from: entry.barre.from, to: entry.barre.to }]
    : [];

  const dots = entry.frets.flatMap((fret, string) => {
    if (typeof fret !== 'number' || fret === 0) return [];
    const coveredByBarre =
      entry.barre && fret === entry.barre.fret && string >= entry.barre.from && string <= entry.barre.to;

    return coveredByBarre ? [] : [{ string, row: fret - startFret }];
  });

  return { ...base, startFret, markers, fingers, barres, dots, nameOverride: entry.name };
};

/** Every root a movable shape can be played on, skipping the open-string position. */
const transpose = (shape) => {
  const entries = [];

  for (let pitch = 0; pitch < 12; pitch += 1) {
    const rootFret = rootFretOn(shape.root, pitch);
    if (rootFret < (shape.minRootFret ?? 1)) continue;

    const frets = shape.offsets.map((offset) => (offset === null ? 'x' : rootFret + offset));
    const barreStrings = shape.offsets.reduce(
      (range, offset, string) => (offset === null ? range : { from: Math.min(range.from, string), to: 5 }),
      { from: 5, to: 5 },
    );

    entries.push({
      name: `${noteName(pitch)}${shape.suffix}`,
      frets,
      fingers: shape.fingers,
      barre:
        shape.barre === undefined
          ? undefined
          : { fret: rootFret + shape.barre, from: barreStrings.from, to: barreStrings.to },
    });
  }

  return entries;
};

const aliasOf = (name) => {
  const root = Object.keys(ENHARMONIC).find((candidate) => name.startsWith(candidate));
  return root ? `${ENHARMONIC[root]}${name.slice(root.length)}` : null;
};

const build = () => {
  const entries = [
    ...OPEN_CHORDS.map((entry) => ({ entry, open: true })),
    ...MOVABLE_SHAPES.flatMap(transpose).map((entry) => ({ entry, open: false })),
  ];

  return entries.map(({ entry, open }, index) => {
    const alias = aliasOf(entry.name);
    const chord = toChordModel(entry);

    return {
      id: `catalog:${index}`,
      name: entry.name,
      aliases: alias ? [alias] : [],
      open,
      startFret: chord.startFret,
      chord,
    };
  });
};

let cache = null;

/** @returns {{id: string, name: string, aliases: string[], open: boolean, startFret: number, chord: object}[]} */
export const catalogShapes = () => {
  cache ??= build();
  return cache;
};

/** The idiomatic open positions, shown before the user searches for anything. */
export const openShapes = () => catalogShapes().filter((shape) => shape.open);

/**
 * Matches on the written name or its enharmonic twin, prefix first.
 *
 * A result is returned under **the spelling that matched**: searching `A#9` shows `A#9`,
 * not the catalogue's own `Bb9`, and picking it names the chord that way too.
 */
export const searchCatalog = (query, shapes = catalogShapes()) => {
  const needle = String(query ?? '').trim().toLocaleLowerCase('fr').replace(/\s+/g, '');
  if (needle === '') return [];

  const matchOf = (shape) => {
    const spellings = [shape.name, ...shape.aliases];
    const lowered = spellings.map((name) => name.toLocaleLowerCase('fr'));

    for (const [score, test] of [
      [0, (name) => name === needle],
      [1, (name) => name.startsWith(needle)],
      [2, (name) => name.includes(needle)],
    ]) {
      const index = lowered.findIndex(test);
      if (index >= 0) return { score, spelling: spellings[index] };
    }
    return null;
  };

  return shapes
    .map((shape) => ({ shape, match: matchOf(shape) }))
    .filter((entry) => entry.match !== null)
    .sort((a, b) => a.match.score - b.match.score || a.shape.startFret - b.shape.startFret)
    .map(({ shape, match }) =>
      match.spelling === shape.name
        ? shape
        : { ...shape, name: match.spelling, chord: { ...shape.chord, nameOverride: match.spelling } },
    );
};
