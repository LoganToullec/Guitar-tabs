/**
 * Lyrics are stored as structured lines: the words on one side, the chords on the other
 * with the character offset they sit above. Nothing has to be typed between brackets.
 *
 * The bracket notation is still understood on import, so pasting a ChordPro-style sheet
 * works:
 *
 *   [Verse 1]
 *   When you were [G]here before
 */

export const MAX_CHORD_NAME = 12;

const SECTION_LINE = /^\s*\[([^\]]{1,40})\]\s*$/;
const CHORD_MARKER = /\[([^\]]{1,12})\]/g;

/** @typedef {{text: string, section: boolean, chords: {index: number, name: string}[]}} LyricLine */

export const emptyLine = () => ({ text: '', section: false, chords: [] });

export const sectionLine = (text = 'Couplet') => ({ text, section: true, chords: [] });

/** Keeps one chord per offset, ordered, and never past the end of the words. */
export const normalizeChords = (chords, textLength) => {
  const byIndex = new Map();

  for (const chord of Array.isArray(chords) ? chords : []) {
    const name = String(chord?.name ?? '').trim().slice(0, MAX_CHORD_NAME);
    if (name === '') continue;

    const index = Math.max(0, Math.min(Math.round(Number(chord?.index) || 0), textLength));
    byIndex.set(index, { index, name });
  }

  return [...byIndex.values()].sort((a, b) => a.index - b.index);
};

export const normalizeLine = (line) => {
  const text = String(line?.text ?? '').replace(/[\r\n]/g, '');
  return {
    text,
    section: line?.section === true,
    chords: line?.section === true ? [] : normalizeChords(line?.chords, text.length),
  };
};

/** @returns {LyricLine[]} */
export const parseLyrics = (text) =>
  String(text ?? '')
    .replace(/\r\n?/g, '\n')
    .split('\n')
    .map((raw) => {
      const heading = raw.match(SECTION_LINE);
      if (heading) return sectionLine(heading[1].trim());

      const chords = [];
      let words = '';
      let cursor = 0;

      CHORD_MARKER.lastIndex = 0;
      for (let match = CHORD_MARKER.exec(raw); match; match = CHORD_MARKER.exec(raw)) {
        words += raw.slice(cursor, match.index);
        chords.push({ index: words.length, name: match[1].trim() });
        cursor = match.index + match[0].length;
      }
      words += raw.slice(cursor);

      return { text: words, section: false, chords: normalizeChords(chords, words.length) };
    });

/** Distinct chord names in the order they first appear. */
export const chordNamesInLines = (lines) => [
  ...new Set(lines.filter((line) => !line.section).flatMap((line) => line.chords.map((chord) => chord.name))),
];

/** Widest rendered line, counting the chord row that sits above the words. */
export const longestLineLength = (lines) =>
  lines.reduce((widest, line) => {
    const lastChord = line.chords.at(-1);
    const chordEnd = lastChord ? lastChord.index + lastChord.name.length : 0;
    return Math.max(widest, line.text.length, chordEnd);
  }, 0);

/** Character offset of the word the caret would land on — chords belong on word starts. */
export const wordStartAt = (text, index) => {
  const clamped = Math.max(0, Math.min(index, text.length));
  if (text[clamped] === ' ') return clamped;

  let start = clamped;
  while (start > 0 && text[start - 1] !== ' ') start -= 1;
  return start;
};

const shiftBy = (chords, delta) =>
  chords.map((chord) => ({ ...chord, index: Math.max(0, chord.index + delta) }));

/**
 * Splices a multi-line paste into a single line, so a whole song copied out of a document
 * lands as it was written: the words left of the caret keep the first pasted line, the
 * words right of it join the last, and everything between becomes its own line — blank
 * lines included, which is what makes a stanza break survive the paste.
 *
 * A pasted section heading never swallows the words around it: it stays on its own line
 * and they keep theirs.
 *
 * @param {LyricLine} line the line the caret is in
 * @param {number} selectionStart caret, or start of the replaced selection
 * @param {number} selectionEnd end of the replaced selection
 * @param {string} text the pasted text
 * @returns {{lines: LyricLine[], caret: {line: number, index: number}}} lines to put in
 *   place of `line`, and where the caret belongs, counted from the first of them
 */
export const spliceLines = (line, selectionStart, selectionEnd, text) => {
  const head = line.text.slice(0, selectionStart);
  const tail = line.text.slice(selectionEnd);
  const kept = line.chords.filter((chord) => chord.index <= selectionStart);
  const moved = line.chords.filter((chord) => chord.index >= selectionEnd);

  const lines = parseLyrics(text);

  if (head !== '') {
    if (lines[0].section) lines.unshift({ text: head, section: false, chords: kept });
    else {
      lines[0] = {
        ...lines[0],
        text: head + lines[0].text,
        chords: [...kept, ...shiftBy(lines[0].chords, head.length)],
      };
    }
  }

  const last = lines.length - 1;
  const caret = { line: last, index: lines[last].text.length };

  if (tail !== '') {
    if (lines[last].section) lines.push({ text: tail, section: false, chords: shiftBy(moved, -selectionEnd) });
    else {
      lines[last] = {
        ...lines[last],
        text: lines[last].text + tail,
        chords: [...lines[last].chords, ...shiftBy(moved, lines[last].text.length - selectionEnd)],
      };
    }
  }

  return { lines: lines.map(normalizeLine), caret };
};
