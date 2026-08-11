/**
 * Immutable model for a full song sheet: an ordered list of blocks mixing chord
 * diagrams, strumming patterns, tablatures and lyrics.
 *
 * Chord and tab blocks embed the very same documents the other two editors produce,
 * so a song is assembled from them rather than re-implementing either.
 */

import { parseChord } from './chord-model.js';
import { parseTab } from './tab-model.js';
import { chordKey, resolveChordName } from './chord-name.js';
import { chordNamesInLines, emptyLine, normalizeLine, parseLyrics } from './lyrics.js';

export const BLOCK_TYPES = ['chords', 'strum', 'tab', 'lyrics'];
export const MAX_BLOCKS = 60;
export const MAX_CHORDS_PER_BLOCK = 16;
export const SUBDIVISIONS = [8, 16];
export const STROKES = [null, 'd', 'u', 'x'];
export const MAX_BPM = 320;
export const MODEL_VERSION = 1;

let sequence = 0;
const nextId = () => `b${Date.now().toString(36)}-${(sequence++).toString(36)}`;

const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

export const createSong = () => ({
  version: MODEL_VERSION,
  kind: 'song',
  title: '',
  artist: '',
  blocks: [],
});

export const createChordsBlock = (chords = []) => ({ id: nextId(), type: 'chords', chords });

export const createStrumBlock = (label = 'Couplet') => ({
  id: nextId(),
  type: 'strum',
  label,
  bpm: 0,
  subdivision: 8,
  strokes: Array.from({ length: 8 }, () => null),
});

export const createTabBlock = (tab) => ({ id: nextId(), type: 'tab', tab });

export const createLyricsBlock = (lines = [emptyLine()]) => ({ id: nextId(), type: 'lyrics', lines });

export const setLyricsLines = (song, id, lines) =>
  updateBlock(song, id, { lines: lines.length > 0 ? lines.map(normalizeLine) : [emptyLine()] });

export const isBlank = (song) => song.blocks.length === 0;

export const blockAt = (song, id) => song.blocks.find((block) => block.id === id) ?? null;

/* ---------- Block list ---------- */

export const addBlock = (song, block) =>
  song.blocks.length >= MAX_BLOCKS ? song : { ...song, blocks: [...song.blocks, block] };

export const removeBlock = (song, id) => ({
  ...song,
  blocks: song.blocks.filter((block) => block.id !== id),
});

export const moveBlock = (song, id, delta) => {
  const from = song.blocks.findIndex((block) => block.id === id);
  const to = from + delta;
  if (from < 0 || to < 0 || to >= song.blocks.length) return song;

  const blocks = [...song.blocks];
  [blocks[from], blocks[to]] = [blocks[to], blocks[from]];
  return { ...song, blocks };
};

export const updateBlock = (song, id, patch) => ({
  ...song,
  blocks: song.blocks.map((block) => (block.id === id ? { ...block, ...patch } : block)),
});

/* ---------- Chord shelf ---------- */

/** Appends to the last chord shelf, creating one when the song has none yet. */
export const addChordDiagram = (song, chord) => {
  const shelf = [...song.blocks].reverse().find((block) => block.type === 'chords');

  if (!shelf) return addBlock(song, createChordsBlock([chord]));
  if (shelf.chords.length >= MAX_CHORDS_PER_BLOCK) return song;
  return updateBlock(song, shelf.id, { chords: [...shelf.chords, chord] });
};

export const removeChordDiagram = (song, id, index) => {
  const block = blockAt(song, id);
  if (block?.type !== 'chords') return song;
  return updateBlock(song, id, { chords: block.chords.filter((_, at) => at !== index) });
};

/* ---------- Strumming ---------- */

export const setSubdivision = (song, id, subdivision) => {
  const block = blockAt(song, id);
  if (block?.type !== 'strum' || !SUBDIVISIONS.includes(subdivision)) return song;

  const strokes = Array.from({ length: subdivision }, (_, index) => block.strokes[index] ?? null);
  return updateBlock(song, id, { subdivision, strokes });
};

export const cycleStroke = (song, id, index, step = 1) => {
  const block = blockAt(song, id);
  if (block?.type !== 'strum' || index < 0 || index >= block.strokes.length) return song;

  const size = STROKES.length;
  const current = STROKES.indexOf(block.strokes[index] ?? null);
  const next = STROKES[(((current + step) % size) + size) % size];

  return updateBlock(song, id, {
    strokes: block.strokes.map((stroke, at) => (at === index ? next : stroke)),
  });
};

