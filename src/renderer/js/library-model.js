/**
 * Immutable model for the song library.
 *
 * Artists and folders are first-class entities: saving a song registers its artist once,
 * so the next song can be attributed to the very same one.
 */

import { parseSong } from './song-model.js';
import { parseChord } from './chord-model.js';

export const SORTS = ['artist', 'title', 'recent'];
export const MAX_NAME_LENGTH = 60;
export const UNTITLED = 'Sans titre';
export const MODEL_VERSION = 1;

/** Sorts entries without an artist after every named one. */
const LAST_KEY = '￿';

let sequence = 0;
const nextId = (prefix) => `${prefix}${Date.now().toString(36)}-${(sequence++).toString(36)}`;

const clean = (value) => String(value ?? '').trim().slice(0, MAX_NAME_LENGTH);
const sameName = (a, b) => a.toLocaleLowerCase('fr') === b.toLocaleLowerCase('fr');

export const MAX_CHORD_SHAPES = 200;

export const createLibrary = () => ({
  version: MODEL_VERSION,
  artists: [],
  folders: [],
  entries: [],
  chordShapes: [],
});

export const artistName = (library, artistId) =>
  library.artists.find((artist) => artist.id === artistId)?.name ?? '';

export const folderName = (library, folderId) =>
  library.folders.find((folder) => folder.id === folderId)?.name ?? '';

export const entryAt = (library, id) => library.entries.find((entry) => entry.id === id) ?? null;

/* ---------- Artists ---------- */

export const findArtist = (library, name) => {
  const wanted = clean(name);
  return wanted === '' ? null : library.artists.find((artist) => sameName(artist.name, wanted)) ?? null;
};

/** @returns {{library: object, artistId: string|null}} */
export const upsertArtist = (library, name) => {
  const wanted = clean(name);
  if (wanted === '') return { library, artistId: null };

  const existing = findArtist(library, wanted);
  if (existing) return { library, artistId: existing.id };

  const artist = { id: nextId('a'), name: wanted };
  return { library: { ...library, artists: [...library.artists, artist] }, artistId: artist.id };
};

export const renameArtist = (library, id, name) => {
  const wanted = clean(name);
  if (wanted === '') return library;
  return { ...library, artists: library.artists.map((artist) => (artist.id === id ? { ...artist, name: wanted } : artist)) };
};

/** Removing an artist keeps their songs; the songs simply lose the attribution. */
export const removeArtist = (library, id) => ({
  ...library,
  artists: library.artists.filter((artist) => artist.id !== id),
  entries: library.entries.map((entry) => (entry.artistId === id ? { ...entry, artistId: null } : entry)),
});

/** Artists with no song left, so the picker does not fill up with typos. */
export const pruneArtists = (library) => ({
  ...library,
  artists: library.artists.filter((artist) => library.entries.some((entry) => entry.artistId === artist.id)),
});

/* ---------- Folders ---------- */

export const addFolder = (library, name) => {
  const wanted = clean(name);
  if (wanted === '') return { library, folderId: null };

  const existing = library.folders.find((folder) => sameName(folder.name, wanted));
  if (existing) return { library, folderId: existing.id };

  const folder = { id: nextId('f'), name: wanted };
  return { library: { ...library, folders: [...library.folders, folder] }, folderId: folder.id };
};

export const renameFolder = (library, id, name) => {
  const wanted = clean(name);
  if (wanted === '') return library;
  return { ...library, folders: library.folders.map((folder) => (folder.id === id ? { ...folder, name: wanted } : folder)) };
};

/** Deleting a folder never deletes songs: they move back to the unfiled list. */
export const removeFolder = (library, id) => ({
  ...library,
  folders: library.folders.filter((folder) => folder.id !== id),
  entries: library.entries.map((entry) => (entry.folderId === id ? { ...entry, folderId: null } : entry)),
});

/* ---------- Entries ---------- */

/** Creates or updates the entry holding `song`. @returns {{library, entryId}} */
export const saveSong = (library, song, entryId = null, now = Date.now()) => {
  const { library: withArtist, artistId } = upsertArtist(library, song.artist);
  const title = clean(song.title) || UNTITLED;
  const existing = entryId ? entryAt(withArtist, entryId) : null;

  if (existing) {
    // Re-attributing the song can leave its previous artist without any song at all.
    return {
      library: pruneArtists({
        ...withArtist,
        entries: withArtist.entries.map((entry) =>
          entry.id === entryId ? { ...entry, title, artistId, song, updatedAt: now } : entry,
        ),
      }),
      entryId,
    };
  }

  const entry = { id: nextId('s'), title, artistId, folderId: null, updatedAt: now, song };
  return { library: { ...withArtist, entries: [...withArtist.entries, entry] }, entryId: entry.id };
};

export const removeEntry = (library, id) =>
  pruneArtists({ ...library, entries: library.entries.filter((entry) => entry.id !== id) });

const patchEntry = (library, id, patch) => ({
  ...library,
  entries: library.entries.map((entry) => (entry.id === id ? { ...entry, ...patch } : entry)),
});

