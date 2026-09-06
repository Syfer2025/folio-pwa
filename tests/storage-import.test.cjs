const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const crypto = require('node:crypto').webcrypto;
const fflate = require('../vendor/fflate.min.js');

function environment(options = {}) {
  const persisted = options.persisted || new Map(), events = [];
  const context = vm.createContext({ TextDecoder, TextEncoder, Uint8Array, Uint32Array, DataView, URL, setTimeout, crypto, fflate,
    localStorage: { getItem: key => persisted.get(key) || null, setItem: (key, value) => { if (options.failWrites) throw new Error('QuotaExceededError'); persisted.set(key, value); } },
    CustomEvent: class { constructor(type, value) { this.type = type; this.detail = value.detail; } },
    dispatchEvent: event => events.push(event), addEventListener() {}
  });
  for (const filename of ['storage.js', 'import.js']) vm.runInContext(fs.readFileSync(path.join(__dirname, '..', filename), 'utf8'), context);
  return { store: context.FolioStore, importer: context.FolioImport, persisted, events };
}
function file(name, source) { const bytes = typeof source === 'string' ? new TextEncoder().encode(source) : source; return { name, size: bytes.length, arrayBuffer: async () => bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) }; }
function basicBook(overrides = {}) { return { id: 'test', t: 'Um livro', a: 'Autora', source: 'import', full: true, chapters: [{ title: 'Começo', paragraphs: ['Texto de um livro.'] }], ...overrides }; }
function serial(value) { return JSON.parse(JSON.stringify(value)); }

