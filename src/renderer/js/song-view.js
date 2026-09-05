/** Song sheet editor: assembles chord diagrams, strumming, tablature and lyrics. */

import {
  addBlock,
  addChordDiagram,
  blockAt,
  createLyricsBlock,
  createSong,
  createStrumBlock,
  createTabBlock,
  cycleStroke,
  isBlank,
  missingChordDiagrams,
  moveBlock,
  parseSong,
  removeBlock,
  removeChordDiagram,
  setArtist,
  setBpm,
  setLyricsLines,
  setSubdivision,
  setTitle,
  unusedChordDiagrams,
  updateBlock,
} from './song-model.js';
import { isEditingInside } from './dom.js';
import { blockPositions, renderSongSvg, SONG_LAYOUT, songSize } from './song-renderer.js';
import { renderChordSvg } from './diagram-renderer.js';
import { resolveChordName, shortChordName } from './chord-name.js';
import { chordNamesInLines, parseLyrics } from './lyrics.js';
import { createLyricsEditor } from './lyrics-editor.js';
import { canRedo, canUndo, commit, createHistory, redo, replace, undo } from './history.js';
import { fitTitleSize, positionTitle, scaleSheet } from './sheet-title.js';
import { ICONS } from './icons.js';

const UNTITLED_LABEL = 'Chanson sans titre';

const BLOCK_META = {
  chords: { icon: 'chord', label: 'Accords' },
  strum: { icon: 'strum', label: 'Rythmique' },
  tab: { icon: 'tab', label: 'Tablature' },
  lyrics: { icon: 'lyrics', label: 'Paroles' },
};

const summarize = (block) => {
  switch (block.type) {
    case 'chords':
      return block.chords.map(shortChordName).join(' · ') || 'vide';
    case 'strum': {
      const strokes = block.strokes.filter(Boolean).length;
      return `${block.label || 'sans nom'} — ${strokes}/${block.subdivision}`;
    }
    case 'tab':
      return `${block.tab.measures.length} mesure${block.tab.measures.length > 1 ? 's' : ''}`;
    case 'lyrics': {
      const lines = block.lines.filter((line) => line.text.trim() !== '').length;
      const chords = chordNamesInLines(block.lines).length;
      return `${lines} ligne${lines > 1 ? 's' : ''}${chords > 0 ? ` · ${chords} accords` : ''}`;
    }
    default:
      return '';
  }
};