export const setEntryTitle = (library, id, title) => {
  const entry = entryAt(library, id);
  if (!entry) return library;

  const wanted = clean(title) || UNTITLED;
  return patchEntry(library, id, { title: wanted, song: { ...entry.song, title: wanted } });
};

export const setEntryArtist = (library, id, name) => {
  const entry = entryAt(library, id);
  if (!entry) return library;

  const { library: withArtist, artistId } = upsertArtist(library, name);
  return pruneArtists(
    patchEntry(withArtist, id, { artistId, song: { ...entry.song, artist: clean(name) } }),
  );
};

export const setEntryFolder = (library, id, folderId) =>
  patchEntry(library, id, { folderId: library.folders.some((folder) => folder.id === folderId) ? folderId : null });

/* ---------- Chord shapes ---------- */

/** Saves a grip under a name; the same name replaces the previous shape. */
export const saveChordShape = (library, name, chord) => {
  const wanted = clean(name);
  if (wanted === '' || library.chordShapes.length >= MAX_CHORD_SHAPES) return { library, shapeId: null };

  const existing = library.chordShapes.find((shape) => sameName(shape.name, wanted));
  if (existing) {
    return {
      library: {
        ...library,
        chordShapes: library.chordShapes.map((shape) =>
          shape.id === existing.id ? { ...shape, chord } : shape,
        ),
      },
      shapeId: existing.id,
    };
  }

  const shape = { id: nextId('c'), name: wanted, chord };
  return { library: { ...library, chordShapes: [...library.chordShapes, shape] }, shapeId: shape.id };
};

export const removeChordShape = (library, id) => ({
  ...library,
  chordShapes: library.chordShapes.filter((shape) => shape.id !== id),
});

/* ---------- Views ---------- */

export const folderCount = (library, folderId) =>
  library.entries.filter((entry) => (folderId === null ? true : entry.folderId === folderId)).length;

/**
 * @param {{folderId?: string|null, query?: string, sort?: string}} options
 *   `folderId` null means "every song", `'none'` means "outside any folder".
 */
export const listEntries = (library, { folderId = null, query = '', sort = 'artist' } = {}) => {
  const needle = clean(query).toLocaleLowerCase('fr');

  const matches = library.entries.filter((entry) => {
    if (folderId === 'none' && entry.folderId !== null) return false;
    if (folderId !== null && folderId !== 'none' && entry.folderId !== folderId) return false;
    if (needle === '') return true;
    return `${entry.title} ${artistName(library, entry.artistId)}`.toLocaleLowerCase('fr').includes(needle);
  });

  const byTitle = (a, b) => a.title.localeCompare(b.title, 'fr', { sensitivity: 'base' });
  const byArtist = (a, b) =>
    (artistName(library, a.artistId) || LAST_KEY).localeCompare(
      artistName(library, b.artistId) || LAST_KEY,
      'fr',
      { sensitivity: 'base' },
    );

  const comparators = {
    title: byTitle,
    recent: (a, b) => b.updatedAt - a.updatedAt || byTitle(a, b),
    artist: (a, b) => byArtist(a, b) || byTitle(a, b),
  };

  return [...matches].sort(comparators[sort] ?? comparators.artist);
};

/* ---------- Persistence ---------- */

const parseNamed = (raw, prefix) =>
  (Array.isArray(raw) ? raw : [])
    .map((item) => ({ id: typeof item?.id === 'string' ? item.id : nextId(prefix), name: clean(item?.name) }))
    .filter((item) => item.name !== '');

/** Rebuilds a trusted library from arbitrary parsed JSON; unreadable songs are dropped. */
export const parseLibrary = (raw) => {
  if (!raw || typeof raw !== 'object') return createLibrary();

  const artists = parseNamed(raw.artists, 'a');
  const folders = parseNamed(raw.folders, 'f');
  const hasId = (list, id) => list.some((item) => item.id === id);

  const entries = (Array.isArray(raw.entries) ? raw.entries : []).flatMap((item) => {
    try {
      return [
        {
          id: typeof item?.id === 'string' ? item.id : nextId('s'),
          title: clean(item?.title) || UNTITLED,
          artistId: hasId(artists, item?.artistId) ? item.artistId : null,
          folderId: hasId(folders, item?.folderId) ? item.folderId : null,
          updatedAt: Number.isFinite(Number(item?.updatedAt)) ? Number(item.updatedAt) : 0,
          song: parseSong(item?.song),
        },
      ];
    } catch {
      return [];
    }
  });

  const chordShapes = (Array.isArray(raw.chordShapes) ? raw.chordShapes : [])
    .slice(0, MAX_CHORD_SHAPES)
    .flatMap((shape) => {
      const name = clean(shape?.name);
      if (name === '') return [];
      try {
        return [{ id: typeof shape?.id === 'string' ? shape.id : nextId('c'), name, chord: parseChord(shape?.chord) }];
      } catch {
        return [];
      }
    });

  return { version: MODEL_VERSION, artists, folders, entries, chordShapes };
};
