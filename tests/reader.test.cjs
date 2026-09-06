const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const { chromium } = require('playwright');

let browser;
const root = path.resolve(__dirname, '..');
before(async () => {
  try { browser = await chromium.launch({ headless: true }); }
  catch (error) {
    if (process.platform !== 'win32') throw error;
    browser = await chromium.launch({ headless: true, channel: 'msedge' });
  }
});
after(async () => { await browser?.close(); });

function sample(overrides = {}) {
  return { id: 'reader-test', t: 'Leitura de verificação', a: 'Teste', full: true,
    chapters: [
      { title: 'Primeiro capítulo', paragraphs: Array.from({ length: 35 }, (_, i) => `${i + 1}. A leitura encontra espaço no dia. ${'Uma frase clara, uma pausa e outra ideia. '.repeat(8)}`) },
      { title: 'Outro começo', paragraphs: ['Antes do café, um coração. Depois do cafe\u0301, outro corac\u0327a\u0303o. 🙂', 'Fim deste texto de verificação.'] }
    ], ...overrides };
}

async function fixture(t, options = {}) {
  const context = await browser.newContext({ viewport: options.viewport || { width: 1280, height: 850 } });
  t.after(() => context.close());
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.route('http://folio-reader.test/**', route => route.fulfill({ contentType: 'text/html', body: '<!doctype html><html lang="pt-BR"><head></head><body><button id="open">Abrir leitor</button></body></html>' }));
  await page.goto('http://folio-reader.test/');
  if (options.clock) await page.clock.install();
  await page.addStyleTag({ path: path.join(root, 'styles.css') });
  await page.addStyleTag({ path: path.join(root, 'reader.css') });
  await page.addScriptTag({ path: path.join(root, 'storage.js') });
  await page.addScriptTag({ path: path.join(root, 'reader.js') });
  await page.evaluate(() => FolioStore.ready);
  await page.locator('#open').focus();
  await page.evaluate(({ book, settings }) => FolioReader.open(book, settings), { book: options.book || sample(), settings: options.settings || {} });
  await page.waitForFunction(() => document.querySelector('#fr-article p')?.clientHeight > 0);
  if (options.clock) await page.clock.runFor(100);
  else await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
  t.after(() => assert.deepEqual(errors, [], 'reader must not emit uncaught page errors'));
  return page;
}

test('reader has a contained responsive viewport and restores paragraph position after reopening', async t => {
  const page = await fixture(t);
  await page.evaluate(() => {
    const viewport = document.querySelector('#fr-viewport');
    const target = document.querySelector('[data-paragraph="14"]');
    viewport.scrollTop = target.getBoundingClientRect().top - viewport.getBoundingClientRect().top + viewport.scrollTop - 24;
  });
  await page.waitForFunction(() => FolioStore.getState().library['reader-test'].position.paragraph === 14);
  const first = await page.evaluate(() => FolioStore.getState().library['reader-test']);
  assert.ok(first.progress > 0 && first.progress < 1);
  await page.locator('[data-action="close"]').click();
  assert.equal(await page.evaluate(() => document.activeElement.id), 'open');
  await page.evaluate(book => FolioReader.open(book), sample());
  await page.waitForFunction(() => {
    const p = document.querySelector('[data-paragraph="14"]').getBoundingClientRect();
    const v = document.querySelector('#fr-viewport').getBoundingClientRect();
    return Math.abs(p.top - v.top - 24) < 3;
  });
  const geometry = await page.locator('#reader-dialog').evaluate(el => ({ width: el.clientWidth, height: el.clientHeight, viewportWidth: innerWidth, viewportHeight: innerHeight }));
  assert.equal(geometry.width, geometry.viewportWidth, JSON.stringify(geometry));
  assert.equal(geometry.height, geometry.viewportHeight, JSON.stringify(geometry));
});

test('search ignores composed/decomposed accents and highlights the original characters', async t => {
  const page = await fixture(t);
  await page.locator('.fr-tools [data-panel="search"]').click();
  await page.locator('#fr-search-input').fill('coracao');
  await page.waitForFunction(() => document.querySelector('.fr-results mark')?.textContent === 'coração');
  await page.locator('.fr-results button').click();
  assert.equal(await page.locator('#fr-chapter-title').textContent(), 'Outro começo');
  await page.locator('.fr-tools [data-panel="search"]').click();
  await page.locator('#fr-search-input').fill('depois do cafe');
  await page.waitForFunction(() => document.querySelector('.fr-results mark')?.textContent === 'Depois do cafe\u0301');
});

