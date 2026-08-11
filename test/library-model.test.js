import test from 'node:test';
import assert from 'node:assert/strict';

import { createSong, setArtist, setTitle } from '../src/renderer/js/song-model.js';
import {
  addFolder,
  artistName,
  createLibrary,
  entryAt,
  findArtist,
  folderCount,
  listEntries,
  parseLibrary,
  removeArtist,
  removeEntry,
  removeFolder,
  renameArtist,
  saveSong,
  setEntryArtist,
  setEntryFolder,
  setEntryTitle,
  upsertArtist,
} from '../src/renderer/js/library-model.js';

const song = (title, artist = '') => setArtist(setTitle(createSong(), title), artist);

const withSongs = (...songs) =>
  songs.reduce((library, next) => saveSong(library, next).library, createLibrary());

test('une bibliothèque neuve est vide', () => {
  const library = createLibrary();
  assert.deepEqual(library.entries, []);
  assert.deepEqual(library.artists, []);
});

/* ---------- Artistes ---------- */

test('enregistrer une chanson enregistre son artiste', () => {
  const { library, entryId } = saveSong(createLibrary(), song('Creep', 'Radiohead'));

  assert.equal(library.artists.length, 1);
  assert.equal(library.artists[0].name, 'Radiohead');
  assert.equal(artistName(library, entryAt(library, entryId).artistId), 'Radiohead');
});

test('un artiste déjà connu est réutilisé, casse comprise', () => {
  const library = withSongs(song('Creep', 'Radiohead'), song('No Surprises', 'radiohead'));

  assert.equal(library.artists.length, 1);
  assert.equal(library.entries.length, 2);
  assert.equal(library.entries[0].artistId, library.entries[1].artistId);
});

test('upsertArtist ne crée rien pour un nom vide', () => {
  const { library, artistId } = upsertArtist(createLibrary(), '   ');
  assert.equal(artistId, null);
  assert.equal(library.artists.length, 0);
});

test('attribuer un artiste existant à une autre chanson ne le duplique pas', () => {
  const base = withSongs(song('Creep', 'Radiohead'), song('Sans titre'));
  const orphan = base.entries[1].id;
  const library = setEntryArtist(base, orphan, 'Radiohead');

  assert.equal(library.artists.length, 1);
  assert.equal(artistName(library, entryAt(library, orphan).artistId), 'Radiohead');
});

test('renommer un artiste se répercute sur ses chansons', () => {
  const base = withSongs(song('Creep', 'Radiohead'));
  const library = renameArtist(base, base.artists[0].id, 'Radiohead (UK)');

  assert.equal(artistName(library, library.entries[0].artistId), 'Radiohead (UK)');
});

test('supprimer un artiste garde ses chansons', () => {
  const base = withSongs(song('Creep', 'Radiohead'));
  const library = removeArtist(base, base.artists[0].id);

  assert.equal(library.entries.length, 1);
  assert.equal(library.entries[0].artistId, null);
});

test('un artiste sans chanson est oublié', () => {
  const base = withSongs(song('Creep', 'Radiohead'));
  const library = removeEntry(base, base.entries[0].id);

  assert.equal(library.artists.length, 0);
});

/* ---------- Dossiers ---------- */

test('un dossier du même nom n est pas recréé', () => {
  const first = addFolder(createLibrary(), 'Concerts');
  const second = addFolder(first.library, 'concerts');

  assert.equal(second.library.folders.length, 1);
  assert.equal(second.folderId, first.folderId);
});

test('classer une chanson dans un dossier puis supprimer le dossier la garde', () => {
  const base = withSongs(song('Creep', 'Radiohead'));
  const { library: withFolder, folderId } = addFolder(base, 'Concerts');
  const filed = setEntryFolder(withFolder, base.entries[0].id, folderId);

  assert.equal(folderCount(filed, folderId), 1);

  const library = removeFolder(filed, folderId);
  assert.equal(library.entries.length, 1);
  assert.equal(library.entries[0].folderId, null);
});

test('un dossier inconnu est ignoré', () => {
  const base = withSongs(song('Creep'));
  const library = setEntryFolder(base, base.entries[0].id, 'nawak');

  assert.equal(library.entries[0].folderId, null);
});

/* ---------- Enregistrement ---------- */

test('réenregistrer la même entrée la met à jour au lieu d en créer une', () => {
  const first = saveSong(createLibrary(), song('Creep', 'Radiohead'), null, 1000);
  const second = saveSong(first.library, song('Creep (live)', 'Radiohead'), first.entryId, 2000);

  assert.equal(second.entryId, first.entryId);
  assert.equal(second.library.entries.length, 1);
  assert.equal(second.library.entries[0].title, 'Creep (live)');
  assert.equal(second.library.entries[0].updatedAt, 2000);
});

