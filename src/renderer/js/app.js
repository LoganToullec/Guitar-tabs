/** Application shell: mode switching, toolbar, file actions. Editing lives in the views. */

import { createChordView } from './chord-view.js';
import { createTabView } from './tab-view.js';
import { createSongView } from './song-view.js';
import { createLibraryView } from './library-view.js';
import { createCatalogView } from './catalog-view.js';
import { CLIPBOARD_DPI, svgToPngDataUrl, toFileName, UNITS_PER_INCH, withPhysicalSize } from './export.js';
import { ICONS, mountIcons } from './icons.js';
import { createAutoScroll } from './autoscroll.js';
import { isEditingInside } from './dom.js';

const TOAST_DURATION_MS = 2600;
const POPOVER_FADE_MS = 220;
const FALLBACK_NAMES = { chord: 'accord', tab: 'tablature', song: 'chanson' };

const element = (id) => document.getElementById(id);

const ui = {
  switcher: element('mode-switch'),
  undo: element('btn-undo'),
  redo: element('btn-redo'),
  toast: element('toast'),
};

let mode = 'chord';
let toastTimer = null;

const views = {};
const current = () => views[mode];

/* ---------- Toast ---------- */

const showToast = (message, isError = false) => {
  ui.toast.textContent = message;
  ui.toast.classList.toggle('error', isError);
  ui.toast.classList.add('visible');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => ui.toast.classList.remove('visible'), TOAST_DURATION_MS);
};

/** Buttons that only make sense when the mode owns an editable sheet. */
const SHEET_BUTTONS = ['btn-new', 'btn-save', 'btn-svg', 'btn-copy', 'btn-png'];

const refreshToolbar = () => {
  const view = views[mode];
  if (!view) return;

  ui.undo.disabled = !view.canUndo();
  ui.redo.disabled = !view.canRedo();

  const hasSheet = view.supportsSheet !== false;
  for (const id of SHEET_BUTTONS) element(id).disabled = !hasSheet;
};

views.chord = createChordView({ toast: showToast, onChange: refreshToolbar });
views.tab = createTabView({ toast: showToast, onChange: refreshToolbar });
views.song = createSongView({ toast: showToast, onChange: refreshToolbar });
views.library = createLibraryView({
  toast: showToast,
  onChange: refreshToolbar,
  onOpenSong: (song) => {
    setMode('song');
    views.song.load(song);
  },
});

/* ---------- Popovers ---------- */

const popovers = [];

const createPopover = (button, panel) => {
  let timer = null;

  const setOpen = (open) => {
    clearTimeout(timer);
    button.classList.toggle('is-on', open);
    button.setAttribute('aria-expanded', String(open));

    if (open) {
      panel.hidden = false;
      requestAnimationFrame(() => panel.classList.add('visible'));
      return;
    }
    panel.classList.remove('visible');
    timer = setTimeout(() => {
      panel.hidden = true;
    }, POPOVER_FADE_MS);
  };

  button.addEventListener('click', (event) => {
    event.stopPropagation();
    const open = panel.hidden;
    for (const other of popovers) other.close();
    setOpen(open);
  });

  const api = { close: () => setOpen(false), contains: (node) => panel.contains(node) };
  popovers.push(api);
  return api;
};

createPopover(element('btn-help-chord'), element('help-chord'));
createPopover(element('btn-help-tab'), element('help-tab'));
createPopover(element('btn-help-song'), element('help-song'));
createPopover(element('btn-help-library'), element('help-library'));

const closeAllPopovers = () => popovers.forEach((popover) => popover.close());

document.addEventListener('click', (event) => {
  if (popovers.some((popover) => popover.contains(event.target))) return;
  closeAllPopovers();
});

/* ---------- Mode switching ---------- */

/** Drives the sliding pill: the thumb is one segment wide and steps to the active index. */
const syncSwitcher = () => {
  const segments = [...ui.switcher.querySelectorAll('.segment')];
  ui.switcher.style.setProperty('--segment-count', String(segments.length));
  ui.switcher.style.setProperty(
    '--segment-index',
    String(segments.findIndex((segment) => segment.dataset.mode === mode)),
  );
  for (const segment of segments) {
    segment.setAttribute('aria-selected', String(segment.dataset.mode === mode));
  }
};

/** Shows or hides everything that belongs to one mode. */
const setChromeVisible = (view, visible) => {
  view.sheet.hidden = !visible;
  view.dock.hidden = !visible;
  for (const extra of view.extras ?? []) extra.hidden = !visible;
};

const setMode = (next) => {
  if (next === mode || !views[next]) return;

  closeAllPopovers();
  autoScroll.stop();
  current().deactivate();
  setChromeVisible(current(), false);

  mode = next;
  document.body.dataset.mode = mode;
  syncSwitcher();

  setChromeVisible(current(), true);
  current().sheet.classList.remove('enter');
  void current().sheet.offsetWidth; // restart the entrance animation
  current().sheet.classList.add('enter');
  current().activate();
};

for (const segment of ui.switcher.querySelectorAll('.segment')) {
  segment.addEventListener('click', () => setMode(segment.dataset.mode));
}

/* ---------- Hands-free scrolling ---------- */

const stage = document.querySelector('.stage');
const scrollButton = element('btn-autoscroll');
const speedInput = element('scroll-speed');

const autoScroll = createAutoScroll({
  container: stage,
  onStateChange: (running) => {
    scrollButton.innerHTML = ICONS[running ? 'pause' : 'play'];
    scrollButton.classList.toggle('is-on', running);
    scrollButton.setAttribute('aria-pressed', String(running));
  },
});

