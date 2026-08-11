/** Song library: folders on the left, songs in the middle, the selected song on the right. */

import {
  addFolder,
  artistName,
  createLibrary,
  entryAt,
  folderCount,
  folderName,
  listEntries,
  parseLibrary,
  removeChordShape,
  removeEntry,
  removeFolder,
  saveChordShape,
  saveSong,
  setEntryArtist,
  setEntryFolder,
  setEntryTitle,
} from './library-model.js';
import { ICONS } from './icons.js';
import { isEditingInside } from './dom.js';

const SAVE_DEBOUNCE_MS = 400;
const ALL_FOLDERS = null;
const UNFILED = 'none';

const dateLabel = (value) =>
  value > 0 ? new Date(value).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: '2-digit' }) : '—';

const escapeHtml = (value) =>
  String(value ?? '').replace(/[&<>"']/g, (character) => `&#${character.charCodeAt(0)};`);

export const createLibraryView = ({ toast, onOpenSong, onChange }) => {
  const element = (id) => document.getElementById(id);

  const ui = {
    sheet: element('library-view'),
    dock: element('dock-library'),
    folders: element('folder-list'),
    newFolder: element('new-folder-form'),
    newFolderName: element('new-folder-name'),
    search: element('library-search'),
    sort: element('library-sort'),
    list: element('song-list'),
    detail: element('library-detail'),
    artistOptions: element('artist-options'),
  };

  let library = createLibrary();
  let folderId = ALL_FOLDERS;
  let selectedId = null;
  /** Entry the Chanson editor is currently working on, so saving updates it in place. */
  let linkedId = null;
  let saveTimer = null;

  const persist = () => {
    clearTimeout(saveTimer);
    saveTimer = setTimeout(async () => {
      const result = await window.desktop.saveLibrary(JSON.stringify(library, null, 2));
      if (!result.ok) toast(`Bibliothèque non enregistrée : ${result.error}`, true);
    }, SAVE_DEBOUNCE_MS);
  };

  const commit = (next) => {
    library = next;
    persist();
    render();
  };

  /* ---------- Rendering ---------- */

  const renderFolders = () => {
    const rows = [
      { id: ALL_FOLDERS, name: 'Toutes les chansons', count: library.entries.length, fixed: true },
      { id: UNFILED, name: 'Hors dossier', count: library.entries.filter((entry) => !entry.folderId).length, fixed: true },
      ...library.folders.map((folder) => ({
        id: folder.id,
        name: folder.name,
        count: folderCount(library, folder.id),
        fixed: false,
      })),
    ];

    ui.folders.innerHTML = rows
      .map(
        (row) =>
          `<div class="folder-row${row.id === folderId ? ' is-selected' : ''}" data-folder="${row.id ?? ''}">` +
          `<i>${row.fixed ? ICONS.library : ICONS.open}</i>` +
          `<span class="folder-name">${escapeHtml(row.name)}</span>` +
          `<span class="count">${row.count}</span>` +
          (row.fixed ? '' : `<button type="button" class="row-btn danger" data-drop-folder="${row.id}" data-tip="Supprimer">${ICONS.clear}</button>`) +
          '</div>',
      )
      .join('');
  };

  const renderList = () => {
    const sort = ui.sort.value;
    const entries = listEntries(library, { folderId, query: ui.search.value, sort });

    if (entries.length === 0) {
      ui.list.innerHTML =
        '<p class="empty">Aucune chanson ici. Depuis le mode Chanson, utilisez « Enregistrer dans la bibliothèque ».</p>';
      return;
    }

    let lastGroup = null;
    ui.list.innerHTML = entries
      .map((entry) => {
        const artist = artistName(library, entry.artistId);
        let header = '';

        if (sort === 'artist' && artist !== lastGroup) {
          lastGroup = artist;
          header = `<div class="group-head">${escapeHtml(artist || 'Sans artiste')}</div>`;
        }

        return (
          header +
          `<div class="song-row${entry.id === selectedId ? ' is-selected' : ''}${entry.id === linkedId ? ' is-open' : ''}" data-entry="${entry.id}">` +
          `<i>${ICONS.song}</i>` +
          `<span class="song-text"><b>${escapeHtml(entry.title)}</b><em>${escapeHtml(artist || 'sans artiste')}${entry.folderId ? ` · ${escapeHtml(folderName(library, entry.folderId))}` : ''}</em></span>` +
          `<span class="song-date">${dateLabel(entry.updatedAt)}</span>` +
          `<button type="button" class="row-btn" data-open="${entry.id}" data-tip="Ouvrir">${ICONS.open}</button>` +
          '</div>'
        );
      })
      .join('');
  };

  const renderDetail = () => {
    const entry = selectedId ? entryAt(library, selectedId) : null;

    if (!entry) {
      ui.detail.innerHTML = '<p class="empty">Sélectionnez une chanson pour en modifier la fiche.</p>';
      return;
    }

    ui.detail.innerHTML =
      '<label class="field"><span>Titre</span><input type="text" id="detail-title" spellcheck="false" /></label>' +
      '<label class="field"><span>Artiste</span><input type="text" id="detail-artist" list="artist-options" placeholder="Nouveau ou existant" spellcheck="false" /></label>' +
      '<label class="field"><span>Dossier</span><select id="detail-folder">' +
      '<option value="">Hors dossier</option>' +
      library.folders
        .map((folder) => `<option value="${folder.id}">${escapeHtml(folder.name)}</option>`)
        .join('') +
      '</select></label>' +
      '<div class="detail-actions">' +
      `<button type="button" id="detail-open" class="wide-btn">${ICONS.open}<span>Ouvrir</span></button>` +
      `<button type="button" id="detail-delete" class="wide-btn danger">${ICONS.clear}<span>Supprimer</span></button>` +
      '</div>';

    const title = element('detail-title');
    title.value = entry.title;
    title.addEventListener('change', () => commit(setEntryTitle(library, entry.id, title.value)));

    const artist = element('detail-artist');
    artist.value = artistName(library, entry.artistId);
    artist.addEventListener('change', () => commit(setEntryArtist(library, entry.id, artist.value)));

    const folder = element('detail-folder');
    folder.value = entry.folderId ?? '';
    folder.addEventListener('change', () => commit(setEntryFolder(library, entry.id, folder.value || null)));

    element('detail-open').addEventListener('click', () => open(entry.id));
    element('detail-delete').addEventListener('click', () => {
      if (linkedId === entry.id) linkedId = null;
      selectedId = null;
      commit(removeEntry(library, entry.id));
      toast('Chanson supprimée de la bibliothèque.');
    });
  };

  const render = () => {
    ui.artistOptions.innerHTML = library.artists
      .map((entry) => `<option value="${escapeHtml(entry.name)}"></option>`)
      .join('');

    renderFolders();
    renderList();
    if (!isEditingInside(ui.detail)) renderDetail();
    onChange();
  };

  /* ---------- Actions ---------- */

  const open = (id) => {
    const entry = entryAt(library, id);
    if (!entry) return;

    linkedId = id;
    selectedId = id;
    onOpenSong(entry.song);
    toast(`« ${entry.title} » ouverte dans le mode Chanson.`);
    render();
  };

  const store = (song) => {
    const result = saveSong(library, song, linkedId);
    linkedId = result.entryId;
    selectedId = result.entryId;
    commit(result.library);
    toast(`« ${entryAt(result.library, result.entryId).title} » enregistrée dans la bibliothèque.`);
  };

  /* ---------- Wiring ---------- */

  ui.folders.addEventListener('click', (event) => {
    const drop = event.target.closest('[data-drop-folder]');
    if (drop) {
      if (folderId === drop.dataset.dropFolder) folderId = ALL_FOLDERS;
      commit(removeFolder(library, drop.dataset.dropFolder));
      return;
    }

    const row = event.target.closest('[data-folder]');
    if (!row) return;
    folderId = row.dataset.folder === '' ? ALL_FOLDERS : row.dataset.folder;
    render();
  });

  ui.newFolder.addEventListener('submit', (event) => {
    event.preventDefault();
    const { library: next, folderId: created } = addFolder(library, ui.newFolderName.value);
    if (!created) return;

    ui.newFolderName.value = '';
    folderId = created;
    commit(next);
  });

  ui.list.addEventListener('click', (event) => {
    const openButton = event.target.closest('[data-open]');
    if (openButton) return open(openButton.dataset.open);

    const row = event.target.closest('[data-entry]');
    if (!row) return;
    selectedId = row.dataset.entry;
    return render();
  });

  ui.list.addEventListener('dblclick', (event) => {
    const row = event.target.closest('[data-entry]');
    if (row) open(row.dataset.entry);
  });

  ui.search.addEventListener('input', render);
  ui.sort.addEventListener('change', render);

  window.desktop.loadLibrary().then((result) => {
    if (!result.ok) {
      toast(`Bibliothèque illisible : ${result.error}`, true);
      return;
    }
    if (result.json) library = parseLibrary(JSON.parse(result.json));
    render();
  });

  render();

  return {
    kind: 'library',
    sheet: ui.sheet,
    dock: ui.dock,
    supportsSheet: false,
    render,
    activate: render,
    deactivate: () => {},
    canUndo: () => false,
    canRedo: () => false,
    undo: () => {},
    redo: () => {},
    clear: () => {},
    serialize: () => null,
    load: () => {},
    exportable: () => null,
    /** Called from the Chanson mode: create or update this song's entry. */
    store,
    chordShapes: () => library.chordShapes,
    storeChord: (name, chord) => {
      const { library: next, shapeId } = saveChordShape(library, name, chord);
      if (!shapeId) {
        toast('Nommez l’accord avant de l’enregistrer.', true);
        return;
      }
      commit(next);
      toast(`« ${name} » enregistré dans la bibliothèque d’accords.`);
    },
    dropChord: (id) => commit(removeChordShape(library, id)),
    /** A song opened from elsewhere is no longer tied to a library entry. */
    detach: () => {
      linkedId = null;
    },
  };
};
