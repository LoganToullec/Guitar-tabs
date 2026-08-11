import test from 'node:test';
import assert from 'node:assert/strict';

import {
  absoluteColumn,
  addMeasure,
  chordAt,
  clearChord,
  clearNote,
  createTab,
  insertColumn,
  isBlank,
  isChordText,
  isFretText,
  measureSteps,
  nextOnString,
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
  totalColumns,
} from '../src/renderer/js/tab-model.js';

test('une tablature neuve est vide', () => {
  const tab = createTab();
  assert.equal(isBlank(tab), true);
  assert.equal(tab.measures.length, 2);
  assert.equal(totalColumns(tab), 16);
});

/* ---------- Mesures de longueur libre ---------- */

test('chaque mesure a sa propre longueur', () => {
  const tab = setMeasureSteps(setMeasureSteps(createTab(), 0, 5), 1, 13);

  assert.equal(measureSteps(tab, 0), 5);
  assert.equal(measureSteps(tab, 1), 13);
  assert.equal(totalColumns(tab), 18);
});

test('la colonne absolue suit les longueurs de chaque mesure', () => {
  const tab = setMeasureSteps(createTab(), 0, 3);

  assert.equal(absoluteColumn(tab, 0, 2), 2);
  assert.equal(absoluteColumn(tab, 1, 0), 3);
});

test('raccourcir une mesure ne touche qu à son contenu', () => {
  const filled = setChord(setFret(setFret(createTab(), 0, 6, 0, '7'), 1, 6, 0, '5'), 0, 7, 'Am');
  const tab = setMeasureSteps(filled, 0, 4);

  assert.equal(noteAt(tab, 0, 6, 0), null);
  assert.equal(chordAt(tab, 0, 7), null);
  assert.equal(noteAt(tab, 1, 6, 0).fret, '5');
});

test('ajouter une mesure reprend la longueur de la dernière', () => {
  const tab = addMeasure(setMeasureSteps(createTab(), 1, 12));

  assert.equal(tab.measures.length, 3);
  assert.equal(measureSteps(tab, 2), 12);
});

test('supprimer une mesure emporte son contenu', () => {
  const tab = removeMeasure(setFret(setFret(createTab(), 1, 0, 0, '3'), 0, 0, 0, '5'));

  assert.equal(tab.measures.length, 1);
  assert.equal(tab.notes.length, 1);
  assert.equal(noteAt(tab, 0, 0, 0).fret, '5');
});

test('la dernière mesure ne peut pas être supprimée', () => {
  const single = removeMeasure(createTab());
  assert.equal(removeMeasure(single).measures.length, 1);
});

test('insérer une case décale ce qui suit dans la mesure', () => {
  const filled = setChord(setFret(setFret(createTab(), 0, 2, 0, '3'), 0, 5, 1, '7'), 0, 5, 'G');
  const tab = insertColumn(filled, 0, 3);

  assert.equal(measureSteps(tab, 0), 9);
  assert.equal(noteAt(tab, 0, 2, 0).fret, '3');
  assert.equal(noteAt(tab, 0, 6, 1).fret, '7');
  assert.equal(chordAt(tab, 0, 6).text, 'G');
});

test('supprimer une case retire son contenu et resserre la mesure', () => {
  const filled = setFret(setFret(createTab(), 0, 3, 0, '3'), 0, 5, 1, '7');
  const tab = removeColumn(filled, 0, 3);

  assert.equal(measureSteps(tab, 0), 7);
  assert.equal(noteAt(tab, 0, 3, 0), null);
  assert.equal(noteAt(tab, 0, 4, 1).fret, '7');
});

/* ---------- Notes et techniques ---------- */

test('poser une case ne modifie pas la tablature d origine', () => {
  const tab = createTab();
  const next = setFret(tab, 0, 3, 0, '7');

  assert.equal(tab.notes.length, 0);
  assert.equal(noteAt(next, 0, 3, 0).fret, '7');
});

test('une case vide supprime la note', () => {
  const tab = setFret(setFret(createTab(), 0, 1, 2, '5'), 0, 1, 2, '');
  assert.equal(noteAt(tab, 0, 1, 2), null);
});

test('seules les cases valides sont acceptées', () => {
  assert.equal(isFretText('0'), true);
  assert.equal(isFretText('12'), true);
  assert.equal(isFretText('x'), true);
  assert.equal(isFretText('123'), false);
  assert.equal(isFretText('h'), false);
});

test('les liaisons se posent et se retirent en basculant', () => {
  const placed = setFret(createTab(), 0, 0, 0, '7');
  const hammer = setLink(placed, 0, 0, 0, 'h');
  assert.equal(noteAt(hammer, 0, 0, 0).link, 'h');

  assert.equal(setLink(hammer, 0, 0, 0, 'h').notes[0].link, null);
  assert.equal(setLink(hammer, 0, 0, 0, 'p').notes[0].link, 'p');
});

test('une liaison inconnue ou sans note est ignorée', () => {
  const empty = createTab();
  assert.equal(setLink(empty, 0, 0, 0, 'h'), empty);

  const placed = setFret(empty, 0, 0, 0, '7');
  assert.equal(setLink(placed, 0, 0, 0, 'zzz'), placed);
});

test('les décorations de note basculent', () => {
  const placed = setFret(createTab(), 0, 0, 0, '7');
  const ghost = toggleFlag(placed, 0, 0, 0, 'ghost');

  assert.equal(noteAt(ghost, 0, 0, 0).ghost, true);
  assert.equal(toggleFlag(ghost, 0, 0, 0, 'ghost').notes[0].ghost, false);
  assert.equal(toggleFlag(placed, 0, 0, 0, 'inconnu'), placed);
});