autoScroll.setSpeed(speedInput.value);
scrollButton.addEventListener('click', () => autoScroll.toggle());
speedInput.addEventListener('input', () => autoScroll.setSpeed(speedInput.value));
// Reaching for the wheel means taking over.
stage.addEventListener('wheel', () => autoScroll.stop(), { passive: true });

/* ---------- File actions ---------- */

const runFileAction = async (label, action) => {
  try {
    const result = await action();
    if (result?.canceled) return;
    if (result?.ok) showToast(`${label} : terminé.`);
    else showToast(result?.error ?? `${label} : échec.`, true);
  } catch (error) {
    showToast(error.message, true);
  }
};

const sheetFileName = (sheet, extension) =>
  toFileName(sheet.name, extension, FALLBACK_NAMES[mode]);

const exportPng = async (toClipboard) => {
  const sheet = current().exportable();
  const unitsPerInch = UNITS_PER_INCH[mode];
  const dataUrl = await svgToPngDataUrl(sheet.svg, sheet.width, sheet.height, {
    unitsPerInch,
    // A copy is sized in pixels rather than in dpi, because that is all the clipboard
    // carries — see CLIPBOARD_DPI.
    ...(toClipboard ? { scale: CLIPBOARD_DPI / unitsPerInch } : {}),
  });

  return toClipboard
    ? window.desktop.copyPng(dataUrl)
    : window.desktop.exportPng(dataUrl, sheetFileName(sheet, 'png'));
};

element('btn-png').addEventListener('click', () => runFileAction('Export PNG', () => exportPng(false)));
element('btn-copy').addEventListener('click', () => runFileAction('Copie', () => exportPng(true)));

element('btn-svg').addEventListener('click', () =>
  runFileAction('Export SVG', () => {
    const sheet = current().exportable();
    const svg = withPhysicalSize(sheet.svg, sheet.width, sheet.height, UNITS_PER_INCH[mode]);
    return window.desktop.exportSvg(svg, sheetFileName(sheet, 'svg'));
  }),
);

element('btn-save').addEventListener('click', () =>
  runFileAction('Enregistrement', () => {
    const document_ = current().serialize();
    return window.desktop.saveProject(
      JSON.stringify(document_, null, 2),
      sheetFileName(current().exportable(), 'gtab'),
    );
  }),
);

element('btn-open').addEventListener('click', () =>
  runFileAction('Ouverture', async () => {
    const result = await window.desktop.openProject();
    if (!result.ok) return result;

    const raw = JSON.parse(result.json);
    setMode(views[raw?.kind]?.supportsSheet !== false ? raw.kind : 'chord');
    // A song read from a file is not (yet) the library entry we were editing.
    if (mode === 'song') views.library.detach();
    current().load(raw);
    return { ok: true };
  }),
);

/** Starting a blank sheet also breaks the link with the library entry being edited. */
const clearCurrent = () => {
  if (mode === 'song') views.library.detach();
  current().clear();
};

for (const id of ['btn-new', 'btn-clear-chord', 'btn-clear-tab', 'btn-clear-song']) {
  element(id).addEventListener('click', clearCurrent);
}

element('btn-to-song-chord').addEventListener('click', () => views.song.addChord(views.chord.serialize()));
element('btn-to-song-tab').addEventListener('click', () => views.song.addTab(views.tab.serialize()));

for (const id of ['btn-to-library', 'btn-library-save']) {
  element(id).addEventListener('click', () => views.library.store(views.song.serialize()));
}

/* ---------- Chord catalogue ---------- */

const catalog = createCatalogView({
  savedShapes: () => views.library.chordShapes(),
  onRemoveSaved: (id) => views.library.dropChord(id),
});

element('btn-catalog-chord').addEventListener('click', (event) => {
  event.stopPropagation();
  catalog.open((shape) => {
    views.chord.load(shape.chord);
    showToast(`« ${shape.name} » chargé dans l'éditeur.`);
  });
});

element('btn-drawer-add').addEventListener('click', (event) => {
  event.stopPropagation();
  catalog.open((shape) => views.song.addChord(shape.chord));
});

element('btn-save-chord').addEventListener('click', () =>
  views.library.storeChord(views.chord.exportable().name, views.chord.serialize()),
);

ui.undo.addEventListener('click', () => current().undo());
ui.redo.addEventListener('click', () => current().redo());

/* ---------- Shortcuts ---------- */

const SHORTCUTS = {
  z: (event) => (event.shiftKey ? ui.redo : ui.undo).click(),
  y: () => ui.redo.click(),
  s: () => element('btn-save').click(),
  o: () => element('btn-open').click(),
  n: () => element('btn-new').click(),
  e: () => element('btn-png').click(),
  c: () => element('btn-copy').click(),
  1: () => setMode('chord'),
  2: () => setMode('tab'),
  3: () => setMode('song'),
  4: () => setMode('library'),
};

window.addEventListener('keydown', (event) => {
  if (event.key === 'Escape') {
    closeAllPopovers();
    return;
  }

  const typing = isEditingInside(document.body);
  if (event.key === ' ' && mode === 'song' && !typing) {
    event.preventDefault();
    autoScroll.toggle();
    return;
  }
  if (!event.ctrlKey && !event.metaKey) return;

  const key = event.key.toLowerCase();
  const handler = SHORTCUTS[key];
  // Plain Ctrl+C must stay the native copy: only Ctrl+Shift+C copies the sheet.
  if (!handler || (key === 'c' && !event.shiftKey)) return;

  event.preventDefault();
  handler(event);
});

mountIcons();
document.body.dataset.mode = mode;
document.body.dataset.drawer = 'open';
document.body.dataset.panel = 'open';
syncSwitcher();
for (const kind of ['tab', 'song', 'library']) setChromeVisible(views[kind], false);
views.song.render();
current().activate();
