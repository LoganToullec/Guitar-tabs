import test from 'node:test';
import assert from 'node:assert/strict';

import { createChord, cycleMarker, toggleNote } from '../src/renderer/js/chord-model.js';
import { createTab } from '../src/renderer/js/tab-model.js';
import {
  addBlock,
  addChordDiagram,
  blockAt,
  createLyricsBlock,
  createSong,
  createStrumBlock,
  createTabBlock,
  cycleStroke,
  isBlank,
  missingChordDiagrams,
  moveBlock,
  parseSong,
  removeBlock,
  removeChordDiagram,
  setBpm,
  setLyricsLines,
  setSubdivision,
  setTitle,
  unusedChordDiagrams,
  updateBlock,
} from '../src/renderer/js/song-model.js';
import {
  chordNamesInLines,
  longestLineLength,
  parseLyrics,
  wordStartAt,
} from '../src/renderer/js/lyrics.js';
import { chordKey } from '../src/renderer/js/chord-name.js';

/** Am shape: low E muted, A open, D 2, G 2, B 1, e open. */
const amChord = () => {
  const muted = cycleMarker(cycleMarker(createChord(), 0), 0);
  return [[2, 1], [3, 1], [4, 0]].reduce((chord, [string, row]) => toggleNote(chord, string, row), muted);
};

const named = (name) => ({ ...createChord(), nameOverride: name });
const lyricsFrom = (text) => createLyricsBlock(parseLyrics(text));

test('une chanson neuve est vide', () => {
  assert.equal(isBlank(createSong()), true);
});

test('ajouter un accord crée une étagère puis la complète', () => {
  const first = addChordDiagram(createSong(), createChord());
  assert.equal(first.blocks.length, 1);
  assert.equal(first.blocks[0].type, 'chords');

  const second = addChordDiagram(first, toggleNote(createChord(), 0, 0));
  assert.equal(second.blocks.length, 1);
  assert.equal(second.blocks[0].chords.length, 2);
});

test('retirer un accord ne touche pas les autres', () => {
  const song = addChordDiagram(addChordDiagram(createSong(), createChord()), toggleNote(createChord(), 2, 1));
  const shelf = song.blocks[0].id;
  const next = removeChordDiagram(song, shelf, 0);

  assert.equal(blockAt(next, shelf).chords.length, 1);
  assert.deepEqual(blockAt(next, shelf).chords[0].dots, [{ string: 2, row: 1 }]);
});

test('les blocs se réordonnent et se suppriment', () => {
  const strum = createStrumBlock();
  const lyrics = lyricsFrom('la la');
  const song = addBlock(addBlock(createSong(), strum), lyrics);

  assert.deepEqual(
    moveBlock(song, lyrics.id, -1).blocks.map((block) => block.id),
    [lyrics.id, strum.id],
  );
  assert.equal(moveBlock(song, strum.id, -1), song);
  assert.equal(removeBlock(song, strum.id).blocks.length, 1);
});

/* ---------- Rythmique ---------- */

test('les coups de gratte tournent dans les deux sens', () => {
  const strum = createStrumBlock();
  const song = addBlock(createSong(), strum);

  const down = cycleStroke(song, strum.id, 0, 1);
  assert.equal(blockAt(down, strum.id).strokes[0], 'd');
  assert.equal(blockAt(cycleStroke(down, strum.id, 0, 1), strum.id).strokes[0], 'u');
  assert.equal(blockAt(cycleStroke(song, strum.id, 0, -1), strum.id).strokes[0], 'x');
});

test('passer en doubles croches conserve les coups déjà posés', () => {
  const strum = createStrumBlock();
  const song = cycleStroke(addBlock(createSong(), strum), strum.id, 2, 1);
  const wider = setSubdivision(song, strum.id, 16);

  assert.equal(blockAt(wider, strum.id).strokes.length, 16);
  assert.equal(blockAt(wider, strum.id).strokes[2], 'd');
});

test('le tempo reste dans ses bornes', () => {
  const strum = createStrumBlock();
  const song = addBlock(createSong(), strum);

  assert.equal(blockAt(setBpm(song, strum.id, -50), strum.id).bpm, 0);
  assert.equal(blockAt(setBpm(song, strum.id, 9000), strum.id).bpm, 320);
});

/* ---------- Paroles ---------- */

test('les marqueurs d accord sortent du texte avec leur position', () => {
  const [line] = parseLyrics('When you were [G]here before');

  assert.equal(line.section, false);
  assert.equal(line.text, 'When you were here before');
  assert.deepEqual(line.chords, [{ index: 14, name: 'G' }]);
});

test('un crochet seul sur sa ligne est une section', () => {
  const [heading] = parseLyrics('[Verse 1]');

  assert.equal(heading.section, true);
  assert.equal(heading.text, 'Verse 1');
  assert.deepEqual(heading.chords, []);
});

test('plusieurs accords se placent aux bons décalages', () => {
  const [line] = parseLyrics('[C]Hello [G]world');

  assert.equal(line.text, 'Hello world');
  assert.deepEqual(line.chords, [
    { index: 0, name: 'C' },
    { index: 6, name: 'G' },
  ]);
});

test('chordNamesInLines liste les accords sans doublon', () => {
  assert.deepEqual(chordNamesInLines(parseLyrics('[G]a [B]b\n[G]c')), ['G', 'B']);
});

test('la largeur tient compte de la ligne d accords', () => {
  assert.equal(longestLineLength(parseLyrics('ab[Gmaj7]')), 7);
});

