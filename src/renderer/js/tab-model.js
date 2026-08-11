/**
 * Immutable model for a linear tablature.
 *
 * Each measure carries its own column count, so a bar can hold as many notes as the
 * music needs. A note is therefore addressed by `(bar, step, string)` rather than by a
 * position on a uniform grid.
 *
 * Strings are indexed like the chord model: 0 is the thickest string (low E).
 */

export const STRING_COUNT = 6;
export const MIN_MEASURES = 1;
export const MAX_MEASURES = 24;
export const MIN_STEPS = 2;
export const MAX_STEPS = 32;
export const DEFAULT_STEPS = 8;
export const MIN_BARS_PER_LINE = 1;
export const MAX_BARS_PER_LINE = 8;
export const MAX_FRET_LENGTH = 2;
export const MAX_CHORD_LENGTH = 10;
export const MODEL_VERSION = 2;

/** Low to high, matching the string index order. */
export const STRING_LABELS = ['E', 'A', 'D', 'G', 'B', 'e'];

/** Articulations joining a note to the next one played on the same string. */
export const LINKS = ['h', 'p', 'b', 'r', '/', '\\'];

/** Per-note decorations. */
export const NOTE_FLAGS = ['ghost', 'harmonic', 'vibrato', 'tap', 'palmMute'];

