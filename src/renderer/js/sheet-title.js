/**
 * The sheet title is an HTML input laid exactly over the band the SVG reserves for
 * it, so editing feels direct and the screen matches the exported image.
 */

export const RESET_BUTTON_SIZE = 26;

const PLACEHOLDER_RATIO = 0.56;
const AVERAGE_GLYPH_RATIO = 0.58;
const TITLE_SIDE_PAD = 24;
const MIN_TITLE_SIZE = 11;

/** Shrinks the title just enough to keep it inside the sheet width. */
export const fitTitleSize = (name, width, layout, isPlaceholder = false) => {
  const base = isPlaceholder ? layout.titleSize * PLACEHOLDER_RATIO : layout.titleSize;
  const length = String(name ?? '').length;
  if (length === 0) return base;

  const available = (width - TITLE_SIDE_PAD) / (AVERAGE_GLYPH_RATIO * length);
  return Math.max(MIN_TITLE_SIZE, Math.min(base, available));
};

export const positionTitle = ({ input, resetButton, layout, zoom, fontSize }) => {
  const top = layout.titleTop * zoom;
  const height = layout.titleHeight * zoom;

  input.style.top = `${top}px`;
  input.style.height = `${height}px`;
  input.style.lineHeight = `${height}px`;
  input.style.fontSize = `${fontSize * zoom}px`;

  if (!resetButton) return;
  resetButton.style.top = `${top + (height - RESET_BUTTON_SIZE) / 2}px`;
  resetButton.style.right = '0px';
};

/** Sizes the rendered SVG to the current zoom level. */
export const scaleSheet = (container, { width, height }, zoom) => {
  const svg = container.querySelector('svg');
  if (!svg) return;
  svg.style.width = `${Math.round(width * zoom)}px`;
  svg.style.height = `${Math.round(height * zoom)}px`;
};