test('une décoration sans note est ignorée', () => {
  const empty = createTab();
  assert.equal(toggleFlag(empty, 0, 0, 0, 'ghost'), empty);
});

test('la note suivante sur la corde traverse les mesures', () => {
  const tab = setFret(setFret(setFret(createTab(), 0, 6, 3, '7'), 1, 1, 3, '9'), 1, 1, 0, '3');
  const source = noteAt(tab, 0, 6, 3);

  assert.equal(nextOnString(tab, source).fret, '9');
  assert.equal(nextOnString(tab, noteAt(tab, 1, 1, 3)), null);
});

test('effacer une note laisse les autres cordes intactes', () => {
  const tab = clearNote(setFret(setFret(createTab(), 0, 0, 0, '3'), 0, 0, 1, '5'), 0, 0, 0);

  assert.equal(noteAt(tab, 0, 0, 0), null);
  assert.equal(noteAt(tab, 0, 0, 1).fret, '5');
});

/* ---------- Accords ---------- */

test('un accord se pose sur n importe quelle colonne', () => {
  const tab = setChord(setChord(createTab(), 0, 0, 'Am'), 0, 5, 'Fmaj7');

  assert.equal(chordAt(tab, 0, 0).text, 'Am');
  assert.equal(chordAt(tab, 0, 5).text, 'Fmaj7');
  assert.equal(chordAt(tab, 0, 3), null);
  assert.equal(isBlank(tab), false);
});

test('les libellés d accord acceptent les suffixes usuels', () => {
  assert.equal(isChordText('Cmaj7'), true);
  assert.equal(isChordText('F#m7b5'), true);
  assert.equal(isChordText('C/E'), true);
  assert.equal(isChordText('C 7'), false);
});

test('clearChord vide la colonne sans toucher aux notes', () => {
  const tab = clearChord(setChord(setFret(createTab(), 0, 2, 0, '3'), 0, 2, 'G'), 0, 2);

  assert.equal(chordAt(tab, 0, 2), null);
  assert.equal(noteAt(tab, 0, 2, 0).fret, '3');
});

/* ---------- Persistance ---------- */

test('écrire hors des mesures déclarées est sans effet', () => {
  const tab = createTab();
  assert.equal(setFret(tab, 5, 0, 0, '3'), tab);
  assert.equal(setFret(tab, 0, 99, 0, '3'), tab);
  assert.equal(setChord(tab, 5, 0, 'G'), tab);
});

test('parseTab rétablit une tablature enregistrée', () => {
  const notes = setLink(setFret(setFret(createTab(), 1, 0, 0, '0'), 0, 2, 3, '7'), 0, 2, 3, 'h');
  const decorated = toggleFlag(notes, 0, 2, 3, 'palmMute');
  const tab = setTitle(setChord(setMeasureSteps(decorated, 1, 11), 1, 4, 'Am7'), 'Intro');

  assert.deepEqual(parseTab(JSON.parse(JSON.stringify(tab))), tab);
});

test('parseTab neutralise des données incohérentes', () => {
  const tab = parseTab({
    measures: [{ steps: 999 }, { steps: 0 }],
    barsPerLine: 0,
    title: 42,
    notes: [
      { bar: 0, step: 0, string: 0, fret: '7', link: 'h', ghost: true },
      { bar: 0, step: 1, string: 42, fret: '99999' },
      { bar: 9, step: 0, string: 0, fret: '3' },
      { bar: 1, step: 40, string: 0, fret: '3' },
      { bar: 0, step: 2, string: 0, fret: '5', link: 'zzz', harmonic: 'oui' },
    ],
    chords: [
      { bar: 0, step: 0, text: 'Am' },
      { bar: 0, step: 1, text: 'oops!' },
      { bar: 5, step: 0, text: 'G' },
    ],
  });

  assert.equal(tab.measures.length, 2);
  assert.equal(measureSteps(tab, 0), 32);
  assert.equal(measureSteps(tab, 1), 8); // 0 est illisible : longueur par défaut
  assert.equal(tab.barsPerLine, 1);
  assert.equal(tab.title, '');

  assert.deepEqual(
    tab.notes.map((note) => [note.bar, note.step, note.string, note.fret, note.link, note.ghost, note.harmonic]),
    [
      [0, 0, 0, '7', 'h', true, false],
      [0, 2, 0, '5', null, false, false],
    ],
  );
  assert.deepEqual(tab.chords, [{ bar: 0, step: 0, text: 'Am' }]);
});

test('parseTab convertit une tablature au format v1', () => {
  const tab = parseTab({
    version: 1,
    kind: 'tab',
    title: 'Riff',
    bars: 2,
    stepsPerBar: 4,
    barsPerLine: 2,
    notes: [
      { string: 0, step: 1, text: '7h9' },
      { string: 3, step: 5, text: '12' },
    ],
    chords: [{ step: 4, text: 'G' }],
  });

  assert.equal(tab.version, 2);
  assert.equal(tab.title, 'Riff');
  assert.deepEqual(tab.measures, [{ steps: 4 }, { steps: 4 }]);
  assert.equal(noteAt(tab, 0, 1, 0).fret, '7');
  assert.equal(noteAt(tab, 0, 1, 0).link, 'h');
  assert.equal(noteAt(tab, 1, 1, 3).fret, '12');
  assert.equal(chordAt(tab, 1, 0).text, 'G');
});

test('les mesures par ligne restent dans leurs bornes', () => {
  assert.equal(setBarsPerLine(createTab(), 0).barsPerLine, 1);
  assert.equal(setBarsPerLine(createTab(), 99).barsPerLine, 8);
});
