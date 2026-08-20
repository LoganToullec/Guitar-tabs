/** Chord-diagram editor: owns its model, history, sheet and dock controls. */

import {
  createChord,
  cycleFinger,
  cycleMarker,
  isBlank,
  MAX_FRET_COUNT,
  MAX_START_FRET,
  MIN_FRET_COUNT,
  parseChord,
  playedFrets,
  setFretCount,
  setNameOverride,
  setStartFret,
  toggleBarre,
  toggleNote,
} from './chord-model.js';
import { detectChordName } from './chord-namer.js';
import { chordNameOptions } from './chord-name.js';
import { diagramSize, LAYOUT, renderChordSvg } from './diagram-renderer.js';
import { canRedo, canUndo, commit, createHistory, redo, replace, undo } from './history.js';
import { fitTitleSize, positionTitle, scaleSheet } from './sheet-title.js';

const UNKNOWN_LABEL = 'Accord non reconnu';

export const createChordView = ({ toast, onChange }) => {
  const element = (id) => document.getElementById(id);

  const ui = {
    sheet: element('sheet-chord'),
    dock: element('dock-chord'),
    diagram: element('diagram-chord'),
    title: element('chord-name'),
    resetName: element('btn-auto-name'),
    startFretDown: element('btn-fret-down'),
    startFretUp: element('btn-fret-up'),
    startFretValue: element('out-start-fret'),
    rowsDown: element('btn-rows-down'),
    rowsUp: element('btn-rows-up'),
    rowsValue: element('out-fret-count'),
    zoom: element('zoom-chord'),
    altNames: element('alt-names'),
  };

  let history = createHistory(createChord());
  let editBaseline = null;
  let zoom = Number(ui.zoom.value) / 100;

  const chord = () => history.present;

  /** Manual name, else detection, else placeholder. */
  const resolveName = (value) => {
    const detected = isBlank(value) ? null : detectChordName(playedFrets(value));
    if (value.nameOverride) return { name: value.nameOverride, isPlaceholder: false, detected };
    if (detected) return { name: detected, isPlaceholder: false, detected };
    return { name: UNKNOWN_LABEL, isPlaceholder: true, detected: null };
  };

  const syncDock = (value) => {
    ui.startFretValue.textContent = String(value.startFret);
    ui.startFretDown.disabled = value.startFret <= 1;
    ui.startFretUp.disabled = value.startFret >= MAX_START_FRET;

    ui.rowsValue.textContent = String(value.fretCount);
    ui.rowsDown.disabled = value.fretCount <= MIN_FRET_COUNT;
    ui.rowsUp.disabled = value.fretCount >= MAX_FRET_COUNT;
  };

  /** The same grip often reads several ways; offer them all rather than picking for the user. */
  const renderAlternatives = (value, resolved) => {
    const options = chordNameOptions(value);
    ui.altNames.hidden = options.length < 2;
    if (ui.altNames.hidden) return;

    ui.altNames.innerHTML =
      '<span class="palette-label">Lectures</span>' +
      options
        .map(
          (name) =>
            `<button type="button" class="glyph-btn name${name === resolved.name ? ' is-on' : ''}" data-name="${name}">${name}</button>`,
        )
        .join('');
  };

  const render = () => {
    const value = chord();
    const resolved = resolveName(value);

    const size = diagramSize(value);
    ui.diagram.innerHTML = renderChordSvg(value, { ...resolved, interactive: true });
    scaleSheet(ui.diagram, size, zoom);
    positionTitle({
      input: ui.title,
      resetButton: ui.resetName,
      layout: LAYOUT,
      zoom,
      fontSize: fitTitleSize(resolved.name, size.width, LAYOUT, resolved.isPlaceholder),
    });

    if (document.activeElement !== ui.title) {
      ui.title.value = value.nameOverride ?? resolved.detected ?? '';
    }
    ui.resetName.hidden = value.nameOverride === null;

    renderAlternatives(value, resolved);
    syncDock(value);
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

  /** Folds every live change made since the field was first touched into one undo step. */
  const endEdit = () => {
    if (editBaseline !== null && editBaseline !== history.present) {
      history = commit({ ...history, present: editBaseline }, history.present);
    }
    editBaseline = null;
    render();
  };

  /* ---------- Interactions ---------- */

  const handlePointer = (event, isSecondary) => {
    const hit = event.target.closest('[data-action]');
    if (!hit) return;

    const string = Number(hit.dataset.string);
    const row = Number(hit.dataset.row);

    switch (hit.dataset.action) {
      case 'cell': {
        if (!isSecondary) {
          update(toggleNote(chord(), string, row));
          return;
        }
        const { chord: next, error } = toggleBarre(chord(), string, row);
        if (error) toast(error, true);
        else update(next);
        return;
      }
      case 'marker':
        update(cycleMarker(chord(), string, isSecondary ? -1 : 1));
        return;
      case 'finger':
        update(cycleFinger(chord(), string, isSecondary ? -1 : 1));
        return;
      case 'position':
        update(setStartFret(chord(), chord().startFret + (isSecondary ? -1 : 1)));
        return;
      default:
    }
  };

  ui.diagram.addEventListener('click', (event) => handlePointer(event, false));
  ui.diagram.addEventListener('contextmenu', (event) => {
    event.preventDefault();
    handlePointer(event, true);
  });

  ui.title.addEventListener('input', () => live(setNameOverride(chord(), ui.title.value)));
  ui.title.addEventListener('change', endEdit);
  ui.title.addEventListener('blur', endEdit);
  ui.title.addEventListener('keydown', (event) => {
    if (event.key === 'Enter' || event.key === 'Escape') ui.title.blur();
  });

  ui.resetName.addEventListener('click', () => update(setNameOverride(chord(), '')));

  ui.altNames.addEventListener('click', (event) => {
    const choice = event.target.closest('[data-name]');
    if (choice) update(setNameOverride(chord(), choice.dataset.name));
  });

  ui.startFretDown.addEventListener('click', () => update(setStartFret(chord(), chord().startFret - 1)));
  ui.startFretUp.addEventListener('click', () => update(setStartFret(chord(), chord().startFret + 1)));
  ui.rowsDown.addEventListener('click', () => update(setFretCount(chord(), chord().fretCount - 1)));
  ui.rowsUp.addEventListener('click', () => update(setFretCount(chord(), chord().fretCount + 1)));

  ui.zoom.addEventListener('input', () => {
    zoom = Number(ui.zoom.value) / 100;
    render();
  });

  return {
    kind: 'chord',
    sheet: ui.sheet,
    dock: ui.dock,
    render,
    activate: render,
    deactivate: () => {
      ui.title.blur();
      ui.altNames.hidden = true;
    },
    canUndo: () => canUndo(history),
    canRedo: () => canRedo(history),
    undo: () => {
      history = undo(history);
      render();
    },
    redo: () => {
      history = redo(history);
      render();
    },
    clear: () => update(createChord()),
    serialize: () => chord(),
    load: (raw) => update(parseChord(raw)),
    exportable: () => {
      const value = chord();
      const resolved = resolveName(value);
      // The editor keeps the fingering row as a click target; an export drops it when it
      // is empty, which is what makes the image as compact as a printed chord chart.
      const options = { ...resolved, interactive: false, trimEmptyFingers: true };
      return {
        svg: renderChordSvg(value, options),
        ...diagramSize(value, options),
        name: resolved.isPlaceholder ? '' : resolved.name,
      };
    },
  };
};
