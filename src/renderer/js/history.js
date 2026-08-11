/** Minimal immutable undo/redo stack. */

const MAX_DEPTH = 100;

export const createHistory = (present) => ({ past: [], present, future: [] });

export const commit = (history, present) => {
  if (present === history.present) return history;
  const past = [...history.past, history.present].slice(-MAX_DEPTH);
  return { past, present, future: [] };
};

/** Replaces the current value without creating an undo step (e.g. live typing). */
export const replace = (history, present) => ({ ...history, present });

export const canUndo = (history) => history.past.length > 0;
export const canRedo = (history) => history.future.length > 0;

export const undo = (history) => {
  if (!canUndo(history)) return history;
  const past = history.past.slice(0, -1);
  return { past, present: history.past.at(-1), future: [history.present, ...history.future] };
};

export const redo = (history) => {
  if (!canRedo(history)) return history;
  return {
    past: [...history.past, history.present],
    present: history.future[0],
    future: history.future.slice(1),
  };
};
