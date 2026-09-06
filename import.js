/* Offline text import. EPUB scripts, styles, images and external resources are never executed or rendered. */
(function (root) {
  'use strict';
  const LIMITS = Object.freeze({ fileBytes: 50 * 1024 * 1024, textBytes: 16 * 1024 * 1024, entryBytes: 4 * 1024 * 1024, entries: 5000, expandedBytes: 256 * 1024 * 1024 });
  const reject = message => { throw new Error(message); };
  function checkCancelled(options) {
    if (options.signal && options.signal.aborted) { const error = new Error('Importação cancelada.'); error.name = 'AbortError'; throw error; }
  }
  function progress(options, stage, completed, total) {
    checkCancelled(options);
    if (typeof options.onProgress === 'function') options.onProgress({ stage, completed, total });
  }
  const decoder = new TextDecoder('utf-8', { fatal: true });
  function decode(bytes) {
    try { return decoder.decode(bytes).replace(/^\uFEFF/, ''); }
    catch (_) { reject('Não foi possível ler a codificação do texto. Salve o arquivo em UTF-8.'); }
  }
  function plain(value) { return String(value || '').replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '').replace(/\s+/g, ' ').trim(); }
  function safePath(value, base) {
    if (typeof value !== 'string' || value.length > 1000 || /[\u0000-\u001F\\]/.test(value)) reject('O EPUB contém um caminho inválido.');
    let decoded; try { decoded = decodeURIComponent(value.split('#')[0].split('?')[0]); } catch (_) { reject('O EPUB contém um caminho malformado.'); }
    if (/^[a-z][a-z\d+.-]*:/i.test(decoded) || decoded.startsWith('/') || /[\\\u0000-\u001F]/.test(decoded)) reject('O EPUB faz referência a conteúdo externo ou caminho inválido.');
    const parts = base ? base.split('/').slice(0, -1) : [];
    for (const part of decoded.split('/')) {
      if (!part || part === '.') continue;
      if (part === '..') { if (!parts.length) reject('O EPUB contém um caminho fora do livro.'); parts.pop(); }
      else parts.push(part);
    }
    return parts.join('/');
  }
  function inspectZip(bytes) {
    if (!(bytes instanceof Uint8Array) || bytes.length < 22 || bytes.length > LIMITS.fileBytes) reject('EPUB vazio, inválido ou maior que 50 MB.');
    const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    const u16 = n => view.getUint16(n, true), u32 = n => view.getUint32(n, true);
    let end = -1;
    for (let i = bytes.length - 22; i >= Math.max(0, bytes.length - 65557); i--) if (u32(i) === 0x06054b50 && i + 22 + u16(i + 20) === bytes.length) { end = i; break; }
    if (end < 0) reject('A estrutura ZIP do EPUB está incompleta.');
    const count = u16(end + 10), directorySize = u32(end + 12), directoryStart = u32(end + 16);
    if (u16(end + 4) || u16(end + 6) || u16(end + 8) !== count || count === 65535 || directoryStart === 0xffffffff || directorySize === 0xffffffff) reject('EPUB ZIP64 ou dividido em volumes não é compatível.');
    if (!count || count > LIMITS.entries || directoryStart + directorySize > end) reject('O EPUB excede o limite de arquivos ou tem diretório inválido.');
    const entries = new Map(), spans = []; let cursor = directoryStart, expanded = 0;
    for (let i = 0; i < count; i++) {
      if (cursor + 46 > end || u32(cursor) !== 0x02014b50) reject('Diretório EPUB corrompido.');
      const flags = u16(cursor + 8), compression = u16(cursor + 10), checksum = u32(cursor + 16), compressedSize = u32(cursor + 20), size = u32(cursor + 24), nameSize = u16(cursor + 28), extraSize = u16(cursor + 30), commentSize = u16(cursor + 32), local = u32(cursor + 42);
      const next = cursor + 46 + nameSize + extraSize + commentSize;
      if (!nameSize || next > end || local + 30 > directoryStart || u16(cursor + 34)) reject('Entrada ZIP inválida.');
      const rawName = decode(bytes.subarray(cursor + 46, cursor + 46 + nameSize));
      // Archive names may not traverse directories, even when they normalize inside the root.
      if (rawName.split('/').includes('..')) reject('O EPUB contém um caminho inseguro.');
      const name = safePath(rawName);
      if (!name || entries.has(name)) reject('O EPUB contém caminhos repetidos ou vazios.');
      if (flags & 0x2041) reject('Este EPUB está criptografado. Importe uma edição sem DRM.');
      if (![0, 8].includes(compression)) reject('O EPUB usa uma compressão não compatível.');
      if (size === 0xffffffff || compressedSize === 0xffffffff || size > 128 * 1024 * 1024 || (expanded += size) > LIMITS.expandedBytes) reject('O EPUB excede o limite de expansão segura.');
      if (u32(local) !== 0x04034b50 || u16(local + 8) !== compression || u16(local + 6) !== flags) reject('Cabeçalho ZIP inconsistente.');
      const localNameSize = u16(local + 26), localExtra = u16(local + 28), start = local + 30 + localNameSize + localExtra;
      if (start + compressedSize > directoryStart || local + 30 + localNameSize > directoryStart || decode(bytes.subarray(local + 30, local + 30 + localNameSize)) !== rawName) reject('O EPUB contém dados ZIP sobrepostos ou incompletos.');
      if (compression === 0 && size !== compressedSize) reject('Tamanho ZIP inconsistente.');
      if (!(flags & 8) && (u32(local + 14) !== checksum || u32(local + 18) !== compressedSize || u32(local + 22) !== size)) reject('Cabeçalho ZIP inconsistente.');
      spans.push({ start: local, end: start + compressedSize });
      entries.set(name, { name, compression, checksum, compressedSize, size, start, directory: rawName.endsWith('/') });
      cursor = next;
    }
    if (cursor !== directoryStart + directorySize) reject('Tamanho do diretório ZIP inconsistente.');
    spans.sort((a, b) => a.start - b.start);
    for (let i = 1; i < spans.length; i++) if (spans[i].start < spans[i - 1].end) reject('O EPUB contém dados ZIP sobrepostos.');
    return entries;
  }
  const crcTable = new Uint32Array(256);
  for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = (c & 1) ? 0xedb88320 ^ (c >>> 1) : c >>> 1; crcTable[n] = c >>> 0; }
  function crc32(bytes) { let value = 0xffffffff; for (const byte of bytes) value = crcTable[(value ^ byte) & 255] ^ (value >>> 8); return (value ^ 0xffffffff) >>> 0; }
  function unzipReader(bytes) {
    const entries = inspectZip(bytes), cache = new Map(); let total = 0;
    return { entries, read(name) {
      if (cache.has(name)) return cache.get(name);
      const entry = entries.get(name);
      if (!entry || entry.directory) reject('Arquivo ausente no EPUB: ' + name.slice(0, 150));
      if (entry.size > LIMITS.entryBytes || entry.size / Math.max(1, entry.compressedSize) > 250) reject('Um capítulo do EPUB excede o limite de expansão segura (4 MB).');
      const compressed = bytes.subarray(entry.start, entry.start + entry.compressedSize);
      let output;
      if (!entry.compression) output = compressed;
      else {
        if (!root.fflate || !root.fflate.Inflate) reject('O importador EPUB não foi carregado. Reabra o aplicativo e tente novamente.');
        const chunks = []; let size = 0;
        const stream = new root.fflate.Inflate(chunk => {
          size += chunk.length;
          if (size > LIMITS.entryBytes || size > entry.size || total + size > LIMITS.textBytes) reject('O EPUB excede o limite de descompressão segura.');
          chunks.push(chunk);
        });
        try { for (let start = 0; start < compressed.length; start += 1024) stream.push(compressed.subarray(start, start + 1024), start + 1024 >= compressed.length); }
        catch (error) { reject('Não foi possível descompactar este EPUB: ' + error.message); }
        output = new Uint8Array(size); let offset = 0; for (const chunk of chunks) { output.set(chunk, offset); offset += chunk.length; }
      }
      if (output.length !== entry.size || crc32(output) !== entry.checksum) reject('O EPUB está corrompido: a integridade de um capítulo falhou.');
      total += output.length; if (total > LIMITS.textBytes) reject('O EPUB excede 16 MB de texto.');
      const result = decode(output); cache.set(name, result); return result;
    } };
  }
  function xml(source, label) {
    if (!root.DOMParser) reject('Este navegador não oferece suporte ao parser de EPUB.');
    if (/<!ENTITY\b/i.test(source) || /<!DOCTYPE[^>]*\[/i.test(source)) reject('O EPUB contém declarações XML não permitidas.');
    // External DTDs are unnecessary for text reading; strip them before parsing.
    source = source.replace(/<!DOCTYPE[^>]*>/gi, '');
    // EPUB 2 XHTML often uses HTML entities supplied by its external DTD. Decode only
    // entity tokens in an inert, detached textarea; never parse the chapter as HTML.
    let entityDecoder;
    source = source.replace(/&([a-zA-Z][a-zA-Z0-9]+);/g, (entity, name) => {
      if (['amp', 'lt', 'gt', 'quot', 'apos'].includes(name)) return entity;
      if (!entityDecoder) entityDecoder = new root.DOMParser().parseFromString('<html><body></body></html>', 'text/html').createElement('textarea');
      entityDecoder.innerHTML = entity;
      const decoded = entityDecoder.value;
      return decoded === entity ? entity : Array.from(decoded, character => '&#' + character.codePointAt(0) + ';').join('');
    });
    const document = new root.DOMParser().parseFromString(source, 'application/xml');
    if (!document.documentElement || document.getElementsByTagName('parsererror').length) reject('XML inválido no EPUB (' + label + ').');
    return document;
  }
  function named(node, name) { return Array.from(node.getElementsByTagName('*')).filter(element => (element.localName || element.nodeName.split(':').pop()) === name); }
  function textFromXHTML(document) {
    const body = named(document, 'body')[0] || document.documentElement;
    const paragraphs = []; let buffer = '';
    const blocks = new Set(['p', 'div', 'section', 'article', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'li', 'blockquote', 'pre', 'tr', 'dt', 'dd', 'hr', 'br']);
    const forbidden = new Set(['script', 'style', 'iframe', 'object', 'embed', 'audio', 'video', 'svg', 'math', 'nav', 'noscript', 'template', 'head']);
    const flush = () => { const value = plain(buffer); if (value) paragraphs.push(value); buffer = ''; };
    function visit(node, depth) {
      if (depth > 100) reject('A estrutura de um capítulo é complexa demais.');
      if (node.nodeType === 3 || node.nodeType === 4) { buffer += node.nodeValue || ''; return; }
      if (node.nodeType !== 1) return;
      const name = (node.localName || node.nodeName.split(':').pop()).toLowerCase();
      if (forbidden.has(name) || node.hasAttribute('hidden') || node.getAttribute('aria-hidden') === 'true') return;
      if (blocks.has(name)) flush();
      for (const child of Array.from(node.childNodes)) visit(child, depth + 1);
      if (blocks.has(name)) flush();
      else if (name === 'td' || name === 'th') buffer += ' ';
    }
    visit(body, 0); flush(); return paragraphs;
  }
  async function identity(bytes) {
    if (root.crypto && root.crypto.subtle) {
      const hash = new Uint8Array(await root.crypto.subtle.digest('SHA-256', bytes));
      return 'imp-' + Array.from(hash.subarray(0, 16), byte => byte.toString(16).padStart(2, '0')).join('');
    }
    // A deterministic fallback keeps duplicate imports stable on older, non-secure local origins.
    let a = 2166136261, b = 0x9e3779b9;
    for (let i = 0; i < bytes.length; i++) { a = Math.imul(a ^ bytes[i], 16777619); b = Math.imul(b ^ (bytes[i] + i), 2246822519); }
    return 'imp-' + (a >>> 0).toString(16).padStart(8, '0') + (b >>> 0).toString(16).padStart(8, '0') + '-' + bytes.length;
  }
  function fromTXT(source, filename) {
    if (source.includes('\u0000')) reject('O arquivo parece binário. Importe um TXT em UTF-8.');
    const normalized = source.replace(/\r\n?/g, '\n').trim();
    if (!normalized) reject('O arquivo está vazio.');
    const lines = normalized.split('\n'), chapters = []; let paragraphs = [], buffer = [], title = 'Texto completo';
    const flush = () => { if (buffer.length) { const value = plain(buffer.join(' ')); if (value) paragraphs.push(value); buffer = []; } };
    const chapter = () => { flush(); if (paragraphs.length) chapters.push({ title, paragraphs }); paragraphs = []; };
    const heading = /^(?:cap[ií]tulo\s+(?:[\dIVXLCDM]+|[\p{L} -]{1,35})(?:\s*[-—–.:].*)?|(?:pr[oó]logo|ep[ií]logo|pref[aá]cio|introdu[cç][aã]o))$/iu;
    for (const line of lines) {
      const clean = line.trim();
      if (clean.length <= 150 && heading.test(clean)) { chapter(); title = plain(clean); }
      else if (!clean) flush();
      else buffer.push(clean);
    }
    chapter(); if (!chapters.length) reject('O arquivo não contém texto legível.');
    return { t: plain(filename.replace(/\.txt$/i, '').replace(/[_-]+/g, ' ')).slice(0, 300) || 'Meu livro', a: 'Autor não informado', chapters };
  }
  function fromJSON(source) {
    let value; try { value = JSON.parse(source); } catch (_) { reject('O arquivo não contém JSON válido.'); }
    if (!value || value.format !== 'folio-book' || value.version !== 1 || !value.book || typeof value.book !== 'object') reject('Use JSON no formato folio-book, versão 1. Backups devem ser restaurados em Minha biblioteca.');
    const book = value.book;
    if (book.full !== undefined && typeof book.full !== 'boolean') reject('O campo full precisa ser verdadeiro ou falso.');
    return { t: book.title === undefined ? book.t : book.title, a: book.author === undefined ? book.a : book.author, g: book.genre === undefined ? book.g : book.genre, y: book.year === undefined ? book.y : book.year, d: book.description === undefined ? book.d : book.description, language: book.language, chapters: book.chapters, full: book.full === undefined ? true : book.full };
  }
  async function fromEPUB(bytes, options) {
    const archive = unzipReader(bytes);
    if (archive.read('mimetype').trim() !== 'application/epub+zip') reject('Este arquivo não é um EPUB válido.');
    if (archive.entries.has('META-INF/encryption.xml')) {
      const encryption = xml(archive.read('META-INF/encryption.xml'), 'criptografia');
      const methods = named(encryption, 'EncryptionMethod');
      if (!methods.length || methods.some(method => !['http://www.idpf.org/2008/embedding', 'http://ns.adobe.com/pdf/enc#RC'].includes(method.getAttribute('Algorithm')))) reject('Este EPUB possui DRM. Importe uma edição sem proteção; o Folio não remove DRM.');
    }
    const container = xml(archive.read('META-INF/container.xml'), 'container');
    const roots = named(container, 'rootfile');
    const packageRoot = roots.find(item => item.getAttribute('media-type') === 'application/oebps-package+xml') || roots[0];
    if (!packageRoot) reject('O EPUB não informou seu pacote de leitura.');
    const packagePath = safePath(packageRoot.getAttribute('full-path'));
    const packageDoc = xml(archive.read(packagePath), 'pacote');
    const metadata = named(packageDoc, 'metadata')[0], manifest = named(packageDoc, 'manifest')[0], spine = named(packageDoc, 'spine')[0];
    if (!manifest || !spine) reject('O EPUB não contém sumário de leitura e manifesto válidos.');
    const info = name => metadata ? plain((named(metadata, name)[0] || {}).textContent) : '';
    const items = new Map();
    for (const item of named(manifest, 'item')) {
      const itemId = item.getAttribute('id');
      if (!itemId || items.has(itemId)) reject('O manifesto EPUB contém identificadores repetidos.');
      items.set(itemId, item);
    }
    const chapters = [], references = named(spine, 'itemref');
    if (!references.length || references.length > 2000) reject('O EPUB excede 2.000 capítulos ou não tem conteúdo.');
    for (let index = 0; index < references.length; index++) {
      progress(options, 'chapters', index, references.length);
      const reference = references[index]; if (reference.getAttribute('linear') === 'no') continue;
      const item = items.get(reference.getAttribute('idref')); if (!item) reject('Há um capítulo ausente no manifesto EPUB.');
      const media = item.getAttribute('media-type');
      if (!['application/xhtml+xml', 'text/html'].includes(media)) continue;
      const chapterPath = safePath(item.getAttribute('href'), packagePath);
      const document = xml(archive.read(chapterPath), 'capítulo ' + (index + 1));
      const paragraphs = textFromXHTML(document);
      if (paragraphs.length) {
        const heading = named(document, 'h1')[0] || named(document, 'h2')[0] || named(document, 'title')[0];
        chapters.push({ title: plain(heading && heading.textContent).slice(0, 300) || 'Capítulo ' + (chapters.length + 1), paragraphs });
      }
      // Let the UI paint import progress and stay responsive on books with many chapters.
      if (index % 12 === 11) await new Promise(resolve => setTimeout(resolve, 0));
    }
    progress(options, 'chapters', references.length, references.length);
    if (!chapters.length) reject('O EPUB não contém texto acessível. Livros compostos só por imagens não são compatíveis.');
    const year = parseInt(info('date').slice(0, 4), 10);
    return { t: info('title') || 'Livro importado', a: info('creator') || 'Autor não informado', language: info('language') || 'pt-BR', g: info('subject').slice(0, 120) || 'Minha coleção', y: Number.isFinite(year) && year >= 0 && year <= 3000 ? year : 0, d: info('description').slice(0, 10000), chapters };
  }
  async function read(file, options = {}) {
    checkCancelled(options);
    if (!file || typeof file.name !== 'string' || typeof file.arrayBuffer !== 'function') reject('Selecione um arquivo EPUB, TXT ou JSON.');
    const extension = file.name.split('.').pop().toLowerCase();
    if (!['epub', 'txt', 'json'].includes(extension)) reject('Formato não compatível. Use EPUB sem DRM, TXT em UTF-8 ou JSON Folio.');
    if (!Number.isInteger(file.size) || file.size <= 0 || file.size > LIMITS.fileBytes) reject('Selecione um arquivo não vazio de até 50 MB.');
    if (extension !== 'epub' && file.size > LIMITS.textBytes) reject('TXT e JSON devem ter até 16 MB.');
    const bytes = new Uint8Array(await file.arrayBuffer());
    progress(options, 'reading', bytes.length, file.size);
    if (bytes.length !== file.size || bytes.length > LIMITS.fileBytes) reject('Não foi possível ler o arquivo inteiro.');
    const content = extension === 'epub' ? await fromEPUB(bytes, options) : extension === 'txt' ? fromTXT(decode(bytes), file.name) : fromJSON(decode(bytes));
    if (!root.FolioStore) reject('O armazenamento do Folio não foi carregado.');
    const bookId = await identity(bytes);
    checkCancelled(options);
    const book = root.FolioStore.validateBook({ ...content, id: bookId, source: 'import', full: content.full === undefined ? true : content.full, importedAt: new Date().toISOString(), originalFilename: file.name.slice(0, 300), format: extension, pal: parseInt(bookId.slice(4, 8), 16) % 12, v: 'type' });
    progress(options, 'complete', 1, 1);
    checkCancelled(options);
    return book;
  }
  root.FolioImport = Object.freeze({ read, limits: LIMITS, inspectZip });
})(typeof window !== 'undefined' ? window : globalThis);