export const setBpm = (song, id, bpm) =>
  updateBlock(song, id, { bpm: clamp(Math.round(Number(bpm) || 0), 0, MAX_BPM) });

/* ---------- Consistency check ---------- */

/** Chord names whose diagram is on the sheet, keyed so `A#` and `Bb` are the same chord. */
const diagramKeys = (song) =>
  new Set(
    song.blocks
      .filter((block) => block.type === 'chords')
      .flatMap((block) => block.chords.map(resolveChordName))
      .filter((resolved) => !resolved.isPlaceholder)
      .map((resolved) => chordKey(resolved.name)),
  );

/**
 * Chords written in the lyrics that the sheet never shows how to play — the reader would
 * be left guessing. Returned in the order they first appear.
 */
export const missingChordDiagrams = (song) => {
  const drawn = diagramKeys(song);
  const used = song.blocks
    .filter((block) => block.type === 'lyrics')
    .flatMap((block) => chordNamesInLines(block.lines));

  const seen = new Set();
  return used.filter((name) => {
    const key = chordKey(name);
    if (drawn.has(key) || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
};

/** Diagrams on the shelf that no lyric line ever calls for. */
export const unusedChordDiagrams = (song) => {
  const used = new Set(
    song.blocks
      .filter((block) => block.type === 'lyrics')
      .flatMap((block) => chordNamesInLines(block.lines).map(chordKey)),
  );
  if (used.size === 0) return [];

  return song.blocks
    .filter((block) => block.type === 'chords')
    .flatMap((block) => block.chords.map(resolveChordName))
    .filter((resolved) => !resolved.isPlaceholder && !used.has(chordKey(resolved.name)))
    .map((resolved) => resolved.name);
};

/* ---------- Header ---------- */

export const setTitle = (song, title) => ({ ...song, title: String(title ?? '').trim() });
export const setArtist = (song, artist) => ({ ...song, artist: String(artist ?? '').trim() });

/* ---------- Persistence ---------- */

const parseStrum = (raw) => {
  const subdivision = SUBDIVISIONS.includes(Number(raw.subdivision)) ? Number(raw.subdivision) : 8;
  return {
    ...createStrumBlock(),
    id: typeof raw.id === 'string' ? raw.id : nextId(),
    label: String(raw.label ?? '').slice(0, 40),
    bpm: clamp(Math.round(Number(raw.bpm) || 0), 0, MAX_BPM),
    subdivision,
    strokes: Array.from({ length: subdivision }, (_, index) =>
      STROKES.includes(raw.strokes?.[index]) ? raw.strokes[index] : null,
    ),
  };
};

const parseBlock = (raw) => {
  if (!raw || !BLOCK_TYPES.includes(raw.type)) return null;
  const id = typeof raw.id === 'string' ? raw.id : nextId();

  switch (raw.type) {
    case 'chords':
      return {
        id,
        type: 'chords',
        chords: (Array.isArray(raw.chords) ? raw.chords : [])
          .slice(0, MAX_CHORDS_PER_BLOCK)
          .map(parseChord),
      };
    case 'strum':
      return parseStrum(raw);
    case 'tab':
      return { id, type: 'tab', tab: parseTab(raw.tab) };
    case 'lyrics': {
      // Version 1 stored one blob of ChordPro-ish text instead of structured lines.
      const lines = Array.isArray(raw.lines) ? raw.lines.map(normalizeLine) : parseLyrics(raw.text);
      return { id, type: 'lyrics', lines: lines.length > 0 ? lines : [emptyLine()] };
    }
    default:
      return null;
  }
};

/** Rebuilds a trusted song object from arbitrary parsed JSON. */
export const parseSong = (raw) => {
  if (!raw || typeof raw !== 'object') throw new Error('Fichier invalide.');

  const blocks = (Array.isArray(raw.blocks) ? raw.blocks : [])
    .slice(0, MAX_BLOCKS)
    .map(parseBlock)
    .filter(Boolean);

  return setArtist(
    setTitle({ ...createSong(), blocks }, typeof raw.title === 'string' ? raw.title : ''),
    typeof raw.artist === 'string' ? raw.artist : '',
  );
};
