/* Folio — reader with local, paragraph-based reading positions. */
(() => {
  'use strict';

  const clamp = (n, min, max) => Math.min(max, Math.max(min, Number(n) || 0));
  const escape = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const localDate = () => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  };
  const id = () => globalThis.crypto?.randomUUID?.() || `note-${Date.now()}-${Math.random().toString(36).slice(2)}`;
  const icons = {
    close: '<path d="m6 6 12 12M6 18 18 6"/>',
    back: '<path d="m14 5-7 7 7 7"/>', next: '<path d="m10 5 7 7-7 7"/>',
    list: '<path d="M9 6h12M9 12h12M9 18h12M3 6h1M3 12h1M3 18h1"/>',
    search: '<circle cx="10.5" cy="10.5" r="6.5"/><path d="m16 16 5 5"/>',
    note: '<path d="M13 4H5v16h15v-9M10 14l1-4 8-8 3 3-8 8-4 1Z"/>',
    bookmark: '<path d="M6 3h12v18l-6-4-6 4V3Z"/>',
    sound: '<path d="M4 9v6h4l5 4V5L8 9H4ZM17 8a6 6 0 0 1 0 8M20 5a10 10 0 0 1 0 14"/>',
    focus: '<path d="M8 3H3v5M16 3h5v5M21 16v5h-5M8 21H3v-5"/>',
    check: '<path d="m5 12 5 5L20 7"/>',
  };
  const icon = name => `<svg viewBox="0 0 24 24" width="21" height="21" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${icons[name] || ''}</svg>`;
  const tool = (action, name, label) => `<button type="button" class="fr-icon" data-action="${action}" aria-label="${label}" title="${label}">${icon(name)}</button>`;
  let dialog, viewport, article, panel, session = null, previousFocus = null, panelTrigger = null;
  let persistTimer, selectionTimer, activityTimer, searchTimer, resizeTimer, statusTimer, layoutToken = 0;
  let lastInteraction = 0, lastTick = 0, pendingActivity = {}, selectionDraft = null;
  let speechToken = 0;
  const speech = {status: 'idle', rate: 1, voiceURI: '', utterance: null, paragraph: 0, chunk: 0, chunks: []};
  const store = () => window.FolioStore;
  let stateCache;
  const state = () => stateCache ||= store().getState();
  window.addEventListener('folio:change', () => { stateCache = null; });
  const announce = message => {
    if (!dialog) return;
    const node = dialog.querySelector('#fr-status');
    clearTimeout(statusTimer);
    node.textContent = '';
    requestAnimationFrame(() => {
      if (!session) return;
      node.textContent = message;
      statusTimer = setTimeout(() => { node.textContent = ''; }, 6500);
    });
  };
  function commit(mutator) {
    try { store().update(mutator); stateCache = null; return true; }
    catch (error) { announce(`Não foi possível salvar neste dispositivo. ${error.message || 'Verifique o espaço disponível e tente novamente.'}`); return false; }
  }

  function init() {
    if (dialog) return;
    dialog = document.createElement('dialog');
    dialog.id = 'reader-dialog';
    dialog.setAttribute('aria-labelledby', 'fr-title');
    dialog.setAttribute('aria-modal', 'true');
    dialog.innerHTML = `
      <div class="fr-shell">
        <header class="fr-header">
          <button type="button" class="fr-back fr-plain" data-action="close" aria-label="Fechar leitor">${icon('back')}<span>Biblioteca</span></button>
          <div class="fr-book-heading"><span class="fr-eyebrow">VOCÊ ESTÁ LENDO</span><h1 id="fr-title"></h1><span id="fr-author"></span></div>
          <div class="fr-header-actions">${tool('bookmark', 'bookmark', 'Marcar este ponto')}${tool('focus', 'focus', 'Entrar no modo foco')}</div>
        </header>
        <nav class="fr-tools" aria-label="Ferramentas de leitura">
          <button type="button" data-panel="contents" aria-controls="fr-panel" aria-expanded="false">${icon('list')}<span>Sumário</span></button>
          <button type="button" data-panel="search" aria-controls="fr-panel" aria-expanded="false">${icon('search')}<span>Buscar</span></button>
          <button type="button" data-panel="notes" aria-controls="fr-panel" aria-expanded="false">${icon('note')}<span>Caderno</span></button>
          <button type="button" data-panel="appearance" aria-controls="fr-panel" aria-expanded="false"><span class="fr-aa" aria-hidden="true">Aa</span><span>Aparência</span></button>
          <button type="button" data-panel="voice" aria-controls="fr-panel" aria-expanded="false">${icon('sound')}<span>Ouvir</span></button>
        </nav>
        <div class="fr-main">
          <div id="fr-viewport" class="fr-viewport" tabindex="0" aria-label="Texto do livro">
            <article id="fr-article" class="fr-article" lang="pt-BR"></article>
          </div>
          <aside id="fr-panel" class="fr-panel" aria-labelledby="fr-panel-title" hidden></aside>
        </div>
        <footer class="fr-footer">
          <div class="fr-progress-track"><div id="fr-progress-fill"></div></div>
          <button type="button" class="fr-step" data-action="previous" aria-label="Capítulo anterior">${icon('back')}<span>Anterior</span></button>
          <div class="fr-reading-position"><span id="fr-chapter-progress"></span><span id="fr-reading-time"></span><button type="button" id="fr-session" data-action="session-toggle" hidden></button></div>
          <button type="button" class="fr-step" data-action="next" aria-label="Próximo capítulo"><span>Próximo</span>${icon('next')}</button>
        </footer>
        <button type="button" class="fr-focus-exit" data-action="focus" hidden>${icon('focus')} Sair do foco</button>
        <div id="fr-selection" class="fr-selection" role="group" aria-label="Trecho selecionado" hidden>
          <span>Guardar este trecho</span><button type="button" data-action="highlight">Grifar</button><button type="button" data-action="annotate">Anotar</button>${tool('clear-selection', 'close', 'Cancelar seleção')}
        </div>
        <div id="fr-status" class="fr-status" role="status" aria-live="polite"></div>
      </div>`;
    document.body.append(dialog);
    viewport = dialog.querySelector('#fr-viewport');
    article = dialog.querySelector('#fr-article');
    panel = dialog.querySelector('#fr-panel');
    dialog.addEventListener('click', handleClick);
    dialog.addEventListener('input', handleInput);
    dialog.addEventListener('change', handleChange);
    dialog.addEventListener('submit', handleSubmit);
    dialog.querySelector('#fr-selection').addEventListener('pointerdown', event => { event.preventDefault(); });
    dialog.addEventListener('keydown', handleKey, true);
    dialog.addEventListener('cancel', event => { event.preventDefault(); if (!panel.hidden) closePanel(); else close(); });
    // Native close events are queued: an old close must not dismiss a new book.
    dialog.addEventListener('close', () => { if (session && !dialog.open) close(); });
    for (const event of ['pointerdown', 'keydown', 'wheel', 'touchstart']) {
      dialog.addEventListener(event, () => { lastInteraction = Date.now(); }, {passive: true});
    }
    viewport.addEventListener('scroll', () => {
      if (!session || session.restoring) return;
      lastInteraction = Date.now();
      capturePosition();
      clearTimeout(persistTimer);
      persistTimer = setTimeout(persistPosition, 300);
    }, {passive: true});
    document.addEventListener('selectionchange', () => {
      if (!session) return;
      clearTimeout(selectionTimer);
      selectionTimer = setTimeout(captureSelection, 180);
    });
    document.addEventListener('visibilitychange', () => {
      if (!session) return;
      if (document.hidden) { activityTick(); persistPosition(); flushActivity(); }
      lastTick = performance.now();
    });
    window.addEventListener('pagehide', () => { if (session) { persistPosition(); flushActivity(); stopSpeech(); } });
    const restoreOnResize = () => {
      if (!session) return;
      clearTimeout(resizeTimer);
      resizeTimer = setTimeout(() => { if (session) restorePosition({...session.position}); }, 100);
    };
    window.addEventListener('resize', restoreOnResize);
    if (window.ResizeObserver) new ResizeObserver(restoreOnResize).observe(viewport);
    window.speechSynthesis?.addEventListener?.('voiceschanged', () => {
      if (session?.panel === 'voice') fillVoices();
    });
  }

  function normalizeBook(book) {
    if (!book?.id) throw new Error('O livro precisa ter um identificador.');
    const source = Array.isArray(book.chapters) && book.chapters.length ? book.chapters : [{title: 'Trecho de leitura', paragraphs: book.open || []}];
    const chapters = source.map((chapter, i) => ({
      title: String(chapter.title || `Capítulo ${i + 1}`),
      paragraphs: (Array.isArray(chapter.paragraphs) ? chapter.paragraphs : []).map(String),
    })).filter(chapter => chapter.paragraphs.some(text => text.trim()));
    if (!chapters.length) throw new Error('Este livro ainda não tem um texto disponível para leitura.');
    let total = 0;
    const offsets = chapters.map(chapter => chapter.paragraphs.map(text => { const start = total; total += text.length + 1; return start; }));
    return {id: String(book.id), t: String(book.t || book.title || 'Sem título'), a: String(book.a || book.author || ''), language: String(book.language || 'pt-BR'), full: book.full === true, chapters, sourceUrl: book.sourceUrl, offsets, total};
  }

  async function open(book, options = {}) {
    const prepared = normalizeBook(book);
    if (!store()) throw new Error('O armazenamento do Folio ainda não está disponível.');
    await store().ready;
    stateCache = null;
    if (session) close();
    init();
    previousFocus = document.activeElement;
    const saved = state().library[prepared.id];
    const requested = options.chapter != null ? {chapter: options.chapter, paragraph: options.paragraph || 0, offset: options.offset || 0} : saved?.position;
    const chapter = Math.floor(clamp(requested?.chapter, 0, prepared.chapters.length - 1));
    const position = {chapter, paragraph: Math.floor(clamp(requested?.paragraph, 0, prepared.chapters[chapter].paragraphs.length - 1)), offset: clamp(requested?.offset, 0, .999)};
    session = {book: prepared, chapter, position, panel: '', focus: false, restoring: false, searchQuery: '', editor: null, duration: options.minutes ? clamp(options.minutes, 1, 240) * 60 : 0, elapsed: 0, paused: false, achieved: false};
    dialog.querySelector('#fr-title').textContent = prepared.t;
    dialog.querySelector('#fr-author').textContent = prepared.a;
    article.lang = prepared.language;
    dialog.querySelector('#fr-status').textContent = '';
    dialog.classList.remove('fr-focus');
    dialog.querySelector('.fr-focus-exit').hidden = true;
    closePanel(false);
    if (!commit(s => {
      s.library[prepared.id] = {...s.library[prepared.id], shelf: s.library[prepared.id]?.shelf === 'finished' ? 'finished' : 'reading', progress: s.library[prepared.id]?.progress || 0, position, updatedAt: new Date().toISOString()};
    })) { session = null; throw new Error('Não foi possível iniciar a leitura com segurança: o dispositivo não conseguiu salvar o progresso.'); }
    applyPreferences();
    if (typeof dialog.showModal === 'function') dialog.showModal();
    else { dialog.setAttribute('open', ''); dialog.setAttribute('role', 'dialog'); }
    renderChapter(position);
    lastInteraction = Date.now();
    lastTick = performance.now();
    pendingActivity = {};
    clearInterval(activityTimer);
    activityTimer = setInterval(activityTick, 1000);
    dialog.querySelector('[data-action="close"]').focus({preventScroll: true});
    const opened = session;
    document.fonts?.ready.then(() => { if (session === opened) restorePosition({...session.position}); });
    return true;
  }

  function close() {
    if (!session) return;
    persistPosition();
    activityTick();
    flushActivity();
    const bookId = session.book.id;
    stopSpeech();
    clearInterval(activityTimer);
    clearTimeout(persistTimer);
    clearTimeout(selectionTimer);
    clearTimeout(searchTimer);
    clearTimeout(resizeTimer);
    clearTimeout(statusTimer);
    layoutToken++;
    hideSelection();
    session = null;
    if (dialog.open && typeof dialog.close === 'function') dialog.close();
    else dialog.removeAttribute('open');
    previousFocus?.isConnected && previousFocus.focus?.({preventScroll: true});
    window.dispatchEvent(new CustomEvent('folio:reader-close', {detail: {bookId}}));
  }

  function applyPreferences() {
    if (!session) return;
    const p = state().preferences || {};
    dialog.dataset.theme = ['paper', 'sepia', 'night', 'white'].includes(p.readerTheme) ? p.readerTheme : 'paper';
    dialog.dataset.font = ['literary', 'sans', 'dyslexic', 'mono'].includes(p.font) ? p.font : 'literary';
    dialog.style.setProperty('--fr-font-size', `${clamp(p.fontSize || 20, 14, 36)}px`);
    dialog.style.setProperty('--fr-line-height', clamp(p.lineHeight || 1.8, 1.2, 2.4));
  }

  function renderChapter(position = {chapter: session.chapter, paragraph: 0, offset: 0}) {
    if (!session) return;
    session.chapter = Math.floor(clamp(position.chapter, 0, session.book.chapters.length - 1));
    const chapter = session.book.chapters[session.chapter];
    session.position = {chapter: session.chapter, paragraph: Math.floor(clamp(position.paragraph, 0, chapter.paragraphs.length - 1)), offset: clamp(position.offset, 0, .999)};
    hideSelection();
    article.replaceChildren();
    const header = document.createElement('header');
    header.className = 'fr-chapter-heading';
    const eyebrow = document.createElement('span');
    eyebrow.className = 'fr-eyebrow';
    eyebrow.textContent = session.book.full ? `CAPÍTULO ${session.chapter + 1} DE ${session.book.chapters.length}` : 'TRECHO DE LEITURA';
    const heading = document.createElement('h2');
    heading.id = 'fr-chapter-title';
    heading.textContent = chapter.title;
    header.append(eyebrow, heading);
    article.setAttribute('aria-labelledby', heading.id);
    article.append(header);
    chapter.paragraphs.forEach((text, index) => {
      const paragraph = document.createElement('p');
      paragraph.dataset.paragraph = index;
      paragraph.id = `fr-paragraph-${index}`;
      renderParagraph(paragraph, text, index);
      article.append(paragraph);
    });
    const end = document.createElement('section');
    end.className = 'fr-chapter-end';
    if (session.chapter < session.book.chapters.length - 1) {
      end.innerHTML = `<span class="fr-eyebrow">A HISTÓRIA CONTINUA</span><h3>${escape(session.book.chapters[session.chapter + 1].title)}</h3><button type="button" class="fr-primary" data-action="next">Próximo capítulo ${icon('next')}</button>`;
    } else {
      const complete = state().library[session.book.id]?.shelf === 'finished';
      end.innerHTML = `<span class="fr-end-ornament" aria-hidden="true">✦</span><h3>${session.book.full ? 'Fim da obra' : 'Fim do trecho'}</h3><p>${session.book.full ? 'Toda leitura deixa alguma coisa. Guarde uma ideia no seu caderno.' : 'Este é o texto disponível nesta edição de demonstração. Seu progresso e suas notas ficam salvos neste dispositivo.'}</p><button type="button" class="fr-primary" data-action="finish">${icon('check')}${complete ? 'Leitura concluída' : session.book.full ? 'Marcar como lido' : 'Concluir este trecho'}</button><button type="button" class="fr-text-button" data-panel="notes">Abrir meu caderno</button>`;
    }
    article.append(end);
    refreshBookmark();
    updateFooter();
    restorePosition(session.position);
  }

  function renderParagraph(node, text, index) {
    const notes = state().notes.filter(note => note.bookId === session.book.id && Number(note.chapter) === session.chapter);
    const ranges = [];
    for (const note of notes) {
      if (Array.isArray(note.ranges)) {
        for (const range of note.ranges) if (Number(range.paragraph) === index) ranges.push({start: clamp(range.start, 0, text.length), end: clamp(range.end, 0, text.length), id: note.id, text: note.text});
      } else if (Number(note.paragraph) === index && note.quote) {
        const start = text.indexOf(note.quote);
        if (start >= 0) ranges.push({start, end: start + note.quote.length, id: note.id, text: note.text});
      }
    }
    const boundaries = [...new Set([0, text.length, ...ranges.flatMap(range => [range.start, range.end])])].sort((a, b) => a - b);
    node.replaceChildren();
    for (let n = 0; n < boundaries.length - 1; n++) {
      const start = boundaries[n], end = boundaries[n + 1];
      const note = ranges.find(range => range.start <= start && range.end >= end && range.end > range.start);
      if (!note) { node.append(document.createTextNode(text.slice(start, end))); continue; }
      const mark = document.createElement('mark');
      mark.dataset.noteId = note.id;
      mark.dataset.color = notes.find(item => item.id === note.id)?.color || 'yellow';
      mark.tabIndex = 0;
      mark.setAttribute('role', 'button');
      mark.setAttribute('aria-label', `Abrir anotação: ${text.slice(start, end).slice(0, 110)}`);
      mark.title = note.text || 'Trecho grifado — abrir no caderno';
      mark.textContent = text.slice(start, end);
      node.append(mark);
    }
  }

  function restorePosition(position) {
    if (!session) return;
    const current = session;
    const token = ++layoutToken;
    current.restoring = true;
    requestAnimationFrame(() => {
      if (session !== current || token !== layoutToken) return;
      const paragraph = article.querySelector(`[data-paragraph="${position.paragraph}"]`);
      if (paragraph) {
        const paragraphTop = paragraph.getBoundingClientRect().top - viewport.getBoundingClientRect().top + viewport.scrollTop;
        viewport.scrollTop = position.paragraph === 0 && !position.offset ? 0 : Math.max(0, paragraphTop + paragraph.offsetHeight * clamp(position.offset, 0, .999) - 24);
      }
      requestAnimationFrame(() => {
        if (session !== current || token !== layoutToken) return;
        current.restoring = false;
        capturePosition();
      });
    });
  }

  function capturePosition() {
    if (!session || session.restoring) return;
    const readingLine = viewport.getBoundingClientRect().top + 24;
    const paragraphs = article.querySelectorAll('[data-paragraph]');
    let target = paragraphs[paragraphs.length - 1];
    for (const paragraph of paragraphs) {
      if (paragraph.getBoundingClientRect().bottom > readingLine) { target = paragraph; break; }
    }
    if (!target) return;
    const rect = target.getBoundingClientRect();
    session.position = {chapter: session.chapter, paragraph: Number(target.dataset.paragraph), offset: clamp((readingLine - rect.top) / Math.max(1, rect.height), 0, .999)};
    updateFooter();
  }

  function progress() {
    if (!session) return 0;
    const {book, position} = session;
    const length = book.chapters[position.chapter].paragraphs[position.paragraph].length;
    return clamp((book.offsets[position.chapter][position.paragraph] + length * position.offset) / Math.max(1, book.total), 0, .999);
  }

  function persistPosition() {
    if (!session) return;
    const {book, position} = session;
    const value = progress();
    return commit(s => {
      const entry = s.library[book.id] || {};
      s.library[book.id] = {...entry, shelf: entry.shelf === 'finished' ? 'finished' : 'reading', position: {...position}, progress: entry.shelf === 'finished' ? 1 : value, updatedAt: new Date().toISOString()};
    });
  }

  function updateFooter() {
    if (!session) return;
    const {book, chapter, position} = session;
    const complete = state().library[book.id]?.shelf === 'finished';
    const percentage = complete ? 100 : Math.min(99, Math.floor(progress() * 100));
    dialog.querySelector('#fr-progress-fill').style.width = `${percentage}%`;
    const next = dialog.querySelector('.fr-footer [data-action="next"]');
    const previous = dialog.querySelector('.fr-footer [data-action="previous"]');
    previous.disabled = chapter === 0;
    next.disabled = chapter === book.chapters.length - 1;
    dialog.querySelector('#fr-chapter-progress').textContent = `${percentage}% ${book.full ? 'da obra' : 'do trecho'} · ${chapter + 1} / ${book.chapters.length}`;
    const remaining = book.chapters[chapter].paragraphs.slice(position.paragraph).join(' ').length;
    dialog.querySelector('#fr-reading-time').textContent = remaining < 350 ? 'Fim do capítulo próximo' : `~${Math.max(1, Math.ceil(remaining / 1050))} min no capítulo`;
    updateSessionUI();
  }

  function navigate(chapter, paragraph = 0, offset = 0, keepSpeech = false) {
    if (!session || chapter < 0 || chapter >= session.book.chapters.length) return;
    persistPosition();
    if (!keepSpeech) stopSpeech();
    closePanel(false);
    renderChapter({chapter, paragraph, offset});
    persistPosition();
    viewport.focus({preventScroll: true});
    announce(`Capítulo ${chapter + 1}: ${session.book.chapters[chapter].title}`);
  }

  function setFocus(value = !session.focus) {
    session.focus = value;
    if (value) closePanel(false);
    dialog.classList.toggle('fr-focus', value);
    dialog.querySelector('.fr-focus-exit').hidden = !value;
    dialog.querySelector('.fr-header [data-action="focus"]').setAttribute('aria-pressed', String(value));
    if (value) viewport.focus({preventScroll: true});
    else dialog.querySelector('.fr-header [data-action="focus"]').focus({preventScroll: true});
  }

  function toggleBookmark() {
    if (!session) return;
    capturePosition();
    const {book, position} = session;
    let removed = false;
    if (!commit(s => {
      const entry = s.library[book.id];
      if (entry.bookmark?.chapter === position.chapter && entry.bookmark?.paragraph === position.paragraph) { delete entry.bookmark; removed = true; }
      else entry.bookmark = {...position, createdAt: new Date().toISOString()};
    })) return;
    refreshBookmark();
    announce(removed ? 'Marcador removido.' : 'Marcador salvo. Encontre-o no sumário.');
  }

  function refreshBookmark() {
    if (!session) return;
    const bookmark = state().library[session.book.id]?.bookmark;
    const button = dialog.querySelector('[data-action="bookmark"]');
    button.setAttribute('aria-pressed', String(!!bookmark));
    button.setAttribute('aria-label', bookmark ? 'Atualizar ou remover marcador neste ponto' : 'Marcar este ponto');
    article.querySelectorAll('.fr-bookmarked').forEach(node => node.classList.remove('fr-bookmarked'));
    if (bookmark?.chapter === session.chapter) article.querySelector(`[data-paragraph="${bookmark.paragraph}"]`)?.classList.add('fr-bookmarked');
  }

  function showPanel(kind, trigger) {
    if (!session) return;
    if (session.focus) setFocus(false);
    if (session.panel === kind && !trigger?.force) { closePanel(); return; }
    hideSelection(false);
    panelTrigger = trigger instanceof HTMLElement ? trigger : dialog.querySelector(`[data-panel="${kind}"]`);
    session.panel = kind;
    panel.hidden = false;
    dialog.classList.add('fr-panel-open');
    dialog.querySelectorAll('.fr-tools [data-panel]').forEach(button => button.setAttribute('aria-expanded', String(button.dataset.panel === kind)));
    const titles = {contents: 'Dentro desta história', search: 'Buscar no livro', notes: 'Seu caderno', appearance: 'Do seu jeito', voice: 'Voz do dispositivo'};
    panel.innerHTML = `<header class="fr-panel-header"><div><span class="fr-eyebrow">ESPAÇO DE LEITURA</span><h2 id="fr-panel-title" tabindex="-1">${titles[kind]}</h2></div>${tool('close-panel', 'close', 'Fechar painel')}</header><div id="fr-panel-body" class="fr-panel-body"></div>`;
    const body = panel.querySelector('#fr-panel-body');
    if (kind === 'contents') renderContents(body);
    if (kind === 'search') renderSearch(body);
    if (kind === 'notes') renderNotes(body);
    if (kind === 'appearance') renderAppearance(body);
    if (kind === 'voice') renderVoice(body);
    (kind === 'search' ? panel.querySelector('#fr-search-input') : panel.querySelector('#fr-panel-title')).focus({preventScroll: true});
  }

  function closePanel(returnFocus = true) {
    if (!dialog) return;
    panel.hidden = true;
    panel.replaceChildren();
    dialog.classList.remove('fr-panel-open');
    if (session) { session.panel = ''; session.editor = null; }
    dialog.querySelectorAll('.fr-tools [data-panel]').forEach(button => button.setAttribute('aria-expanded', 'false'));
    if (returnFocus) panelTrigger?.isConnected && panelTrigger.focus({preventScroll: true});
  }

  function renderContents(body) {
    const {book} = session;
    const bookmark = state().library[book.id]?.bookmark;
    body.innerHTML = `${bookmark ? `<button class="fr-bookmark-link" type="button" data-action="goto-bookmark">${icon('bookmark')}<span>Voltar ao marcador<small>Capítulo ${bookmark.chapter + 1} · parágrafo ${bookmark.paragraph + 1}</small></span></button>` : ''}<p class="fr-help">${book.full ? 'Texto completo disponível nesta edição.' : 'Você está lendo um trecho de demonstração.'}</p><ol class="fr-toc">${book.chapters.map((chapter, index) => `<li><button type="button" data-chapter="${index}" ${index === session.chapter ? 'aria-current="location"' : ''}><span class="fr-toc-number">${String(index + 1).padStart(2, '0')}</span><span>${escape(chapter.title)}<small>~${Math.max(1, Math.ceil(chapter.paragraphs.join(' ').length / 1050))} min de leitura</small></span></button></li>`).join('')}</ol>`;
  }

  function renderSearch(body) {
    body.innerHTML = `<label class="fr-field-label" for="fr-search-input">Uma palavra, uma passagem</label><div class="fr-search-field">${icon('search')}<input id="fr-search-input" type="search" placeholder="O que você procura?" value="${escape(session.searchQuery)}" maxlength="180" autocomplete="off"></div><div id="fr-search-results" aria-live="polite"></div>`;
    runSearch();
  }

  function normalized(text) { return text.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase('pt-BR'); }

  // Search ignores accents, but its offsets must still refer to the original text.
  function searchIndex(text, term) {
    let folded = '', cursor = 0;
    const starts = [], ends = [];
    for (const character of text) {
      const clean = normalized(character);
      for (let i = 0; i < clean.length; i++) { starts.push(cursor); ends.push(cursor + character.length); }
      folded += clean;
      cursor += character.length;
      if (!clean && ends.length) ends[ends.length - 1] = cursor;
    }
    const index = folded.indexOf(term);
    return index < 0 ? null : {index: starts[index], end: ends[index + term.length - 1]};
  }

  function runSearch() {
    if (session?.panel !== 'search') return;
    const target = panel.querySelector('#fr-search-results');
    const term = normalized(session.searchQuery.trim());
    if (term.length < 2) { target.innerHTML = '<p class="fr-help">Digite pelo menos duas letras. A busca inclui todos os capítulos disponíveis.</p>'; return; }
    const matches = [];
    let total = 0;
    session.book.chapters.forEach((chapter, c) => chapter.paragraphs.forEach((text, p) => {
      const match = searchIndex(text, term);
      if (!match) return;
      total++;
      if (matches.length < 80) matches.push({c, p, ...match, title: chapter.title, text});
    }));
    target.innerHTML = `<p class="fr-result-count">${total ? `${total} ${total === 1 ? 'passagem encontrada' : 'passagens encontradas'}` : 'Nenhuma passagem encontrada.'}${total > 80 ? ' · Mostrando as primeiras 80' : ''}</p><ul class="fr-results">${matches.map(result => {
      const start = Math.max(0, result.index - 55), end = Math.min(result.text.length, result.end + 100);
      return `<li><button type="button" data-search-chapter="${result.c}" data-search-paragraph="${result.p}"><small>${escape(result.title)}</small><span>${start ? '…' : ''}${escape(result.text.slice(start, result.index))}<mark>${escape(result.text.slice(result.index, result.end))}</mark>${escape(result.text.slice(result.end, end))}${end < result.text.length ? '…' : ''}</span></button></li>`;
    }).join('')}</ul>`;
  }

  function captureSelection() {
    if (!session || session.editor) return;
    const selection = window.getSelection();
    if (!selection || selection.isCollapsed || !selection.rangeCount) { hideSelection(false); return; }
    const range = selection.getRangeAt(0);
    if (!article.contains(range.startContainer) || !article.contains(range.endContainer)) { hideSelection(false); return; }
    const paragraphOf = node => (node.nodeType === Node.ELEMENT_NODE ? node : node.parentElement)?.closest('p[data-paragraph]');
    const startP = paragraphOf(range.startContainer), endP = paragraphOf(range.endContainer);
    if (!startP || !endP) { hideSelection(false); return; }
    const start = Number(startP.dataset.paragraph), end = Number(endP.dataset.paragraph);
    if (end - start >= 100) { hideSelection(false); announce('Selecione até 100 parágrafos por anotação.'); return; }
    const beforeStart = document.createRange();
    beforeStart.selectNodeContents(startP); beforeStart.setEnd(range.startContainer, range.startOffset);
    const beforeEnd = document.createRange();
    beforeEnd.selectNodeContents(endP); beforeEnd.setEnd(range.endContainer, range.endOffset);
    const quote = selection.toString().trim();
    if (!quote) { hideSelection(false); return; }
    if (quote.length > 12000) { hideSelection(false); announce('Selecione um trecho de até 12 mil caracteres para guardar no caderno.'); return; }
    const paragraphs = session.book.chapters[session.chapter].paragraphs;
    const ranges = [];
    for (let paragraph = start; paragraph <= end; paragraph++) ranges.push({paragraph, start: paragraph === start ? beforeStart.toString().length : 0, end: paragraph === end ? beforeEnd.toString().length : paragraphs[paragraph].length});
    selectionDraft = {chapter: session.chapter, paragraph: start, endParagraph: end, quote, ranges};
    dialog.querySelector('#fr-selection').hidden = false;
  }

  function hideSelection(clear = true) {
    if (!dialog) return;
    dialog.querySelector('#fr-selection').hidden = true;
    if (clear) { selectionDraft = null; window.getSelection()?.removeAllRanges(); }
  }

  function saveHighlight(text = '', draft = selectionDraft, existingId = null) {
    if (!draft || !session) return;
    const note = {id: existingId || id(), bookId: session.book.id, bookTitle: session.book.t, chapter: draft.chapter, paragraph: draft.paragraph, endParagraph: draft.endParagraph, quote: draft.quote, ranges: draft.ranges, text: String(text).trim(), color: draft.color || 'yellow', createdAt: draft.createdAt || new Date().toISOString()};
    if (!commit(s => {
      const found = s.notes.findIndex(item => item.id === note.id);
      if (found >= 0) s.notes[found] = note;
      else s.notes.unshift(note);
    })) return false;
    const position = {...session.position};
    hideSelection();
    for (const paragraph of article.querySelectorAll('[data-paragraph]')) renderParagraph(paragraph, session.book.chapters[session.chapter].paragraphs[Number(paragraph.dataset.paragraph)], Number(paragraph.dataset.paragraph));
    refreshBookmark();
    restorePosition(position);
    announce(text ? 'Anotação salva no seu caderno.' : 'Trecho grifado e salvo no seu caderno.');
    return true;
  }

  function openEditor(draft, existingId = null) {
    showPanel('notes', {force: true});
    session.editor = {draft, existingId};
    hideSelection();
    const body = panel.querySelector('#fr-panel-body');
    body.innerHTML = `<form id="fr-note-form"><p class="fr-help">Capítulo ${draft.chapter + 1} · ${escape(session.book.chapters[draft.chapter]?.title || '')}</p><blockquote class="fr-note-quote">${escape(draft.quote)}</blockquote><label for="fr-note-text" class="fr-field-label">O que este trecho despertou em você?</label><textarea id="fr-note-text" rows="6" maxlength="6000" placeholder="Uma ideia, uma conexão, uma pergunta…">${escape(draft.text || '')}</textarea><div class="fr-form-actions"><button class="fr-primary" type="submit">Salvar anotação</button><button class="fr-text-button" type="button" data-action="cancel-note">Cancelar</button></div></form>`;
    panel.querySelector('#fr-note-text').focus();
  }

  function renderNotes(body) {
    const notes = state().notes.filter(note => note.bookId === session.book.id);
    body.innerHTML = `<p class="fr-help">${notes.length ? `${notes.length} ${notes.length === 1 ? 'lembrança desta leitura' : 'lembranças desta leitura'}. Suas anotações ficam neste dispositivo.` : 'Ideias que ficam com você. Selecione um trecho do texto para grifar ou escrever uma anotação.'}</p>${notes.length ? `<ol class="fr-notes">${notes.map(note => `<li data-note-card="${escape(note.id)}"><small>CAPÍTULO ${Number(note.chapter) + 1}</small><blockquote>${escape(note.quote)}</blockquote>${note.text ? `<p>${escape(note.text)}</p>` : '<span class="fr-note-type">Trecho grifado</span>'}<div class="fr-note-actions"><button type="button" data-goto-note="${escape(note.id)}">Ir ao trecho</button><button type="button" data-edit-note="${escape(note.id)}">Editar</button><button type="button" data-delete-note="${escape(note.id)}" aria-label="Excluir anotação: ${escape(note.quote.slice(0, 50))}">Excluir</button></div></li>`).join('')}</ol>` : '<div class="fr-empty-note" aria-hidden="true">“</div>'}`;
  }

  function renderAppearance(body) {
    const p = state().preferences;
    const themes = [['paper', 'Papel'], ['white', 'Claro'], ['sepia', 'Sépia'], ['night', 'Noite']];
    const fonts = [['literary', 'Literária'], ['sans', 'Contemporânea'], ['dyslexic', 'Leitura clara'], ['mono', 'Monoespaçada']];
    body.innerHTML = `<fieldset class="fr-setting"><legend>Cor da página</legend><div class="fr-theme-options">${themes.map(([value, label]) => `<button type="button" data-reader-theme="${value}" aria-pressed="${p.readerTheme === value}"><span class="fr-theme-swatch fr-swatch-${value}" aria-hidden="true">A</span>${label}</button>`).join('')}</div></fieldset><fieldset class="fr-setting"><legend>Fonte</legend><div class="fr-font-options">${fonts.map(([value, label]) => `<button type="button" data-reader-font="${value}" aria-pressed="${p.font === value}"><span>${label}</span><span aria-hidden="true">Aa</span></button>`).join('')}</div></fieldset><div class="fr-setting"><label for="fr-font-size">Tamanho do texto <output id="fr-font-output">${p.fontSize || 20}px</output></label><div class="fr-range-row"><span aria-hidden="true">A</span><input id="fr-font-size" type="range" min="14" max="34" step="1" value="${p.fontSize || 20}"><span aria-hidden="true">A</span></div></div><div class="fr-setting"><label for="fr-line-height">Espaço entre linhas</label><select id="fr-line-height"><option value="1.5"${Number(p.lineHeight) === 1.5 ? ' selected' : ''}>Compacto · 1,5</option><option value="1.8"${Number(p.lineHeight) === 1.8 ? ' selected' : ''}>Confortável · 1,8</option><option value="2.1"${Number(p.lineHeight) === 2.1 ? ' selected' : ''}>Amplo · 2,1</option></select></div><div class="fr-tip"><strong>Um capítulo de cada vez.</strong><p>Role para ler. Use Page Up e Page Down para avançar pelo texto, ou Alt + ← / → para trocar de capítulo. O modo foco esconde as ferramentas.</p></div>`;
  }

  function setPreference(key, value) {
    const position = {...session.position};
    if (!commit(s => { s.preferences[key] = value; })) return;
    applyPreferences();
    restorePosition(position);
    if (key === 'fontSize' && panel.querySelector('#fr-font-output')) panel.querySelector('#fr-font-output').textContent = `${value}px`;
    panel.querySelectorAll('[data-reader-theme]').forEach(button => button.setAttribute('aria-pressed', String(button.dataset.readerTheme === state().preferences.readerTheme)));
    panel.querySelectorAll('[data-reader-font]').forEach(button => button.setAttribute('aria-pressed', String(button.dataset.readerFont === state().preferences.font)));
  }

  const speechAvailable = () => 'speechSynthesis' in window && 'SpeechSynthesisUtterance' in window;

  function renderVoice(body) {
    if (!speechAvailable()) { body.innerHTML = '<p class="fr-help">Este navegador não oferece leitura por voz. Você pode continuar lendo normalmente e experimentar a voz em outro navegador compatível.</p>'; return; }
    body.innerHTML = `<div class="fr-voice-symbol" aria-hidden="true">${icon('sound')}</div><p class="fr-voice-intro">Uma companhia para a leitura.</p><p class="fr-help">Voz sintética do seu dispositivo. Não é um audiolivro com narração profissional. A disponibilidade de vozes e o uso sem internet dependem do dispositivo.</p><div class="fr-voice-controls"><button type="button" class="fr-primary" data-action="speech-toggle"></button><button type="button" class="fr-text-button" data-action="speech-stop">Parar</button></div><p id="fr-voice-status" class="fr-help" role="status"></p><div class="fr-setting"><label for="fr-voice-select">Voz</label><select id="fr-voice-select"></select></div><div class="fr-setting"><label for="fr-voice-rate">Velocidade</label><select id="fr-voice-rate">${[.75, 1, 1.25, 1.5, 2].map(rate => `<option value="${rate}"${speech.rate === rate ? ' selected' : ''}>${String(rate).replace('.', ',')}×${rate === 1 ? ' · Natural' : ''}</option>`).join('')}</select></div><p class="fr-help">Começa no parágrafo em que você está. A voz é interrompida ao fechar o livro.</p>`;
    fillVoices();
    updateSpeechUI();
  }

  function fillVoices() {
    const select = panel.querySelector('#fr-voice-select');
    if (!select || !speechAvailable()) return;
    const language = session.book.language.toLowerCase();
    const voices = window.speechSynthesis.getVoices().filter(voice => voice.lang.split(/[-_]/)[0].toLowerCase() === language.split(/[-_]/)[0]);
    select.replaceChildren(new Option(`Padrão do dispositivo · ${session.book.language}`, ''));
    voices.sort((a, b) => Number(b.lang.toLowerCase() === language) - Number(a.lang.toLowerCase() === language)).forEach(voice => select.add(new Option(`${voice.name} · ${voice.lang}`, voice.voiceURI)));
    select.value = voices.some(voice => voice.voiceURI === speech.voiceURI) ? speech.voiceURI : '';
  }

  function updateSpeechUI() {
    if (!session) return;
    const button = panel.querySelector('[data-action="speech-toggle"]');
    if (button) button.textContent = speech.status === 'playing' ? 'Pausar leitura' : speech.status === 'paused' ? 'Continuar leitura' : 'Ouvir a partir daqui';
    const stop = panel.querySelector('[data-action="speech-stop"]');
    if (stop) stop.disabled = speech.status === 'idle';
    const label = panel.querySelector('#fr-voice-status');
    if (label) label.textContent = speech.status === 'playing' ? `Lendo o parágrafo ${speech.paragraph + 1} do capítulo ${session.chapter + 1}.` : speech.status === 'paused' ? 'Leitura em voz pausada.' : 'Pronto para começar.';
    dialog.querySelector('.fr-tools [data-panel="voice"]').classList.toggle('fr-voice-active', speech.status !== 'idle');
  }

  function stopSpeech() {
    speechToken++;
    if (speech.status !== 'idle' || speech.utterance) window.speechSynthesis?.cancel();
    speech.status = 'idle';
    speech.utterance = null;
    article?.querySelectorAll('.fr-speaking').forEach(node => node.classList.remove('fr-speaking'));
    updateSpeechUI();
  }

  function toggleSpeech() {
    if (!speechAvailable()) return;
    if (speech.status === 'playing') { window.speechSynthesis.pause(); speech.status = 'paused'; updateSpeechUI(); return; }
    if (speech.status === 'paused') { window.speechSynthesis.resume(); speech.status = 'playing'; updateSpeechUI(); return; }
    startSpeech(session.position.paragraph);
  }

  function chunks(text) {
    const result = [];
    let rest = text.trim();
    while (rest.length) {
      if (rest.length <= 450) { result.push(rest); break; }
      const piece = rest.slice(0, 450);
      const sentence = Math.max(piece.lastIndexOf('. '), piece.lastIndexOf('! '), piece.lastIndexOf('? '), piece.lastIndexOf('; '));
      const space = piece.lastIndexOf(' ');
      const boundary = sentence > 120 ? sentence + 1 : space > 0 ? space : 450;
      result.push(rest.slice(0, boundary)); rest = rest.slice(boundary).trimStart();
    }
    return result.length ? result : [' '];
  }

  function startSpeech(paragraph) {
    stopSpeech();
    if (!session || !speechAvailable()) return;
    speech.status = 'playing';
    speech.paragraph = paragraph;
    speech.chunk = 0;
    speech.chunks = chunks(session.book.chapters[session.chapter].paragraphs[paragraph]);
    const token = ++speechToken;
    speakNext(token);
  }

  function speakNext(token) {
    if (!session || token !== speechToken || speech.status === 'idle') return;
    const paragraph = article.querySelector(`[data-paragraph="${speech.paragraph}"]`);
    article.querySelectorAll('.fr-speaking').forEach(node => node.classList.remove('fr-speaking'));
    paragraph?.classList.add('fr-speaking');
    if (speech.chunk === 0) {
      session.position = {chapter: session.chapter, paragraph: speech.paragraph, offset: 0};
      restorePosition(session.position);
      persistPosition();
    }
    const utterance = new SpeechSynthesisUtterance(speech.chunks[speech.chunk]);
    utterance.lang = session.book.language;
    utterance.rate = speech.rate;
    const voices = window.speechSynthesis.getVoices();
    const language = session.book.language.toLowerCase();
    utterance.voice = voices.find(voice => voice.voiceURI === speech.voiceURI) || voices.find(voice => voice.lang.toLowerCase() === language) || voices.find(voice => voice.lang.split(/[-_]/)[0].toLowerCase() === language.split(/[-_]/)[0]) || null;
    utterance.onend = () => {
      if (!session || token !== speechToken) return;
      speech.chunk++;
      if (speech.chunk >= speech.chunks.length) {
        speech.paragraph++; speech.chunk = 0;
        if (speech.paragraph >= session.book.chapters[session.chapter].paragraphs.length) {
          if (session.chapter >= session.book.chapters.length - 1) { stopSpeech(); announce('A leitura em voz chegou ao fim. Você pode marcar sua leitura como concluída.'); return; }
          navigate(session.chapter + 1, 0, 0, true);
          speech.paragraph = 0;
        }
        speech.chunks = chunks(session.book.chapters[session.chapter].paragraphs[speech.paragraph]);
      }
      setTimeout(() => speakNext(token), 50);
    };
    utterance.onerror = event => {
      if (token !== speechToken || ['canceled', 'interrupted'].includes(event.error)) return;
      stopSpeech();
      announce('Não foi possível continuar a voz. Tente outra voz ou inicie a leitura novamente.');
    };
    speech.utterance = utterance;
    window.speechSynthesis.speak(utterance);
    updateSpeechUI();
  }

  function activityTick() {
    if (!session) return;
    const now = performance.now();
    const seconds = Math.min(3, Math.max(0, (now - lastTick) / 1000));
    lastTick = now;
    if (!document.hidden && !session.paused && (Date.now() - lastInteraction < 90000 || speech.status === 'playing')) {
      pendingActivity[localDate()] = (pendingActivity[localDate()] || 0) + seconds;
      session.elapsed += seconds;
      if (session.duration && session.elapsed >= session.duration && !session.achieved) {
        session.achieved = true;
        announce(`Você completou sua sessão de ${session.duration / 60} minutos. Continue no seu ritmo ou faça uma pausa.`);
        window.dispatchEvent(new CustomEvent('folio:session-complete', {detail: {bookId: session.book.id, minutes: session.duration / 60}}));
      }
      updateSessionUI();
    }
    if (Object.values(pendingActivity).reduce((a, b) => a + b, 0) >= 15) flushActivity();
  }

  function updateSessionUI() {
    if (!session) return;
    const button = dialog.querySelector('#fr-session');
    button.hidden = !session.duration;
    if (!session.duration) return;
    const remaining = Math.max(0, Math.ceil(session.duration - session.elapsed));
    const countdown = `${Math.floor(remaining / 60)}:${String(remaining % 60).padStart(2, '0')}`;
    button.textContent = session.achieved ? `${session.duration / 60} min · sessão cumprida ✓` : session.paused ? `Sessão pausada · ${countdown}` : `Sua sessão · ${countdown}`;
    button.setAttribute('aria-label', session.paused ? 'Continuar a sessão de leitura' : 'Pausar a sessão de leitura');
    button.setAttribute('aria-pressed', String(session.paused));
    button.title = session.paused ? 'Continuar sessão' : 'Pausar sessão';
  }

  function flushActivity() {
    const elapsed = pendingActivity;
    pendingActivity = {};
    if (!Object.values(elapsed).some(seconds => seconds >= .1)) return;
    if (!commit(s => {
      s.activity ||= {};
      for (const [day, seconds] of Object.entries(elapsed)) s.activity[day] = Math.min(86400, Math.round(((s.activity[day] || 0) + seconds) * 10) / 10);
    })) for (const [day, seconds] of Object.entries(elapsed)) pendingActivity[day] = (pendingActivity[day] || 0) + seconds;
  }

  function handleClick(event) {
    if (!session) return;
    const button = event.target.closest('button, mark[data-note-id]');
    if (!button || !dialog.contains(button)) return;
    if (button.dataset.panel) { showPanel(button.dataset.panel, button); return; }
    if (button.dataset.chapter != null) { navigate(Number(button.dataset.chapter)); return; }
    if (button.dataset.searchChapter != null) {
      navigate(Number(button.dataset.searchChapter), Number(button.dataset.searchParagraph));
      const target = article.querySelector(`[data-paragraph="${button.dataset.searchParagraph}"]`);
      target?.classList.add('fr-found');
      setTimeout(() => target?.classList.remove('fr-found'), 2500);
      return;
    }
    if (button.dataset.readerTheme) { setPreference('readerTheme', button.dataset.readerTheme); return; }
    if (button.dataset.readerFont) { setPreference('font', button.dataset.readerFont); return; }
    const noteId = button.dataset.noteId || button.dataset.gotoNote || button.dataset.editNote || button.dataset.deleteNote;
    if (noteId) {
      const note = state().notes.find(item => item.id === noteId && item.bookId === session.book.id);
      if (!note) return;
      if (button.dataset.deleteNote) {
        if (!commit(s => { s.notes = s.notes.filter(item => item.id !== noteId); })) return;
        const position = {...session.position};
        for (const p of article.querySelectorAll('[data-paragraph]')) renderParagraph(p, session.book.chapters[session.chapter].paragraphs[Number(p.dataset.paragraph)], Number(p.dataset.paragraph));
        refreshBookmark(); restorePosition(position);
        renderNotes(panel.querySelector('#fr-panel-body'));
        panel.querySelector('#fr-panel-title').focus();
        announce('Anotação excluída.');
      } else if (button.dataset.gotoNote) navigate(Number(note.chapter), Number(note.paragraph));
      else {
        const selection = window.getSelection();
        if (button.dataset.noteId && selection && !selection.isCollapsed) return;
        openEditor(note, note.id);
      }
      return;
    }
    switch (button.dataset.action) {
      case 'close': close(); break;
      case 'close-panel': closePanel(); break;
      case 'previous': navigate(session.chapter - 1); break;
      case 'next': navigate(session.chapter + 1); break;
      case 'focus': setFocus(); break;
      case 'bookmark': toggleBookmark(); break;
      case 'goto-bookmark': { const bookmark = state().library[session.book.id]?.bookmark; if (bookmark) navigate(bookmark.chapter, bookmark.paragraph, bookmark.offset); break; }
      case 'clear-selection': hideSelection(); viewport.focus({preventScroll: true}); break;
      case 'highlight': saveHighlight(); break;
      case 'annotate': if (selectionDraft) openEditor({...selectionDraft}); break;
      case 'cancel-note': session.editor = null; renderNotes(panel.querySelector('#fr-panel-body')); panel.querySelector('#fr-panel-title').focus(); break;
      case 'speech-toggle': toggleSpeech(); break;
      case 'speech-stop': stopSpeech(); break;
      case 'session-toggle':
        activityTick();
        session.paused = !session.paused;
        if (session.paused && speech.status === 'playing') toggleSpeech();
        updateSessionUI();
        announce(session.paused ? 'Sessão pausada. O tempo não está sendo contado.' : 'Sessão retomada.');
        break;
      case 'finish':
        if (!commit(s => { s.library[session.book.id] = {...s.library[session.book.id], shelf: 'finished', progress: 1, updatedAt: new Date().toISOString()}; })) return;
        button.textContent = 'Leitura concluída';
        updateFooter();
        announce(session.book.full ? 'Livro marcado como lido. Sua leitura ficou registrada na biblioteca.' : 'Trecho marcado como concluído.');
        break;
    }
  }

  function handleInput(event) {
    if (!session) return;
    if (event.target.id === 'fr-search-input') { session.searchQuery = event.target.value; clearTimeout(searchTimer); searchTimer = setTimeout(runSearch, 140); }
    if (event.target.id === 'fr-font-size') setPreference('fontSize', Number(event.target.value));
  }

  function handleChange(event) {
    if (!session) return;
    if (event.target.id === 'fr-line-height') setPreference('lineHeight', Number(event.target.value));
    if (event.target.id === 'fr-voice-rate' || event.target.id === 'fr-voice-select') {
      const wasPlaying = speech.status === 'playing';
      const paragraph = speech.status === 'idle' ? session.position.paragraph : speech.paragraph;
      if (event.target.id === 'fr-voice-rate') speech.rate = clamp(event.target.value, .5, 2);
      else speech.voiceURI = event.target.value;
      if (wasPlaying) startSpeech(paragraph);
      else if (speech.status === 'paused') stopSpeech();
    }
  }

  function handleSubmit(event) {
    if (event.target.id !== 'fr-note-form') return;
    event.preventDefault();
    if (!session?.editor) return;
    const {draft, existingId} = session.editor;
    if (!saveHighlight(panel.querySelector('#fr-note-text').value, draft, existingId)) return;
    session.editor = null;
    renderNotes(panel.querySelector('#fr-panel-body'));
    panel.querySelector('#fr-panel-title').focus();
  }

  function handleKey(event) {
    if (!session) return;
    event.stopPropagation();
    if (event.key === 'Escape') {
      event.preventDefault();
      if (!dialog.querySelector('#fr-selection').hidden) hideSelection();
      else if (!panel.hidden) closePanel();
      else if (session.focus) setFocus(false);
      else close();
      return;
    }
    if (event.target.matches('mark[data-note-id]') && ['Enter', ' '].includes(event.key)) { event.preventDefault(); event.target.click(); return; }
    const editable = event.target.matches('input,textarea,select,[contenteditable="true"]');
    if (editable || event.ctrlKey || event.metaKey) return;
    if (event.altKey && ['ArrowLeft', 'ArrowRight'].includes(event.key)) { event.preventDefault(); navigate(session.chapter + (event.key === 'ArrowRight' ? 1 : -1)); return; }
    if (panel.hidden && ['PageDown', 'PageUp'].includes(event.key)) { event.preventDefault(); viewport.scrollBy({top: viewport.clientHeight * .85 * (event.key === 'PageDown' ? 1 : -1), behavior: 'auto'}); }
    if (event.key === 'Tab' && typeof dialog.showModal !== 'function') {
      const focusable = [...dialog.querySelectorAll('button,input,textarea,select,[tabindex="0"]')].filter(node => !node.disabled && node.getClientRects().length);
      if (event.shiftKey && document.activeElement === focusable[0]) { event.preventDefault(); focusable.at(-1)?.focus(); }
      else if (!event.shiftKey && document.activeElement === focusable.at(-1)) { event.preventDefault(); focusable[0]?.focus(); }
    }
  }

  window.FolioReader = Object.freeze({open, close, get isOpen() { return !!session; }});
})();
