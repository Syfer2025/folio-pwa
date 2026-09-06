/* Folio — biblioteca pessoal e descoberta. Nenhum serviço externo recebe seus livros. */
(() => {
  'use strict';
  const $ = (selector, root = document) => root.querySelector(selector);
  const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const fold = value => String(value ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase('pt-BR');
  const localDay = (date = new Date()) => [date.getFullYear(), String(date.getMonth()+1).padStart(2,'0'), String(date.getDate()).padStart(2,'0')].join('-');
  const dateLabel = value => new Intl.DateTimeFormat('pt-BR',{day:'numeric',month:'short',year:'numeric'}).format(new Date(value));
  const fmtMinutes = n => { n = Math.max(1,Math.ceil(n || 1)); return n >= 60 ? Math.floor(n/60)+' h'+(n%60 ? ' '+n%60+' min' : '') : n+' min'; };
  const pct = n => Math.round(Math.max(0,Math.min(1,n || 0))*100);
  const bytesLabel = n => n >= 1048576 ? (n/1048576).toLocaleString('pt-BR',{maximumFractionDigits:1})+' MB' : Math.ceil(n/1024)+' KB';
  const store = window.FolioStore;
  const catalog = Array.isArray(window.FOLIO_CATALOG) ? window.FOLIO_CATALOG : [];
  const catalogById = new Map(catalog.map(book => [book.id,book]));
  const books = new Map(), loadingBooks = new Map();
  const main = $('#main'), appDialog = $('#app-dialog'), dialogBody = $('#dialog-body');
  const icons = {
    home:'<path d="m3 10 9-7 9 7v10H3V10Z"/><path d="M9 20v-7h6v7"/>',
    search:'<circle cx="10.5" cy="10.5" r="6.5"/><path d="m16 16 5 5"/>',
    path:'<circle cx="5" cy="5" r="2"/><circle cx="19" cy="19" r="2"/><path d="M7 5h9a4 4 0 0 1 0 8H8a3 3 0 0 0 0 6h9"/>',
    library:'<path d="M3 4h4v16H3zM10 4h4v16h-4zM17 5l3-1 4 15-3 1z"/>',
    pen:'<path d="m14 4 3-3 5 5-3 3M14 4 4 14l-2 8 8-2L20 10M6 14l4 4"/>',
    upload:'<path d="M12 16V3m-5 5 5-5 5 5M3 15v6h18v-6"/>',
    download:'<path d="M12 3v13m-5-5 5 5 5-5M3 17v4h18v-4"/>',
    settings:'<path d="M4 6h16M4 12h16M4 18h16"/><circle cx="9" cy="6" r="2"/><circle cx="16" cy="12" r="2"/><circle cx="8" cy="18" r="2"/>',
    arrow:'<path d="M4 12h16m-6-6 6 6-6 6"/>', chevron:'<path d="m9 5 7 7-7 7"/>',
    book:'<path d="M12 5v16M3 3c4 0 6 0 9 2 3-2 5-2 9-2v16c-4 0-6 0-9 2-3-2-5-2-9-2V3Z"/>',
    clock:'<circle cx="12" cy="12" r="9"/><path d="M12 6v6l4 2"/>',
    check:'<path d="m5 12 5 5L20 7"/>', plus:'<path d="M12 4v16M4 12h16"/>',
    close:'<path d="m6 6 12 12M6 18 18 6"/>',
    share:'<path d="M12 16V2m-5 5 5-5 5 5M5 11H3v10h18V11h-2"/>',
    note:'<path d="M4 3h16v18H4zM8 8h8M8 12h8M8 16h5"/>',
    offline:'<path d="m3 3 18 18M2 8a18 18 0 0 1 20 0M5 12a12 12 0 0 1 12-2M8 16a6 6 0 0 1 4-1"/><circle cx="12" cy="20" r="1"/>',
    trash:'<path d="M3 6h18M9 6V3h6v3M6 6l1 15h10l1-15M10 10v7M14 10v7"/>'
  };
  const icon = name => '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">'+(icons[name] || icons.book)+'</svg>';
  let route = 'hoje', detailId = '', query = '', mood = '', libraryFilter = 'all', sort = 'recent', noteQuery = '', noteBook = '';
  let minutes = 10, ready = false, renderTimer, toastTimer, searchTimer, previousFocus, pendingRestore, importedDraft;
  let installPrompt, swRegistration, updateAccepted = false, reloading = false, bootError = '', modalKind = '', busyImport = false;
  let bodyOverflow = '', mutationDepth = 0;
  const state = () => store.getState();
  const allBooks = () => [...catalog.map(book => ({...books.get(book.id),...book})), ...[...books.values()].filter(book => !catalogById.has(book.id))];
  const byId = id => catalogById.has(id) ? {...books.get(id),...catalogById.get(id)} : books.get(id);
  const hasOffline = id => books.has(id);
  const entry = id => state().library[id];
  const bookMins = book => book.minutes || book.mins || 1;
  const chapterData = book => book.sessions || (book.chapters || []).map((chapter,index) => ({chapter:index,title:chapter.title,minutes:Math.max(1,Math.ceil(chapter.paragraphs.join(' ').split(/\s+/).length/200))}));
  const safeExternal = value => { try { const u = new URL(value); return u.protocol === 'https:' && !u.username && !u.password ? u.href : ''; } catch { return ''; } };
  const externalLink = (url,label) => safeExternal(url) ? '<a href="'+esc(safeExternal(url))+'" target="_blank" rel="noopener noreferrer">'+esc(label)+'</a>' : '';
  const button = (label, action, id = '', kind = 'secondary', glyph = '') => '<button type="button" class="button '+kind+'" data-action="'+action+'"'+(id ? ' data-id="'+esc(id)+'"' : '')+'>'+(glyph ? icon(glyph) : '')+esc(label)+'</button>';

  function toast(message) {
    const node = $('#toast'); node.textContent = message; node.classList.add('is-visible');
    clearTimeout(toastTimer); toastTimer = setTimeout(() => node.classList.remove('is-visible'),5000);
  }
  function report(error) {
    console.error('[Folio]',error);
    const message = error?.message || 'Não foi possível concluir. Tente novamente.';
    if (appDialog.open) {
      let node = $('#dialog-error');
      if (!node) { node = document.createElement('p'); node.id = 'dialog-error'; node.className = 'dialog-alert error-text'; node.setAttribute('role','alert'); dialogBody.append(node); }
      node.textContent = message;
    }
    toast(message);
  }
  function cover(book, compact = false) {
    const variant = Math.abs(Number(book.pal) || 0)%4;
    return '<div class="cover" data-variant="'+variant+'" aria-hidden="true"><span class="cover-edition">'+(book.source === 'import' ? 'MINHA EDIÇÃO' : 'FOLIO / LEITURAS')+'</span><span class="cover-title">'+esc(book.t)+'</span><span class="cover-rule"></span><span class="cover-author">'+esc(book.a)+'</span>'+(compact ? '' : '<span class="cover-bottom">f.</span>')+'</div>';
  }
  function card(book) {
    const item = entry(book.id), progress = item?.progress || 0;
    return '<article class="book-card"><button type="button" class="book-cover-button" data-action="detail" data-id="'+esc(book.id)+'" aria-label="Ver '+esc(book.t)+', '+esc(book.a)+'">'+cover(book)+(hasOffline(book.id) ? '<span class="cover-badge">'+icon('check')+'Neste aparelho</span>' : '')+'</button><button class="book-title" data-action="detail" data-id="'+esc(book.id)+'">'+esc(book.t)+'</button><p class="book-author">'+esc(book.a)+'</p><p class="book-meta">'+(item?.shelf === 'finished' ? icon('check')+'Concluído' : progress > 0 ? pct(progress)+'% lido · ~'+fmtMinutes(bookMins(book)*(1-progress))+' restantes' : esc(book.g || 'Sua coleção')+' · ~'+fmtMinutes(bookMins(book)))+'</p>'+(progress > 0 ? '<div class="book-progress" role="progressbar" aria-label="Progresso de '+esc(book.t)+'" aria-valuemin="0" aria-valuemax="100" aria-valuenow="'+pct(progress)+'"><i style="width:'+pct(progress)+'%"></i></div>' : '')+'</article>';
  }
  function empty(title, text, actions = '', glyph = 'book') { return '<div class="empty">'+icon(glyph)+'<h2>'+esc(title)+'</h2><p>'+esc(text)+'</p>'+actions+'</div>'; }
  function heading(kicker,title,text,actions = '') { return '<div class="page-heading"><div><p class="eyebrow">'+esc(kicker)+'</p><h1>'+esc(title)+'</h1>'+(text ? '<p>'+esc(text)+'</p>' : '')+'</div>'+actions+'</div>'; }
  function section(title,subtitle,content,link = '') { return '<section class="section"><div class="section-heading"><div><h2>'+esc(title)+'</h2>'+(subtitle ? '<p>'+esc(subtitle)+'</p>' : '')+'</div>'+link+'</div>'+content+'</section>'; }
  function libraryBooks() {
    const saved = state().library;
    return allBooks().filter(book => saved[book.id] || book.source === 'import').sort((a,b) => (saved[b.id]?.updatedAt || b.importedAt || '').localeCompare(saved[a.id]?.updatedAt || a.importedAt || ''));
  }
  function readingBooks() { return libraryBooks().filter(book => entry(book.id)?.shelf === 'reading'); }
  function dayStats() {
    const s = state(), today = localDay(), seconds = s.activity[today] || 0;
    const week = Array.from({length:7},(_,i) => { const d = new Date(); d.setDate(d.getDate()-6+i); return {key:localDay(d),name:new Intl.DateTimeFormat('pt-BR',{weekday:'short'}).format(d).replace('.',''),seconds:s.activity[localDay(d)] || 0}; });
    let streak = 0, d = new Date();
    if (!(s.activity[localDay(d)] > 0)) d.setDate(d.getDate()-1);
    while (s.activity[localDay(d)] > 0 && streak < 10000) { streak++; d.setDate(d.getDate()-1); }
    return {today,seconds,week,streak,goal:s.preferences.goal};
  }
  function sessionChoices() {
    const readings = readingBooks(), rest = allBooks().filter(book => !readings.some(b => b.id === book.id) && entry(book.id)?.shelf !== 'finished');
    return [...readings,...rest].slice(0,3).map(book => {
      const pos = entry(book.id)?.position || {chapter:0,paragraph:0}, chapters = chapterData(book);
      const current = chapters[Math.min(pos.chapter,chapters.length-1)] || {title:'Começar a leitura',minutes:bookMins(book),chapter:0};
      return {book,current,resume:!!entry(book.id)?.progress};
    });
  }
  function timeCards() {
    return '<div class="time-picker" role="group" aria-label="Tempo disponível">'+[5,10,20].map(n => '<button class="chip" data-action="time" data-minutes="'+n+'" aria-pressed="'+(n === minutes)+'">'+icon('clock')+n+' minutos</button>').join('')+'</div><div class="session-grid">'+sessionChoices().map(({book,current,resume}) => '<button class="session-card" data-action="session" data-id="'+esc(book.id)+'">'+cover(book,true)+'<span><strong>'+esc(book.t)+'</strong><span class="session-subtitle">'+(resume ? 'Retome sua posição' : esc(current.title))+'</span><span class="session-time">'+icon('clock')+(current.minutes <= minutes ? 'Próximo capítulo · ~'+fmtMinutes(current.minutes) : 'Leia por '+minutes+' min, no seu ritmo')+'</span></span></button>').join('')+'</div><p class="section-note">Estimativas a 200 palavras/minuto. O tempo conta com a leitura ativa; você escolhe quando parar.</p>';
  }
  function renderHome() {
    const reading = readingBooks(), hero = reading[0] || allBooks()[0], stats = dayStats();
    let html = heading('NO SEU TEMPO',reading.length ? 'Sua história continua.' : 'Sua próxima página.','Um pouco de leitura também é leitura.', '<button class="quiet-link" data-action="stats">'+icon('clock')+'Seu ritmo '+icon('chevron')+'</button>');
    if (hero) {
      const progress = entry(hero.id)?.progress || 0;
      html += '<div class="hero-grid"><article class="feature"><div><p class="eyebrow">'+(reading.length ? 'DE ONDE VOCÊ PAROU' : 'COMECE AQUI')+'</p><h2 class="feature-title">'+esc(hero.t)+'</h2><p class="feature-author">'+esc(hero.a)+'</p><p class="feature-desc">'+esc(hero.d || 'Sua edição está pronta para acompanhar você. Guarde trechos, faça anotações e descubra seu ritmo.')+'</p><div class="feature-meta"><span>'+icon('clock')+'~'+fmtMinutes(bookMins(hero)*(1-progress))+(progress ? ' restantes' : ' de leitura')+'</span>'+(progress ? '<span>'+pct(progress)+'% lido</span>' : '')+'</div>'+button(reading.length ? 'Continuar lendo' : 'Abrir livro','read',hero.id,'primary','book')+'</div><button class="feature-cover book-cover-button" data-action="detail" data-id="'+esc(hero.id)+'" aria-label="Detalhes de '+esc(hero.t)+'">'+cover(hero)+'</button></article><aside class="goal-card"><span class="goal-top">SEU MOMENTO DE LEITURA</span><div class="goal-ring" style="--goal-progress:'+Math.min(100,stats.seconds/(stats.goal*60)*100)+'%"><span>'+Math.floor(stats.seconds/60)+'<small>de '+stats.goal+' min</small></span></div><strong>'+(stats.seconds >= stats.goal*60 ? 'Seu tempo bem vivido.' : 'Um intervalo só seu.')+'</strong><p>'+(stats.streak ? stats.streak+' dia'+(stats.streak === 1 ? '' : 's')+' com leitura' : 'Seu ritmo começa com uma página.')+'</p><button class="quiet-link" data-action="stats">Acompanhar meu ritmo '+icon('arrow')+'</button></aside></div>';
    }
    html += section('Quanto tempo você tem?','Um capítulo inteiro ou só algumas páginas.',timeCards());
    if (reading.length > 1) html += section('Suas leituras em curso','', '<div class="book-grid">'+reading.slice(1,6).map(card).join('')+'</div>');
    html += section('Um lugar para cada história','O acervo inicial e os livros que você trouxer.', '<div class="book-grid">'+allBooks().slice(0,8).map(card).join('')+'</div>', '<a class="quiet-link" href="#explorar">Explorar '+icon('arrow')+'</a>');
    html += '<section class="import-callout"><div>'+icon('upload')+'<div><h2>Seus livros também moram aqui.</h2><p>Importe uma edição EPUB, TXT ou JSON e leia com suas preferências.</p></div></div>'+button('Importar livro','import','','secondary','plus')+'</section>';
    main.innerHTML = html;
  }
  function renderExplore() {
    main.innerHTML = heading('DESCOBERTAS','Encontre sua leitura.','Busque no acervo e nos livros importados.',button('Importar','import','','secondary small','upload'))+
      '<label class="search-box" for="catalog-search">'+icon('search')+'<input id="catalog-search" type="search" maxlength="150" placeholder="Título, autor ou assunto" autocomplete="off" value="'+esc(query)+'"><button type="button" class="clear-button" data-action="clear-search" aria-label="Limpar busca">'+icon('close')+'</button></label>'+
      '<div class="filter-bar"><div class="chips" role="group" aria-label="Tipo de leitura">'+[['','Todos'],['short','Até 30 minutos'],['import','Meus arquivos'],['offline','Neste aparelho']].map(([id,label])=>'<button class="chip" data-action="mood" data-value="'+id+'" aria-pressed="'+(mood === id)+'">'+label+'</button>').join('')+'</div><label class="sort-label">Ordenar <select id="catalog-sort" class="field-select"><option value="title">Título</option><option value="time">Menor duração</option><option value="author">Autor</option></select></label></div><div id="catalog-results" aria-live="polite" aria-atomic="false"></div>';
    $('#catalog-sort').value = ['title','time','author'].includes(sort) ? sort : 'title';
    renderExploreResults();
  }
  function renderExploreResults() {
    const target = $('#catalog-results'); if (!target) return;
    let list = allBooks().filter(book => fold([book.t,book.a,book.g,book.d].join(' ')).includes(fold(query)));
    if (mood === 'short') list = list.filter(book => bookMins(book) <= 30);
    if (mood === 'import') list = list.filter(book => book.source === 'import');
    if (mood === 'offline') list = list.filter(book => hasOffline(book.id));
    list.sort((a,b) => sort === 'time' ? bookMins(a)-bookMins(b) : (sort === 'author' ? a.a : a.t).localeCompare(sort === 'author' ? b.a : b.t,'pt-BR'));
    target.innerHTML = '<p class="count-label">'+list.length+' livro'+(list.length === 1 ? '' : 's')+'</p>'+(list.length ? '<div class="book-grid">'+list.map(card).join('')+'</div>' : empty('Nenhum livro por aqui','Experimente outra busca, limpe os filtros ou importe sua edição.',button('Limpar filtros','reset-search')+button('Importar livro','import','','primary','upload'),'search'));
  }
  function renderLibrary() {
    const list = libraryBooks().filter(book => libraryFilter === 'all' || (libraryFilter === 'offline' ? hasOffline(book.id) : entry(book.id)?.shelf === libraryFilter));
    if (sort === 'title') list.sort((a,b) => a.t.localeCompare(b.t,'pt-BR'));
    if (sort === 'progress') list.sort((a,b) => (entry(b.id)?.progress || 0)-(entry(a.id)?.progress || 0));
    main.innerHTML = heading('SEU ACERVO','Biblioteca.','Livros, posições e escolhas que ficam.', '<div class="library-tools">'+button('Importar','import','','primary','upload')+'</div>')+
      '<div class="filter-bar"><div class="segments" role="group" aria-label="Prateleira">'+[['all','Todos'],['reading','Lendo'],['want','Quero ler'],['finished','Concluídos'],['offline','Neste aparelho']].map(([id,label])=>'<button class="chip" data-action="shelf-filter" data-value="'+id+'" aria-pressed="'+(libraryFilter === id)+'">'+label+'</button>').join('')+'</div><label class="sort-label">Ordenar <select id="library-sort" class="field-select"><option value="recent">Recentes</option><option value="title">Título</option><option value="progress">Progresso</option></select></label></div>'+
      (list.length ? '<p class="count-label">'+list.length+' livro'+(list.length === 1 ? '' : 's')+'</p><div class="book-grid">'+list.map(card).join('')+'</div>' : empty(libraryFilter === 'all' ? 'Sua biblioteca começa com você.' : 'Uma prateleira à sua espera.',libraryFilter === 'offline' ? 'Salve um livro neste aparelho para poder abri-lo sem conexão.' : 'Adicione uma leitura do acervo ou traga um arquivo seu.', '<a href="#explorar" class="button secondary">Explorar acervo</a>'+button('Importar livro','import','','primary','upload')));
    $('#library-sort').value = ['recent','title','progress'].includes(sort) ? sort : 'recent';
  }
  function trailList() {
    const all = allBooks();
    return [
      {title:'Histórias em uma sentada',text:'Leituras de até meia hora, para um intervalo que pode virar história.',ids:all.filter(book=>bookMins(book)<=30).sort((a,b)=>bookMins(a)-bookMins(b)).map(b=>b.id)},
      {title:'Um capítulo por vez',text:'Livros com capítulos curtos. Avance na ordem, no tempo que tiver.',ids:all.filter(book=>chapterData(book).some(ch=>ch.minutes<=10) && chapterData(book).length>1).map(b=>b.id)},
      {title:'O que você quer ler',text:'A fila que você escolheu. Transforme intenção em próxima página.',ids:libraryBooks().filter(book=>entry(book.id)?.shelf === 'want').map(b=>b.id)}
    ];
  }
  function renderTrails() {
    main.innerHTML = heading('CAMINHOS DE LEITURA','Uma página leva à outra.','Escolha um caminho que combina com o seu momento.')+
      '<div class="trail-grid">'+trailList().map((trail,index)=>'<button class="trail-card" data-action="trail" data-value="'+index+'"><span class="trail-number">0'+(index+1)+'</span><h2>'+esc(trail.title)+'</h2><p>'+esc(trail.text)+'</p><span class="trail-meta">'+trail.ids.length+' leituras '+icon('arrow')+'</span></button>').join('')+'</div>'+
      section('Seu tempo, sua sequência','O próximo capítulo respeita a posição em que você parou.',timeCards());
  }
  function renderNotebook() {
    main.innerHTML = heading('O QUE FICA','Seu caderno.','Reencontre uma ideia. Volte à página.',button('Exportar caderno','export-notes','','secondary small','download'))+
      '<label class="search-box" for="note-search">'+icon('search')+'<input id="note-search" type="search" maxlength="150" value="'+esc(noteQuery)+'" placeholder="Buscar nos trechos e nas anotações"></label><div class="filter-bar"><label class="sort-label">Livro <select id="note-book" class="field-select"><option value="">Todos os livros</option>'+[...new Map(state().notes.map(note=>[note.bookId,note.bookTitle])).entries()].map(([id,title])=>'<option value="'+esc(id)+'">'+esc(title)+'</option>').join('')+'</select></label></div><div id="note-results" aria-live="polite" aria-atomic="false"></div>';
    $('#note-book').value = noteBook; renderNoteResults();
  }
  function filteredNotes() { return state().notes.filter(note => (!noteBook || note.bookId === noteBook) && fold([note.quote,note.text,note.bookTitle].join(' ')).includes(fold(noteQuery))).sort((a,b)=>b.createdAt.localeCompare(a.createdAt)); }
  function renderNoteResults() {
    const notes = filteredNotes(), target = $('#note-results'); if (!target) return;
    target.innerHTML = notes.length ? '<p class="count-label">'+notes.length+' registro'+(notes.length === 1 ? '' : 's')+'</p><div class="note-list">'+notes.map(note=>'<article class="note-card" data-color="'+esc(note.color)+'">'+(note.quote ? '<blockquote>'+esc(note.quote)+'</blockquote>' : '')+(note.text ? '<p class="note-text">'+esc(note.text)+'</p>' : '')+'<div class="note-footer"><div><button class="note-source" data-action="goto-note" data-id="'+esc(note.id)+'">'+esc(note.bookTitle)+' · capítulo '+(note.chapter+1)+' '+icon('arrow')+'</button><p class="note-date">'+dateLabel(note.createdAt)+'</p></div><div class="note-actions"><button data-action="edit-note" data-id="'+esc(note.id)+'">Editar</button><button data-action="share-note" data-id="'+esc(note.id)+'">Compartilhar</button><button data-action="delete-note" data-id="'+esc(note.id)+'">Excluir</button></div></div></article>').join('')+'</div>' : empty('Guarde o que vale reler.',noteQuery || noteBook ? 'Nenhum registro corresponde a este filtro.' : 'No leitor, selecione um trecho para destacar ou anotar. Suas ideias aparecem aqui.', '<a class="button primary" href="#biblioteca">Ir para biblioteca</a>','pen');
  }
  function render() {
    if (!ready) return;
    clearTimeout(renderTimer);
    const renderers = {hoje:renderHome,explorar:renderExplore,biblioteca:renderLibrary,trilhas:renderTrails,caderno:renderNotebook};
    (renderers[route] || renderHome)();
    main.setAttribute('aria-busy','false');
    document.querySelectorAll('[data-nav]').forEach(a => a.dataset.nav === route ? a.setAttribute('aria-current','page') : a.removeAttribute('aria-current'));
    document.title = (route === 'hoje' ? 'Folio — no seu tempo' : ({explorar:'Explorar',biblioteca:'Biblioteca',trilhas:'Trilhas',caderno:'Caderno'}[route] || 'Folio')+' · Folio');
    $('#note-count').textContent = state().notes.length; $('#note-count').hidden = !state().notes.length;
    applyTheme(); connectivity();
  }
  function scheduleRender() { if (ready && !window.FolioReader?.isOpen && !mutationDepth) { clearTimeout(renderTimer); renderTimer = setTimeout(render,60); } }
  function closeDialog() {
    if (appDialog.open) appDialog.close();
    modalKind = ''; pendingRestore = null; importedDraft = null;
    document.body.style.overflow = bodyOverflow;
    if (previousFocus?.isConnected) previousFocus.focus({preventScroll:true});
  }
  function modal(title,body,kind = '') {
    if (!appDialog.open) { previousFocus = document.activeElement; bodyOverflow = document.body.style.overflow; }
    modalKind = kind;
    dialogBody.innerHTML = '<header class="dialog-header"><h2 id="dialog-title" tabindex="-1">'+esc(title)+'</h2><button type="button" class="icon-button" data-action="close-dialog" aria-label="Fechar">'+icon('close')+'</button></header><div class="dialog-content">'+body+'</div>';
    if (!appDialog.open) appDialog.showModal();
    document.body.style.overflow = 'hidden';
    $('#dialog-title').focus({preventScroll:true});
  }
  async function loadBook(id) {
    if (books.has(id)) return books.get(id);
    if (loadingBooks.has(id)) return loadingBooks.get(id);
    const task = (async () => {
      const cached = await store.getBook(id); if (cached) { books.set(id,cached); return cached; }
      const meta = catalogById.get(id);
      if (!meta || !/^books\/[a-zA-Z0-9_-]+\.json$/.test(meta.contentUrl || '')) throw new Error('Esta edição não está disponível. Importe o arquivo novamente.');
      const response = await fetch(new URL(meta.contentUrl,document.baseURI),{signal:AbortSignal.timeout(20000),cache:'no-store'});
      if (!response.ok) throw new Error('Não foi possível abrir o livro. Verifique sua conexão e tente novamente.');
      const content = await response.json();
      const valid = store.validateBook({...meta,...content,id:meta.id,source:'catalog',full:meta.full});
      return valid;
    })();
    loadingBooks.set(id,task);
    try { return await task; } finally { loadingBooks.delete(id); }
  }
  async function readBook(id,options = {}) {
    toast('Abrindo sua leitura…');
    const book = await loadBook(id);
    closeDialog();
    await window.FolioReader.open(book,options);
    toast('Boa leitura.');
  }
  async function saveOffline(id) {
    const book = await loadBook(id); await store.putBook(book); books.set(id,book);
    store.update(s => { s.library[id] = {...s.library[id],offline:true,updatedAt:new Date().toISOString()}; });
    toast('Livro salvo neste aparelho.'); render();
    if (modalKind === 'detail') showDetail(id);
  }
  function showDetail(id) {
    const book = byId(id); if (!book) { report(new Error('Livro não encontrado.')); return; }
    const item = entry(id), progress = item?.progress || 0, chapters = chapterData(book);
    detailId = id;
    const statuses = [['want','Quero ler'],['reading','Lendo'],['finished','Concluído']];
    const info = '<div class="detail-top">'+cover(book)+'<div><p class="eyebrow">'+esc(book.g || 'MINHA COLEÇÃO')+'</p><h3>'+esc(book.t)+'</h3><p>'+esc(book.a)+(book.y ? ' · '+book.y : '')+'</p><div class="detail-tags"><span class="badge">'+(book.full ? 'Texto completo' : 'Amostra')+'</span>'+(hasOffline(id) ? '<span class="badge">'+icon('check')+'Neste aparelho</span>' : '')+'</div></div></div><p class="detail-description">'+esc(book.d || 'Uma leitura da sua coleção pessoal.')+'</p><div class="detail-facts"><div><span>Duração estimada</span><strong>~'+fmtMinutes(bookMins(book))+'</strong></div><div><span>Capítulos</span><strong>'+chapters.length+'</strong></div><div><span>Seu progresso</span><strong>'+pct(progress)+'%</strong></div></div>';
    const actions = '<div class="detail-actions">'+button(progress > 0 && item?.shelf !== 'finished' ? 'Continuar lendo' : 'Abrir livro','read',id,'primary','book')+(!hasOffline(id) ? button('Salvar offline','download',id,'secondary','download') : '')+button('Compartilhar','share-book',id,'secondary','share')+'</div><div class="detail-section"><h3>Na sua biblioteca</h3><div class="chips" role="group" aria-label="Status do livro">'+statuses.map(([value,label])=>'<button class="chip" data-action="set-shelf" data-id="'+esc(id)+'" data-value="'+value+'" aria-pressed="'+(item?.shelf === value)+'">'+label+'</button>').join('')+'</div>'+(item || book.source === 'import' ? '<div class="detail-utilities">'+button('Recomeçar leitura','restart',id,'secondary small')+button(book.source === 'import' ? 'Remover livro' : 'Tirar da biblioteca','remove-book',id,'danger small')+(hasOffline(id) && book.source !== 'import' ? button('Liberar download','remove-offline',id,'secondary small') : '')+'</div>' : '')+'</div>';
    modal(book.t,info+actions+'<section class="detail-section"><h3>Sumário</h3><ol class="chapter-list">'+chapters.map(ch=>'<li><button data-action="chapter" data-id="'+esc(id)+'" data-chapter="'+ch.chapter+'"><span>'+esc(ch.title)+'</span><small>~'+fmtMinutes(ch.minutes)+'</small></button></li>').join('')+'</ol></section><section class="detail-section"><h3>Sobre esta edição</h3><p>'+esc(book.editionNote || (book.source === 'import' ? 'Arquivo importado por você: '+(book.originalFilename || 'edição pessoal')+'. Mantido neste aparelho.' : 'Edição inicial de leitura.'))+'</p><p>'+esc(book.rightsNote || book.rights || '')+'</p><p>'+externalLink(book.sourceUrl,'Consultar fonte')+(book.transcriptionLicenseUrl ? ' · '+externalLink(book.transcriptionLicenseUrl,'Licença da transcrição') : '')+'</p></section>','detail');
  }
  function showImport() {
    modal('Traga sua próxima leitura.','<p class="dialog-lead">Seus livros, com seu jeito de ler.</p><div class="import-drop" id="import-drop">'+icon('upload')+'<p>Arraste seu arquivo aqui ou escolha no aparelho.</p>'+button('Escolher arquivo','choose-file','','primary','upload')+'</div><p class="help-text">EPUB sem DRM até 50 MB; TXT em UTF-8 e JSON Folio até 16 MB. A importação preserva o texto e a ordem dos capítulos. Imagens, diagramação fixa e áudio do EPUB não são importados.</p><div class="dialog-alert">O arquivo fica neste dispositivo. Exporte um backup em Preferências e dados para guardá-lo em outro lugar.</div>','import');
  }
  async function importFile(file) {
    if (!file || busyImport) return;
    busyImport = true;
    modal('Preparando sua leitura…','<p role="status">Lendo e verificando o arquivo. Isso pode levar alguns instantes.</p>','importing');
    try {
      const book = await window.FolioImport.read(file);
      if (books.has(book.id)) { showDetail(book.id); toast('Essa edição já está na sua biblioteca.'); return; }
      importedDraft = book;
      modal('Sua leitura está pronta.', '<div class="import-summary">'+cover(book)+'<div><h3>'+esc(book.t)+'</h3><p>'+esc(book.a)+'</p><p>'+book.chapters.length+' capítulos · ~'+fmtMinutes(book.mins)+'</p></div></div><div class="settings-row">'+button('Adicionar à biblioteca','confirm-import','','primary','plus')+button('Cancelar','close-dialog')+'</div>','confirm-import');
    } catch(error) { showImport(); report(error); }
    finally { busyImport = false; $('#book-file').value = ''; }
  }
  async function confirmImport() {
    const book = importedDraft; if (!book) return;
    mutationDepth++;
    try {
      await store.saveImportedBook(book); books.set(book.id,book);
      closeDialog(); route = 'biblioteca'; history.pushState(null,'','#biblioteca'); render(); showDetail(book.id); toast('Livro adicionado à biblioteca.');
    } finally { mutationDepth--; }
  }
  function showStats() {
    const stats = dayStats(), s = state(), completed = Object.values(s.library).filter(item=>item.shelf === 'finished').length;
    const totalSeconds = Object.values(s.activity).reduce((a,b)=>a+b,0);
    modal('Seu ritmo de leitura.','<div class="stats-grid"><div class="stat"><strong>'+Math.floor(stats.seconds/60)+'</strong><span>minutos hoje</span></div><div class="stat"><strong>'+stats.streak+'</strong><span>dias em sequência</span></div><div class="stat"><strong>'+completed+'</strong><span>livros concluídos</span></div></div><h3 class="minor-title">Seus últimos sete dias</h3><div class="week">'+stats.week.map(day=>'<div class="day '+(day.seconds > 0 ? 'active ' : '')+(day.key === stats.today ? 'today' : '')+'"><span>'+esc(day.name)+'</span><i aria-hidden="true"></i><span>'+Math.floor(day.seconds/60)+' min</span></div>').join('')+'</div><p class="help-text">'+Math.floor(totalSeconds/60)+' minutos registrados desde o início. O relógio pausa quando a página fica oculta ou sem interação por 90 segundos.</p><section class="settings-section"><h3>Um tempo possível, todo dia.</h3><form id="goal-form"><label class="form-label" for="goal-input">Sua meta diária, em minutos</label><div class="input-action"><input class="field-input" id="goal-input" name="goal" type="number" min="1" max="240" step="1" value="'+s.preferences.goal+'" required><button type="submit" class="button primary">Salvar meta</button></div><p class="help-text">De 1 a 240 minutos. A meta acompanha você, sem bloquear a leitura.</p></form></section>','stats');
  }
  function showSettings() {
    const pref = state().preferences, offline = [...books.values()], size = offline.reduce((total,b)=>total+new Blob([JSON.stringify(b)]).size,0);
    modal('Preferências e dados','<section class="settings-section"><h3>Aparência do app</h3><div class="chips" role="group" aria-label="Aparência">'+[['system','Sistema'],['light','Claro'],['dark','Escuro']].map(([value,label])=>'<button class="chip" data-action="theme" data-value="'+value+'" aria-pressed="'+(pref.theme === value)+'">'+label+'</button>').join('')+'</div><p>A fonte, o tamanho e as cores da página ficam nas preferências do leitor.</p></section><section class="settings-section"><h3>Biblioteca neste aparelho</h3><p>'+offline.length+' livros salvos · aproximadamente '+bytesLabel(size)+' de texto.</p><p id="storage-persistence">Faça backups regulares: limpar os dados do navegador também remove sua biblioteca local.</p><div class="settings-row">'+button('Proteger armazenamento','persist-storage','','secondary small')+button('Ver biblioteca','open-library','','secondary small')+'</div></section><section class="settings-section"><h3>Backup e restauração</h3><p>O backup reúne os livros salvos, progresso, anotações e preferências. Guarde o arquivo para restaurar em outro navegador ou aparelho.</p><div class="settings-row">'+button('Exportar backup','export-backup','','primary','download')+button('Restaurar backup','choose-backup','','secondary','upload')+'</div></section><section class="settings-section"><h3>Folio sempre à mão</h3><div class="settings-row">'+button('Instalar ou abrir instruções','install','','secondary','plus')+(swRegistration?.waiting ? button('Atualizar aplicativo','update','','secondary') : '')+'</div></section><section class="settings-section"><h3>Seus dados são seus</h3><p>Não há conta ou sincronização entre aparelhos nesta versão. Os arquivos são processados aqui, sem envio ao servidor. A narração usa as vozes oferecidas pelo navegador; algumas dependem de conexão.</p><p>A exportação do caderno pode ser feita na aba Caderno. Atalhos: <kbd>/</kbd> para buscar e <kbd>Esc</kbd> para fechar janelas.</p></section>','settings');
    navigator.storage?.persisted?.().then(persisted => { if (modalKind === 'settings' && persisted) $('#storage-persistence').textContent = 'O navegador concedeu armazenamento persistente. Mantenha um backup para proteger-se de limpeza manual ou perda do aparelho.'; }).catch(()=>{});
  }
  async function requestPersistence() {
    if (!navigator.storage?.persist) { toast('Este navegador não oferece proteção adicional. Mantenha um backup.'); return; }
    const ok = await navigator.storage.persist(); showSettings(); toast(ok ? 'Armazenamento persistente concedido.' : 'O navegador não concedeu a proteção agora. Mantenha um backup.');
  }
  function downloadFile(filename,text,type = 'application/json') {
    const url = URL.createObjectURL(new Blob([text],{type:type+';charset=utf-8'}));
    const a = document.createElement('a'); a.href = url; a.download = filename; document.body.append(a); a.click(); a.remove();
    setTimeout(()=>URL.revokeObjectURL(url),30000);
  }
  async function exportBackup() { const backup = await store.exportBackup(); downloadFile('folio-backup-'+localDay()+'.json',JSON.stringify(backup)); toast('Backup preparado para download.'); }
  async function inspectBackup(file) {
    if (!file) return;
    try {
      if (file.size > 60*1024*1024) throw new Error('Escolha um backup de até 60 MB.');
      const content = await file.text(), validated = store.validateBackup(content);
      pendingRestore = content;
      modal('Restaurar este backup?', '<p class="dialog-lead">'+validated.books.length+' livros salvos e '+validated.state.notes.length+' anotações.</p><p class="help-text">A restauração substitui a biblioteca e as preferências deste aparelho pelas do arquivo. Exporte seu backup atual antes se quiser preservá-lo.</p><div class="settings-row">'+button('Exportar atual','export-backup','','secondary','download')+button('Restaurar e substituir','confirm-restore','','primary')+button('Cancelar','close-dialog')+'</div>','restore');
    } catch(error) { report(error); }
    finally { $('#backup-file').value = ''; }
  }
  async function restoreBackup() {
    if (!pendingRestore) return;
    const backup = pendingRestore; mutationDepth++;
    try {
      await store.importBackup(backup); await refreshBooks(); closeDialog(); history.pushState(null,'','#biblioteca'); route = 'biblioteca'; render(); toast('Backup restaurado.');
    } finally { mutationDepth--; }
  }
  async function refreshBooks() {
    const saved = await store.getBooks(); books.clear(); saved.forEach(book => books.set(book.id,book));
  }
  function exportNotes() {
    const notes = filteredNotes();
    if (!notes.length) { toast('Não há anotações para exportar neste filtro.'); return; }
    const lines = ['# Meu caderno Folio','', 'Exportado em '+localDay(),'',...notes.flatMap(note=>['## '+note.bookTitle,'','Capítulo '+(note.chapter+1)+' · '+dateLabel(note.createdAt),'',...(note.quote ? note.quote.split('\n').map(line=>'> '+line) : []),'',note.text || '','','---',''])];
    downloadFile('folio-caderno-'+localDay()+'.md',lines.join('\n'),'text/markdown'); toast('Caderno preparado para download.');
  }
  function showNoteEditor(id) {
    const note = state().notes.find(n=>n.id === id); if (!note) return;
    modal('Editar anotação','<form id="note-edit-form" data-id="'+esc(id)+'">'+(note.quote ? '<blockquote class="editor-quote">'+esc(note.quote)+'</blockquote>' : '')+'<label class="form-label" for="edit-note-text">Sua anotação</label><textarea id="edit-note-text" class="note-editor" maxlength="20000">'+esc(note.text)+'</textarea><div class="settings-row"><button type="submit" class="button primary">Salvar anotação</button>'+button('Cancelar','close-dialog')+'</div></form>','note-edit');
    $('#edit-note-text').focus();
  }
  function confirmRemoval(id) {
    const book = byId(id); if (!book) return;
    const imported = book.source === 'import', count = state().notes.filter(note=>note.bookId === id).length;
    modal('Remover '+book.t+'?', '<p class="help-text">'+(imported ? 'O arquivo e a posição serão removidos deste aparelho. Será preciso importar a mesma edição para ler novamente.' : 'A posição e o download serão removidos. O livro continuará no acervo.')+(count ? ' As '+count+' anotações continuarão no caderno.' : '')+'</p><div class="settings-row">'+button('Remover da biblioteca','confirm-remove',id,'danger','trash')+button('Cancelar','close-dialog')+'</div>','remove');
  }
  async function removeBook(id) {
    if (store.removeFromLibrary) await store.removeFromLibrary(id,{deleteNotes:false});
    else {
      store.update(s=>{ delete s.library[id]; });
      await store.deleteBook(id);
    }
    books.delete(id); closeDialog(); render(); toast('Livro removido; as anotações foram preservadas.');
  }
  async function share(text,title,url) {
    if (navigator.share) { try { await navigator.share({title,text,...(url ? {url} : {})}); return; } catch(error) { if (error.name === 'AbortError') return; } }
    const content = text+(url ? '\n'+url : '');
    if (navigator.clipboard?.writeText) { try { await navigator.clipboard.writeText(content); toast('Copiado para compartilhar.'); return; } catch {} }
    modal('Copiar para compartilhar','<label class="form-label" for="share-text">Texto</label><textarea id="share-text" class="note-editor" readonly>'+esc(content)+'</textarea>','share'); $('#share-text').select();
  }
  async function install() {
    if (installPrompt) { const prompt = installPrompt; installPrompt = null; await prompt.prompt(); const choice = await prompt.userChoice; toast(choice.outcome === 'accepted' ? 'Instalação solicitada.' : 'Você pode instalar quando quiser.'); return; }
    modal('Leve o Folio com você.','<ol class="install-instructions"><li>No iPhone ou iPad, abra o Folio no Safari, toque em Compartilhar e escolha <strong>Adicionar à Tela de Início</strong>.</li><li>No Android, abra o menu do navegador e escolha <strong>Instalar aplicativo</strong> ou <strong>Adicionar à tela inicial</strong>.</li><li>No computador, procure o ícone de instalação na barra de endereço ou a opção no menu do navegador.</li></ol><p class="help-text">A opção depende do navegador. Salve os livros neste aparelho para ler sem conexão.</p>','install');
  }
  function applyTheme() {
    const p = state().preferences.theme, resolved = p === 'system' ? (matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light') : p;
    document.documentElement.dataset.theme = resolved;
    $('meta[name="theme-color"]').content = resolved === 'dark' ? '#111310' : '#f5f5ee';
  }
  function connectivity() {
    const banner = $('#connection-banner');
    if (swRegistration?.waiting) {
      banner.hidden = false; banner.innerHTML = '<span>Uma nova versão do Folio está pronta.</span><button class="button small secondary" data-action="update">Atualizar agora</button>';
    } else {
      banner.hidden = navigator.onLine;
      banner.textContent = 'Você está offline. Os livros salvos neste aparelho continuam disponíveis.';
    }
    $('#connection-label').textContent = navigator.onLine ? 'Sua biblioteca pessoal' : 'Leitura offline';
  }
  async function setupPWA() {
    if (!('serviceWorker' in navigator) || !['https:','http:'].includes(location.protocol)) return;
    try {
      swRegistration = await navigator.serviceWorker.register('./sw.js',{updateViaCache:'none'});
      connectivity();
      swRegistration.addEventListener('updatefound',()=> { const installing = swRegistration.installing; installing?.addEventListener('statechange',()=> { if (installing.state === 'installed') connectivity(); }); });
      navigator.serviceWorker.addEventListener('controllerchange',()=> { if (updateAccepted && !reloading) { reloading = true; location.reload(); } });
    } catch(error) { console.warn('Offline indisponível:',error); toast('Não foi possível preparar o app offline. Reabra com conexão para tentar novamente.'); }
  }
  function parseRoute() {
    let hash; try { hash = decodeURIComponent(location.hash.slice(1)); } catch { hash = 'hoje'; }
    if (hash.startsWith('livro/')) {
      if (!ready) return;
      render(); showDetail(hash.slice(6)); return;
    }
    if (hash === 'continuar') {
      route = 'hoje'; render(); const book = readingBooks()[0];
      if (book) readBook(book.id).catch(report); else main.focus({preventScroll:true});
      return;
    }
    route = ['hoje','explorar','trilhas','biblioteca','caderno'].includes(hash) ? hash : 'hoje';
    if (window.FolioReader?.isOpen) window.FolioReader.close();
    closeDialog(); render(); window.scrollTo(0,0); main.focus({preventScroll:true});
  }
  async function action(event) {
    const control = event.target.closest('[data-action]');
    if (!control || control.closest('.fr-dialog') || control.disabled) return;
    const act = control.dataset.action, id = control.dataset.id, value = control.dataset.value;
    // Reader owns its entire dialog and its data-action vocabulary.
    if (control.closest('dialog') && control.closest('dialog') !== appDialog) return;
    const asyncActions = ['read','session','chapter','download','confirm-import','confirm-restore','confirm-remove','remove-offline','goto-note','export-backup'];
    if (asyncActions.includes(act)) control.disabled = true;
    try {
      switch(act) {
        case 'detail': showDetail(id); break;
        case 'read': await readBook(id); break;
        case 'session': await readBook(id,{minutes}); break;
        case 'chapter': await readBook(id,{chapter:Number(control.dataset.chapter)}); break;
        case 'time': minutes = Number(control.dataset.minutes); render(); main.querySelector('[data-minutes="'+minutes+'"]')?.focus({preventScroll:true}); break;
        case 'download': await saveOffline(id); break;
        case 'set-shelf': store.update(s=>{s.library[id] = {...s.library[id],shelf:value,progress:value === 'finished' ? 1 : (s.library[id]?.progress === 1 ? 0 : s.library[id]?.progress || 0),updatedAt:new Date().toISOString(),offline:hasOffline(id)};}); showDetail(id); toast('Prateleira atualizada.'); break;
        case 'restart': modal('Recomeçar a leitura?','<p class="help-text">A posição volta ao início. Seus destaques e anotações continuam no caderno.</p><div class="settings-row">'+button('Começar do início','confirm-restart',id,'primary')+button('Cancelar','close-dialog')+'</div>','restart'); break;
        case 'confirm-restart': store.update(s=>{s.library[id] = {...s.library[id],position:{chapter:0,paragraph:0},progress:0,shelf:'reading',updatedAt:new Date().toISOString()};}); await readBook(id,{chapter:0,paragraph:0}); break;
        case 'remove-book': confirmRemoval(id); break;
        case 'confirm-remove': await removeBook(id); break;
        case 'remove-offline': await store.deleteBook(id); books.delete(id); showDetail(id); scheduleRender(); toast('Download removido. Posição e anotações preservadas.'); break;
        case 'import': showImport(); break;
        case 'choose-file': $('#book-file').click(); break;
        case 'confirm-import': await confirmImport(); break;
        case 'close-dialog': closeDialog(); break;
        case 'search': history.pushState(null,'','#explorar'); route = 'explorar'; closeDialog(); render(); $('#catalog-search').focus(); break;
        case 'clear-search': query = ''; $('#catalog-search').value = ''; renderExploreResults(); $('#catalog-search').focus(); break;
        case 'mood': mood = value; renderExplore(); main.querySelector('[data-value="'+mood+'"]')?.focus({preventScroll:true}); break;
        case 'reset-search': query = ''; mood = ''; renderExplore(); $('#catalog-search').focus(); break;
        case 'shelf-filter': libraryFilter = value; renderLibrary(); main.querySelector('[data-value="'+value+'"]')?.focus({preventScroll:true}); break;
        case 'stats': showStats(); break;
        case 'settings': showSettings(); break;
        case 'theme': store.update(s=>{s.preferences.theme = value;}); applyTheme(); showSettings(); break;
        case 'persist-storage': await requestPersistence(); break;
        case 'export-backup': await exportBackup(); break;
        case 'choose-backup': $('#backup-file').click(); break;
        case 'confirm-restore': await restoreBackup(); break;
        case 'open-library': closeDialog(); location.hash = 'biblioteca'; break;
        case 'install': await install(); break;
        case 'update': if (window.FolioReader?.isOpen) { toast('Feche o leitor para aplicar a atualização.'); break; } if (swRegistration?.waiting) { updateAccepted = true; swRegistration.waiting.postMessage({type:'SKIP_WAITING'}); } break;
        case 'export-notes': exportNotes(); break;
        case 'edit-note': showNoteEditor(id); break;
        case 'delete-note': modal('Excluir esta anotação?','<p class="help-text">O trecho destacado e sua anotação serão removidos do caderno e do leitor.</p><div class="settings-row">'+button('Excluir anotação','confirm-delete-note',id,'danger')+button('Cancelar','close-dialog')+'</div>','delete-note'); break;
        case 'confirm-delete-note': store.update(s=>{s.notes = s.notes.filter(note=>note.id !== id);}); closeDialog(); render(); toast('Anotação excluída.'); break;
        case 'goto-note': { const note = state().notes.find(n=>n.id === id); if(note) await readBook(note.bookId,{chapter:note.chapter,paragraph:note.paragraph}); break; }
        case 'share-note': { const note = state().notes.find(n=>n.id === id); if(note) await share((note.quote ? '“'+note.quote+'”\n\n' : '')+(note.text ? note.text+'\n\n' : '')+note.bookTitle,note.bookTitle); break; }
        case 'share-book': { const book = byId(id); const url = book.source !== 'import' && !['localhost','127.0.0.1','[::1]'].includes(location.hostname) ? new URL('#livro/'+encodeURIComponent(id),location.href).href : undefined; await share(book.t+' — '+book.a,book.t,url); break; }
        case 'trail': { const trail = trailList()[Number(value)]; if (trail) modal(trail.title,'<p class="dialog-lead">'+esc(trail.text)+'</p>'+(trail.ids.length ? '<ol class="trail-detail-list">'+trail.ids.map((bookId,i)=>{const b=byId(bookId);return '<li><span>'+String(i+1).padStart(2,'0')+'</span>'+cover(b,true)+'<div><h3>'+esc(b.t)+'</h3><p>'+esc(b.a)+' · ~'+fmtMinutes(bookMins(b))+'</p>'+button(entry(b.id)?.progress ? 'Continuar' : 'Começar','session',b.id,'primary small','book')+'</div></li>';}).join('')+'</ol>' : empty('Seu caminho começa na escolha.','Adicione livros à prateleira Quero ler para montar sua sequência.','<a class="button primary" href="#explorar">Explorar acervo</a>')),'trail'); break; }
      }
    } catch(error) { report(error); }
    finally { if (control.isConnected) control.disabled = false; }
  }
  document.addEventListener('click',action);
  document.addEventListener('input',event=>{
    if (event.target.id === 'catalog-search') { query = event.target.value; clearTimeout(searchTimer); searchTimer=setTimeout(renderExploreResults,140); }
    if (event.target.id === 'note-search') { noteQuery = event.target.value; clearTimeout(searchTimer); searchTimer=setTimeout(renderNoteResults,140); }
  });
  document.addEventListener('change',event=>{
    if (['catalog-sort','library-sort'].includes(event.target.id)) { sort = event.target.value; event.target.id === 'catalog-sort' ? renderExploreResults() : renderLibrary(); }
    if (event.target.id === 'note-book') { noteBook = event.target.value; renderNoteResults(); }
    if (event.target.id === 'book-file') importFile(event.target.files[0]).catch(report);
    if (event.target.id === 'backup-file') inspectBackup(event.target.files[0]).catch(report);
  });
  document.addEventListener('submit',event=>{
    if (!['goal-form','note-edit-form'].includes(event.target.id)) return;
    event.preventDefault();
    try {
      if (event.target.id === 'goal-form') { const goal = Number($('#goal-input').value); if (!Number.isInteger(goal) || goal < 1 || goal > 240) throw new Error('Escolha de 1 a 240 minutos.'); store.update(s=>{s.preferences.goal=goal;}); closeDialog(); render(); toast('Meta de leitura atualizada.'); }
      else { const id = event.target.dataset.id, text = $('#edit-note-text').value.trim(); store.update(s=>{const note=s.notes.find(n=>n.id === id); if (note) note.text=text;}); closeDialog(); render(); toast('Anotação salva.'); }
    } catch(error) { report(error); }
  });
  document.addEventListener('keydown',event=>{
    if (window.FolioReader?.isOpen || event.ctrlKey || event.metaKey || event.altKey || event.target.matches('input,textarea,select,[contenteditable]')) return;
    if (event.key === '/' && !appDialog.open) { event.preventDefault(); history.pushState(null,'','#explorar'); route='explorar'; render(); $('#catalog-search').focus(); }
  });
  appDialog.addEventListener('cancel',event=>{event.preventDefault(); closeDialog();});
  appDialog.addEventListener('click',event=>{if(event.target === appDialog) { const r=appDialog.getBoundingClientRect(); if(event.clientX < r.left || event.clientX > r.right || event.clientY < r.top || event.clientY > r.bottom) closeDialog(); }});
  for (const name of ['dragenter','dragover','dragleave','drop']) appDialog.addEventListener(name,event=>{
    const zone = event.target.closest('#import-drop'); if(!zone) return; event.preventDefault();
    zone.classList.toggle('is-dragging',name === 'dragenter' || name === 'dragover');
    if (name === 'drop') { zone.classList.remove('is-dragging'); if(event.dataTransfer.files.length > 1) toast('Importe um livro por vez.'); else importFile(event.dataTransfer.files[0]).catch(report); }
  });
  window.addEventListener('hashchange',parseRoute);
  window.addEventListener('online',connectivity); window.addEventListener('offline',connectivity);
  window.addEventListener('beforeinstallprompt',event=>{event.preventDefault(); installPrompt=event;});
  window.addEventListener('appinstalled',()=>{installPrompt=null; toast('Folio instalado.');});
  matchMedia('(prefers-color-scheme: dark)').addEventListener('change',()=>{if(ready) applyTheme();});
  window.addEventListener('folio:change',event=>{
    if (!ready) return;
    if (['book-saved','book-deleted','restore','other-tab'].includes(event.detail?.reason)) {
      refreshBooks().then(scheduleRender).catch(report);
    } else scheduleRender();
  });
  window.addEventListener('folio:reader-close',()=>{render(); connectivity();});
  window.addEventListener('folio:storage-error',event=>{
    bootError = event.detail?.message || 'Não foi possível salvar os dados.';
    const banner = $('#storage-banner'); banner.hidden=false; banner.textContent='Armazenamento: '+bootError+' Exporte um backup se seus dados estiverem acessíveis.';
  });
  async function boot() {
    try {
      if (!store || !window.FolioReader || !window.FolioImport) throw new Error('Alguns arquivos do Folio não foram carregados. Recarregue com conexão.');
      await store.ready;
      try { await refreshBooks(); } catch(error) { bootError=error.message; }
      ready=true;
      document.querySelectorAll('[data-icon]').forEach(node=>{node.innerHTML=icon(node.dataset.icon);});
      $('#today-date').textContent = new Intl.DateTimeFormat('pt-BR',{weekday:'long',day:'numeric',month:'long'}).format(new Date());
      parseRoute(); await setupPWA();
    } catch(error) {
      main.innerHTML=empty('Não conseguimos abrir a biblioteca.',error.message,'<button id="retry-boot" class="button primary">Tentar novamente</button>');
      $('#retry-boot')?.addEventListener('click',()=>location.reload());
      main.setAttribute('aria-busy','false'); console.error(error);
    }
  }
  boot();
})();

