/**
 * Immutable chord-diagram model. Every mutator returns a new chord object.
 *
 * Convention: strings are indexed left to right as drawn on a chord chart,
 * so index 0 is the thickest string (low E in standard tuning).
 * Rows are relative to the diagram window; the absolute fret of a row is
 * `startFret + row`.
 */

export const STRING_COUNT = 6;
export const MIN_BARRE_STRINGS = 3;
export const MIN_FRET_COUNT = 3;
export const MAX_FRET_COUNT = 7;
export const MAX_START_FRET = 22;
export const MAX_FINGER = 5;
export const MODEL_VERSION = 1;

export const MARKER_CYCLE = [null, 'open', 'muted'];

const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

export const createChord = () => ({
  version: MODEL_VERSION,
  kind: 'chord',
  nameOverride: null,
  startFret: 1,
  fretCount: 5,
  stringCount: STRING_COUNT,
  dots: [],
  barres: [],
  markers: Array.from({ length: STRING_COUNT }, () => null),
  fingers: Array.from({ length: STRING_COUNT }, () => 0),
});

export const barreCovering = (chord, string, row) =>
  chord.barres.find((barre) => barre.row === row && string >= barre.from && string <= barre.to) ?? null;

export const hasDot = (chord, string, row) =>
  chord.dots.some((dot) => dot.string === string && dot.row === row);

export const isPressed = (chord, string, row) =>
  hasDot(chord, string, row) || barreCovering(chord, string, row) !== null;

const withoutDot = (chord, string, row) =>
  chord.dots.filter((dot) => !(dot.string === string && dot.row === row));

const barreToDots = (barre) =>
  Array.from({ length: barre.to - barre.from + 1 }, (_, offset) => ({
    string: barre.from + offset,
    row: barre.row,
  }));

/** Replaces a barre by the equivalent set of individual dots. */
const dissolveBarre = (chord, barre) => ({
  ...chord,
  barres: chord.barres.filter((candidate) => candidate !== barre),
  dots: [...chord.dots, ...barreToDots(barre)],
});

/**
 * Toggles the note at a cell. A string carries at most one dot, so pressing a
 * new fret moves the existing dot (barres are left untouched, which is what
 * shapes like the F barre chord need).
 */
export const toggleNote = (chord, string, row) => {
  const barre = barreCovering(chord, string, row);
  if (barre) {
    const dissolved = dissolveBarre(chord, barre);
    return { ...dissolved, dots: withoutDot(dissolved, string, row) };
  }

  if (hasDot(chord, string, row)) {
    return { ...chord, dots: withoutDot(chord, string, row) };
  }

  const dots = [...chord.dots.filter((dot) => dot.string !== string), { string, row }];
  const markers = chord.markers.map((marker, index) => (index === string ? null : marker));
  return { ...chord, dots, markers };
};

/** Longest run of consecutive pressed strings on `row` that contains `string`. */
const pressedRun = (chord, string, row) => {
  if (!isPressed(chord, string, row)) return null;

  let from = string;
  let to = string;
  while (from > 0 && isPressed(chord, from - 1, row)) from -= 1;
  while (to < chord.stringCount - 1 && isPressed(chord, to + 1, row)) to += 1;
  return { from, to };
};

/**
 * Right-click behaviour: turn a run of dots into a barre, or turn a barre back
 * into dots. Returns `{ chord, error }` so the UI can explain a refusal.
 */
export const toggleBarre = (chord, string, row) => {
  const existing = barreCovering(chord, string, row);
  if (existing) return { chord: dissolveBarre(chord, existing), error: null };

  const run = pressedRun(chord, string, row);
  if (!run) return { chord, error: 'Clic droit sur un point pour créer un barré.' };

  const width = run.to - run.from + 1;
  if (width < MIN_BARRE_STRINGS) {
    return { chord, error: `Un barré demande au moins ${MIN_BARRE_STRINGS} cordes consécutives.` };
  }

  const dots = chord.dots.filter(
    (dot) => !(dot.row === row && dot.string >= run.from && dot.string <= run.to),
  );
  return { chord: { ...chord, dots, barres: [...chord.barres, { row, ...run }] }, error: null };
};