test('first run has empty local data and snapshots cannot mutate saved state', () => {
  const { store } = environment(); const first = store.getState();
  assert.deepEqual(serial(first.library), {}); assert.equal(first.notes.length, 0);
  first.preferences.goal = 70; assert.equal(store.getState().preferences.goal, 15);
  store.update(state => { state.preferences.goal = 25; }); assert.equal(store.getState().preferences.goal, 25);
});
test('quota failure preserves the previous in-memory state and emits a storage error', () => {
  const { store, events } = environment({ failWrites: true });
  assert.throws(() => store.update(state => { state.preferences.goal = 30; }), /Quota/);
  assert.equal(store.getState().preferences.goal, 15);
  assert.equal(events.at(-1).type, 'folio:storage-error');
  assert.equal(events.some(event => event.type === 'folio:change'), false);
});
test('a synchronous update rebases on another tab and refuses to overwrite damaged state', () => {
  const persisted = new Map(); const first = environment({ persisted }).store, second = environment({ persisted }).store;
  first.update(state => { state.preferences.goal = 30; });
  second.update(state => { state.preferences.fontSize = 25; });
  assert.equal(second.getState().preferences.goal, 30);
  persisted.set('folio.state.v1', '{damaged');
  assert.throws(() => second.update(state => { state.preferences.goal = 2; }));
  assert.equal(persisted.get('folio.state.v1'), '{damaged');
});
test('state rejects prototype keys, invalid preferences and impossible activity dates', () => {
  const { store } = environment();
  let value = store.getState(); value.library = JSON.parse('{"__proto__":{}}');
  assert.throws(() => store.validateState(value), /Identificador/);
  value = store.getState(); value.preferences.fontSize = -2; assert.throws(() => store.validateState(value), /Número/);
  value = store.getState(); value.activity['2026-02-30'] = 10; assert.throws(() => store.validateState(value), /Dia/);
  value = store.getState(); value.preferences.theme = 'javascript:alert(1)'; assert.throws(() => store.validateState(value), /Opção/);
});
test('bookmark and selection ranges survive serialization; unknown executable fields do not', () => {
  const { store } = environment(); const state = store.getState();
  state.library.test = { shelf: 'reading', progress: 0.3, position: { chapter: 0, paragraph: 3 }, updatedAt: '2026-09-06T12:00:00Z', offline: true, bookmark: { chapter: 0, paragraph: 2, createdAt: '2026-09-06T12:00:00Z' } };
  state.notes.push({ id: 'n1', bookId: 'test', bookTitle: 'Livro', chapter: 0, paragraph: 2, endParagraph: 3, quote: 'Uma frase.', text: '', color: 'yellow', createdAt: '2026-09-06T12:00:00Z', ranges: [{ paragraph: 2, start: 0, end: 4 }], html: '<script>attack()</script>' });
  const clean = store.validateState(state); assert.equal(clean.library.test.bookmark.paragraph, 2);
  assert.equal(clean.notes[0].ranges[0].end, 4); assert.equal('html' in clean.notes[0], false);
});
test('backup validation catches duplicate books and repairs missing offline payload flags', () => {
  const { store } = environment(); const state = store.getState();
  state.library.missing = { offline: true };
  const backup = { format: 'folio-backup', version: 1, state, books: [] };
  assert.equal(store.validateBackup(backup).state.library.missing.offline, false);
  backup.books = [basicBook(), basicBook()]; assert.throws(() => store.validateBackup(backup), /repetidos/);
  backup.version = 99; assert.throws(() => store.validateBackup(backup), /compatível/);
});
test('book validation strips untrusted metadata and checks content bounds', () => {
  const { store } = environment(); const clean = store.validateBook(basicBook({ cover: 'javascript:alert(1)', html: '<iframe />' }));
  assert.equal(clean.wordCount, 4); assert.equal('cover' in clean, false); assert.equal('html' in clean, false);
  assert.throws(() => store.validateBook(basicBook({ chapters: [] })), /capítulos/);
  assert.throws(() => store.validateBook(basicBook({ sourceUrl: 'javascript:alert(1)' })), /HTTPS/);
  assert.throws(() => store.validateBook(basicBook({ chapters: [{ paragraphs: ['x'.repeat(120001)] }] })), /longo/);
});
test('TXT import preserves Portuguese accents, detects chapters and deduplicates by content', async () => {
  const { importer } = environment(); const source = 'Capítulo I\r\n\r\nOlá, coração.\r\nContinua a história.\r\n\r\nCapítulo II\r\n\r\nOutro começo.';
  const book = await importer.read(file('Meu_livro.txt', source)); const duplicate = await importer.read(file('outro-nome.txt', source));
  assert.equal(book.t, 'Meu livro'); assert.equal(book.chapters.length, 2);
  assert.equal(book.chapters[0].paragraphs[0], 'Olá, coração. Continua a história.');
  assert.equal(book.source, 'import'); assert.equal(book.full, true); assert.equal(book.id, duplicate.id);
});
test('JSON book import uses documented format, ignores supplied IDs and rejects backups', async () => {
  const { importer } = environment();
  const book = await importer.read(file('livro.json', JSON.stringify({ format: 'folio-book', version: 1, book: { id: '__proto__', title: 'Livro meu', author: 'Joana', year: 2026, chapters: [{ title: 'Um', paragraphs: ['<script>isto permanece texto</script>'] }] } })));
  assert.equal(book.t, 'Livro meu'); assert.equal(book.a, 'Joana'); assert.match(book.id, /^imp-/); assert.match(book.chapters[0].paragraphs[0], /<script>/);
  await assert.rejects(importer.read(file('backup.json', '{"format":"folio-backup","version":1}')), /Backups/);
  for (const full of ['false', null, 1]) await assert.rejects(importer.read(file('bad.json', JSON.stringify({ format: 'folio-book', version: 1, book: { ...basicBook(), full } }))), /full/);
  const excerpt = await importer.read(file('excerpt.json', JSON.stringify({ format: 'folio-book', version: 1, book: basicBook({ full: false }) })));
  assert.equal(excerpt.full, false);
});
test('import rejects unsupported formats, blank content, binary TXT and declared file overflow', async () => {
  const { importer } = environment();
  await assert.rejects(importer.read(file('livro.pdf', 'fake PDF')), /Formato/);
  await assert.rejects(importer.read(file('livro.txt', '   ')), /vazio/);
  await assert.rejects(importer.read(file('livro.txt', 'a\0b')), /binário/);
  await assert.rejects(importer.read({ name: 'livro.epub', size: 51 * 1024 * 1024, arrayBuffer: async () => { throw new Error('must never read'); } }), /50 MB/);
});
test('import cancellation exits without returning a partially parsed book', async () => {
  const { importer } = environment();
  await assert.rejects(importer.read(file('book.txt', 'Um texto'), { signal: { aborted: true } }), { name: 'AbortError' });
  const signal = { aborted: false };
  await assert.rejects(importer.read(file('book.txt', 'Um texto'), { signal, onProgress: () => { signal.aborted = true; } }), { name: 'AbortError' });
});
test('ZIP inspection validates paths, encryption, directory integrity and expansion caps before extraction', () => {
  const { importer } = environment();
  const zip = fflate.zipSync({ mimetype: fflate.strToU8('application/epub+zip'), 'OEBPS/chapter.xhtml': fflate.strToU8('<html/>') });
  assert.equal(importer.inspectZip(zip).size, 2);
  const traversal = fflate.zipSync({ '../escape.xhtml': fflate.strToU8('bad') });
  assert.throws(() => importer.inspectZip(traversal), /inseguro/);
  const encrypted = zip.slice(); const view = new DataView(encrypted.buffer); let central = 0;
  while (view.getUint32(central, true) !== 0x02014b50) central++;
  view.setUint16(central + 8, 1, true); assert.throws(() => importer.inspectZip(encrypted), /criptografado/);
  const bomb = zip.slice(); new DataView(bomb.buffer).setUint32(central + 24, 200 * 1024 * 1024, true);
  assert.throws(() => importer.inspectZip(bomb), /expansão segura/);
  assert.throws(() => importer.inspectZip(zip.subarray(0, zip.length - 3)), /incompleta/);
});
