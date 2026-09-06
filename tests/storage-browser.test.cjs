const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
const { chromium } = require('playwright');
const fflate = require('../vendor/fflate.min.js');

let browser, server, origin;
before(async () => {
  const files = new Map(['storage.js', 'import.js', 'vendor/fflate.min.js'].map(name => ['/' + name, fs.readFileSync(path.join(__dirname, '..', name))]));
  server = http.createServer((request, response) => {
    response.setHeader('Content-Type', files.has(request.url) ? 'text/javascript' : 'text/html');
    response.end(files.get(request.url) || '<!doctype html><html><body><script src="/storage.js"></script><script src="/vendor/fflate.min.js"></script><script src="/import.js"></script></body></html>');
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  origin = 'http://127.0.0.1:' + server.address().port;
  browser = await chromium.launch({ headless: true, ...(process.env.PLAYWRIGHT_CHANNEL ? { channel: process.env.PLAYWRIGHT_CHANNEL } : process.platform === 'win32' ? { channel: 'msedge' } : {}) });
});
after(async () => { if (browser) await browser.close(); if (server) await new Promise(resolve => server.close(resolve)); });
async function isolated(run) {
  const context = await browser.newContext();
  try { const page = await context.newPage(); await page.goto(origin); await page.evaluate(() => FolioStore.ready); await run(page, context); }
  finally { await context.close(); }
}
function book(id = 'example') { return { id, t: 'Leitura de teste', source: 'import', full: true, chapters: [{ title: 'Início', paragraphs: ['Primeiro parágrafo.', 'Segundo parágrafo.'] }] }; }

test('IndexedDB import deduplicates, preserves reading state and removes data together', () => isolated(async page => {
  const result = await page.evaluate(async value => {
    await FolioStore.saveImportedBook(value);
    FolioStore.update(state => {
      state.library[value.id].shelf = 'reading'; state.library[value.id].progress = .5;
      state.notes.push({ id: 'note1', bookId: value.id, chapter: 0, paragraph: 0, text: 'Uma ideia', createdAt: new Date().toISOString() });
    });
    await FolioStore.saveImportedBook(value);
    const before = { count: (await FolioStore.getBooks()).length, state: FolioStore.getState() };
    await FolioStore.removeFromLibrary(value.id);
    return { before, books: await FolioStore.getBooks(), state: FolioStore.getState() };
  }, book());
  assert.equal(result.before.count, 1); assert.equal(result.before.state.library.example.progress, .5);
  assert.equal(result.before.state.library.example.shelf, 'reading'); assert.equal(result.before.state.library.example.offline, true);
  assert.equal(result.books.length, 0); assert.deepEqual(result.state.library, {}); assert.deepEqual(result.state.notes, []);
}));

test('a quota failure before the journal leaves the sole book and its notes intact', () => isolated(async page => {
  const result = await page.evaluate(async value => {
    await FolioStore.saveImportedBook(value);
    const original = Storage.prototype.setItem;
    Storage.prototype.setItem = function () { throw new DOMException('Dispositivo cheio', 'QuotaExceededError'); };
    let message; try { await FolioStore.removeFromLibrary(value.id); } catch (error) { message = error.message; }
    Storage.prototype.setItem = original;
    return { message, book: await FolioStore.getBook(value.id), state: FolioStore.getState() };
  }, book());
  assert.match(result.message, /cheio/); assert.equal(result.book.id, 'example'); assert.equal(result.state.library.example.offline, true);
}));

test('an aborted restore rolls back both a cleared IndexedDB and the state journal', () => isolated(async page => {
  const result = await page.evaluate(async values => {
    await FolioStore.saveImportedBook(values[0]);
    const previous = await FolioStore.exportBackup();
    const backup = { ...previous, books: [values[1]], state: { ...previous.state, library: { replacement: { offline: true } } } };
    const original = IDBObjectStore.prototype.put;
    IDBObjectStore.prototype.put = function (value, ...args) { if (value?.id === 'replacement') throw new DOMException('Write failed', 'QuotaExceededError'); return original.call(this, value, ...args); };
    let message; try { await FolioStore.importBackup(backup); } catch (error) { message = error.message; }
    IDBObjectStore.prototype.put = original;
    return { message, backup: await FolioStore.exportBackup(), persisted: JSON.parse(localStorage.getItem('folio.state.v1')) };
  }, [book(), book('replacement')]);
  assert.match(result.message, /Write failed/); assert.equal(result.backup.books[0].id, 'example');
  assert.ok(result.backup.state.library.example); assert.equal(result.persisted.format, undefined);
}));

test('a committed journal recovers after failure to finalize localStorage and a reload', () => isolated(async page => {
  const result = await page.evaluate(async value => {
    const original = Storage.prototype.setItem; let writes = 0;
    Storage.prototype.setItem = function (...args) { if (++writes === 2) throw new DOMException('Write failed', 'QuotaExceededError'); return original.apply(this, args); };
    await FolioStore.saveImportedBook(value);
    Storage.prototype.setItem = original;
    let blocked = false; try { FolioStore.update(state => { state.preferences.goal = 99; }); } catch (_) { blocked = true; }
    return { blocked, journal: JSON.parse(localStorage.getItem('folio.state.v1')).format };
  }, book());
  assert.equal(result.blocked, true); assert.equal(result.journal, 'folio-restore');
  await page.reload(); await page.evaluate(() => FolioStore.ready);
  const recovered = await page.evaluate(async () => ({ state: FolioStore.getState(), books: await FolioStore.getBooks(), journal: JSON.parse(localStorage.getItem('folio.state.v1')).format }));
  assert.equal(recovered.books.length, 1); assert.equal(recovered.state.library.example.offline, true); assert.equal(recovered.journal, undefined);
}));

test('an uncommitted journal restores the previous state after a reload', () => isolated(async page => {
  await page.evaluate(async value => {
    await FolioStore.saveImportedBook(value);
    const previous = FolioStore.getState(), next = FolioStore.getState(); next.library = {};
    localStorage.setItem('folio.state.v1', JSON.stringify({ format: 'folio-restore', token: 'never-committed', previous, next }));
  }, book());
  await page.reload(); await page.evaluate(() => FolioStore.ready);
  const result = await page.evaluate(async () => ({ state: FolioStore.getState(), books: await FolioStore.getBooks() }));
  assert.ok(result.state.library.example); assert.equal(result.books[0].id, 'example');
}));

test('a failed recovery import preserves previously damaged raw state for recovery', () => isolated(async page => {
  const result = await page.evaluate(async value => {
    const state = FolioStore.getState(); localStorage.setItem('folio.state.v1', '{still-recoverable');
    const original = IDBObjectStore.prototype.clear;
    IDBObjectStore.prototype.clear = function () { throw new Error('Cannot clear'); };
    let message;
    try { await FolioStore.importBackup({ format: 'folio-backup', version: 1, state, books: [value] }); } catch (error) { message = error.message; }
    IDBObjectStore.prototype.clear = original;
    const raw = localStorage.getItem('folio.state.v1');
    await FolioStore.importBackup({ format: 'folio-backup', version: 1, state, books: [value] });
    return { message, raw, books: await FolioStore.getBooks() };
  }, book());
  assert.match(result.message, /Cannot clear/); assert.equal(result.raw, '{still-recoverable'); assert.equal(result.books.length, 1);
}));

test('the 500-book limit rejects only new IDs without deleting existing data', () => isolated(async page => {
  const result = await page.evaluate(async value => {
    const books = Array.from({ length: 500 }, (_, index) => ({ ...value, id: 'book-' + index }));
    await FolioStore.importBackup({ format: 'folio-backup', version: 1, state: FolioStore.getState(), books });
    let message; try { await FolioStore.saveImportedBook({ ...value, id: 'overflow' }); } catch (error) { message = error.message; }
    await FolioStore.saveImportedBook({ ...value, id: 'book-1' });
    return { message, count: (await FolioStore.getBooks()).length, state: FolioStore.getState() };
  }, book());
  assert.match(result.message, /500/); assert.equal(result.count, 500); assert.equal(result.state.library.overflow, undefined); assert.ok(result.state.library['book-1']);
}));

test('concurrent imports from two tabs serialize their book and state transactions', () => isolated(async (first, context) => {
  const second = await context.newPage(); await second.goto(origin); await second.evaluate(() => FolioStore.ready);
  await Promise.all([first.evaluate(value => FolioStore.saveImportedBook(value), book('one')), second.evaluate(value => FolioStore.saveImportedBook(value), book('two'))]);
  const result = await first.evaluate(() => FolioStore.exportBackup());
  assert.deepEqual(result.books.map(item => item.id).sort(), ['one', 'two']); assert.deepEqual(Object.keys(result.state.library).sort(), ['one', 'two']);
}));

test('deleting an offline payload preserves the reading entry and notes', () => isolated(async page => {
  const result = await page.evaluate(async value => {
    await FolioStore.saveImportedBook(value);
    FolioStore.update(state => { state.library[value.id].progress = .4; state.notes.push({ id: 'n1', bookId: value.id, text: 'Anotação', createdAt: new Date().toISOString() }); });
    await FolioStore.deleteBook(value.id);
    return { state: FolioStore.getState(), payload: await FolioStore.getBook(value.id) };
  }, book());
  assert.equal(result.payload, null); assert.equal(result.state.library.example.offline, false); assert.equal(result.state.library.example.progress, .4); assert.equal(result.state.notes.length, 1);
}));

test('EPUB extraction handles XHTML entities and excludes executable and external elements', () => isolated(async page => {
  const zip = fflate.zipSync({
    mimetype: fflate.strToU8('application/epub+zip'),
    'META-INF/container.xml': fflate.strToU8('<container><rootfiles><rootfile full-path="OEBPS/book.opf" media-type="application/oebps-package+xml"/></rootfiles></container>'),
    'OEBPS/book.opf': fflate.strToU8('<package><metadata><title>Uma leitura</title><creator>Joana</creator></metadata><manifest><item id="c1" href="chapter.xhtml" media-type="application/xhtml+xml"/></manifest><spine><itemref idref="c1"/></spine></package>'),
    'OEBPS/chapter.xhtml': fflate.strToU8('<!DOCTYPE html PUBLIC "-//W3C//DTD XHTML 1.1//EN" "http://www.w3.org/TR/xhtml11/DTD/xhtml11.dtd"><html xmlns="http://www.w3.org/1999/xhtml"><head><title>Capítulo</title><style>bad-style</style></head><body><h1>Início</h1><p>Olá&nbsp;&copy; mundo <em>literário</em>.</p><script>window.executed = true;</script><iframe src="https://invalid.example/">bad-frame</iframe><img src="https://invalid.example/image.png"/><p hidden="hidden">bad-hidden</p><p>&lt;script&gt;texto&lt;/script&gt;</p></body></html>')
  });
  const external = []; page.on('request', request => { if (!request.url().startsWith(origin)) external.push(request.url()); });
  const result = await page.evaluate(async bytes => {
    const value = await FolioImport.read(new File([new Uint8Array(bytes)], 'reading.epub'));
    return { value, executed: !!window.executed };
  }, [...zip]);
  assert.equal(result.value.chapters.length, 1); assert.deepEqual(result.value.chapters[0].paragraphs, ['Início', 'Olá © mundo literário.', '<script>texto</script>']);
  assert.equal(result.executed, false); assert.deepEqual(external, []);
}));