export const cycleMarker = (chord, string, step = 1) => {
  const size = MARKER_CYCLE.length;
  const current = MARKER_CYCLE.indexOf(chord.markers[string] ?? null);
  const next = MARKER_CYCLE[(((current + step) % size) + size) % size];
  const markers = chord.markers.map((marker, index) => (index === string ? next : marker));

  if (next !== 'muted') return { ...chord, markers };

  // A muted string cannot be fretted at the same time.
  return {
    ...chord,
    markers,
    dots: chord.dots.filter((dot) => dot.string !== string),
    fingers: chord.fingers.map((finger, index) => (index === string ? 0 : finger)),
  };
};

export const cycleFinger = (chord, string, step = 1) => {
  const total = MAX_FINGER + 1;
  const next = (((chord.fingers[string] ?? 0) + step) % total + total) % total;
  return { ...chord, fingers: chord.fingers.map((finger, index) => (index === string ? next : finger)) };
};

export const setStartFret = (chord, startFret) => ({
  ...chord,
  startFret: clamp(Math.round(startFret) || 1, 1, MAX_START_FRET),
});

export const setFretCount = (chord, fretCount) => {
  const next = clamp(Math.round(fretCount) || MIN_FRET_COUNT, MIN_FRET_COUNT, MAX_FRET_COUNT);
  return {
    ...chord,
    fretCount: next,
    dots: chord.dots.filter((dot) => dot.row < next),
    barres: chord.barres.filter((barre) => barre.row < next),
  };
};

export const setNameOverride = (chord, name) => {
  const trimmed = (name ?? '').trim();
  return { ...chord, nameOverride: trimmed === '' ? null : trimmed };
};

/**
 * True while nothing has been placed yet. An untouched grid is not the same as
 * six open strings, so name detection stays silent until the user marks something.
 */
export const isBlank = (chord) =>
  chord.dots.length === 0 &&
  chord.barres.length === 0 &&
  chord.markers.every((marker) => marker === null);

/**
 * Absolute fret played on each string: `null` when muted, `0` when open.
 * When a string carries both a barre and a dot, the higher note wins.
 */
export const playedFrets = (chord) =>
  Array.from({ length: chord.stringCount }, (_, string) => {
    if (chord.markers[string] === 'muted') return null;

    const rows = [
      ...chord.dots.filter((dot) => dot.string === string).map((dot) => dot.row),
      ...chord.barres
        .filter((barre) => string >= barre.from && string <= barre.to)
        .map((barre) => barre.row),
    ];

    if (rows.length === 0) return 0;
    return chord.startFret + Math.max(...rows);
  });

const sanitizeCell = (chord, value) => ({
  string: clamp(Math.round(value?.string ?? 0), 0, chord.stringCount - 1),
  row: clamp(Math.round(value?.row ?? 0), 0, chord.fretCount - 1),
});

/** Rebuilds a trusted chord object from arbitrary parsed JSON. */
export const parseChord = (raw) => {
  if (!raw || typeof raw !== 'object') throw new Error('Fichier invalide.');

  const base = createChord();
  const withGrid = setFretCount(
    setStartFret(base, Number(raw.startFret) || 1),
    Number(raw.fretCount) || base.fretCount,
  );

  const dots = Array.isArray(raw.dots) ? raw.dots.map((dot) => sanitizeCell(withGrid, dot)) : [];
  const barres = Array.isArray(raw.barres)
    ? raw.barres
        .map((barre) => {
          const row = clamp(Math.round(barre?.row ?? 0), 0, withGrid.fretCount - 1);
          const from = clamp(Math.round(barre?.from ?? 0), 0, withGrid.stringCount - 1);
          const to = clamp(Math.round(barre?.to ?? 0), 0, withGrid.stringCount - 1);
          return { row, from: Math.min(from, to), to: Math.max(from, to) };
        })
        .filter((barre) => barre.to - barre.from + 1 >= MIN_BARRE_STRINGS)
    : [];

  const markers = withGrid.markers.map((_, index) =>
    MARKER_CYCLE.includes(raw.markers?.[index]) ? raw.markers[index] : null,
  );
  const fingers = withGrid.fingers.map((_, index) =>
    clamp(Math.round(Number(raw.fingers?.[index]) || 0), 0, MAX_FINGER),
  );

  return setNameOverride(
    { ...withGrid, dots, barres, markers, fingers },
    typeof raw.nameOverride === 'string' ? raw.nameOverride : '',
  );
};
