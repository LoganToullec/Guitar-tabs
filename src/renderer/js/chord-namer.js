/**
 * Chord recognition from a fretted shape.
 *
 * The shape is given as one absolute fret per string (`null` = muted, `0` = open),
 * indexed from the thickest string, matching `playedFrets()` in chord-model.js.
 */

/** MIDI note of each open string, thickest first: E2 A2 D3 G3 B3 E4. */
export const STANDARD_TUNING = [40, 45, 50, 55, 59, 64];

const PITCH_NAMES = ['C', 'C#', 'D', 'Eb', 'E', 'F', 'F#', 'G', 'Ab', 'A', 'Bb', 'B'];

const SEMITONES_PER_OCTAVE = 12;
const WRONG_BASS_PENALTY = 40;
const MISSING_TONE_PENALTY = 10;

/**
 * Ordered by preference: on equal footing the earlier entry wins.
 * `optional` lists degrees guitar voicings routinely drop (mostly the fifth).
 */
const FORMULAS = [
  { suffix: '5', intervals: [0, 7], optional: [] },
  { suffix: '', intervals: [0, 4, 7], optional: [] },
  { suffix: 'm', intervals: [0, 3, 7], optional: [] },
  { suffix: 'dim', intervals: [0, 3, 6], optional: [] },
  { suffix: 'aug', intervals: [0, 4, 8], optional: [] },
  { suffix: 'sus2', intervals: [0, 2, 7], optional: [] },
  { suffix: 'sus4', intervals: [0, 5, 7], optional: [] },
  { suffix: '7', intervals: [0, 4, 7, 10], optional: [7] },
  { suffix: 'm7', intervals: [0, 3, 7, 10], optional: [7] },
  { suffix: 'maj7', intervals: [0, 4, 7, 11], optional: [7] },
  { suffix: '6', intervals: [0, 4, 7, 9], optional: [7] },
  { suffix: 'm6', intervals: [0, 3, 7, 9], optional: [7] },
  { suffix: 'mMaj7', intervals: [0, 3, 7, 11], optional: [7] },
  { suffix: 'm7b5', intervals: [0, 3, 6, 10], optional: [] },
  { suffix: 'dim7', intervals: [0, 3, 6, 9], optional: [] },
  { suffix: '7sus4', intervals: [0, 5, 7, 10], optional: [7] },
  { suffix: 'add9', intervals: [0, 2, 4, 7], optional: [] },
  { suffix: 'madd9', intervals: [0, 2, 3, 7], optional: [] },
  { suffix: '7b5', intervals: [0, 4, 6, 10], optional: [] },
  { suffix: '7#5', intervals: [0, 4, 8, 10], optional: [] },
  { suffix: '9', intervals: [0, 2, 4, 7, 10], optional: [7] },
  { suffix: 'maj9', intervals: [0, 2, 4, 7, 11], optional: [7] },
  { suffix: 'm9', intervals: [0, 2, 3, 7, 10], optional: [7] },
  { suffix: '6/9', intervals: [0, 2, 4, 7, 9], optional: [7] },
  { suffix: '7b9', intervals: [0, 1, 4, 7, 10], optional: [7] },
  { suffix: '7#9', intervals: [0, 3, 4, 7, 10], optional: [7] },
  { suffix: '11', intervals: [0, 2, 5, 7, 10], optional: [7, 2] },
  { suffix: 'm11', intervals: [0, 2, 3, 5, 7, 10], optional: [7, 2] },
  { suffix: '13', intervals: [0, 2, 4, 7, 9, 10], optional: [7, 2] },
  { suffix: 'maj13', intervals: [0, 2, 4, 7, 9, 11], optional: [7, 2] },
];

export const noteName = (pitchClass) => PITCH_NAMES[((pitchClass % 12) + 12) % 12];

const scoreFormula = (formula, index, relatives, root, bassPitchClass) => {
  const available = new Set(formula.intervals);
  for (const interval of relatives) {
    if (!available.has(interval)) return null;
  }

  const missing = formula.intervals.filter((interval) => !relatives.has(interval));
  if (missing.some((interval) => !formula.optional.includes(interval))) return null;

  return (
    (root === bassPitchClass ? 0 : WRONG_BASS_PENALTY) + index + missing.length * MISSING_TONE_PENALTY
  );
};

/** How far behind the best reading an alternative may be and still be worth showing. */
const ALTERNATIVE_WINDOW = 60;
const MAX_ALTERNATIVES = 6;

/**
 * Every plausible reading of a shape, best first. A single grip often has several valid
 * names (`Am7` and `C6/A` are the same four notes), so the caller can offer the choice.
 *
 * @returns {string[]} chord symbols, possibly empty
 */
export const detectChordNames = (frets, { tuning = STANDARD_TUNING, limit = MAX_ALTERNATIVES } = {}) => {
  const notes = frets
    .map((fret, string) => (fret === null || fret === undefined ? null : tuning[string] + fret))
    .filter((note) => note !== null);

  const pitchClasses = new Set(notes.map((note) => note % SEMITONES_PER_OCTAVE));
  if (pitchClasses.size < 2) return [];

  const bassPitchClass = Math.min(...notes) % SEMITONES_PER_OCTAVE;
  const candidates = [];

  for (const root of pitchClasses) {
    const relatives = new Set(
      [...pitchClasses].map(
        (pitchClass) => (pitchClass - root + SEMITONES_PER_OCTAVE) % SEMITONES_PER_OCTAVE,
      ),
    );

    FORMULAS.forEach((formula, index) => {
      const score = scoreFormula(formula, index, relatives, root, bassPitchClass);
      if (score === null) return;

      const slash = root === bassPitchClass ? '' : `/${noteName(bassPitchClass)}`;
      candidates.push({ score, name: `${noteName(root)}${formula.suffix}${slash}` });
    });
  }

  if (candidates.length === 0) return [];

  candidates.sort((a, b) => a.score - b.score);
  const ceiling = candidates[0].score + ALTERNATIVE_WINDOW;

  return [...new Set(candidates.filter((entry) => entry.score <= ceiling).map((entry) => entry.name))].slice(
    0,
    limit,
  );
};

/**
 * @returns {string|null} the most likely chord symbol (e.g. `Am7`, `C/E`), or null.
 */
export const detectChordName = (frets, tuning = STANDARD_TUNING) =>
  detectChordNames(frets, { tuning, limit: 1 })[0] ?? null;
