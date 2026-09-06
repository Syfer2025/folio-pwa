"use strict";

/* ============================================================
   FOLIO — interface
   ============================================================ */
const $  = (s, r) => (r || document).querySelector(s);
const $$ = (s, r) => Array.prototype.slice.call((r || document).querySelectorAll(s));
const byId = id => BOOKS.find(b => b.id === id);
const REDUCED = window.matchMedia("(prefers-reduced-motion: reduce)");
const esc = s => String(s).replace(/[&<>"]/g, c => ({ "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;" }[c]));

const STATE = JSON.parse(JSON.stringify(STATE_SEED));
const readerPrefs = { size:19, theme:"night", font:"literata", scroll:false, autoTheme:true };
let dtScale = 1, lastFocus = null;

const FONTS = [
  { id:"literata", n:"Literata",  css:'"Literata","New York",Georgia,serif' },
  { id:"charter",  n:"Charter",   css:'Charter,"Bitstream Charter","Iowan Old Style",Georgia,serif' },
  { id:"georgia",  n:"Georgia",   css:'Georgia,"Times New Roman",serif' },
  { id:"system",   n:"São Francisco", css:'var(--ui)' },
  { id:"palatino", n:"Palatino",  css:'Palatino,"Palatino Linotype","Book Antiqua",Georgia,serif' }
];

/* ---------- utilidades ---------- */
function lastName(a){ const p = a.split(" "); return p[p.length - 1].toUpperCase(); }
function hhmm(min){
  if (min <= 0) return "Concluído";
  const h = Math.floor(min / 60), m = min % 60;
  return h ? (m ? h + " h " + m + " min" : h + " h") : m + " min";
}
function toast(msg){
  const t = $("#toast"); t.textContent = msg; t.classList.add("is-on");
  clearTimeout(toast._t); toast._t = setTimeout(() => t.classList.remove("is-on"), 2600);
}

/* ---------- capas geradas ---------- */
const VMAP = { rule:"low", band:"plate", type:"center", frame:"stack", arc:"bottom" };
function coverHTML(book, opt){
  const p = PAL[book.pal], L = book.t.length, v = VMAP[book.v] || "bottom";
  const o = opt || {}, st = STATE[book.id];
  const k = L > 32 ? .54 : L > 24 ? .66 : L > 15 ? .8 : 1;
  const T = esc(book.t), A = esc(book.a);
  const fs2 = (base, max) => "font-size:clamp(8px,calc(" + base + "cqw * " + k + ")," + max + "px)";
  const ground = "background:" +
    "radial-gradient(88% 52% at 27% 11%, " + p.acc + "8C 0%, rgba(0,0,0,0) 58%)," +
    "radial-gradient(70% 42% at 84% 34%, " + p.ink + "26 0%, rgba(0,0,0,0) 62%)," +
    "radial-gradient(132% 96% at 88% 94%, " + p.g[0] + " 0%, rgba(0,0,0,0) 66%)," +
    "linear-gradient(160deg, " + p.g[0] + " 0%, " + p.g[1] + " 88%)";
  let art = "", body = "";

  if (v === "center"){
    art = '<span style="position:absolute;left:50%;top:36%;transform:translate(-50%,-50%);width:82%;aspect-ratio:1;border-radius:50%;' +
          'background:radial-gradient(circle,' + p.acc + 'D9 0%,' + p.acc + '30 44%,rgba(0,0,0,0) 68%)"></span>' +
          '<span style="position:absolute;left:50%;top:36%;transform:translate(-50%,-50%);width:26%;aspect-ratio:1;border-radius:50%;background:' + p.ink + ';opacity:.85"></span>';
    body = '<span class="cover-art" style="justify-content:flex-end;align-items:center;text-align:center;color:' + p.ink + '">' +
      '<span class="c-title wide" style="' + fs2(10.5, 22) + ';text-transform:uppercase">' + T + '</span>' +
      '<span class="c-author" style="margin-top:8%">' + A + '</span></span>';
  } else if (v === "stack"){
    art = '<span style="position:absolute;inset:0;display:flex">' +
      [0,1,2,3].map(i => '<span style="flex:1;background:' + (i % 2 ? p.acc : p.g[0]) + ';opacity:' + (.42 + i * .12) + '"></span>').join("") +
      '</span>';
    body = '<span class="cover-art" style="justify-content:flex-end;align-items:center;text-align:center;color:' + p.ink + '">' +
      '<span class="c-title serif" style="' + fs2(14, 30) + '">' + T + '</span>' +
      '<span class="c-author" style="margin-top:7%">' + A + '</span></span>';
  } else if (v === "plate"){
    art = '<span style="position:absolute;inset:-10% -30%;background:linear-gradient(112deg,rgba(0,0,0,0) 38%,' + p.acc + ' 39%,' + p.acc + ' 52%,rgba(0,0,0,0) 53%)"></span>' +
          '<span style="position:absolute;inset:-10% -30%;background:linear-gradient(112deg,rgba(0,0,0,0) 56%,' + p.ink + '2E 57%,rgba(0,0,0,0) 63%)"></span>';
    body = '<span class="cover-art" style="justify-content:flex-end;color:' + p.ink + '">' +
      '<span class="c-title" style="' + fs2(15, 32) + ';text-transform:uppercase">' + T + '</span>' +
      '<span class="c-author" style="margin-top:6%">' + A + '</span></span>';
  } else if (v === "low"){
    art = '<span style="position:absolute;left:-14%;bottom:14%;width:128%;height:34%;background:radial-gradient(60% 100% at 50% 100%,' + p.acc + 'B3 0%,rgba(0,0,0,0) 72%)"></span>' +
          '<span style="position:absolute;left:8%;right:8%;bottom:29%;height:1.5px;background:' + p.acc + ';opacity:.8"></span>';
    body = '<span class="cover-art" style="justify-content:flex-end;color:' + p.ink + '">' +
      '<span class="c-author" style="margin-bottom:5%">' + A + '</span>' +
      '<span class="c-title" style="' + fs2(16, 34) + ';text-transform:uppercase">' + T + '</span></span>';
  } else {
    art = '<span style="position:absolute;right:-22%;top:-14%;width:86%;aspect-ratio:1;border-radius:50%;background:' + p.acc + ';opacity:.88"></span>' +
          '<span style="position:absolute;left:-18%;top:24%;width:52%;aspect-ratio:1;border-radius:50%;background:' + p.ink + ';opacity:.16"></span>';
    body = '<span class="cover-art" style="justify-content:flex-end;color:' + p.ink + '">' +
      '<span class="c-title serif" style="' + fs2(15, 32) + '">' + T + '</span>' +
      '<span class="c-author" style="margin-top:6%">' + A + '</span></span>';
  }

  const badge = book.plus ? '<span class="plus-badge" aria-hidden="true">folio+</span>' : "";
  const prog = (o.prog && st && st.prog > 0 && st.prog < 1)
    ? '<span class="cover-prog" aria-hidden="true"><i style="width:' + Math.round(st.prog * 100) + '%"></i></span>' : "";
  const mass = '<span style="position:absolute;left:-12%;right:-12%;bottom:-16%;height:60%;' +
    'background:radial-gradient(58% 100% at 50% 100%,rgba(0,0,0,.93) 0%,rgba(0,0,0,.5) 44%,rgba(0,0,0,0) 76%)"></span>';
  return '<span class="cover sq" style="' + ground + '">' + art + mass +
    '<span class="c-scrim"></span>' + body + badge + prog + '<span class="cover-grain"></span></span>';
}

/* ---------- arte-chave em CSS (heróis e fundos) ---------- */
function keyArt(palIdx, cls){
  const p = PAL[palIdx];
  const bg = "background:" +
    "radial-gradient(74% 46% at 22% 14%, " + p.acc + "A6 0%, rgba(0,0,0,0) 60%)," +
    "radial-gradient(58% 38% at 86% 26%, " + p.ink + "2E 0%, rgba(0,0,0,0) 62%)," +
    "radial-gradient(126% 84% at 92% 96%, " + p.g[0] + " 0%, rgba(0,0,0,0) 64%)," +
    "linear-gradient(163deg, " + p.g[0] + " 0%, " + p.g[1] + " 92%)";
  return '<div class="' + (cls || "bb-art") + '" aria-hidden="true" style="' + bg + '">' +
    '<span style="position:absolute;left:6%;top:4%;width:70%;aspect-ratio:1;border-radius:50%;' +
      'background:radial-gradient(circle,' + p.acc + 'C4 0%,' + p.acc + '33 40%,rgba(0,0,0,0) 66%)"></span>' +
    '<span style="position:absolute;right:-20%;bottom:2%;width:84%;aspect-ratio:1;border-radius:50%;' +
      'background:radial-gradient(circle,' + p.ink + '24 0%,rgba(0,0,0,0) 64%)"></span>' +
    '<span style="position:absolute;left:0;right:0;bottom:0;height:52%;' +
      'background:linear-gradient(to top,rgba(0,0,0,.72),rgba(0,0,0,0))"></span>' +
    '<span class="bb-grain"></span></div>';
}

/* ---------- arte gerada em canvas (heróis e fundos) ---------- */
function paintArt(cv, palIdx, seed){
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const w = cv.clientWidth || 430, h = cv.clientHeight || 480;
  cv.width = Math.round(w * dpr); cv.height = Math.round(h * dpr);
  const c = cv.getContext("2d"); c.setTransform(dpr, 0, 0, dpr, 0, 0);
  const p = PAL[palIdx];
  let s = (seed * 9301 + 49297) % 233280;
  const rnd = () => { s = (s * 9301 + 49297) % 233280; return s / 233280; };

  const base = c.createLinearGradient(0, 0, w * .42, h);
  base.addColorStop(0, p.g[0]); base.addColorStop(1, p.g[1]);
  c.fillStyle = base; c.fillRect(0, 0, w, h);

  c.globalCompositeOperation = "screen";
  const tints = [p.acc, p.g[0], p.acc, p.g[0]];
  for (let i = 0; i < 5; i++){
    const x = (.12 + rnd() * .76) * w, y = (.04 + rnd() * .68) * h;
    const r = (.32 + rnd() * .44) * Math.max(w, h);
    const g = c.createRadialGradient(x, y, 0, x, y, r);
    const col = tints[i % 4];
    g.addColorStop(0, col + (i % 2 ? "59" : "3A"));
    g.addColorStop(.5, col + "1C");
    g.addColorStop(1, col + "00");
    c.fillStyle = g; c.fillRect(x - r, y - r, r * 2, r * 2);
  }
  const leak = c.createLinearGradient(w * .08, 0, w * .92, h * .62);
  leak.addColorStop(0, p.acc + "00"); leak.addColorStop(.44, p.acc + "1E"); leak.addColorStop(.92, p.acc + "00");
  c.fillStyle = leak; c.fillRect(0, 0, w, h);

  c.globalCompositeOperation = "source-over";
  const vg = c.createRadialGradient(w / 2, h * .36, h * .12, w / 2, h * .52, h * .96);
  vg.addColorStop(0, "rgba(0,0,0,0)"); vg.addColorStop(.7, "rgba(0,0,0,.12)"); vg.addColorStop(1, "rgba(0,0,0,.48)");
  c.fillStyle = vg; c.fillRect(0, 0, w, h);
}
function paintAll(root){
  $$("canvas[data-art]", root || document).forEach((cv, i) => {
    const pal = parseInt(cv.dataset.pal || "0", 10);
    paintArt(cv, isNaN(pal) ? 0 : pal, parseInt(cv.dataset.seed || (i + 3), 10));
  });
}

/* ---------- cartões ---------- */
function bookCard(b, opt){
  const o = opt || {}, st = STATE[b.id];
  const pct = (o.prog && st && st.prog > 0 && st.prog < 1) ? ", " + Math.round(st.prog * 100) + " por cento lido" : "";
  return '<button class="book-card" type="button" data-book="' + b.id + '" ' +
    'aria-label="' + esc(b.t) + ', ' + esc(b.a) + pct + '. Abrir ficha do livro.">' +
    coverHTML(b, o) + '</button>';
}
function resumeCard(b){ return bookCard(b, { prog:true }); }
function collectionCard(cl){
  const p = PAL[cl.pal];
  const bg = 'background:' +
    'linear-gradient(to top, rgba(0,0,0,.70) 0%, rgba(0,0,0,0) 64%),' +
    'radial-gradient(90% 130% at 84% 8%, ' + p.acc + '55 0%, rgba(0,0,0,0) 62%),' +
    'linear-gradient(140deg, ' + p.g[0] + ', ' + p.g[1] + ')';
  return '<button class="collection-card" type="button" data-collection="' + cl.id + '" aria-label="Coleção ' + esc(cl.n) + ', ' + esc(cl.c) + '">' +
    '<span class="collection-art sq" style="' + bg + '">' +
      '<span class="cl-name">' + esc(cl.n) + '</span><span class="cl-count">' + esc(cl.c) + '</span>' +
    '</span></button>';
}
function shelf(title, sub, inner){
  return '<section class="shelf"><div class="shelf-head">' +
    '<button class="shelf-title" type="button" data-act="seeall" data-name="' + esc(title) + '">' +
      '<h2>' + esc(title) + '</h2>' +
      '<svg width="20" height="20" aria-hidden="true"><use href="#i-chev-r"/></svg>' +
    '</button>' + (sub ? '<p class="shelf-sub">' + esc(sub) + '</p>' : "") +
    '</div><div class="rail">' + inner + '</div></section>';
}

/* ---------- billboard ---------- */
const SLIDES = [
  { id:"casmurro", kicker:"CONTINUAR", brand:false,
    title:"Dom Casmurro", meta:"Capítulo IX &middot; 34% lido &middot; 3 h 26 min restantes",
    cta:"Continuar lendo", act:"read" },
  { id:"machado", kicker:"COLEÇÃO", brand:true,
    title:"Machado, do começo ao fim", meta:"Nove romances e contos em edição revista, com ensaios de apresentação.",
    cta:"Ver coleção", act:"collection" },
  { id:"sertoes", kicker:"NOVO EM", brand:true,
    title:"Os Sertões", meta:"Edição anotada com mapas de Canudos e notas de campo de Euclides da Cunha.",
    cta:"Ler amostra", act:"detail" }
];
function renderBillboard(){
  const track = $("#bb-track"), dots = $("#bb-dots");
  track.innerHTML = SLIDES.map((s, i) => {
    const b = byId(s.id);
    const pal = b ? b.pal : (COLLECTIONS.find(c => c.id === s.id) || { pal:0 }).pal;
    return '<article class="bb-slide" role="group" aria-roledescription="slide" aria-label="' + (i + 1) + ' de ' + SLIDES.length + ': ' + esc(s.title) + '">' +
      '<div class="bb-card sq">' + keyArt(pal) +
      '<div class="bb-scrim" aria-hidden="true"></div>' +
      '<div class="bb-body">' +
        '<p class="bb-kicker">' + esc(s.kicker) + (s.brand ? ' <span class="bb-brand">folio+</span>' : "") + '</p>' +
        '<h2 class="bb-title">' + esc(s.title) + '</h2>' +
        '<p class="bb-meta">' + s.meta + '</p>' +
        '<div class="bb-actions">' +
          '<button class="btn btn-prominent" type="button" data-slide-act="' + s.act + '" data-target="' + s.id + '">' +
            (s.act === "read" ? '<svg width="15" height="15" aria-hidden="true"><use href="#i-play"/></svg>' : "") + esc(s.cta) + '</button>' +
          '<button class="btn btn-icon" type="button" data-act="add" data-book="' + (byId(s.id) ? s.id : "") + '" aria-label="Adicionar à biblioteca">' +
            '<svg width="20" height="20" aria-hidden="true"><use href="#i-plus"/></svg></button>' +
        '</div>' +
      '</div></div></article>';
  }).join("");
  dots.innerHTML = SLIDES.map((s, i) =>
    '<button class="bb-dot-hit" type="button" role="tab" aria-current="' + (i === 0) + '" aria-label="Destaque ' + (i + 1) + ': ' + esc(s.title) + '" data-dot="' + i + '"><span class="bb-dot"></span></button>'
  ).join("");
}
function bbSync(){
  const track = $("#bb-track");
  const i = Math.round(track.scrollLeft / Math.max(track.clientWidth, 1));
  $$("#bb-dots .bb-dot-hit").forEach((d, n) => d.setAttribute("aria-current", String(n === i)));
}

/* ---------- prateleiras ---------- */
function renderNow(){
  const reading = Object.keys(STATE).filter(k => STATE[k].shelf === "lendo")
    .sort((a, b) => STATE[b].prog - STATE[a].prog).map(byId);
  const gratis  = BOOKS.filter(b => !b.plus).slice(0, 10);
  const lanc    = ["sertoes","maias","comedia","dalloway","frankenstein","taverna","espumas","dorian"].map(byId);
  const grandes = ["brascubas","crime","moby","orgulho","cortico","macunaima","vidassecas","quaresma"].map(byId);
  const plusIds = BOOKS.filter(b => b.plus).slice(0, 10);
  const because = ["quincas","helena","saobernardo","quaresma","ateneu","sargento"].map(byId);
  const audio   = BOOKS.filter(b => b.narr).slice(0, 8);

  $("#now-shelves").innerHTML =
    shelf("Continuar lendo", null, reading.map(resumeCard).join("")) +
    shelf("Leia de graça", null, gratis.map(b => bookCard(b)).join("")) +
    shelf("Últimos lançamentos", null, lanc.map(b => bookCard(b)).join("")) +
    shelf("Grandes clássicos agora no Folio", null, grandes.map(b => bookCard(b)).join("")) +
    shelf("Incluídos no Folio+", "Sem custo adicional na sua assinatura", plusIds.map(b => bookCard(b)).join("")) +
    shelf("Coleções", null, COLLECTIONS.map(collectionCard).join("")) +
    shelf("Porque você leu O Alienista", null, because.map(b => bookCard(b)).join("")) +
    shelf("Com narração", null, audio.map(b => bookCard(b)).join(""));
}
function renderPlus(){
  const orig = BOOKS.filter(b => b.plus);
  $("#plus-shelves").innerHTML =
    shelf("Destaques do Folio+", null, orig.slice(0, 8).map(b => bookCard(b)).join("")) +
    shelf("Coleções exclusivas", null, COLLECTIONS.slice(0, 4).map(collectionCard).join("")) +
    shelf("Narrados por vozes brasileiras", null, BOOKS.filter(b => b.narr && b.plus).map(b => bookCard(b)).join(""));
  $("#plus-legal").innerHTML =
    "O valor é cobrado na sua conta ao confirmar a compra. A assinatura renova automaticamente por R$ 19,90/mês, " +
    "a menos que seja cancelada com no mínimo 24 horas de antecedência. Gerencie ou cancele em Ajustes › Sua conta › Assinaturas. " +
    "Ao assinar durante um período gratuito, a parte não utilizada é perdida. Assinatura válida em todos os seus dispositivos. " +
    "Compras avulsas usam o pagamento da App Store, ficam vinculadas à sua conta e podem ser restauradas a qualquer momento, em qualquer dispositivo.";
}

/* ---------- busca ---------- */
const RECENTS = ["Machado de Assis", "romance realista", "vidas secas", "poesia brasileira"];
function renderSearch(q){
  const body = $("#search-body");
  const term = (q || "").trim().toLowerCase();
  const hits = term
    ? BOOKS.filter(b => (b.t + " " + b.a + " " + b.g).toLowerCase().indexOf(term) > -1)
    : BOOKS;
  if (!hits.length){
    body.innerHTML = '<div class="empty"><b>Nenhum resultado</b><p>Não encontramos nada para “' + esc(q) +
      '”. Verifique a grafia ou procure pelo nome do autor.</p></div>';
    return;
  }
  body.innerHTML = '<h3 class="vh">' + hits.length + (hits.length === 1 ? ' título' : ' títulos') + '</h3>' +
    '<div class="poster-grid">' + hits.map(b => bookCard(b, { prog:true })).join("") + '</div>';
}

/* ---------- biblioteca ---------- */
function renderLib(seg){
  const ids = Object.keys(STATE).filter(k => seg === "off" ? STATE[k].off : STATE[k].shelf === seg);
  const body = $("#lib-body");
  if (!ids.length){
    body.innerHTML = '<div class="empty"><b>Nada por aqui ainda</b><p>Os livros que você adicionar aparecem nesta aba, disponíveis em todos os seus dispositivos.</p></div>';
    return;
  }
  body.innerHTML = '<div class="poster-grid">' +
    ids.map(id => bookCard(byId(id), { prog:true })).join("") + '</div>';
}

/* ---------- ficha do livro ---------- */
function openDetail(id){
  const b = byId(id); if (!b) return;
  const st = STATE[id] || { prog:0, off:false, shelf:null };
  const inLib = !!STATE[id];
  const chs = CHAPTERS[id];
  const stars = Math.round(b.rate);

  $("#detail-navtitle").textContent = b.t;
  $("#detail-body").innerHTML =
    '<div class="detail-hero">' +
      '<div class="detail-bgart" aria-hidden="true">' + keyArt(b.pal) + '</div>' +
      '<div class="detail-bgscrim" aria-hidden="true"></div>' +
      '<div class="detail-inner">' +
        coverHTML(b) +
        '<h2 class="detail-title" id="detail-title">' + esc(b.t) + '</h2>' +
        '<p class="detail-author">' + esc(b.a) + '</p>' +
        '<p class="detail-facts">' +
          (b.plus ? '<span class="badge is-plus">folio+</span>' : '<span class="badge">R$ 9,90</span>') +
          '<span>' + b.y + '</span><span aria-hidden="true">&middot;</span><span>' + esc(b.g) + '</span>' +
          '<span aria-hidden="true">&middot;</span><span>' + b.pages + ' páginas</span>' +
          '<span aria-hidden="true">&middot;</span><span>' + hhmm(b.mins) + '</span>' +
        '</p>' +
        '<div class="detail-actions">' +
          '<button class="btn btn-prominent" type="button" data-act="read" data-book="' + id + '">' +
            '<svg width="15" height="15" aria-hidden="true"><use href="#i-play"/></svg>' +
            (st.prog > 0 && st.prog < 1 ? "Continuar" : b.plus ? "Ler agora" : "Ler amostra") + '</button>' +
          (b.plus ? "" : '<button class="btn btn-gray" type="button" data-act="buy" data-book="' + id + '">Comprar R$ 9,90</button>') +
        '</div>' +
        (st.prog > 0 && st.prog < 1 ?
          '<div style="width:100%;max-width:340px"><div class="progress"><i style="width:' + Math.round(st.prog * 100) + '%"></i></div>' +
          '<p style="font:var(--f-caption1);letter-spacing:var(--tr-caption1);color:var(--label-2);margin-top:6px">' +
          esc(st.ch) + ' &middot; ' + hhmm(st.left) + ' restantes</p></div>' : "") +
        '<div class="icon-row">' +
          '<button class="icon-action" type="button" data-act="add" data-book="' + id + '" aria-pressed="' + inLib + '">' +
            '<svg width="24" height="24" aria-hidden="true"><use href="#' + (inLib ? "i-check" : "i-plus") + '"/></svg>' +
            '<span>' + (inLib ? "Na biblioteca" : "Adicionar") + '</span></button>' +
          '<button class="icon-action" type="button" data-act="download" data-book="' + id + '" aria-pressed="' + !!st.off + '">' +
            '<svg width="24" height="24" aria-hidden="true"><use href="#' + (st.off ? "i-downloaded" : "i-download") + '"/></svg>' +
            '<span>' + (st.off ? "Baixado" : "Baixar") + '</span></button>' +
          (b.narr ? '<button class="icon-action" type="button" data-act="listen" data-book="' + id + '">' +
            '<svg width="24" height="24" aria-hidden="true"><use href="#i-headphones"/></svg><span>Ouvir</span></button>' : "") +
          '<button class="icon-action" type="button" data-act="share" data-book="' + id + '">' +
            '<svg width="24" height="24" aria-hidden="true"><use href="#i-share"/></svg><span>Compartilhar</span></button>' +
        '</div>' +
      '</div>' +
    '</div>' +

    '<section class="section"><div class="prose clamped" id="desc"><p>' + esc(b.d) + '</p></div>' +
      '<button class="more-link" type="button" data-act="expand" aria-expanded="false">mais</button></section>' +

    '<section class="section"><h3>Avaliações</h3>' +
      '<div class="list"><div class="list-row">' +
        '<span style="font:var(--f-title1);letter-spacing:var(--tr-title1);font-variant-numeric:tabular-nums">' + b.rate.toFixed(1) + '</span>' +
        '<span><span aria-hidden="true">' +
          [1,2,3,4,5].map(n => '<svg width="13" height="13" style="color:' + (n <= stars ? "var(--sys-orange)" : "var(--label-4)") + '"><use href="#i-star"/></svg>').join("") +
        '</span><br><small style="font:var(--f-caption1);letter-spacing:var(--tr-caption1);color:var(--label-2)">' +
        b.rate.toFixed(1) + ' de 5 &middot; ' + (900 + (b.y % 700)) + ' avaliações</small></span>' +
        '<button class="btn btn-sm btn-tinted" style="margin-left:auto" type="button" data-act="rate">Avaliar</button>' +
      '</div>' +
      '<button class="list-row" type="button" data-act="report"><span>Denunciar um problema</span>' +
        '<svg class="chev" width="14" height="14" style="margin-left:auto" aria-hidden="true"><use href="#i-chev-r"/></svg></button>' +
      '</div></section>' +

    (chs ? '<section class="section"><h3>Sumário</h3><div class="list">' +
      chs.slice(0, 6).map((c, i) => '<button class="list-row toc-row" type="button" data-read-ch="' + i + '" data-book="' + id + '" data-read="' + c.read + '">' +
        '<span class="toc-n">' + c.n + '</span><span class="toc-t">' + esc(c.t) + '</span>' +
        '<span class="toc-len">' + (6 + (i * 3) % 11) + ' min</span></button>').join("") +
      '</div><p class="list-note">' + chs.length + ' capítulos nesta edição.</p></section>' : "") +

    '<section class="section"><h3>Informações</h3><div class="list">' +
      '<div class="list-row"><span>Editora</span><span class="lr-value">Folio Edições</span></div>' +
      '<div class="list-row"><span>Publicado em</span><span class="lr-value">' + b.y + '</span></div>' +
      '<div class="list-row"><span>Idioma</span><span class="lr-value">Português</span></div>' +
      '<div class="list-row"><span>Tamanho</span><span class="lr-value">' + (1.2 + (b.pages / 260)).toFixed(1) + ' MB</span></div>' +
      '<div class="list-row"><span>Direitos</span><span class="lr-value">Domínio público</span></div>' +
      '<div class="list-row"><span>Acessibilidade</span><span class="lr-value">VoiceOver, Dynamic Type</span></div>' +
    '</div><p class="list-note">Obra em domínio público no Brasil (Lei 9.610/98, art. 41). Texto revisto pela equipe editorial do Folio a partir da edição de ' + b.y + '.</p></section>' +

    shelf("Leitores também leram", null,
      BOOKS.filter(x => x.g === b.g && x.id !== b.id).concat(BOOKS.filter(x => x.a === b.a && x.id !== b.id))
        .filter((v, i, arr) => arr.indexOf(v) === i).slice(0, 8).map(x => bookCard(x)).join(""), false);

  paintAll($("#detail-body"));
  openLayer("layer-detail");
  $("#detail-scroller").scrollTop = 0;
  $("#nav-detail").classList.remove("is-solid");
}

/* ---------- leitor ---------- */
let rdPage = 0, rdPages = 1;
function openReader(id, chIdx){
  const b = byId(id); if (!b) return;
  $("#reader-navtitle").textContent = b.t;
  const chs = CHAPTERS[id];
  let html = "";
  if (chs){
    const list = chs.filter(c => c.p);
    const start = typeof chIdx === "number" ? Math.min(chIdx, list.length - 1) : 0;
    html = list.slice(start).map(c =>
      '<h4><span class="ch-num">Capítulo ' + c.n + '</span>' + esc(c.t) + '</h4>' +
      c.p.map((t, i) => '<p class="' + (i === 0 ? "first" : (t.indexOf("—") === 0 ? "dlg" : "")) + '">' + esc(t) + '</p>').join("")
    ).join("");
  } else {
    html = '<h4><span class="ch-num">Amostra</span>' + esc(b.t) + '</h4>' +
      (b.open || []).map((t, i) => '<p class="' + (i === 0 ? "first" : "") + '">' + esc(t) + '</p>').join("") +
      '<p style="text-indent:0;margin-top:1.4em;padding-top:1.2em;border-top:1px solid currentColor;opacity:.55;font-size:.8em;font-family:var(--ui);text-align:left">' +
      'Fim da amostra. ' + (b.plus ? "Este título está incluído no Folio+." : "Compre por R$ 9,90 para ler na íntegra.") + '</p>';
  }
  $("#reader-col").innerHTML = html;
  applyReaderPrefs();
  openLayer("layer-reader");
  requestAnimationFrame(() => { rdPage = 0; measureReader(); });
}
function measureReader(){
  const col = $("#reader-col"), page = $("#reader-page");
  if (!col || !page) return;
  const w = col.clientWidth, gap = 44;
  rdPages = Math.max(1, Math.round((col.scrollWidth + gap) / (w + gap)));
  goPage(Math.min(rdPage, rdPages - 1));
}
function goPage(i){
  const col = $("#reader-col");
  rdPage = Math.max(0, Math.min(i, rdPages - 1));
  const w = col.clientWidth, gap = 44;
  col.style.transform = "translate3d(" + (-rdPage * (w + gap)) + "px,0,0)";
  $("#reader-pos").textContent = "Página " + (rdPage + 1) + " de " + rdPages;
  const perPage = 3;
  $("#reader-left").textContent = Math.max(0, (rdPages - rdPage - 1) * perPage) + " min restantes no capítulo";
}
function applyReaderPrefs(){
  const L = $("#layer-reader");
  L.dataset.rtheme = readerPrefs.theme;
  const col = $("#reader-col");
  col.style.setProperty("--rd-size", readerPrefs.size);
  const f = FONTS.find(x => x.id === readerPrefs.font);
  col.style.setProperty("--rd-font", f ? f.css : "var(--serif)");
  col.style.columnWidth = readerPrefs.scroll ? "auto" : "100%";
  $("#rd-size-note").textContent = "Corpo de " + readerPrefs.size + " pt. Também acompanha o Tamanho do Texto do sistema.";
  $$("#rd-themes .theme-swatch").forEach(s => s.setAttribute("aria-pressed", String(s.dataset.rtheme === readerPrefs.theme)));
  $("#rd-scroll").setAttribute("aria-checked", String(readerPrefs.scroll));
  $$("#rd-scroll .switch, #rd-auto .switch").forEach(sw =>
    sw.setAttribute("aria-checked", sw.parentElement.getAttribute("aria-checked")));
}
function renderFontList(){
  $("#rd-fonts").innerHTML = FONTS.map(f =>
    '<button class="list-row" type="button" data-font="' + f.id + '" aria-pressed="' + (f.id === readerPrefs.font) + '">' +
    '<span style="font-family:' + f.css + '">' + esc(f.n) + '</span>' +
    (f.id === readerPrefs.font ? '<svg class="check" width="18" height="18" aria-hidden="true"><use href="#i-check"/></svg>' : "") +
    '</button>').join("");
}
function renderTOC(){
  const chs = CHAPTERS.casmurro;
  $("#toc-list").innerHTML = chs.map((c, i) =>
    '<button class="list-row toc-row" type="button" data-read-ch="' + i + '" data-book="casmurro" data-read="' + c.read + '"' +
    (c.cur ? ' aria-current="true"' : "") + '>' +
    '<span class="toc-n">' + c.n + '</span><span class="toc-t">' + esc(c.t) + '</span>' +
    (c.cur ? '<svg class="check" width="16" height="16" aria-hidden="true"><use href="#i-bookmark-fill"/></svg>' :
      '<span class="toc-len">' + (6 + (i * 3) % 11) + ' min</span>') + '</button>').join("");
}

/* ---------- camadas e folhas ---------- */
function openLayer(id){
  const L = document.getElementById(id);
  lastFocus = document.activeElement;
  L.setAttribute("aria-hidden", "false");
  L.classList.add("is-open");
  const f = L.querySelector("button, [href], input");
  if (f) setTimeout(() => f.focus({ preventScroll:true }), REDUCED.matches ? 0 : 340);
}
function closeLayer(id){
  const L = document.getElementById(id);
  L.classList.remove("is-open");
  L.setAttribute("aria-hidden", "true");
  if (lastFocus && lastFocus.focus) lastFocus.focus({ preventScroll:true });
}
function openSheet(id){
  const s = document.getElementById(id); if (!s) return;
  lastFocus = document.activeElement;
  $("#scrim").hidden = false;
  requestAnimationFrame(() => { $("#scrim").classList.add("is-open"); s.classList.add("is-open"); });
  s.setAttribute("aria-hidden", "false");
  const f = s.querySelector("button");
  if (f) setTimeout(() => f.focus({ preventScroll:true }), REDUCED.matches ? 0 : 300);
}
function closeSheets(){
  $$(".sheet.is-open").forEach(s => { s.classList.remove("is-open"); s.setAttribute("aria-hidden", "true"); });
  $("#scrim").classList.remove("is-open");
  setTimeout(() => { $("#scrim").hidden = true; }, 320);
  if (lastFocus && lastFocus.focus) lastFocus.focus({ preventScroll:true });
}

/* ---------- abas ---------- */
const TAB_GLYPH = { now:["i-book","i-book-fill"], lib:["i-books","i-books-fill"] };
function selectTab(name){
  $$(".tab").forEach(t => {
    const on = t.dataset.tab === name;
    t.setAttribute("aria-selected", String(on));
    const map = TAB_GLYPH[t.dataset.tab];
    const use = t.querySelector("use");
    if (map && use) use.setAttribute("href", "#" + (on ? map[1] : map[0]));
  });
  $$(".screen").forEach(s => s.classList.toggle("is-active", s.id === "scr-" + name));
  const scr = $("#scr-" + name);
  if (scr) scr.focus({ preventScroll:true });
  if (name === "search") setTimeout(() => $("#q").focus({ preventScroll:true }), 60);
}

/* ---------- Dynamic Type e aparência ---------- */
const DT_STEPS = [.882, .941, 1, 1.118, 1.235, 1.353, 1.471];
const DT_NAMES = ["Menor", "Pequeno", "Padrão", "Grande", "Maior", "Extra grande", "Acessibilidade"];
let dtIndex = 2;
function applyDT(){
  dtScale = DT_STEPS[dtIndex];
  document.documentElement.style.setProperty("--dt", dtScale);
  $("#dt-value").textContent = DT_NAMES[dtIndex];
  requestAnimationFrame(measureReader);
}
function applyAppearance(mode){
  if (mode === "auto") document.documentElement.removeAttribute("data-theme");
  else document.documentElement.setAttribute("data-theme", mode);
  $$("#appearance .seg").forEach(s => s.setAttribute("aria-selected", String(s.dataset.appear === mode)));
  const dark = mode === "dark" || (mode === "auto" && window.matchMedia("(prefers-color-scheme: dark)").matches);
  const tc = document.querySelector('meta[name="theme-color"]');
  if (tc) tc.setAttribute("content", dark ? "#000000" : "#F2F2F7");
  if (readerPrefs.autoTheme){
    readerPrefs.theme = dark ? "night" : "quiet";
    applyReaderPrefs();
  }
  requestAnimationFrame(() => paintAll());
}

/* ============================================================
   Eventos
   ============================================================ */
document.addEventListener("click", ev => {
  const t = ev.target.closest("[data-tab],[data-book],[data-collection],[data-act],[data-sheet],[data-close],[data-close-sheet],[data-slide-act],[data-dot],[data-recent],[data-seg],[data-appear],[data-rtheme],[data-font],[data-read-ch],[data-page]");
  if (!t) return;
  const d = t.dataset;

  if (d.tab)          { selectTab(d.tab); return; }
  if (d.sheet)        { openSheet(d.sheet); return; }
  if (t.hasAttribute("data-close-sheet")) { closeSheets(); return; }
  if (d.close)        { closeLayer(d.close); return; }
  if (d.dot != null)  { const tr = $("#bb-track"); tr.scrollTo({ left: +d.dot * tr.clientWidth, behavior: REDUCED.matches ? "auto" : "smooth" }); return; }
  if (d.recent)       { $("#q").value = d.recent; renderSearch(d.recent); $("#q-clear").hidden = false; $("#q-cancel").hidden = false; return; }
  if (d.seg)          { $$("#lib-seg .seg").forEach(s => s.setAttribute("aria-selected", String(s === t))); renderLib(d.seg); return; }
  if (d.appear)       { applyAppearance(d.appear); return; }
  if (d.rtheme)       { readerPrefs.theme = d.rtheme; readerPrefs.autoTheme = false; $("#rd-auto").setAttribute("aria-checked","false"); applyReaderPrefs(); return; }
  if (d.font)         { readerPrefs.font = d.font; renderFontList(); applyReaderPrefs(); requestAnimationFrame(measureReader); return; }
  if (d.readCh != null){ closeSheets(); openReader(d.book || "casmurro", +d.readCh); return; }
  if (d.page != null) {
    const n = +d.page;
    if (n === 0) $("#layer-reader").classList.toggle("is-immersive");
    else goPage(rdPage + n);
    return;
  }
  if (d.slideAct){
    if (d.slideAct === "read") openReader(d.target);
    else if (d.slideAct === "detail") openDetail(d.target);
    else { const c = COLLECTIONS.find(x => x.id === d.target); toast("Coleção “" + c.n + "” — " + c.c); }
    return;
  }
  if (d.collection){
    const c = COLLECTIONS.find(x => x.id === d.collection);
    if (c) openDetail(c.ids[0]);
    return;
  }

  switch (d.act){
    case "read":     openReader(d.book); return;
    case "expand": {
      const p = $("#desc"), on = t.getAttribute("aria-expanded") === "true";
      p.classList.toggle("clamped", on); t.setAttribute("aria-expanded", String(!on));
      t.textContent = on ? "mais" : "menos"; return;
    }
    case "add": {
      if (!d.book) { toast("Adicionado à biblioteca"); return; }
      if (STATE[d.book]) { delete STATE[d.book]; toast("Removido da biblioteca"); }
      else { const b = byId(d.book); STATE[d.book] = { prog:0, ch:"", left:b.mins, shelf:"quero", off:false }; toast("Adicionado a Quero ler"); }
      openDetail(d.book); renderLib($("#lib-seg .seg[aria-selected=true]").dataset.seg); return;
    }
    case "download": {
      const st = STATE[d.book]; if (!st) { toast("Adicione à biblioteca para baixar"); return; }
      st.off = !st.off; toast(st.off ? "Baixado para leitura offline" : "Download removido");
      openDetail(d.book); return;
    }
    case "buy":      toast("Compra pela App Store — R$ 9,90"); return;
    case "subscribe":toast("Teste grátis de 7 dias iniciado"); return;
    case "restore":  toast("Compras restauradas"); return;
    case "manage":   toast("Abrindo Ajustes › Assinaturas"); return;
    case "listen":   toast("Narração disponível no Folio+"); return;
    case "share":    toast("Compartilhar link do livro"); return;
    case "rate":     toast("Avaliar este livro"); return;
    case "report":   toast("Formulário de denúncia enviado ao suporte"); return;
    case "privacy":  toast("Abrindo a política de privacidade"); return;
    case "export":   toast("Preparando o arquivo com seus dados"); return;
    case "delete":   toast("Apagar conta pede confirmação por e-mail"); return;
    case "support":  toast("suporte@folio.app"); return;
    case "analytics":{
      const on = t.getAttribute("aria-checked") === "true";
      t.setAttribute("aria-checked", String(!on));
      $(".switch", t).setAttribute("aria-checked", String(!on));
      toast(!on ? "Análises ativadas" : "Análises desativadas"); return;
    }
    case "seeall":   toast("Ver tudo: " + d.name); return;
  }
});

/* Livro: clique em qualquer cartão */
document.addEventListener("click", ev => {
  const c = ev.target.closest("[data-book]");
  if (!c || c.dataset.act || c.dataset.readCh || c.dataset.slideAct) return;
  if (c.classList.contains("book-card") || c.classList.contains("rank-card") ||
      c.classList.contains("result-row") || c.classList.contains("resume-card")) openDetail(c.dataset.book);
});

/* Barras de navegação que ficam opacas ao rolar */
$$(".scroller").forEach(sc => {
  const nav = document.getElementById(sc.dataset.nav);
  const from = +(sc.dataset.navFrom || 30);
  if (!nav) return;
  sc.addEventListener("scroll", () => nav.classList.toggle("is-solid", sc.scrollTop > from), { passive:true });
});

/* Carrossel */
let bbTimer = null;
function bbAuto(){
  clearInterval(bbTimer);
  if (REDUCED.matches) return;
  bbTimer = setInterval(() => {
    const tr = $("#bb-track");
    if (!$("#scr-now").classList.contains("is-active") || document.hidden) return;
    if ($(".stack-layer.is-open")) return;
    const i = (Math.round(tr.scrollLeft / tr.clientWidth) + 1) % SLIDES.length;
    tr.scrollTo({ left: i * tr.clientWidth, behavior:"smooth" });
  }, 7000);
}

/* Busca */
$("#q").addEventListener("input", e => {
  const v = e.target.value;
  $("#q-clear").hidden = !v; $("#q-cancel").hidden = !v;
  renderSearch(v);
});
$("#q-clear").addEventListener("click", () => {
  $("#q").value = ""; $("#q-clear").hidden = true; renderSearch(""); $("#q").focus();
});
$("#q-cancel").addEventListener("click", () => {
  $("#q").value = ""; $("#q-clear").hidden = true; $("#q-cancel").hidden = true; renderSearch(""); $("#q").blur();
});

/* Controles do leitor */
$("#rd-smaller").addEventListener("click", () => { readerPrefs.size = Math.max(14, readerPrefs.size - 1); applyReaderPrefs(); requestAnimationFrame(measureReader); });
$("#rd-bigger").addEventListener("click",  () => { readerPrefs.size = Math.min(30, readerPrefs.size + 1); applyReaderPrefs(); requestAnimationFrame(measureReader); });
$("#rd-scroll").addEventListener("click",  function(){ readerPrefs.scroll = this.getAttribute("aria-checked") !== "true"; this.setAttribute("aria-checked", String(readerPrefs.scroll)); applyReaderPrefs(); requestAnimationFrame(measureReader); });
$("#rd-auto").addEventListener("click",    function(){ readerPrefs.autoTheme = this.getAttribute("aria-checked") !== "true"; this.setAttribute("aria-checked", String(readerPrefs.autoTheme)); $(".switch", this).setAttribute("aria-checked", String(readerPrefs.autoTheme)); if (readerPrefs.autoTheme) applyAppearance($("#appearance .seg[aria-selected=true]").dataset.appear); });
$("#dt-smaller").addEventListener("click", () => { dtIndex = Math.max(0, dtIndex - 1); applyDT(); });
$("#dt-bigger").addEventListener("click",  () => { dtIndex = Math.min(DT_STEPS.length - 1, dtIndex + 1); applyDT(); });
$("#dt-reset").addEventListener("click",   () => { dtIndex = 2; applyDT(); });
$("#scrim").addEventListener("click", closeSheets);

/* Teclado: Esc, setas no leitor, setas no carrossel */
document.addEventListener("keydown", e => {
  if (e.key === "Escape"){
    if ($(".sheet.is-open")) { closeSheets(); return; }
    const L = $(".stack-layer.is-open");
    if (L) closeLayer(L.id);
    return;
  }
  if ($("#layer-reader").classList.contains("is-open") && !$(".sheet.is-open")){
    if (e.key === "ArrowRight" || e.key === "PageDown" || e.key === " ") { e.preventDefault(); goPage(rdPage + 1); }
    if (e.key === "ArrowLeft"  || e.key === "PageUp")                    { e.preventDefault(); goPage(rdPage - 1); }
  }
});

/* Swipe no leitor */
(function(){
  const p = $("#reader-page"); let x0 = null;
  p.addEventListener("touchstart", e => { x0 = e.touches[0].clientX; }, { passive:true });
  p.addEventListener("touchend", e => {
    if (x0 == null) return;
    const dx = e.changedTouches[0].clientX - x0;
    if (Math.abs(dx) > 42) goPage(rdPage + (dx < 0 ? 1 : -1));
    x0 = null;
  }, { passive:true });
})();

let rz; window.addEventListener("resize", () => {
  clearTimeout(rz); rz = setTimeout(() => { paintAll(); measureReader(); }, 180);
});
$("#bb-track").addEventListener("scroll", bbSync, { passive:true });
REDUCED.addEventListener("change", bbAuto);
window.matchMedia("(prefers-color-scheme: dark)").addEventListener("change", () => {
  const m = $("#appearance .seg[aria-selected=true]");
  if (m && m.dataset.appear === "auto") applyAppearance("auto");
});

/* ---------- boot ---------- */
renderBillboard();
renderNow();
renderPlus();
renderSearch("");
renderLib("lendo");
renderFontList();
renderTOC();
applyAppearance("dark");
applyDT();
applyReaderPrefs();
requestAnimationFrame(() => { paintAll(); bbAuto(); });
window.addEventListener("load", () => { paintAll(); });

if ("serviceWorker" in navigator && location.protocol !== "blob:" && location.protocol.indexOf("http") === 0){
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("sw.js").catch(() => {});
  });
}

