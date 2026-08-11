/** Linear tablature editor: click a slot, type the fret, add the articulations. */

import {
  addMeasure,
  chordAt,
  clearChord,
  clearNote,
  createTab,
  insertColumn,
  isBlank,
  isChordText,
  MAX_BARS_PER_LINE,
  MAX_CHORD_LENGTH,
  MAX_FRET_LENGTH,
  MAX_MEASURES,
  MAX_STEPS,
  measureSteps,
  MIN_BARS_PER_LINE,
  MIN_MEASURES,
  MIN_STEPS,
  noteAt,
  parseTab,
  removeColumn,
  removeMeasure,
  setBarsPerLine,
  setChord,
  setFret,
  setLink,
  setMeasureSteps,
  setTitle,
  toggleFlag,
} from './tab-model.js';
import { renderTabSvg, TAB_LAYOUT, tabSize } from './tab-renderer.js';
import { canRedo, canUndo, commit, createHistory, redo, replace, undo } from './history.js';
import { fitTitleSize, positionTitle, scaleSheet } from './sheet-title.js';

const UNTITLED_LABEL = 'Tablature sans titre';
const CHORD_LANE = 'chords';
const NOTE_LANE = 'notes';
const NEEDS_NOTE = 'Placez d’abord une case sur la corde.';

/** Single-key shortcuts for the articulations, mirroring the palette. */
const LINK_KEYS = { h: 'h', p: 'p', b: 'b', r: 'r', '/': '/', '\\': '\\' };
const FLAG_KEYS = { g: 'ghost', n: 'harmonic', '~': 'vibrato', t: 'tap', m: 'palmMute' };

const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

