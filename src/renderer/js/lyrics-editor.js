/**
 * On-sheet lyrics editing: one input per line, laid exactly over the space the SVG
 * reserves, with a clickable chord lane above each line.
 *
 * Chords are never typed between brackets — clicking above a word opens a picker holding
 * the chords the song already defines.
 */

import { charWidth, lineBandHeight, SONG_LAYOUT } from './song-renderer.js';
import { emptyLine, sectionLine, spliceLines, wordStartAt } from './lyrics.js';

const MONO = "'Courier New', Courier, monospace";

const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

/**
 * Only structural changes need a rebuild; typing must not blow the DOM away, because a
 * rebuild takes the caret with it. Two things are therefore kept out of the signature and
 * handled by `place()` instead, since both move with every single keystroke:
 *
 * - where a block sits and how wide it is, which follows the longest line;
 * - the offset of each chord, which slides along as words are inserted before it.
 *
 * What is left only changes when the shape of the lyrics really does: lines appearing or
 * disappearing, a line becoming a section heading, a chord being added, renamed or removed.
 */
const signatureOf = (blocks) =>
  blocks
    .map((block) =>
      `${block.id}:` +
      block.lines
        .map((line) => `${line.section ? 's' : 'l'}${line.chords.map((chord) => chord.name).join(',')}`)
        .join('/'),
    )
    .join('#');

