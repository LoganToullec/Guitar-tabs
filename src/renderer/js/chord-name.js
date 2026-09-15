/** Shared naming rule for a chord diagram: manual name, else detection, else placeholder. */

import { isBlank, playedFrets } from './chord-model.js';
import { detectChordName, detectChordNames } from './chord-namer.js';

export const UNKNOWN_CHORD_LABEL = 'Accord non reconnu';

/** Every valid reading of the shape, best first — the same grip often has several names. */
export const chordNameOptions = (chord) => (isBlank(chord) ? [] : detectChordNames(playedFrets(chord)));

export const resolveChordName = (chord) => {
  const detected = isBlank(chord) ? null : detectChordName(playedFrets(chord));
  if (chord.nameOverride) return { name: chord.nameOverride, isPlaceholder: false, detected };
  if (detected) return { name: detected, isPlaceholder: false, detected };
  return { name: UNKNOWN_CHORD_LABEL, isPlaceholder: true, detected: null };
};

/** Short label for lists and summaries. */
export const shortChordName = (chord) => {
  const resolved = resolveChordName(chord);
  return resolved.isPlaceholder ? '?' : resolved.name;
};

const ROOT_PATTERN = /^([A-G])([#b♯♭]?)/;
const NATURAL_PITCH = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };
const SHARPS = ['#', '♯'];
const FLATS = ['b', '♭'];

const BASS_PATTERN = /\/([A-G])([#b♯♭]?)$/;

const pitchOf = (letter, accidental) => {
  const shift = SHARPS.includes(accidental) ? 1 : FLATS.includes(accidental) ? -1 : 0;
  return (NATURAL_PITCH[letter] + shift + 12) % 12;
};

/**
 * Comparison key for two written chord names: the root and the bass of a slash chord
 * both become pitch classes, so `A#` matches `Bb` and `D/F#` matches `D/Gb`, while the
 * suffix is kept as typed (`m7` and `maj7` stay distinct).
 */
export const chordKey = (name) => {
  const written = String(name ?? '').trim();
  const root = written.match(ROOT_PATTERN);
  if (!root) return written.toLowerCase();

  const [matched, letter, accidental] = root;
  const rest = written.slice(matched.length);
  const bass = rest.match(BASS_PATTERN);
  const suffix = bass ? `${rest.slice(0, bass.index)}/${pitchOf(bass[1], bass[2])}` : rest;

  return `${pitchOf(letter, accidental)}${suffix}`;
};