const FRET_PATTERN = /^(x|\d{1,2})$/;
const CHORD_PATTERN = /^[A-Za-z0-9#♯♭°Δ+\-/()]*$/;

const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

export const createTab = () => ({
  version: MODEL_VERSION,
  kind: 'tab',
  title: '',
  stringCount: STRING_COUNT,
  barsPerLine: 4,
  measures: [{ steps: DEFAULT_STEPS }, { steps: DEFAULT_STEPS }],
  notes: [],
  chords: [],
});

const blankNote = (bar, step, string) => ({
  bar,
  step,
  string,
  fret: '',
  link: null,
  ghost: false,
  harmonic: false,
  vibrato: false,
  tap: false,
  palmMute: false,
});

/* ---------- Geometry of the measure list ---------- */

export const measureCount = (tab) => tab.measures.length;
export const measureSteps = (tab, bar) => tab.measures[bar]?.steps ?? 0;
export const totalColumns = (tab) => tab.measures.reduce((sum, measure) => sum + measure.steps, 0);

/** Position of a slot on the single timeline formed by all the measures. */
export const absoluteColumn = (tab, bar, step) =>
  tab.measures.slice(0, bar).reduce((sum, measure) => sum + measure.steps, 0) + step;

export const isFretText = (text) => FRET_PATTERN.test(text);
export const isChordText = (text) => CHORD_PATTERN.test(text);

export const isBlank = (tab) => tab.notes.length === 0 && tab.chords.length === 0;

/* ---------- Notes ---------- */

/** Guards every write: a slot only exists inside a declared measure. */
export const slotExists = (tab, bar, step) => step >= 0 && step < measureSteps(tab, bar);

const sameSlot = (item, bar, step, string) =>
  item.bar === bar && item.step === step && item.string === string;

export const noteAt = (tab, bar, step, string) =>
  tab.notes.find((note) => sameSlot(note, bar, step, string)) ?? null;

/** Writing an empty fret removes the note along with its articulations. */
export const setFret = (tab, bar, step, string, fret) => {
  if (!slotExists(tab, bar, step)) return tab;

  const cleaned = String(fret ?? '').slice(0, MAX_FRET_LENGTH);
  const kept = tab.notes.filter((note) => !sameSlot(note, bar, step, string));

  if (cleaned === '') return { ...tab, notes: kept };

  const existing = noteAt(tab, bar, step, string) ?? blankNote(bar, step, string);
  return { ...tab, notes: [...kept, { ...existing, fret: cleaned }] };
};

export const clearNote = (tab, bar, step, string) => ({
  ...tab,
  notes: tab.notes.filter((note) => !sameSlot(note, bar, step, string)),
});

const patchNote = (tab, bar, step, string, patch) => {
  const existing = noteAt(tab, bar, step, string);
  if (!existing) return tab;
  return {
    ...tab,
    notes: tab.notes.map((note) => (note === existing ? { ...note, ...patch } : note)),
  };
};

/** Articulations only make sense on an existing note, so a missing one is a no-op. */
export const toggleFlag = (tab, bar, step, string, flag) => {
  const existing = noteAt(tab, bar, step, string);
  if (!existing || !NOTE_FLAGS.includes(flag)) return tab;
  return patchNote(tab, bar, step, string, { [flag]: !existing[flag] });
};

export const setLink = (tab, bar, step, string, link) => {
  const existing = noteAt(tab, bar, step, string);
  if (!existing || !LINKS.includes(link)) return tab;
  return patchNote(tab, bar, step, string, { link: existing.link === link ? null : link });
};

/** Next note played on the same string, or null at the end of the line. */
export const nextOnString = (tab, note) => {
  const from = absoluteColumn(tab, note.bar, note.step);
  return (
    tab.notes
      .filter((other) => other.string === note.string && absoluteColumn(tab, other.bar, other.step) > from)
      .sort(
        (a, b) => absoluteColumn(tab, a.bar, a.step) - absoluteColumn(tab, b.bar, b.step),
      )[0] ?? null
  );
};

/* ---------- Chords ---------- */

export const chordAt = (tab, bar, step) =>
  tab.chords.find((chord) => chord.bar === bar && chord.step === step) ?? null;

export const setChord = (tab, bar, step, text) => {
  if (!slotExists(tab, bar, step)) return tab;

  const kept = tab.chords.filter((chord) => !(chord.bar === bar && chord.step === step));
  const cleaned = String(text ?? '').slice(0, MAX_CHORD_LENGTH);

  if (cleaned === '') return { ...tab, chords: kept };
  return { ...tab, chords: [...kept, { bar, step, text: cleaned }] };
};

export const clearChord = (tab, bar, step) => setChord(tab, bar, step, '');

/* ---------- Measures ---------- */

const dropOutside = (tab, bar, steps) => ({
  notes: tab.notes.filter((note) => note.bar !== bar || note.step < steps),
  chords: tab.chords.filter((chord) => chord.bar !== bar || chord.step < steps),
});

export const setMeasureSteps = (tab, bar, steps) => {
  if (!tab.measures[bar]) return tab;

  const next = clamp(Math.round(steps) || MIN_STEPS, MIN_STEPS, MAX_STEPS);
  return {
    ...tab,
    measures: tab.measures.map((measure, index) => (index === bar ? { steps: next } : measure)),
    ...dropOutside(tab, bar, next),
  };
};

export const addMeasure = (tab) => {
  if (tab.measures.length >= MAX_MEASURES) return tab;
  const steps = tab.measures.at(-1)?.steps ?? DEFAULT_STEPS;
  return { ...tab, measures: [...tab.measures, { steps }] };
};

export const removeMeasure = (tab) => {
  if (tab.measures.length <= MIN_MEASURES) return tab;
  const last = tab.measures.length - 1;
  return {
    ...tab,
    measures: tab.measures.slice(0, last),
    notes: tab.notes.filter((note) => note.bar < last),
    chords: tab.chords.filter((chord) => chord.bar < last),
  };
};

const shiftFrom = (bar, step, delta) => (item) =>
  item.bar === bar && item.step >= step ? { ...item, step: item.step + delta } : item;

/** Opens a slot inside a measure, pushing everything after it one column to the right. */
export const insertColumn = (tab, bar, step) => {
  const steps = measureSteps(tab, bar);
  if (steps === 0 || steps >= MAX_STEPS) return tab;

  return {
    ...tab,
    measures: tab.measures.map((measure, index) => (index === bar ? { steps: steps + 1 } : measure)),
    notes: tab.notes.map(shiftFrom(bar, step, 1)),
    chords: tab.chords.map(shiftFrom(bar, step, 1)),
  };
};

export const removeColumn = (tab, bar, step) => {
  const steps = measureSteps(tab, bar);
  if (steps <= MIN_STEPS) return tab;

  const keep = (item) => !(item.bar === bar && item.step === step);
  return {
    ...tab,
    measures: tab.measures.map((measure, index) => (index === bar ? { steps: steps - 1 } : measure)),
    notes: tab.notes.filter(keep).map(shiftFrom(bar, step + 1, -1)),
    chords: tab.chords.filter(keep).map(shiftFrom(bar, step + 1, -1)),
  };
};

export const setBarsPerLine = (tab, bars) => ({
  ...tab,
  barsPerLine: clamp(Math.round(bars) || MIN_BARS_PER_LINE, MIN_BARS_PER_LINE, MAX_BARS_PER_LINE),
});

export const setTitle = (tab, title) => ({ ...tab, title: String(title ?? '').trim() });

/* ---------- Persistence ---------- */

/** Version 1 stored a uniform `bars` × `stepsPerBar` grid with free-text notes. */
const migrateV1 = (raw) => {
  const stepsPerBar = clamp(Math.round(Number(raw.stepsPerBar) || DEFAULT_STEPS), MIN_STEPS, MAX_STEPS);
  const bars = clamp(Math.round(Number(raw.bars) || MIN_MEASURES), MIN_MEASURES, MAX_MEASURES);

  const split = (step) => ({ bar: Math.floor(step / stepsPerBar), step: step % stepsPerBar });
  const firstFret = (text) => String(text ?? '').match(/^(x|\d{1,2})/)?.[0] ?? '';
  const firstLink = (text) => LINKS.find((link) => String(text ?? '').includes(link)) ?? null;

  return {
    ...raw,
    measures: Array.from({ length: bars }, () => ({ steps: stepsPerBar })),
    notes: (Array.isArray(raw.notes) ? raw.notes : []).map((note) => ({
      ...split(Number(note?.step) || 0),
      string: note?.string,
      fret: firstFret(note?.text),
      link: firstLink(note?.text),
    })),
    chords: (Array.isArray(raw.chords) ? raw.chords : []).map((chord) => ({
      ...split(Number(chord?.step) || 0),
      text: chord?.text,
    })),
  };
};

/** Rebuilds a trusted tab object from arbitrary parsed JSON. */
export const parseTab = (input) => {
  if (!input || typeof input !== 'object') throw new Error('Fichier invalide.');

  const raw = Array.isArray(input.measures) ? input : migrateV1(input);
  const base = createTab();

  const measures = raw.measures
    .slice(0, MAX_MEASURES)
    .map((measure) => ({
      steps: clamp(Math.round(Number(measure?.steps) || DEFAULT_STEPS), MIN_STEPS, MAX_STEPS),
    }));

  const sized = setBarsPerLine(
    { ...base, measures: measures.length > 0 ? measures : base.measures },
    Number(raw.barsPerLine),
  );

  const inGrid = (bar, step) => bar >= 0 && bar < sized.measures.length && step >= 0 && step < measureSteps(sized, bar);

  const notes = (Array.isArray(raw.notes) ? raw.notes : [])
    .map((note) => ({
      ...blankNote(
        Math.round(Number(note?.bar) || 0),
        Math.round(Number(note?.step) || 0),
        clamp(Math.round(Number(note?.string) || 0), 0, sized.stringCount - 1),
      ),
      fret: String(note?.fret ?? ''),
      link: LINKS.includes(note?.link) ? note.link : null,
      ...Object.fromEntries(NOTE_FLAGS.map((flag) => [flag, note?.[flag] === true])),
    }))
    .filter((note) => isFretText(note.fret) && inGrid(note.bar, note.step));

  const chords = (Array.isArray(raw.chords) ? raw.chords : [])
    .map((chord) => ({
      bar: Math.round(Number(chord?.bar) || 0),
      step: Math.round(Number(chord?.step) || 0),
      text: String(chord?.text ?? '').slice(0, MAX_CHORD_LENGTH),
    }))
    .filter((chord) => chord.text !== '' && isChordText(chord.text) && inGrid(chord.bar, chord.step));

  const unique = (items) => [
    ...new Map(items.map((item) => [`${item.bar}:${item.step}:${item.string ?? ''}`, item])).values(),
  ];

  return setTitle(
    { ...sized, notes: unique(notes), chords: unique(chords) },
    typeof raw.title === 'string' ? raw.title : '',
  );
};
