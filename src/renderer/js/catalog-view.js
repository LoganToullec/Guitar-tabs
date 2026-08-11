/**
 * Chord catalogue popover: the built-in shapes plus the ones saved by the user, shown as
 * real diagrams. Who opened it decides what a click does — load it into the editor, or
 * drop it into the song.
 */

import { catalogShapes, openShapes, searchCatalog } from './chord-catalog.js';
import { renderChordSvg } from './diagram-renderer.js';
import { resolveChordName } from './chord-name.js';

/** Rendering every position at once would mean hundreds of diagrams; narrow the search instead. */
const MAX_RESULTS = 60;

const escapeHtml = (value) =>
  String(value ?? '').replace(/[&<>"']/g, (character) => `&#${character.charCodeAt(0)};`);

export const createCatalogView = ({ savedShapes, onPick, onRemoveSaved }) => {
  const element = (id) => document.getElementById(id);

  const ui = {
    root: element('chord-catalog'),
    search: element('catalog-search'),
    grid: element('catalog-grid'),
    foot: element('catalog-foot'),
    close: element('btn-catalog-close'),
  };

  const builtIn = catalogShapes();
  let pick = null;
  /** What the grid currently shows — search results carry the spelling that matched. */
  let displayed = [];

  /** Saved grips carry less metadata than catalogue entries; line them up. */
  const asShape = (saved) => ({
    id: saved.id,
    name: saved.name,
    aliases: [],
    startFret: saved.chord.startFret,
    chord: saved.chord,
  });

  const tile = (shape, removable) =>
    `<figure class="catalog-tile" data-shape="${shape.id}"${removable ? ' data-removable="1"' : ''}>` +
    renderChordSvg(shape.chord, { ...resolveChordName(shape.chord), interactive: false, trimEmptyFingers: true }) +
    `<figcaption>${escapeHtml(shape.name)}` +
    (shape.startFret > 1 ? `<span>${shape.startFret}fr</span>` : '') +
    '</figcaption></figure>';

  const section = (title, shapes, removable) =>
    shapes.length === 0
      ? ''
      : `<h4>${escapeHtml(title)}</h4><div class="catalog-grid-rows">${shapes.map((shape) => tile(shape, removable)).join('')}</div>`;

  const render = () => {
    const query = ui.search.value.trim();
    const saved = savedShapes().map(asShape);

    const mine = query === '' ? saved : searchCatalog(query, saved);
    const found = query === '' ? openShapes() : searchCatalog(query);
    const shown = found.slice(0, MAX_RESULTS);
    const hidden = found.length - shown.length;
    displayed = [...mine, ...shown];

    ui.grid.innerHTML =
      mine.length + shown.length === 0
        ? '<p class="empty">Aucun accord ne correspond.</p>'
        : section('Mes accords', mine, true) +
          section(query === '' ? 'Positions ouvertes' : 'Catalogue', shown, false);

    ui.foot.textContent =
      query === ''
        ? `${builtIn.length} positions au catalogue — tapez un nom (C, Am7, F#maj7, Bb9…) pour toutes les voir.`
        : hidden > 0
          ? `${found.length} positions trouvées, ${hidden} masquées — précisez la recherche.`
          : `${found.length} position${found.length > 1 ? 's' : ''} trouvée${found.length > 1 ? 's' : ''}. Clic droit sur un de vos accords pour le retirer.`;
  };

  const close = () => {
    ui.root.hidden = true;
    pick = null;
  };

  const open = (handler) => {
    pick = handler;
    ui.search.value = '';
    render();
    ui.root.hidden = false;
    ui.search.focus();
  };

  const shapeById = (id) => displayed.find((shape) => shape.id === id) ?? null;

  ui.search.addEventListener('input', render);
  ui.close.addEventListener('click', close);

  ui.grid.addEventListener('click', (event) => {
    const figure = event.target.closest('[data-shape]');
    const shape = figure ? shapeById(figure.dataset.shape) : null;
    if (!shape || !pick) return;

    const handler = pick;
    close();
    handler(shape);
  });

  ui.grid.addEventListener('contextmenu', (event) => {
    const figure = event.target.closest('[data-removable]');
    if (!figure) return;
    event.preventDefault();
    onRemoveSaved(figure.dataset.shape);
    render();
  });

  ui.root.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') close();
  });

  document.addEventListener('click', (event) => {
    if (!ui.root.hidden && !ui.root.contains(event.target) && !event.target.closest('[data-opens-catalog]')) {
      close();
    }
  });

  return {
    /** @param {(shape: {name: string, chord: object}) => void} handler */
    open: (handler) => open(handler ?? onPick),
    close,
    refresh: () => {
      if (!ui.root.hidden) render();
    },
  };
};