export const createTabView = ({ toast, onChange }) => {
  const element = (id) => document.getElementById(id);

  const ui = {
    sheet: element('sheet-tab'),
    dock: element('dock-tab'),
    palette: element('palette-tab'),
    diagram: element('diagram-tab'),
    title: element('tab-title'),
    barsDown: element('btn-bars-down'),
    barsUp: element('btn-bars-up'),
    barsValue: element('out-bars'),
    stepsDown: element('btn-steps-down'),
    stepsUp: element('btn-steps-up'),
    stepsValue: element('out-steps'),
    wrapDown: element('btn-wrap-down'),
    wrapUp: element('btn-wrap-up'),
    wrapValue: element('out-wrap'),
    zoom: element('zoom-tab'),
  };

  let history = createHistory(createTab());
  let editBaseline = null;
  let cursor = { lane: NOTE_LANE, string: 0, bar: 0, step: 0 };
  let typing = false;
  let isActive = false;
  let zoom = Number(ui.zoom.value) / 100;

  const tab = () => history.present;
  const inChordLane = () => cursor.lane === CHORD_LANE;
  const currentNote = () => noteAt(tab(), cursor.bar, cursor.step, cursor.string);

  const resolveName = (value) =>
    value.title
      ? { name: value.title, isPlaceholder: false }
      : { name: UNTITLED_LABEL, isPlaceholder: true };

  const syncDock = (value) => {
    ui.barsValue.textContent = String(value.measures.length);
    ui.barsDown.disabled = value.measures.length <= MIN_MEASURES;
    ui.barsUp.disabled = value.measures.length >= MAX_MEASURES;

    const steps = measureSteps(value, cursor.bar);
    ui.stepsValue.textContent = String(steps);
    ui.stepsDown.disabled = steps <= MIN_STEPS;
    ui.stepsUp.disabled = steps >= MAX_STEPS;

    ui.wrapValue.textContent = String(value.barsPerLine);
    ui.wrapDown.disabled = value.barsPerLine <= MIN_BARS_PER_LINE;
    ui.wrapUp.disabled = value.barsPerLine >= MAX_BARS_PER_LINE;
  };

  const syncPalette = () => {
    const note = inChordLane() ? null : currentNote();

    for (const button of ui.palette.querySelectorAll('[data-link], [data-flag]')) {
      const { link, flag } = button.dataset;
      const active = note ? (link ? note.link === link : note[flag] === true) : false;
      button.classList.toggle('is-on', active);
    }
    ui.palette.classList.toggle('is-idle', note === null);
  };

  const render = () => {
    const value = tab();
    const resolved = resolveName(value);

    ui.diagram.innerHTML = renderTabSvg(value, {
      ...resolved,
      interactive: true,
      cursor: isActive ? cursor : null,
    });

    const size = tabSize(value);
    scaleSheet(ui.diagram, size, zoom);
    positionTitle({
      input: ui.title,
      resetButton: null,
      layout: TAB_LAYOUT,
      zoom,
      fontSize: fitTitleSize(resolved.name, size.width, TAB_LAYOUT, resolved.isPlaceholder),
    });

    if (document.activeElement !== ui.title) ui.title.value = value.title;

    syncDock(value);
    syncPalette();
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

  /** All the keystrokes typed into one slot collapse into a single undo step. */
  const endEdit = () => {
    if (editBaseline !== null && editBaseline !== history.present) {
      history = commit({ ...history, present: editBaseline }, history.present);
    }
    editBaseline = null;
    typing = false;
  };

  /* ---------- Cursor ---------- */

  const clampCursor = () => {
    const value = tab();
    const bar = clamp(cursor.bar, 0, value.measures.length - 1);
    cursor = {
      ...cursor,
      bar,
      step: clamp(cursor.step, 0, measureSteps(value, bar) - 1),
      string: clamp(cursor.string, 0, value.stringCount - 1),
    };
  };

  /** Walks the timeline, crossing bar lines rather than stopping at them. */
  const moveStep = (delta) => {
    endEdit();
    const value = tab();
    let { bar, step } = cursor;

    for (let remaining = Math.abs(delta); remaining > 0; remaining -= 1) {
      if (delta > 0) {
        if (step + 1 < measureSteps(value, bar)) step += 1;
        else if (bar + 1 < value.measures.length) [bar, step] = [bar + 1, 0];
        else break;
      } else if (step > 0) step -= 1;
      else if (bar > 0) [bar, step] = [bar - 1, measureSteps(value, bar - 1) - 1];
      else break;
    }

    cursor = { ...cursor, bar, step };
    render();
  };

  const jumpTo = (bar, step) => {
    endEdit();
    cursor = { ...cursor, bar, step };
    clampCursor();
    render();
  };

  /** `delta > 0` goes up the sheet: thinner strings first, then the chord lane. */
  const moveLane = (delta) => {
    endEdit();
    const top = tab().stringCount - 1;

    if (delta > 0 && !inChordLane()) {
      cursor =
        cursor.string >= top ? { ...cursor, lane: CHORD_LANE } : { ...cursor, string: cursor.string + 1 };
    } else if (delta < 0) {
      cursor = inChordLane()
        ? { ...cursor, lane: NOTE_LANE, string: top }
        : { ...cursor, string: Math.max(0, cursor.string - 1) };
    }
    render();
  };

  /* ---------- Typing ---------- */

  const typeChordCharacter = (character) => {
    const value = tab();
    const existing = chordAt(value, cursor.bar, cursor.step);
    const base = typing && existing ? existing.text : '';
    live(setChord(value, cursor.bar, cursor.step, (base + character).slice(0, MAX_CHORD_LENGTH)));
    typing = true;
  };

  const typeFretCharacter = (character) => {
    const value = tab();
    const existing = currentNote();
    const base = typing && existing && /^\d+$/.test(existing.fret) ? existing.fret : '';
    live(setFret(value, cursor.bar, cursor.step, cursor.string, (base + character).slice(0, MAX_FRET_LENGTH)));
    typing = true;
  };

  const applyArticulation = (apply) => {
    if (inChordLane() || !currentNote()) {
      toast(NEEDS_NOTE, true);
      return;
    }
    endEdit();
    update(apply(tab()));
  };

  const applyLink = (link) =>
    applyArticulation((value) => setLink(value, cursor.bar, cursor.step, cursor.string, link));

  const applyFlag = (flag) =>
    applyArticulation((value) => toggleFlag(value, cursor.bar, cursor.step, cursor.string, flag));

  const backspace = () => {
    const value = tab();
    if (inChordLane()) {
      const existing = chordAt(value, cursor.bar, cursor.step);
      if (!existing) return moveStep(-1);
      live(setChord(value, cursor.bar, cursor.step, existing.text.slice(0, -1)));
    } else {
      const existing = currentNote();
      if (!existing) return moveStep(-1);
      live(setFret(value, cursor.bar, cursor.step, cursor.string, existing.fret.slice(0, -1)));
    }
    typing = true;
    return undefined;
  };

  const clearSlot = () => {
    endEdit();
    update(
      inChordLane()
        ? clearChord(tab(), cursor.bar, cursor.step)
        : clearNote(tab(), cursor.bar, cursor.step, cursor.string),
    );
  };

  /* ---------- Columns ---------- */

  const addColumn = () => {
    endEdit();
    update(insertColumn(tab(), cursor.bar, cursor.step));
  };

  const dropColumn = () => {
    endEdit();
    update(removeColumn(tab(), cursor.bar, cursor.step));
    clampCursor();
    render();
  };

  /* ---------- Interactions ---------- */

  const handlePointer = (event, isSecondary) => {
    const hit = event.target.closest('[data-action="cell"], [data-action="chord"]');
    if (!hit) return;

    endEdit();
    cursor = {
      lane: hit.dataset.action === 'chord' ? CHORD_LANE : NOTE_LANE,
      string: Number(hit.dataset.string ?? cursor.string),
      bar: Number(hit.dataset.bar),
      step: Number(hit.dataset.step),
    };

    if (isSecondary) clearSlot();
    else render();
  };

  ui.diagram.addEventListener('click', (event) => handlePointer(event, false));
  ui.diagram.addEventListener('contextmenu', (event) => {
    event.preventDefault();
    handlePointer(event, true);
  });

  const NAVIGATION = {
    ArrowLeft: () => moveStep(-1),
    ArrowRight: () => moveStep(1),
    ArrowUp: () => moveLane(1),
    ArrowDown: () => moveLane(-1),
    ' ': () => moveStep(1),
    Enter: () => moveStep(1),
    Home: () => jumpTo(0, 0),
    End: () => jumpTo(tab().measures.length - 1, MAX_STEPS),
    Insert: addColumn,
    Delete: clearSlot,
    Backspace: backspace,
  };

  window.addEventListener('keydown', (event) => {
    if (!isActive || event.ctrlKey || event.metaKey || event.altKey) return;
    if (document.activeElement?.tagName === 'INPUT') return;

    const navigate = NAVIGATION[event.key];
    if (navigate) {
      event.preventDefault();
      navigate();
      return;
    }
    if (event.key.length !== 1) return;

    if (inChordLane()) {
      if (!isChordText(event.key)) return;
      event.preventDefault();
      typeChordCharacter(event.key);
      return;
    }

    if (/[0-9]/.test(event.key)) {
      event.preventDefault();
      typeFretCharacter(event.key);
    } else if (event.key === 'x') {
      event.preventDefault();
      endEdit();
      update(setFret(tab(), cursor.bar, cursor.step, cursor.string, 'x'));
    } else if (LINK_KEYS[event.key]) {
      event.preventDefault();
      applyLink(LINK_KEYS[event.key]);
    } else if (FLAG_KEYS[event.key]) {
      event.preventDefault();
      applyFlag(FLAG_KEYS[event.key]);
    }
  });

  /* ---------- Palette ---------- */

  ui.palette.addEventListener('click', (event) => {
    const button = event.target.closest('button');
    if (!button) return;

    const { link, flag, fret, column } = button.dataset;
    if (link) applyLink(link);
    else if (flag) applyFlag(flag);
    else if (fret) {
      endEdit();
      update(setFret(tab(), cursor.bar, cursor.step, cursor.string, fret));
    } else if (column === 'insert') addColumn();
    else if (column === 'remove') dropColumn();
  });

  /* ---------- Title and dock ---------- */

  ui.title.addEventListener('input', () => live(setTitle(tab(), ui.title.value)));
  ui.title.addEventListener('change', () => {
    endEdit();
    render();
  });
  ui.title.addEventListener('blur', () => {
    endEdit();
    render();
  });
  ui.title.addEventListener('keydown', (event) => {
    if (event.key === 'Enter' || event.key === 'Escape') ui.title.blur();
  });

  const stepMeasure = (delta) => {
    endEdit();
    update(setMeasureSteps(tab(), cursor.bar, measureSteps(tab(), cursor.bar) + delta));
    clampCursor();
    render();
  };

  ui.barsDown.addEventListener('click', () => {
    endEdit();
    update(removeMeasure(tab()));
    clampCursor();
    render();
  });
  ui.barsUp.addEventListener('click', () => update(addMeasure(tab())));
  ui.stepsDown.addEventListener('click', () => stepMeasure(-1));
  ui.stepsUp.addEventListener('click', () => stepMeasure(1));
  ui.wrapDown.addEventListener('click', () => update(setBarsPerLine(tab(), tab().barsPerLine - 1)));
  ui.wrapUp.addEventListener('click', () => update(setBarsPerLine(tab(), tab().barsPerLine + 1)));

  ui.zoom.addEventListener('input', () => {
    zoom = Number(ui.zoom.value) / 100;
    render();
  });

  return {
    kind: 'tab',
    sheet: ui.sheet,
    dock: ui.dock,
    extras: [ui.palette],
    render,
    activate: () => {
      isActive = true;
      clampCursor();
      render();
    },
    deactivate: () => {
      endEdit();
      isActive = false;
      ui.title.blur();
      render();
    },
    canUndo: () => canUndo(history) || editBaseline !== null,
    canRedo: () => canRedo(history),
    undo: () => {
      endEdit();
      history = undo(history);
      clampCursor();
      render();
    },
    redo: () => {
      endEdit();
      history = redo(history);
      clampCursor();
      render();
    },
    clear: () => {
      endEdit();
      update(createTab());
      clampCursor();
      render();
    },
    serialize: () => {
      endEdit();
      return tab();
    },
    load: (raw) => {
      endEdit();
      update(parseTab(raw));
      clampCursor();
      render();
    },
    exportable: () => {
      endEdit();
      const value = tab();
      const resolved = resolveName(value);
      return {
        svg: renderTabSvg(value, { ...resolved, interactive: false }),
        ...tabSize(value),
        name: resolved.isPlaceholder ? '' : resolved.name,
      };
    },
    isEmpty: () => isBlank(tab()),
  };
};
