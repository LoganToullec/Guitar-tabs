/** Inline icon set (24×24, stroke-based). Kept local so no external asset is ever fetched. */

const glyph = (body) =>
  `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" ` +
  `stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">${body}</svg>`;

export const ICONS = {
  logo: glyph('<path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/>'),

  new: glyph(
    '<path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z"/><path d="M14 2v5h5"/>' +
      '<path d="M12 11v6"/><path d="M9 14h6"/>',
  ),
  open: glyph(
    '<path d="M4 20h16a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.9a2 2 0 0 1-1.69-.9L9.6 3.9A2 2 0 0 0 7.93 3H4a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2Z"/>',
  ),
  save: glyph(
    '<path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2Z"/>' +
      '<path d="M17 21v-8H7v8"/><path d="M7 3v5h8"/>',
  ),

  undo: glyph('<path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/>'),
  redo: glyph('<path d="M21 12a9 9 0 1 1-9-9 9.75 9.75 0 0 1 6.74 2.74L21 8"/><path d="M21 3v5h-5"/>'),

  png: glyph(
    '<rect x="3" y="3" width="18" height="18" rx="3"/><circle cx="9" cy="9" r="1.6"/>' +
      '<path d="m21 15-3.1-3.1a2 2 0 0 0-2.8 0L6 21"/>',
  ),
  svg: glyph(
    '<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8Z"/><path d="M14 2v6h6"/>' +
      '<path d="m10 13-2 2 2 2"/><path d="m14 17 2-2-2-2"/>',
  ),
  copy: glyph(
    '<rect x="8" y="8" width="14" height="14" rx="3"/>' +
      '<path d="M4 16a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2"/>',
  ),

  position: glyph('<path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"/><circle cx="12" cy="10" r="2.8"/>'),
  rows: glyph('<rect x="3" y="3" width="18" height="18" rx="3"/><path d="M3 9h18"/><path d="M3 15h18"/>'),
  zoom: glyph('<circle cx="11" cy="11" r="7"/><path d="m20 20-3.7-3.7"/>'),

  minus: glyph('<path d="M5 12h14"/>'),
  plus: glyph('<path d="M12 5v14"/><path d="M5 12h14"/>'),
  clear: glyph(
    '<path d="M3 6h18"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6"/>' +
      '<path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>',
  ),
  help: glyph('<circle cx="12" cy="12" r="9"/><path d="M9.2 9.2a3 3 0 0 1 5.8 1c0 2-3 2.6-3 4"/><path d="M12 17.5h.01"/>'),
  auto: glyph(
    '<path d="m12 4 1.6 4.4L18 10l-4.4 1.6L12 16l-1.6-4.4L6 10l4.4-1.6Z"/>' +
      '<path d="M19 15.5 19.7 17.3 21.5 18l-1.8.7L19 20.5l-.7-1.8L16.5 18l1.8-.7Z"/>',
  ),

  chord: glyph(
    '<path d="M8 3v18M16 3v18M3 8h18M3 16h18"/><circle cx="8" cy="16" r="1.9" fill="currentColor" stroke="none"/>',
  ),
  tab: glyph(
    '<path d="M3 6h18M3 12h18M3 18h18"/>' +
      '<circle cx="8" cy="6" r="1.7" fill="currentColor" stroke="none"/>' +
      '<circle cx="15.5" cy="12" r="1.7" fill="currentColor" stroke="none"/>',
  ),
  song: glyph(
    '<path d="M14 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9Z"/><path d="M14 3v6h6"/>' +
      '<path d="M10 18v-5.5l5-1V17"/><circle cx="8.5" cy="18" r="1.6" fill="currentColor" stroke="none"/>' +
      '<circle cx="13.5" cy="17" r="1.6" fill="currentColor" stroke="none"/>',
  ),
  strum: glyph('<path d="M8 4v15M8 19l-3-3M8 19l3 3"/><path d="M16 20V5M16 5l-3 3M16 5l3 3"/>'),
  lyrics: glyph('<rect x="9" y="2" width="6" height="11" rx="3"/><path d="M5 11a7 7 0 0 0 14 0"/><path d="M12 18v3"/>'),
  addToSong: glyph(
    '<path d="M14 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h5"/><path d="M14 3v6h6"/><path d="M18 14v6M15 17h6"/>',
  ),
  library: glyph(
    '<path d="M4 19V5a2 2 0 0 1 2-2h2v18H6a2 2 0 0 1-2-2Z"/><path d="M10 3h3.5v18H10z"/><path d="m16.2 4.3 3.6 14.4-2.9.8-3.6-14.5z"/>',
  ),
  folderPlus: glyph(
    '<path d="M4 20h16a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.9a2 2 0 0 1-1.69-.9L9.6 3.9A2 2 0 0 0 7.93 3H4a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2Z"/>' +
      '<path d="M12 10.5v6M9 13.5h6"/>',
  ),
  librarySave: glyph('<path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h6"/><path d="M18 3v6M15 6h6"/>'),
  play: glyph('<path d="M7.5 4.8v14.4l11.5-7.2z" fill="currentColor"/>'),
  pause: glyph('<path d="M9 4.5v15M15 4.5v15" stroke-width="2.4"/>'),
  speed: glyph('<path d="M4.5 18a9 9 0 1 1 15 0"/><path d="m12 14 3.5-4.5"/><circle cx="12" cy="15" r="1.4" fill="currentColor" stroke="none"/>'),
  chevronLeft: glyph('<path d="m15 18-6-6 6-6"/>'),
  chevronRight: glyph('<path d="m9 18 6-6-6-6"/>'),
  warning: glyph('<path d="M12 4 2.5 20h19Z"/><path d="M12 10v4"/><path d="M12 17.5h.01"/>'),
  check: glyph('<path d="m4 12.5 5 5 11-11"/>'),
  up: glyph('<path d="m18 15-6-6-6 6"/>'),
  down: glyph('<path d="m6 9 6 6 6-6"/>'),
  close: glyph('<path d="M18 6 6 18M6 6l12 12"/>'),
  download: glyph('<path d="M12 3v12"/><path d="m7 11 5 5 5-5"/><path d="M4 19h16"/>'),

  bars: glyph('<path d="M4 5v14M12 5v14M20 5v14"/>'),
  columns: glyph('<rect x="3" y="5" width="18" height="14" rx="2.5"/><path d="M9 5v14M15 5v14"/>'),
  wrap: glyph('<path d="M3 6h18M3 12h18M3 18h11"/>'),
  colAdd: glyph('<rect x="3" y="4" width="18" height="16" rx="2.5"/><path d="M12 9v6M9 12h6"/>'),
  colRemove: glyph('<rect x="3" y="4" width="18" height="16" rx="2.5"/><path d="M9 12h6"/>'),
  keyboard: glyph(
    '<rect x="2" y="6" width="20" height="12" rx="2.5"/><path d="M6 10h.01M10 10h.01M14 10h.01M18 10h.01M8 14h8"/>',
  ),
  technique: glyph('<path d="M3 16c4 0 4-8 8-8s4 8 8 8"/><path d="M3 20h18"/>'),

  click: glyph('<path d="M9 9l10.5 4-4.6 1.9L13 19.5Z"/><path d="M5 3v2"/><path d="M3 5h2"/><path d="M5 11v2"/><path d="M11 5h2"/>'),
  barre: glyph('<rect x="2" y="9" width="20" height="6" rx="3"/><path d="M6 4v2"/><path d="M12 4v2"/><path d="M18 4v2"/>'),
  mute: glyph('<circle cx="12" cy="12" r="9"/><path d="m9 9 6 6"/><path d="m15 9-6 6"/>'),
  finger: glyph('<path d="M6 13V6a2 2 0 1 1 4 0v6"/><path d="M10 12V4a2 2 0 1 1 4 0v8"/><path d="M14 12V6a2 2 0 1 1 4 0v9a6 6 0 0 1-6 6h-1a6 6 0 0 1-6-6v-2a2 2 0 1 1 4 0"/>'),
};

/** Replaces every `[data-icon]` placeholder with its inline SVG. */
export const mountIcons = (root = document) => {
  for (const node of root.querySelectorAll('[data-icon]')) {
    node.innerHTML = ICONS[node.dataset.icon] ?? '';
  }
};