test('une chanson sans titre reçoit un libellé par défaut', () => {
  const { library } = saveSong(createLibrary(), createSong());
  assert.equal(library.entries[0].title, 'Sans titre');
});

test('renommer une entrée renomme aussi le document', () => {
  const base = withSongs(song('Creep', 'Radiohead'));
  const library = setEntryTitle(base, base.entries[0].id, 'Creep (acoustique)');

  assert.equal(library.entries[0].title, 'Creep (acoustique)');
  assert.equal(library.entries[0].song.title, 'Creep (acoustique)');
});

/* ---------- Tris et filtres ---------- */

test('le tri par artiste range les chansons sans artiste en dernier', () => {
  const library = withSongs(song('Zebra', 'ZZ Top'), song('Orphan'), song('Alpha', 'ABBA'));

  assert.deepEqual(
    listEntries(library, { sort: 'artist' }).map((entry) => entry.title),
    ['Alpha', 'Zebra', 'Orphan'],
  );
});

test('le tri par titre ignore la casse et les accents', () => {
  const library = withSongs(song('éclair'), song('Bravo'), song('alpha'));

  assert.deepEqual(
    listEntries(library, { sort: 'title' }).map((entry) => entry.title),
    ['alpha', 'Bravo', 'éclair'],
  );
});

test('le tri récent remonte la dernière modification', () => {
  const first = saveSong(createLibrary(), song('Vieille'), null, 1000);
  const { library } = saveSong(first.library, song('Neuve'), null, 5000);

  assert.deepEqual(
    listEntries(library, { sort: 'recent' }).map((entry) => entry.title),
    ['Neuve', 'Vieille'],
  );
});

test('la recherche porte sur le titre et sur l artiste', () => {
  const library = withSongs(song('Creep', 'Radiohead'), song('Wonderwall', 'Oasis'));

  assert.deepEqual(listEntries(library, { query: 'radio' }).map((entry) => entry.title), ['Creep']);
  assert.deepEqual(listEntries(library, { query: 'WONDER' }).map((entry) => entry.title), ['Wonderwall']);
  assert.equal(listEntries(library, { query: 'zzz' }).length, 0);
});

test('le filtre dossier sépare classées et non classées', () => {
  const base = withSongs(song('Creep'), song('Wonderwall'));
  const { library: withFolder, folderId } = addFolder(base, 'Concerts');
  const library = setEntryFolder(withFolder, base.entries[0].id, folderId);

  assert.deepEqual(listEntries(library, { folderId }).map((entry) => entry.title), ['Creep']);
  assert.deepEqual(listEntries(library, { folderId: 'none' }).map((entry) => entry.title), ['Wonderwall']);
  assert.equal(listEntries(library, {}).length, 2);
});

/* ---------- Persistance ---------- */

test('parseLibrary rétablit une bibliothèque enregistrée', () => {
  const base = withSongs(song('Creep', 'Radiohead'), song('Wonderwall', 'Oasis'));
  const { library: withFolder, folderId } = addFolder(base, 'Concerts');
  const library = setEntryFolder(withFolder, base.entries[0].id, folderId);

  assert.deepEqual(parseLibrary(JSON.parse(JSON.stringify(library))), library);
});

test('parseLibrary écarte les entrées illisibles et les références orphelines', () => {
  const library = parseLibrary({
    artists: [{ id: 'a1', name: 'Radiohead' }, { name: '   ' }],
    folders: [{ id: 'f1', name: 'Concerts' }],
    entries: [
      { id: 's1', title: 'Creep', artistId: 'a1', folderId: 'f1', updatedAt: 5, song: { kind: 'song', blocks: [] } },
      { id: 's2', title: 'Bancale', artistId: 'inconnu', folderId: 'inconnu', song: { kind: 'song', blocks: [] } },
      { id: 's3', title: 'Cassée', song: null },
    ],
  });

  assert.equal(library.artists.length, 1);
  assert.equal(library.entries.length, 2);
  assert.equal(library.entries[1].artistId, null);
  assert.equal(library.entries[1].folderId, null);
});

test('parseLibrary accepte n importe quoi sans lever', () => {
  assert.deepEqual(parseLibrary(null).entries, []);
  assert.deepEqual(parseLibrary('bruit').entries, []);
});

test('findArtist retrouve un artiste sans tenir compte de la casse', () => {
  const library = withSongs(song('Creep', 'Radiohead'));

  assert.equal(findArtist(library, 'RADIOHEAD').name, 'Radiohead');
  assert.equal(findArtist(library, 'Muse'), null);
});
