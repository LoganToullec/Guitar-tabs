const TEXT_FIELDS = ['INPUT', 'TEXTAREA', 'SELECT'];

/**
 * True while a field inside `root` has focus. Panels rebuilt with innerHTML must not be
 * replaced then, or the caret is lost — but a click on one of their buttons must still
 * refresh them, which is why focus on a button does not count.
 */
export const isEditingInside = (root) =>
  root.contains(document.activeElement) && TEXT_FIELDS.includes(document.activeElement?.tagName);