export const createLyricsEditor = ({ host, picker, getSong, liveLines, commitLines, endEdit, chordChoices }) => {
  const layers = document.createElement('div');
  layers.className = 'lyrics-layers';
  host.append(layers);

  let zoom = 1;
  let signature = null;
  let pendingFocus = null;
  let target = null; // { blockId, line, index, existing }

  const lineHeights = () => ({
    font: SONG_LAYOUT.lyricSize * zoom,
    char: charWidth() * zoom,
    chordRow: SONG_LAYOUT.chordRowHeight * zoom,
    textRow: SONG_LAYOUT.lyricLineHeight * zoom,
    section: SONG_LAYOUT.sectionHeight * zoom,
  });

  const blockOf = (blockId) => getSong().blocks.find((block) => block.id === blockId) ?? null;

  const currentLine = (blockId, lineIndex) => blockOf(blockId)?.lines[lineIndex] ?? null;

  const writeLines = (blockId, lines, { commit = false } = {}) =>
    (commit ? commitLines : liveLines)(blockId, lines);

  /* ---------- Chord picker ---------- */

  const closePicker = () => {
    picker.root.hidden = true;
    target = null;
  };

  const applyChord = (name) => {
    // Read the target before closing: closePicker() clears it.
    const slot = target;
    if (!slot) return;

    const block = blockOf(slot.blockId);
    closePicker();
    if (!block) return;

    const lines = block.lines.map((line, index) => {
      if (index !== slot.line) return line;
      const chords = line.chords.filter((chord) => chord.index !== slot.index);
      return { ...line, chords: name === '' ? chords : [...chords, { index: slot.index, name }] };
    });

    writeLines(slot.blockId, lines, { commit: true });
  };

  const openPicker = (anchor, next) => {
    target = next;

    picker.list.innerHTML = '';
    for (const name of chordChoices()) {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'picker-chip';
      button.textContent = name;
      button.addEventListener('click', () => applyChord(name));
      picker.list.append(button);
    }
    if (picker.list.childElementCount === 0) {
      const hint = document.createElement('p');
      hint.className = 'empty';
      hint.textContent = 'Aucun accord dans la chanson : saisissez-en un.';
      picker.list.append(hint);
    }

    picker.input.value = next.existing ?? '';
    picker.remove.hidden = !next.existing;
    picker.root.hidden = false;

    const box = anchor.getBoundingClientRect();
    const width = picker.root.offsetWidth;
    picker.root.style.left = `${clamp(box.left, 12, window.innerWidth - width - 12)}px`;
    picker.root.style.top = `${Math.min(box.bottom + 6, window.innerHeight - picker.root.offsetHeight - 12)}px`;
    picker.input.focus();
    picker.input.select();
  };

  picker.form.addEventListener('submit', (event) => {
    event.preventDefault();
    applyChord(picker.input.value.trim());
  });
  picker.remove.addEventListener('click', () => applyChord(''));
  picker.root.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') closePicker();
  });
  document.addEventListener('click', (event) => {
    if (!picker.root.hidden && !picker.root.contains(event.target) && !event.target.closest('.chord-lane')) {
      closePicker();
    }
  });

  /* ---------- Line editing ---------- */

  const focusLine = (blockId, line, caret) => {
    pendingFocus = { blockId, line, caret };
  };

  /**
   * A rebuild replaces every input, and the browser silently drops the caret with them.
   * Noting where it was lets `restoreFocus` put it back, so typing over a line that
   * carries a chord — which shifts the chord and therefore rebuilds — keeps working.
   */
  const captureFocus = () => {
    const active = document.activeElement;
    if (!active?.classList?.contains('lyric-text') || !layers.contains(active)) return;

    const row = active.closest('.lyric-row');
    const layer = active.closest('.lyrics-layer');
    if (!row || !layer) return;

    pendingFocus = {
      blockId: layer.dataset.block,
      line: Number(row.dataset.line),
      caret: active.selectionStart ?? active.value.length,
    };
  };

  const restoreFocus = () => {
    if (!pendingFocus) return;
    const input = layers.querySelector(
      `[data-block="${pendingFocus.blockId}"] .lyric-row[data-line="${pendingFocus.line}"] .lyric-text`,
    );
    if (input) {
      input.focus();
      const caret = clamp(pendingFocus.caret, 0, input.value.length);
      input.setSelectionRange(caret, caret);
    }
    pendingFocus = null;
  };

  /** Keeps chords glued to their word when text is inserted or removed before them. */
  const shiftChords = (chords, from, delta) =>
    chords.map((chord) => (chord.index >= from ? { ...chord, index: Math.max(0, chord.index + delta) } : chord));

  const handleInput = (blockId, lineIndex, input) => {
    const block = blockOf(blockId);
    if (!block) return;

    const previous = block.lines[lineIndex];
    const delta = input.value.length - previous.text.length;
    const caretBefore = input.selectionStart - Math.max(delta, 0);

    const lines = block.lines.map((line, index) =>
      index === lineIndex
        ? { ...line, text: input.value, chords: shiftChords(line.chords, caretBefore, delta) }
        : line,
    );
    writeLines(blockId, lines);
  };

  const splitLine = (blockId, lineIndex, caret) => {
    const block = blockOf(blockId);
    const line = block.lines[lineIndex];

    const head = { ...line, text: line.text.slice(0, caret), chords: line.chords.filter((c) => c.index <= caret) };
    const tail = {
      ...emptyLine(),
      section: false,
      text: line.text.slice(caret),
      chords: line.chords.filter((c) => c.index > caret).map((c) => ({ ...c, index: c.index - caret })),
    };

    focusLine(blockId, lineIndex + 1, 0);
    commitLines(blockId, [...block.lines.slice(0, lineIndex), head, tail, ...block.lines.slice(lineIndex + 1)]);
  };

  const mergeWithPrevious = (blockId, lineIndex) => {
    const block = blockOf(blockId);
    if (lineIndex === 0) return;

    const previous = block.lines[lineIndex - 1];
    const current = block.lines[lineIndex];
    const merged = {
      ...previous,
      text: previous.text + current.text,
      chords: [
        ...previous.chords,
        ...current.chords.map((chord) => ({ ...chord, index: chord.index + previous.text.length })),
      ],
    };

    focusLine(blockId, lineIndex - 1, previous.text.length);
    commitLines(blockId, [
      ...block.lines.slice(0, lineIndex - 1),
      merged,
      ...block.lines.slice(lineIndex + 1),
    ]);
  };

  /**
   * A paste carrying line breaks is laid out as lines rather than flattened into one, so
   * the lyrics of a whole song can be dropped on the sheet in a single gesture.
   */
  const handlePaste = (event, blockId, lineIndex, input) => {
    const text = event.clipboardData?.getData('text/plain') ?? '';
    // One line is exactly what a text input already does well; leave it to the browser.
    if (!/\r|\n/.test(text)) return;
    event.preventDefault();

    // Close the running edit first: it renders, and a render before the new lines exist
    // would drop the focus we are about to ask for.
    endEdit();
    const block = blockOf(blockId);
    if (!block) return;

    const { lines, caret } = spliceLines(
      block.lines[lineIndex],
      input.selectionStart,
      input.selectionEnd,
      text,
    );

    focusLine(blockId, lineIndex + caret.line, caret.index);
    commitLines(blockId, [
      ...block.lines.slice(0, lineIndex),
      ...lines,
      ...block.lines.slice(lineIndex + 1),
    ]);
  };

  const toggleSection = (blockId, lineIndex) => {
    const block = blockOf(blockId);
    const line = block.lines[lineIndex];
    const next = line.section ? { ...line, section: false } : { ...sectionLine(line.text || 'Couplet') };

    focusLine(blockId, lineIndex, next.text.length);
    commitLines(blockId, block.lines.map((item, index) => (index === lineIndex ? next : item)));
  };

  const handleKey = (event, blockId, lineIndex, input) => {
    const block = blockOf(blockId);

    if (event.key === 'Enter') {
      event.preventDefault();
      endEdit();
      splitLine(blockId, lineIndex, input.selectionStart);
      return;
    }
    if (event.key === 'Backspace' && input.selectionStart === 0 && input.selectionEnd === 0) {
      event.preventDefault();
      endEdit();
      mergeWithPrevious(blockId, lineIndex);
      return;
    }
    if (event.key === 'ArrowUp' && lineIndex > 0) {
      event.preventDefault();
      focusLine(blockId, lineIndex - 1, input.selectionStart);
      restoreFocus();
      return;
    }
    if (event.key === 'ArrowDown' && lineIndex < block.lines.length - 1) {
      event.preventDefault();
      focusLine(blockId, lineIndex + 1, input.selectionStart);
      restoreFocus();
      return;
    }
    if (event.key === 'Escape') input.blur();
    if (event.key === 'Tab' && event.shiftKey) {
      event.preventDefault();
      endEdit();
      toggleSection(blockId, lineIndex);
    }
  };

  /* ---------- Building ---------- */

  const buildRow = (blockId, line, lineIndex, metrics) => {
    const row = document.createElement('div');
    row.className = `lyric-row${line.section ? ' section' : ''}`;
    row.dataset.line = String(lineIndex);
    row.style.height = `${lineBandHeight(line) * zoom}px`;

    if (!line.section) {
      const lane = document.createElement('div');
      lane.className = 'chord-lane';
      lane.style.height = `${metrics.chordRow}px`;
      lane.style.fontSize = `${metrics.font}px`;

      line.chords.forEach((chord, at) => {
        const chip = document.createElement('span');
        chip.className = 'chord-chip';
        chip.textContent = chord.name;
        chip.style.left = `${chord.index * metrics.char}px`;
        chip.style.lineHeight = `${metrics.chordRow}px`;

        // Typing before a chord slides it along without rebuilding the row, so its offset
        // has to be read from the model rather than from the value captured here.
        const slot = () => {
          const current = currentLine(blockId, lineIndex)?.chords[at];
          return current ? { blockId, line: lineIndex, index: current.index, existing: current.name } : null;
        };

        chip.addEventListener('click', (event) => {
          event.stopPropagation();
          const next = slot();
          if (next) openPicker(chip, next);
        });
        chip.addEventListener('contextmenu', (event) => {
          event.preventDefault();
          event.stopPropagation();
          target = slot();
          if (target) applyChord('');
        });
        lane.append(chip);
      });

      lane.addEventListener('click', (event) => {
        if (event.target !== lane) return;
        const words = currentLine(blockId, lineIndex)?.text ?? '';
        const offset = event.clientX - lane.getBoundingClientRect().left;
        const column = wordStartAt(words, Math.round(offset / metrics.char));
        openPicker(lane, { blockId, line: lineIndex, index: column, existing: null });
      });
      row.append(lane);
    }

    const input = document.createElement('input');
    input.type = 'text';
    input.className = 'lyric-text';
    input.spellcheck = false;
    input.value = line.text;
    input.style.height = `${line.section ? metrics.section : metrics.textRow}px`;
    input.style.lineHeight = `${line.section ? metrics.section : metrics.textRow}px`;
    input.style.fontSize = `${line.section ? 13 * zoom : metrics.font}px`;
    if (!line.section) input.style.fontFamily = MONO;

    input.addEventListener('input', () => handleInput(blockId, lineIndex, input));
    input.addEventListener('paste', (event) => handlePaste(event, blockId, lineIndex, input));
    input.addEventListener('keydown', (event) => handleKey(event, blockId, lineIndex, input));
    input.addEventListener('blur', () => endEdit());
    row.append(input);

    return row;
  };

  const rebuild = (positions) => {
    const song = getSong();
    const metrics = lineHeights();
    layers.innerHTML = '';

    for (const position of positions.filter((entry) => entry.type === 'lyrics')) {
      const block = song.blocks.find((entry) => entry.id === position.id);
      if (!block) continue;

      const layer = document.createElement('div');
      layer.className = 'lyrics-layer';
      layer.dataset.block = block.id;
      block.lines.forEach((line, index) => layer.append(buildRow(block.id, line, index, metrics)));
      layers.append(layer);
    }
  };

  /**
   * Brings the rows back in step with the model without rebuilding them: the chords slide
   * to their new offset as words are typed before them, and the words themselves are
   * written back when something other than the keyboard changed them — an undo, a redo or
   * an import. Chips are built in `line.chords` order, which the model keeps sorted.
   */
  const refreshLines = (block, layer, metrics) => {
    block.lines.forEach((line, index) => {
      const row = layer.querySelector(`.lyric-row[data-line="${index}"]`);
      if (!row) return;

      const input = row.querySelector('.lyric-text');
      if (input && input.value !== line.text) {
        const caret = input === document.activeElement ? clamp(input.selectionStart, 0, line.text.length) : null;
        input.value = line.text;
        if (caret !== null) input.setSelectionRange(caret, caret);
      }

      for (const [at, chip] of [...row.querySelectorAll('.chord-chip')].entries()) {
        const chord = line.chords[at];
        if (chord) chip.style.left = `${chord.index * metrics.char}px`;
      }
    });
  };

  const place = (positions) => {
    const song = getSong();
    const metrics = lineHeights();

    for (const position of positions.filter((entry) => entry.type === 'lyrics')) {
      const layer = layers.querySelector(`[data-block="${position.id}"]`);
      const block = song.blocks.find((entry) => entry.id === position.id);
      if (!layer || !block) continue;

      layer.style.left = `${position.x * zoom}px`;
      layer.style.top = `${position.y * zoom}px`;
      layer.style.width = `${position.width * zoom}px`;
      refreshLines(block, layer, metrics);
    }
  };

  return {
    sync: (positions, nextZoom) => {
      const song = getSong();
      const blocks = song.blocks.filter((block) => block.type === 'lyrics');
      const next = `${nextZoom}::${signatureOf(blocks)}`;

      if (next !== signature) {
        // An explicit request (a split, a merge) knows better than where the caret is now.
        if (!pendingFocus) captureFocus();
        zoom = nextZoom;
        signature = next;
        rebuild(positions);
      }
      zoom = nextZoom;
      place(positions);
      restoreFocus();
    },
    focusBlock: (blockId) => {
      focusLine(blockId, 0, 0);
      restoreFocus();
    },
    closePicker,
  };
};