test('wordStartAt cale un accord sur le début du mot', () => {
  const text = 'When you were here';

  assert.equal(wordStartAt(text, 16), 14);
  assert.equal(wordStartAt(text, 14), 14);
  assert.equal(wordStartAt(text, 0), 0);
  assert.equal(wordStartAt(text, 999), 14);
});

test('setLyricsLines normalise les lignes et n en laisse jamais zéro', () => {
  const block = createLyricsBlock();
  const song = setLyricsLines(addBlock(createSong(), block), block.id, []);

  assert.deepEqual(blockAt(song, block.id).lines, [{ text: '', section: false, chords: [] }]);
});

test('un accord ne peut pas dépasser la fin de sa ligne', () => {
  const block = createLyricsBlock();
  const song = setLyricsLines(addBlock(createSong(), block), block.id, [
    { text: 'abc', chords: [{ index: 99, name: 'Am' }, { index: 1, name: '' }] },
  ]);

  assert.deepEqual(blockAt(song, block.id).lines[0].chords, [{ index: 3, name: 'Am' }]);
});

/* ---------- Contrôle des accords ---------- */

test('un accord des paroles sans diagramme est signalé', () => {
  const song = addBlock(
    addChordDiagram(createSong(), named('Am')),
    lyricsFrom('[Am]Hello [G]world\n[Em]again'),
  );

  assert.deepEqual(missingChordDiagrams(song), ['G', 'Em']);
});

test('aucun manquant quand tous les diagrammes sont là', () => {
  const withChords = addChordDiagram(addChordDiagram(createSong(), named('Am')), named('G'));
  const song = addBlock(withChords, lyricsFrom('[Am]a [G]b [Am]c'));

  assert.deepEqual(missingChordDiagrams(song), []);
});

test('les enharmoniques comptent pour le même accord', () => {
  const song = addBlock(addChordDiagram(createSong(), named('Bb')), lyricsFrom('[A#]yes'));

  assert.deepEqual(missingChordDiagrams(song), []);
});

test('un accord non reconnu ne compte pas comme diagramme', () => {
  const song = addBlock(addChordDiagram(createSong(), createChord()), lyricsFrom('[Am]x'));

  assert.deepEqual(missingChordDiagrams(song), ['Am']);
});

test('un diagramme détecté automatiquement compte aussi', () => {
  const song = addBlock(addChordDiagram(createSong(), amChord()), lyricsFrom('[Am]x'));

  assert.deepEqual(missingChordDiagrams(song), []);
});

test('sans paroles il n y a rien à signaler', () => {
  assert.deepEqual(missingChordDiagrams(addChordDiagram(createSong(), named('Am'))), []);
});

test('un diagramme jamais appelé par les paroles est repéré', () => {
  const withChords = addChordDiagram(addChordDiagram(createSong(), named('Am')), named('F#m'));
  const song = addBlock(withChords, lyricsFrom('[Am]seulement'));

  assert.deepEqual(unusedChordDiagrams(song), ['F#m']);
  assert.deepEqual(unusedChordDiagrams(addChordDiagram(createSong(), named('Am'))), []);
});

test('chordKey rapproche les enharmoniques mais distingue les suffixes', () => {
  assert.equal(chordKey('A#'), chordKey('Bb'));
  assert.equal(chordKey('C#m7'), chordKey('Dbm7'));
  assert.notEqual(chordKey('Am'), chordKey('Amaj7'));
  assert.notEqual(chordKey('C'), chordKey('Cm'));
});

/* ---------- Persistance ---------- */

test('parseSong rétablit une chanson enregistrée', () => {
  const strum = createStrumBlock('Refrain');
  const withBlocks = addBlock(
    addBlock(addChordDiagram(createSong(), createChord()), strum),
    createTabBlock(createTab()),
  );
  const song = setTitle(
    addBlock(cycleStroke(withBlocks, strum.id, 1, 1), lyricsFrom('[Am]Hello')),
    'Creep',
  );

  assert.deepEqual(parseSong(JSON.parse(JSON.stringify(song))), song);
});

test('parseSong ignore les blocs inconnus', () => {
  const song = parseSong({
    title: 'X',
    artist: 42,
    blocks: [{ type: 'inconnu' }, { type: 'lyrics', lines: [{ text: 'ok' }] }, null],
  });

  assert.equal(song.artist, '');
  assert.equal(song.blocks.length, 1);
  assert.deepEqual(song.blocks[0].lines, [{ text: 'ok', section: false, chords: [] }]);
});

test('parseSong convertit des paroles enregistrées au format texte', () => {
  const song = parseSong({
    blocks: [{ id: 'l1', type: 'lyrics', text: '[Couplet]\nHello [G]world' }],
  });

  assert.deepEqual(song.blocks[0].lines, [
    { text: 'Couplet', section: true, chords: [] },
    { text: 'Hello world', section: false, chords: [{ index: 6, name: 'G' }] },
  ]);
});

test('updateBlock ne modifie que le bloc visé', () => {
  const lyrics = lyricsFrom('a');
  const strum = createStrumBlock();
  const song = addBlock(addBlock(createSong(), lyrics), strum);
  const next = updateBlock(song, lyrics.id, { lines: [{ text: 'b', section: false, chords: [] }] });

  assert.equal(blockAt(next, lyrics.id).lines[0].text, 'b');
  assert.equal(blockAt(next, strum.id), blockAt(song, strum.id));
});