test('multi-paragraph selection, note edits and bookmarks survive closing the reader', async t => {
  const page = await fixture(t);
  await page.evaluate(() => {
    const paragraphs = document.querySelectorAll('#fr-article > p');
    const range = document.createRange();
    range.setStart(paragraphs[0].firstChild, 3);
    range.setEnd(paragraphs[1].firstChild, 20);
    getSelection().removeAllRanges();
    getSelection().addRange(range);
  });
  await page.locator('#fr-selection').waitFor({ state: 'visible' });
  await page.locator('[data-action="annotate"]').click();
  await page.locator('#fr-note-text').fill('Uma ideia que quero guardar.');
  await page.locator('#fr-note-form [type="submit"]').click();
  const note = await page.evaluate(() => FolioStore.getState().notes[0]);
  assert.equal(note.text, 'Uma ideia que quero guardar.');
  assert.equal(note.ranges.length, 2);
  assert.ok(await page.locator('#fr-article mark').count() >= 2);
  await page.locator('[data-action="close-panel"]').click();
  await page.locator('[data-action="bookmark"]').click();
  await page.locator('[data-action="close"]').click();
  const saved = await page.evaluate(() => FolioStore.getState());
  assert.ok(saved.library['reader-test'].bookmark);
  assert.equal(saved.notes.length, 1);
  await page.evaluate(book => FolioReader.open(book), sample());
  assert.ok(await page.locator('#fr-article mark').count() >= 2);
});

test('quota failure preserves a note draft and cannot trap the user in the reader', async t => {
  const page = await fixture(t);
  await page.evaluate(() => {
    const text = document.querySelector('#fr-article > p').firstChild;
    const range = document.createRange(); range.setStart(text, 0); range.setEnd(text, 20);
    getSelection().removeAllRanges(); getSelection().addRange(range);
  });
  await page.locator('#fr-selection').waitFor({ state: 'visible' });
  await page.locator('[data-action="annotate"]').click();
  await page.locator('#fr-note-text').fill('Rascunho que precisa continuar aqui.');
  await page.evaluate(() => { Storage.prototype.setItem = () => { throw new Error('Sem espaço disponível.'); }; });
  await page.locator('#fr-note-form [type="submit"]').click();
  assert.equal(await page.locator('#fr-note-text').inputValue(), 'Rascunho que precisa continuar aqui.');
  assert.equal(await page.evaluate(() => FolioStore.getState().notes.length), 0);
  await page.waitForFunction(() => document.querySelector('#fr-status').textContent.includes('Não foi possível salvar'));
  await page.locator('[data-action="close"]').click();
  assert.equal(await page.evaluate(() => FolioReader.isOpen), false);
});

test('mobile panels, large fonts and focus mode do not overflow the screen', async t => {
  const page = await fixture(t, { viewport: { width: 360, height: 740 } });
  await page.locator('.fr-tools [data-panel="appearance"]').click();
  await page.locator('[data-reader-theme="night"]').click();
  await page.locator('#fr-font-size').fill('34');
  assert.equal(await page.evaluate(() => FolioStore.getState().preferences.fontSize), 34);
  assert.equal(await page.locator('#reader-dialog').getAttribute('data-theme'), 'night');
  await page.locator('[data-action="close-panel"]').click();
  await page.locator('.fr-header [data-action="focus"]').click();
  assert.ok(await page.locator('.fr-header').isHidden());
  assert.ok(await page.locator('.fr-focus-exit').isVisible());
  assert.ok(await page.locator('#fr-viewport').evaluate(el => el.scrollWidth <= el.clientWidth));
  await page.keyboard.press('Escape');
  assert.ok(await page.locator('.fr-header').isVisible());
  await page.keyboard.press('Escape');
  assert.equal(await page.evaluate(() => FolioReader.isOpen), false);
});

test('timed sessions count active time, pause, and notify once without closing the text', async t => {
  const page = await fixture(t, { clock: true, settings: { minutes: 1 } });
  await page.evaluate(() => { window.completedSessions = []; addEventListener('folio:session-complete', event => completedSessions.push(event.detail)); });
  await page.clock.runFor(10000);
  await page.locator('#fr-session').click();
  const paused = await page.locator('#fr-session').textContent();
  await page.clock.runFor(15000);
  assert.equal(await page.locator('#fr-session').textContent(), paused);
  await page.locator('#fr-session').click();
  await page.clock.runFor(52000);
  assert.match(await page.locator('#fr-session').textContent(), /sessão cumprida/);
  assert.equal(await page.evaluate(() => completedSessions.length), 1);
  assert.equal(await page.evaluate(() => FolioReader.isOpen), true);
  await page.locator('[data-action="close"]').click();
  const seconds = await page.evaluate(() => Object.values(FolioStore.getState().activity).reduce((a, b) => a + b, 0));
  assert.ok(seconds >= 60 && seconds < 65, `active seconds: ${seconds}`);
});

test('speech uses book language, breaks long unspaced text, and cancels on close', async t => {
  const page = await fixture(t, { book: sample({ language: 'en-US', chapters: [{ title: 'Speech', paragraphs: ['x'.repeat(1000)] }] }) });
  await page.evaluate(() => {
    window.spoken = [];
    window.cancelled = 0;
    speechSynthesis.speak = utterance => { spoken.push({ text: utterance.text, lang: utterance.lang }); };
    speechSynthesis.cancel = () => { cancelled++; };
  });
  await page.locator('.fr-tools [data-panel="voice"]').click();
  await page.locator('[data-action="speech-toggle"]').click();
  const spoken = await page.evaluate(() => spoken);
  assert.equal(spoken[0].text.length, 450);
  assert.equal(spoken[0].lang, 'en-US');
  await page.locator('[data-action="close"]').click();
  assert.ok(await page.evaluate(() => cancelled > 0));
});
