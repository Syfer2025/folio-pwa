/* Folio local data. Books stay on this device; there is no account or cloud sync. */
(function (root) {
  'use strict';

  const KEY = 'folio.state.v1';
  const DB_NAME = 'folio-library';
  const LIMITS = Object.freeze({ books: 500, chapters: 2000, paragraphs: 100000, bookCharacters: 12000000, backupCharacters: 60000000, notes: 10000 });
  const own = (value, key) => Object.prototype.hasOwnProperty.call(value, key);
  const clone = value => JSON.parse(JSON.stringify(value));
  const isRecord = value => value !== null && typeof value === 'object' && !Array.isArray(value);
  const fail = message => { throw new Error(message); };

  function record(value, label) { if (!isRecord(value)) fail(label + ' inválido.'); return value; }
  function text(value, max, fallback) {
    if (value === undefined && fallback !== undefined) return fallback;
    if (typeof value !== 'string' || value.length > max) fail('Texto inválido ou longo demais.');
    return value.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '').trim();
  }
  function id(value) {
    if (typeof value !== 'string' || !/^[a-zA-Z0-9_.:-]{1,128}$/.test(value) || ['__proto__', 'prototype', 'constructor'].includes(value)) fail('Identificador inválido.');
    return value;
  }
  function number(value, min, max, fallback, integer) {
    if (value === undefined && fallback !== undefined) return fallback;
    if (typeof value !== 'number' || !Number.isFinite(value) || value < min || value > max || (integer && !Number.isInteger(value))) fail('Número fora do intervalo permitido.');
    return value;
  }
  function choice(value, values, fallback) {
    if (value === undefined) return fallback;
    if (!values.includes(value)) fail('Opção de configuração inválida.');
    return value;
  }
  function date(value, fallback) {
    if (value === undefined && fallback !== undefined) return fallback;
    if (typeof value !== 'string' || value.length > 40 || !Number.isFinite(Date.parse(value))) fail('Data inválida.');
    return new Date(value).toISOString();
  }
  function position(value) {
    value = record(value, 'Posição');
    const result = { chapter: number(value.chapter, 0, LIMITS.chapters - 1, 0, true), paragraph: number(value.paragraph, 0, LIMITS.paragraphs - 1, 0, true) };
    if (value.offset !== undefined) result.offset = number(value.offset, 0, 10000000);
    return result;
  }
  function initialState() {
    return { version: 1, library: {}, preferences: { theme: 'dark', readerTheme: 'paper', fontSize: 20, font: 'literary', lineHeight: 1.8, readingMode: 'scroll', goal: 15 }, notes: [], activity: {}, recentSearches: [] };
  }
  function validateState(input) {
    record(input, 'Estado');
    if (input.version !== 1) fail('Versão de dados não reconhecida.');
    const result = initialState();
    const library = record(input.library, 'Biblioteca');
    if (Object.keys(library).length > 2000) fail('A biblioteca ultrapassa 2.000 títulos.');
    for (const [key, entry] of Object.entries(library)) {
      id(key); record(entry, 'Item da biblioteca');
      const item = { shelf: choice(entry.shelf, ['reading', 'want', 'finished'], 'want'), progress: number(entry.progress, 0, 1, 0), position: position(entry.position || {}), updatedAt: date(entry.updatedAt, new Date().toISOString()), offline: entry.offline === true };
      if (entry.offline !== undefined && typeof entry.offline !== 'boolean') fail('Estado offline inválido.');
      if (entry.bookmark !== undefined && entry.bookmark !== null) item.bookmark = { ...position(entry.bookmark), createdAt: date(entry.bookmark.createdAt, item.updatedAt) };
      result.library[key] = item;
    }
    const prefs = record(input.preferences, 'Preferências');
    result.preferences = {
      theme: choice(prefs.theme, ['dark', 'light', 'system'], 'dark'),
      readerTheme: choice(prefs.readerTheme, ['paper', 'sepia', 'night', 'white'], 'paper'),
      fontSize: number(prefs.fontSize, 14, 36, 20),
      font: choice(prefs.font, ['literary', 'sans', 'dyslexic', 'mono'], 'literary'),
      lineHeight: number(prefs.lineHeight, 1.2, 2.4, 1.8),
      readingMode: choice(prefs.readingMode, ['scroll', 'paged'], 'scroll'),
      goal: number(prefs.goal, 1, 240, 15, true)
    };
    if (!Array.isArray(input.notes) || input.notes.length > LIMITS.notes) fail('Lista de notas inválida ou muito grande.');
    const noteIds = new Set();
    result.notes = input.notes.map(note => {
      record(note, 'Nota');
      const noteId = id(note.id); if (noteIds.has(noteId)) fail('Há notas com identificadores repetidos.'); noteIds.add(noteId);
      const normalized = { id: noteId, bookId: id(note.bookId), bookTitle: text(note.bookTitle, 300, ''), ...position(note), quote: text(note.quote, 20000, ''), text: text(note.text, 20000, ''), createdAt: date(note.createdAt), color: choice(note.color, ['yellow', 'green', 'blue', 'pink'], 'yellow') };
      if (!normalized.quote && !normalized.text) fail('Uma nota precisa de texto ou trecho.');
      if (note.endParagraph !== undefined) normalized.endParagraph = number(note.endParagraph, normalized.paragraph, LIMITS.paragraphs - 1, undefined, true);
      if (note.ranges !== undefined) {
        if (!Array.isArray(note.ranges) || note.ranges.length > 100) fail('Seleção de texto inválida.');
        normalized.ranges = note.ranges.map(range => { record(range, 'Intervalo'); const start = number(range.start, 0, 120000, undefined, true); return { paragraph: number(range.paragraph, 0, LIMITS.paragraphs - 1, undefined, true), start, end: number(range.end, start, 120000, undefined, true) }; });
      }
      return normalized;
    });
    const activity = record(input.activity, 'Atividade');
    if (Object.keys(activity).length > 10000) fail('Histórico de atividade muito grande.');
    for (const [key, seconds] of Object.entries(activity)) {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(key) || !Number.isFinite(Date.parse(key)) || new Date(key).toISOString().slice(0, 10) !== key) fail('Dia de leitura inválido.');
      result.activity[key] = number(seconds, 0, 86400);
    }
    if (!Array.isArray(input.recentSearches) || input.recentSearches.length > 20) fail('Histórico de buscas inválido.');
    result.recentSearches = [...new Set(input.recentSearches.map(query => text(query, 150)).filter(Boolean))];
    return result;
  }
  function validateBook(input) {
    record(input, 'Livro');
    if (!Array.isArray(input.chapters) || !input.chapters.length || input.chapters.length > LIMITS.chapters) fail('O livro precisa de capítulos válidos (até 2.000).');
    let paragraphCount = 0, characterCount = 0, words = 0;
    const chapters = input.chapters.map((chapter, index) => {
      record(chapter, 'Capítulo');
      if (!Array.isArray(chapter.paragraphs) || !chapter.paragraphs.length) fail('Capítulo sem parágrafos.');
      paragraphCount += chapter.paragraphs.length;
      if (paragraphCount > LIMITS.paragraphs) fail('O livro excede o limite de parágrafos.');
      const paragraphs = chapter.paragraphs.map(paragraph => {
        const clean = text(paragraph, 120000); characterCount += clean.length;
        if (characterCount > LIMITS.bookCharacters) fail('O texto do livro excede 12 milhões de caracteres.');
        words += clean ? clean.split(/\s+/).length : 0;
        return clean;
      }).filter(Boolean);
      if (!paragraphs.length) fail('Capítulo sem texto legível.');
      return { title: text(chapter.title, 300, 'Capítulo ' + (index + 1)), paragraphs };
    });
    const title = text(input.t, 300); if (!title) fail('O livro precisa de título.');
    if (typeof input.full !== 'boolean') fail('Informe se o conteúdo é completo.');
    const result = { id: id(input.id), t: title, a: text(input.a, 300, 'Autor não informado'), g: text(input.g, 120, 'Minha coleção'), y: number(input.y, 0, 3000, 0, true), source: choice(input.source, ['import', 'catalog'], 'import'), full: input.full, chapters, d: text(input.d, 10000, ''), language: text(input.language, 40, 'pt-BR'), wordCount: words, pages: Math.max(1, Math.ceil(words / 250)), mins: Math.max(1, Math.ceil(words / 200)), pal: number(input.pal, 0, 100, 0, true), v: choice(input.v, ['rule', 'band', 'type', 'frame', 'arc'], 'type') };
    for (const key of ['originalFilename', 'format', 'rights']) if (input[key] !== undefined) result[key] = text(input[key], key === 'rights' ? 2000 : 300);
    if (input.importedAt !== undefined) result.importedAt = date(input.importedAt);
    if (input.sourceUrl !== undefined) {
      const value = text(input.sourceUrl, 2000); let parsed; try { parsed = new URL(value); } catch (_) { fail('URL de origem inválida.'); }
      if (parsed.protocol !== 'https:' || parsed.username || parsed.password) fail('A origem precisa usar HTTPS.');
      result.sourceUrl = parsed.href;
    }
    return result;
  }

  function emit(name, detail) { if (typeof root.dispatchEvent === 'function' && typeof root.CustomEvent === 'function') root.dispatchEvent(new root.CustomEvent(name, { detail })); }
  function storageError(error, operation) { emit('folio:storage-error', { operation, message: error.message || 'Não foi possível salvar neste dispositivo.' }); return error; }
  let state = initialState(), pendingRestore = null, restoring = false;
  function journal(value) {
    record(value, 'Operação pendente');
    const result = { format: 'folio-restore', token: id(value.token), previous: validateState(value.previous), next: validateState(value.next) };
    if (value.previousRaw !== undefined) {
      if (typeof value.previousRaw !== 'string' || value.previousRaw.length > LIMITS.backupCharacters) fail('Estado anterior da operação inválido.');
      result.previousRaw = value.previousRaw;
    }
    return result;
  }
  try {
    const raw = root.localStorage.getItem(KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed.format === 'folio-restore') { pendingRestore = journal(parsed); state = pendingRestore.previous; restoring = true; }
      else state = validateState(parsed);
    }
  } catch (error) { setTimeout(() => storageError(error, 'load-state'), 0); }

  let databasePromise;
  function database() {
    if (!databasePromise) databasePromise = new Promise((resolve, reject) => {
      if (!root.indexedDB) { reject(new Error('Este navegador não disponibilizou armazenamento de livros. Abra o app em um navegador com IndexedDB.')); return; }
      let request; try { request = root.indexedDB.open(DB_NAME, 1); } catch (error) { reject(error); return; }
      request.onupgradeneeded = () => { const db = request.result; if (!db.objectStoreNames.contains('books')) db.createObjectStore('books', { keyPath: 'id' }); if (!db.objectStoreNames.contains('meta')) db.createObjectStore('meta'); };
      request.onsuccess = () => { const db = request.result; db.onversionchange = () => { db.close(); databasePromise = null; }; resolve(db); };
      request.onerror = () => reject(request.error || new Error('Não foi possível abrir o armazenamento.'));
      request.onblocked = () => storageError(new Error('Feche outras abas do Folio para atualizar o armazenamento.'), 'open-books');
    }).catch(error => { databasePromise = null; throw error; });
    return databasePromise;
  }
  async function transact(mode, operation, stores) {
    const db = await database();
    return new Promise((resolve, reject) => {
      let result, tx, operationError;
      try {
        tx = db.transaction(stores || ['books'], mode);
        result = operation(tx.objectStore('books'), tx, error => { operationError = error; tx.abort(); });
      } catch (error) { if (tx) try { tx.abort(); } catch (_) {} reject(error); return; }
      tx.oncomplete = () => resolve(result && own(result, 'result') ? result.result : result && 'result' in result ? result.result : undefined);
      tx.onabort = () => reject(operationError || tx.error || new Error('A operação foi interrompida; nenhum livro foi alterado.'));
      tx.onerror = () => {};
    });
  }
  let operationQueue = Promise.resolve();
  function exclusive(operation) {
    const run = () => root.navigator && root.navigator.locks ? root.navigator.locks.request('folio-library-write', operation) : operation();
    const result = operationQueue.then(run, run);
    operationQueue = result.catch(() => {});
    return result;
  }
  // Synchronous writes must read the latest state, not a snapshot from before another tab saved.
  // A journal is also a write barrier while a multi-store transaction is in flight.
  function persistedState(allowDamaged) {
    let raw, parsed;
    try {
      raw = root.localStorage.getItem(KEY);
      parsed = raw ? JSON.parse(raw) : initialState();
      if (parsed.format === 'folio-restore') fail('Há uma operação de biblioteca em andamento. Aguarde ou reabra o app para recuperá-la.');
      const result = validateState(parsed);
      return result;
    } catch (error) {
      if (allowDamaged && (!parsed || parsed.format !== 'folio-restore')) return state;
      throw storageError(error, 'read-state');
    }
  }
  async function recoverPending() {
    const raw = root.localStorage.getItem(KEY);
    const parsed = raw ? JSON.parse(raw) : null;
    if (!parsed || parsed.format !== 'folio-restore') { pendingRestore = null; restoring = false; if (parsed) state = validateState(parsed); return; }
    pendingRestore = journal(parsed);
    const committed = await transact('readonly', (_, tx) => tx.objectStore('meta').get('restore-token'), ['books', 'meta']);
    const didCommit = committed === pendingRestore.token;
    state = didCommit ? pendingRestore.next : pendingRestore.previous;
    // If this write fails, keep the journal barrier. A later retry can safely recover it.
    root.localStorage.setItem(KEY, !didCommit && pendingRestore.previousRaw !== undefined ? pendingRestore.previousRaw : JSON.stringify(state));
    pendingRestore = null; restoring = false;
    emit('folio:change', { state: clone(state), reason: 'recover-restore' });
  }
  const ready = exclusive(async () => {
    try {
      await database();
      if (pendingRestore) await recoverPending();
    } catch (error) { storageError(error, 'open-books'); }
    return clone(state);
  });
  function update(mutator) {
    if (restoring) fail('Aguarde a restauração terminar antes de alterar a biblioteca.');
    if (typeof mutator !== 'function') fail('A atualização precisa de uma função.');
    const draft = clone(persistedState()); const returned = mutator(draft);
    if (returned && typeof returned.then === 'function') fail('Use uma atualização síncrona.');
    const next = validateState(returned && isRecord(returned) && returned.version === 1 ? returned : draft);
    try { root.localStorage.setItem(KEY, JSON.stringify(next)); } catch (error) { throw storageError(error, 'save-state'); }
    state = next; emit('folio:change', { state: clone(state), reason: 'update' }); return clone(state);
  }
  async function getBooks() { await ready; try { return (await transact('readonly', store => store.getAll())).map(validateBook); } catch (error) { throw storageError(error, 'read-books'); } }
  async function getBook(bookId) { await ready; id(bookId); try { const value = await transact('readonly', store => store.get(bookId)); return value ? validateBook(value) : null; } catch (error) { throw storageError(error, 'read-book'); } }
  function putLimited(store, tx, abort, book) {
    const existing = store.getKey(book.id);
    existing.onsuccess = () => {
      if (existing.result !== undefined) { store.put(book); return; }
      const count = store.count();
      count.onsuccess = () => {
        if (count.result >= LIMITS.books) { abort(new Error('Sua biblioteca chegou ao limite de 500 livros neste dispositivo.')); return; }
        store.put(book);
      };
    };
  }
  async function putBook(book) {
    const normalized = validateBook(book); await ready;
    return exclusive(async () => {
      persistedState(); if (restoring) fail('Aguarde a restauração terminar.');
      try { await transact('readwrite', (store, tx, abort) => putLimited(store, tx, abort, normalized)); emit('folio:change', { reason: 'book-saved', bookId: normalized.id }); return normalized; } catch (error) { throw storageError(error, 'save-book'); }
    });
  }
  async function exportBackup() {
    await ready;
    return exclusive(async () => {
      if (restoring) fail('Aguarde a restauração terminar.');
      const books = await getBooks();
      state = persistedState();
      const backup = { format: 'folio-backup', version: 1, exportedAt: new Date().toISOString(), state: clone(state), books };
      validateBackup(JSON.stringify(backup));
      return backup;
    });
  }
  function validateBackup(value) {
    if (typeof value === 'string') { if (value.length > LIMITS.backupCharacters) fail('O backup excede 60 MB de texto.'); try { value = JSON.parse(value); } catch (_) { fail('O arquivo não contém JSON válido.'); } }
    record(value, 'Backup');
    if (value.format !== 'folio-backup' || value.version !== 1) fail('Este arquivo não é um backup Folio compatível.');
    if (!Array.isArray(value.books) || value.books.length > LIMITS.books) fail('O backup excede 500 livros.');
    const next = validateState(value.state), books = value.books.map(validateBook), ids = new Set(); let characters = 0;
    for (const book of books) { if (ids.has(book.id)) fail('Há livros com identificadores repetidos.'); ids.add(book.id); for (const chapter of book.chapters) for (const paragraph of chapter.paragraphs) characters += paragraph.length; }
    if (characters > LIMITS.backupCharacters) fail('O backup excede 60 milhões de caracteres.');
    for (const [bookId, item] of Object.entries(next.library)) if (item.offline && !ids.has(bookId)) item.offline = false;
    return { state: next, books };
  }
  async function commitState(next, operation, reason, allowDamaged) {
    await database();
    if (restoring) fail('Já existe uma operação de biblioteca em andamento.');
    const previous = clone(persistedState(allowDamaged)), token = 'restore-' + Date.now() + '-' + Math.random().toString(36).slice(2);
    next = validateState(typeof next === 'function' ? next(clone(previous)) : next);
    // Journal + a receipt in the same IndexedDB transaction let startup recover even if the tab closes mid-restore.
    const pending = { format: 'folio-restore', token, previous, next };
    if (allowDamaged) {
      const previousRaw = root.localStorage.getItem(KEY);
      if (previousRaw !== null) {
        try { validateState(JSON.parse(previousRaw)); }
        catch (_) { pending.previousRaw = previousRaw; }
      }
    }
    let journalWritten = false, committed = false;
    restoring = true;
    try {
      root.localStorage.setItem(KEY, JSON.stringify(pending)); journalWritten = true;
      await transact('readwrite', (store, tx, abort) => { operation(store, tx, abort); tx.objectStore('meta').put(token, 'restore-token'); }, ['books', 'meta']);
      committed = true; state = next;
      try { root.localStorage.setItem(KEY, JSON.stringify(state)); }
      catch (error) { pendingRestore = pending; storageError(error, 'finish-restore'); }
      emit('folio:change', { state: clone(state), reason });
    } catch (error) {
      if (journalWritten && !committed) try { root.localStorage.setItem(KEY, pending.previousRaw === undefined ? JSON.stringify(previous) : pending.previousRaw); } catch (rollbackError) { pendingRestore = pending; storageError(rollbackError, 'rollback-restore'); }
      throw storageError(error, reason);
    } finally { restoring = !!pendingRestore; }
  }
  async function importBackup(value) {
    const validated = validateBackup(value); await ready;
    return exclusive(async () => {
      if (pendingRestore) await recoverPending();
      await commitState(validated.state, store => { store.clear(); for (const book of validated.books) store.put(book); }, 'restore', true);
      return { books: validated.books.length, notes: state.notes.length };
    });
  }
  async function saveImportedBook(book) {
    const normalized = validateBook(book);
    if (normalized.source !== 'import') fail('Use esta operação para livros importados.');
    await ready;
    return exclusive(async () => {
      await commitState(next => {
        next.library[normalized.id] = { shelf: 'want', progress: 0, position: { chapter: 0, paragraph: 0 }, ...next.library[normalized.id], offline: true, updatedAt: new Date().toISOString() };
        return next;
      }, (store, tx, abort) => putLimited(store, tx, abort, normalized), 'book-imported');
      return normalized;
    });
  }
  async function removeFromLibrary(bookId, options = {}) {
    id(bookId); await ready;
    return exclusive(async () => {
      await commitState(next => {
        delete next.library[bookId];
        if (options.deleteNotes !== false) next.notes = next.notes.filter(note => note.bookId !== bookId);
        return next;
      }, store => store.delete(bookId), 'book-removed');
    });
  }
  async function deleteBook(bookId) {
    id(bookId); await ready;
    return exclusive(async () => {
      await commitState(next => {
        if (next.library[bookId]) next.library[bookId].offline = false;
        return next;
      }, store => store.delete(bookId), 'book-deleted');
    });
  }
  if (typeof root.addEventListener === 'function') root.addEventListener('storage', async event => {
    if (event.key !== KEY || restoring) return;
    try {
      const parsed = event.newValue ? JSON.parse(event.newValue) : initialState();
      if (parsed.format === 'folio-restore') {
        // The next plain-state event publishes the committed result; a new tab can recover a leftover journal.
        return;
      }
      state = validateState(parsed); emit('folio:change', { state: clone(state), reason: 'other-tab' });
    } catch (error) { storageError(error, 'other-tab'); }
  });
  root.FolioStore = Object.freeze({ ready, getState: () => clone(state), update, putBook, saveImportedBook, getBook, getBooks, deleteBook, removeFromLibrary, exportBackup, importBackup, validateState, validateBook, validateBackup, limits: LIMITS });
})(typeof window !== 'undefined' ? window : globalThis);