export const createSongView = ({ toast, onChange }) => {
  const element = (id) => document.getElementById(id);

  const ui = {
    sheet: element('sheet-song'),
    dock: element('dock-song'),
    panel: element('panel-song'),
    panelToggle: element('btn-panel-toggle'),
    canvas: element('sheet-song').querySelector('.canvas'),
    diagram: element('diagram-song'),
    title: element('song-title'),
    artist: element('song-artist'),
    list: element('song-blocks'),
    editor: element('song-editor'),
    check: element('song-check'),
    drawer: element('chord-drawer'),
    drawerChords: element('drawer-chords'),
    drawerToggle: element('btn-drawer-toggle'),
    zoom: element('zoom-song'),
  };

  let history = createHistory(createSong());
  let editBaseline = null;
  let selectedId = null;
  let zoom = Number(ui.zoom.value) / 100;
  let results = [];
  let lastQuery = '';
  let lyricsEditor = null;

  const song = () => history.present;

  /** What the chord picker offers: the song's own diagrams, then chords already placed. */
  const chordChoices = () => {
    const value = song();
    const shelf = value.blocks
      .filter((block) => block.type === 'chords')
      .flatMap((block) => block.chords.map(shortChordName))
      .filter((name) => name !== '?');
    const placed = value.blocks
      .filter((block) => block.type === 'lyrics')
      .flatMap((block) => chordNamesInLines(block.lines));

    return [...new Set([...shelf, ...placed])];
  };

  const escapeHtml = (value) =>
    String(value ?? '').replace(/[&<>"']/g, (character) => `&#${character.charCodeAt(0)};`);
  const selected = () => (selectedId ? blockAt(song(), selectedId) : null);

  const resolveName = (value) =>
    value.title ? { name: value.title, isPlaceholder: false } : { name: UNTITLED_LABEL, isPlaceholder: true };

  /* ---------- Panel ---------- */

  const iconMarkup = (name) => ICONS[name] ?? '';

  const renderList = () => {
    const value = song();

    if (value.blocks.length === 0) {
      ui.list.innerHTML =
        '<p class="empty">Ajoutez une section : accords, rythmique, tablature ou paroles.</p>';
      return;
    }

    ui.list.innerHTML = value.blocks
      .map((block, index) => {
        const meta = BLOCK_META[block.type];
        return (
          `<div class="block-row${block.id === selectedId ? ' is-selected' : ''}" data-block="${block.id}">` +
          `<i class="block-icon">${iconMarkup(meta.icon)}</i>` +
          `<span class="block-text"><b>${meta.label}</b><em>${summarize(block)}</em></span>` +
          `<button type="button" class="row-btn" data-move="-1" data-tip="Monter" ${index === 0 ? 'disabled' : ''}>${iconMarkup('up')}</button>` +
          `<button type="button" class="row-btn" data-move="1" data-tip="Descendre" ${index === value.blocks.length - 1 ? 'disabled' : ''}>${iconMarkup('down')}</button>` +
          `<button type="button" class="row-btn danger" data-remove="1" data-tip="Supprimer">${iconMarkup('clear')}</button>` +
          '</div>'
        );
      })
      .join('');
  };

  /** The chord shelf stays pinned in its drawer so it never scrolls out of sight. */
  const renderDrawer = () => {
    const items = song()
      .blocks.filter((block) => block.type === 'chords')
      .flatMap((block) => block.chords.map((chord, index) => ({ block, chord, index })));

    if (items.length === 0) {
      ui.drawerChords.innerHTML =
        '<p class="empty">Aucun accord. Depuis le mode Accord : « Ajouter à la chanson ».</p>';
      return;
    }

    ui.drawerChords.innerHTML = items
      .map(
        ({ block, chord, index }) =>
          `<figure class="drawer-chord" data-block="${block.id}" data-index="${index}">` +
          renderChordSvg(chord, { ...resolveChordName(chord), interactive: false, trimEmptyFingers: true }) +
          `<button type="button" class="drawer-remove" data-tip="Retirer" aria-label="Retirer l'accord">${iconMarkup('close')}</button>` +
          '</figure>',
      )
      .join('');
  };

  /** Warns when the lyrics call for a chord the sheet never shows how to play. */
  const renderCheck = () => {
    const value = song();
    const missing = missingChordDiagrams(value);
    const unused = unusedChordDiagrams(value);

    if (missing.length > 0) {
      ui.check.hidden = false;
      ui.check.className = 'check warn';
      ui.check.innerHTML =
        `<i>${iconMarkup('warning')}</i><div><b>${missing.length} accord${missing.length > 1 ? 's' : ''} sans diagramme</b>` +
        `<span>${missing.map((name) => `<code>${name}</code>`).join(' ')}</span>` +
        '<em>Créez-les en mode Accord puis « Ajouter à la chanson ».</em></div>';
      return;
    }

    if (unused.length > 0) {
      ui.check.hidden = false;
      ui.check.className = 'check info';
      ui.check.innerHTML =
        `<i>${iconMarkup('help')}</i><div><b>${unused.length} diagramme${unused.length > 1 ? 's' : ''} jamais utilisé${unused.length > 1 ? 's' : ''}</b>` +
        `<span>${unused.map((name) => `<code>${name}</code>`).join(' ')}</span></div>`;
      return;
    }

    const hasChecks = value.blocks.some((block) => block.type === 'lyrics');
    ui.check.hidden = !hasChecks;
    ui.check.className = 'check ok';
    ui.check.innerHTML = `<i>${iconMarkup('check')}</i><div><b>Tous les accords des paroles ont leur diagramme.</b></div>`;
  };

  const renderEditor = () => {
    const block = selected();

    if (!block) {
      ui.editor.innerHTML = '<p class="empty">Sélectionnez une section pour la modifier.</p>';
      return;
    }

    if (block.type === 'lyrics') {
      ui.editor.innerHTML =
        '<p class="empty">Les paroles s\'écrivent directement sur la partition. Entrée passe à la ligne, Maj+Tab bascule une ligne en titre de section, et un clic au-dessus d\'un mot y pose un accord. Un texte collé à plusieurs lignes se pose ligne par ligne, lignes vides comprises.</p>' +
        '<form class="import-row" id="lyrics-search-form">' +
        '<input type="search" id="lyrics-query" placeholder="Artiste, titre…" spellcheck="false" aria-label="Rechercher des paroles" />' +
        `<button type="submit" class="icon-btn" data-tip="Chercher les paroles (LRCLIB)" aria-label="Chercher les paroles">${iconMarkup('download')}</button>` +
        '</form>' +
        '<div class="result-list" id="lyrics-results"></div>';

      element('lyrics-query').value = lastQuery;
      element('lyrics-search-form').addEventListener('submit', (event) => {
        event.preventDefault();
        searchLyrics(block.id);
      });
      renderResults(block.id);
      return;
    }

    if (block.type === 'strum') {
      ui.editor.innerHTML =
        '<label class="field"><span>Nom de la section</span><input type="text" id="strum-label" spellcheck="false" /></label>' +
        '<div class="inline-fields">' +
        '<label class="field"><span>Tempo (bpm)</span><input type="number" id="strum-bpm" min="0" max="320" /></label>' +
        '<label class="field"><span>Croches / doubles</span><select id="strum-subdivision"><option value="8">8 (croches)</option><option value="16">16 (doubles)</option></select></label>' +
        '</div>' +
        '<p class="empty">Cliquez les flèches sur la partition : ↓ puis ↑ puis ✕.</p>';

      const label = element('strum-label');
      label.value = block.label;
      label.addEventListener('input', () => live(updateBlock(song(), block.id, { label: label.value })));
      label.addEventListener('change', endEdit);
      label.addEventListener('blur', endEdit);

      const bpm = element('strum-bpm');
      bpm.value = String(block.bpm || '');
      bpm.addEventListener('input', () => live(setBpm(song(), block.id, bpm.value)));
      bpm.addEventListener('change', endEdit);
      bpm.addEventListener('blur', endEdit);

      const subdivision = element('strum-subdivision');
      subdivision.value = String(block.subdivision);
      subdivision.addEventListener('change', () =>
        update(setSubdivision(song(), block.id, Number(subdivision.value))),
      );
      return;
    }

    if (block.type === 'chords') {
      ui.editor.innerHTML =
        '<div class="chip-row">' +
        (block.chords.length === 0
          ? '<p class="empty">Depuis le mode Accord, utilisez « Ajouter à la chanson ».</p>'
          : block.chords
              .map(
                (chord, index) =>
                  `<button type="button" class="chip" data-chord="${index}" data-tip="Retirer">${shortChordName(chord)}<i>${iconMarkup('close')}</i></button>`,
              )
              .join('')) +
        '</div>';
      return;
    }

    ui.editor.innerHTML =
      '<p class="empty">Tablature reprise du mode Tablature. Pour la modifier, éditez-la là-bas et rajoutez-la.</p>';
  };

  const render = () => {
    const value = song();
    const resolved = resolveName(value);

    ui.diagram.innerHTML = renderSongSvg(value, { interactive: true, selectedId });

    const size = songSize(value, { interactive: true });
    scaleSheet(ui.diagram, size, zoom);
    positionTitle({
      input: ui.title,
      resetButton: null,
      layout: SONG_LAYOUT,
      zoom,
      fontSize: fitTitleSize(resolved.name, size.width, SONG_LAYOUT, resolved.isPlaceholder),
    });

    lyricsEditor?.sync(blockPositions(value, { interactive: true }), zoom);

    if (document.activeElement !== ui.title) ui.title.value = value.title;
    if (document.activeElement !== ui.artist) ui.artist.value = value.artist;

    renderList();
    renderCheck();
    renderDrawer();
    // Rebuilding the editor would drop the caret, so leave it alone while a field has focus.
    if (!isEditingInside(ui.editor)) renderEditor();
    onChange();
  };

  const update = (next) => {
    history = commit(history, next);
    render();
  };

  const live = (next) => {
    if (editBaseline === null) editBaseline = history.present;
    history = replace(history, next);
    render();
  };

  const endEdit = () => {
    if (editBaseline !== null && editBaseline !== history.present) {
      history = commit({ ...history, present: editBaseline }, history.present);
    }
    editBaseline = null;
    render();
  };

  lyricsEditor = createLyricsEditor({
    host: ui.canvas,
    picker: {
      root: element('chord-picker'),
      list: element('picker-list'),
      form: element('picker-form'),
      input: element('picker-input'),
      remove: element('picker-remove'),
    },
    getSong: song,
    liveLines: (blockId, lines) => live(setLyricsLines(song(), blockId, lines)),
    commitLines: (blockId, lines) => update(setLyricsLines(song(), blockId, lines)),
    endEdit,
    chordChoices,
  });

  const select = (id) => {
    selectedId = id;
    render();
  };

  /* ---------- Lyrics import ---------- */

  const durationLabel = (seconds) =>
    seconds > 0 ? `${Math.floor(seconds / 60)}:${String(Math.round(seconds % 60)).padStart(2, '0')}` : '';

  const renderResults = (blockId) => {
    const host = element('lyrics-results');
    if (!host) return;

    if (results.length === 0) {
      host.innerHTML = '';
      return;
    }

    host.innerHTML = results
      .map(
        (result, index) =>
          `<button type="button" class="result-row" data-result="${index}">` +
          `<span class="result-text"><b>${escapeHtml(result.track)}</b><em>${escapeHtml(result.artist)}${result.album ? ` · ${escapeHtml(result.album)}` : ''}</em></span>` +
          `<span class="result-time">${durationLabel(result.duration)}</span>` +
          '</button>',
      )
      .join('');

    host.addEventListener('click', (event) => {
      const row = event.target.closest('[data-result]');
      if (row) applyResult(blockId, results[Number(row.dataset.result)]);
    });
  };

  const searchLyrics = async (blockId) => {
    lastQuery = element('lyrics-query')?.value ?? '';
    toast('Recherche des paroles…');

    const response = await window.desktop.searchLyrics(lastQuery);
    if (!response.ok) {
      results = [];
      renderResults(blockId);
      toast(response.error, true);
      return;
    }

    results = response.results;
    renderResults(blockId);
    toast(`${results.length} résultat${results.length > 1 ? 's' : ''}.`);
  };

  const applyResult = (blockId, result) => {
    let next = setLyricsLines(song(), blockId, parseLyrics(result.lyrics));
    if (!song().title) next = setTitle(next, result.track);
    if (!song().artist) next = setArtist(next, result.artist);

    update(next);
    toast(`Paroles importées : ${result.artist} — ${result.track}`);
  };

  /* ---------- Wiring ---------- */

  ui.diagram.addEventListener('click', (event) => {
    const hit = event.target.closest('[data-action]');
    if (!hit) return;

    if (hit.dataset.action === 'stroke') {
      update(cycleStroke(song(), hit.dataset.block, Number(hit.dataset.index), 1));
      selectedId = hit.dataset.block;
      render();
      return;
    }
    select(hit.dataset.block);
  });

  ui.diagram.addEventListener('contextmenu', (event) => {
    const hit = event.target.closest('[data-action]');
    if (!hit) return;
    event.preventDefault();

    if (hit.dataset.action === 'stroke') {
      update(cycleStroke(song(), hit.dataset.block, Number(hit.dataset.index), -1));
    } else if (hit.dataset.action === 'diagram') {
      update(removeChordDiagram(song(), hit.dataset.block, Number(hit.dataset.index)));
    }
  });

  ui.list.addEventListener('click', (event) => {
    const row = event.target.closest('[data-block]');
    if (!row) return;
    const id = row.dataset.block;

    const move = event.target.closest('[data-move]');
    if (move) return update(moveBlock(song(), id, Number(move.dataset.move)));

    if (event.target.closest('[data-remove]')) {
      if (selectedId === id) selectedId = null;
      return update(removeBlock(song(), id));
    }
    return select(id);
  });

  ui.editor.addEventListener('click', (event) => {
    const chip = event.target.closest('[data-chord]');
    if (chip && selectedId) update(removeChordDiagram(song(), selectedId, Number(chip.dataset.chord)));
  });

  const removeFromDrawer = (event) => {
    const figure = event.target.closest('.drawer-chord');
    if (!figure) return;
    event.preventDefault();
    update(removeChordDiagram(song(), figure.dataset.block, Number(figure.dataset.index)));
  };

  ui.drawerChords.addEventListener('contextmenu', removeFromDrawer);
  ui.drawerChords.addEventListener('click', (event) => {
    if (event.target.closest('.drawer-remove')) removeFromDrawer(event);
  });

  ui.drawerToggle.addEventListener('click', () => {
    const closing = document.body.dataset.drawer !== 'closed';
    document.body.dataset.drawer = closing ? 'closed' : 'open';
    ui.drawerToggle.innerHTML = iconMarkup(closing ? 'chevronRight' : 'chevronLeft');
    ui.drawerToggle.dataset.tip = closing ? 'Afficher les accords' : 'Replier les accords';
  });

  ui.title.addEventListener('input', () => live(setTitle(song(), ui.title.value)));
  ui.title.addEventListener('change', endEdit);
  ui.title.addEventListener('blur', endEdit);
  ui.title.addEventListener('keydown', (event) => {
    if (event.key === 'Enter' || event.key === 'Escape') ui.title.blur();
  });

  ui.artist.addEventListener('input', () => live(setArtist(song(), ui.artist.value)));
  ui.artist.addEventListener('change', endEdit);
  ui.artist.addEventListener('blur', endEdit);

  const appendBlock = (block) => {
    update(addBlock(song(), block));
    select(block.id);
  };

  element('btn-add-strum').addEventListener('click', () => appendBlock(createStrumBlock()));
  element('btn-add-lyrics').addEventListener('click', () => {
    const block = createLyricsBlock();
    appendBlock(block);
    lyricsEditor.focusBlock(block.id);
  });

  ui.panelToggle.addEventListener('click', () => {
    const closing = document.body.dataset.panel !== 'closed';
    document.body.dataset.panel = closing ? 'closed' : 'open';
    ui.panelToggle.innerHTML = iconMarkup(closing ? 'chevronLeft' : 'chevronRight');
    ui.panelToggle.dataset.tip = closing ? 'Afficher le panneau' : 'Replier le panneau';
    render();
  });

  ui.zoom.addEventListener('input', () => {
    zoom = Number(ui.zoom.value) / 100;
    render();
  });

  return {
    kind: 'song',
    sheet: ui.sheet,
    dock: ui.dock,
    extras: [ui.panel, ui.drawer],
    render,
    activate: render,
    deactivate: () => ui.title.blur(),
    canUndo: () => canUndo(history) || editBaseline !== null,
    canRedo: () => canRedo(history),
    undo: () => {
      history = undo(history);
      render();
    },
    redo: () => {
      history = redo(history);
      render();
    },
    clear: () => {
      selectedId = null;
      update(createSong());
    },
    serialize: () => song(),
    load: (raw) => {
      selectedId = null;
      update(parseSong(raw));
    },
    exportable: () => {
      const value = song();
      const resolved = resolveName(value);
      // The export keeps the chord shelf on the page, unlike the on-screen drawer.
      return {
        svg: renderSongSvg(value, { interactive: false }),
        ...songSize(value),
        name: resolved.isPlaceholder ? '' : resolved.name,
      };
    },
    /** Called from the other two modes to drop their current work into the song. */
    addChord: (chord) => {
      update(addChordDiagram(song(), chord));
      toast('Accord ajouté à la chanson.');
    },
    addTab: (tab) => {
      const block = createTabBlock(tab);
      update(addBlock(song(), block));
      selectedId = block.id;
      toast('Tablature ajoutée à la chanson.');
    },
    isEmpty: () => isBlank(song()),
  };
};
