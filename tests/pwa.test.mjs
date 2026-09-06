import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile, writeFile, mkdir, mkdtemp, rm, readdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { once } from 'node:events';
import vm from 'node:vm';
import { build } from '../scripts/build.mjs';
import { createFolioServer } from '../scripts/serve.mjs';
import { SHELL_FILES, publicFiles } from '../scripts/public-files.mjs';

const project = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const workerSource = await readFile(path.join(project, 'sw.js'), 'utf8');
const manifest = JSON.parse(await readFile(path.join(project, 'manifest.webmanifest'), 'utf8'));

async function fixture(t) {
  const working = path.join(project, 'work');
  await mkdir(working, { recursive: true });
  const root = await mkdtemp(path.join(working, 'pwa-test-'));
  t.after(async () => {
    assert.equal(path.dirname(root), working);
    assert.match(path.basename(root), /^pwa-test-/);
    await rm(root, { recursive: true, force: true });
  });
  await mkdir(path.join(root, 'books'));
  for (const name of SHELL_FILES) {
    await mkdir(path.dirname(path.join(root, name)), { recursive: true });
    const content = name === 'manifest.webmanifest' ? JSON.stringify(manifest)
      : name === 'sw.js' ? workerSource
      : name === 'index.html' ? '<!doctype html><link rel="manifest" href="manifest.webmanifest"><script src="app.js"></script>'
      : name.endsWith('.js') ? 'void 0;'
      : name.endsWith('.png') ? await readFile(path.join(project, name)) : '';
    await writeFile(path.join(root, name), content);
  }
  await writeFile(path.join(root, 'books', 'fixture.json'), '{"id":"fixture"}');
  return root;
}

async function serve(t, root) {
  const server = createFolioServer({ root });
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  t.after(async () => { server.closeAllConnections(); await new Promise(resolve => server.close(resolve)); });
  return 'http://127.0.0.1:' + server.address().port;
}

function worker() {
  const handlers = new Map(), buckets = new Map(), network = [], deleted = [];
  let skipCount = 0, claimCount = 0;
  const scope = 'https://folio.test/reader/';
  const cacheAPI = {
    async keys() { return [...buckets.keys()]; },
    async delete(key) { deleted.push(key); return buckets.delete(key); },
    async open(key) {
      if (!buckets.has(key)) buckets.set(key, new Map());
      const entries = buckets.get(key);
      return {
        async addAll(requests) { for (const request of requests) entries.set(request.url, new Response('cached:' + new URL(request.url).pathname)); },
        async match(url) { return entries.get(url)?.clone(); }
      };
    }
  };
  const context = vm.createContext({ URL, Request, Response, Map, Promise, caches: cacheAPI,
    fetch: async request => { network.push(request.url); return new Response('network'); },
    self: { registration: { scope }, location: new URL(scope + 'sw.js'),
      clients: { claim: async () => { claimCount++; } },
      skipWaiting: async () => { skipCount++; },
      addEventListener: (name, callback) => handlers.set(name, callback) }
  });
  vm.runInContext(workerSource, context);
  async function dispatch(name, extras = {}) {
    let work, response;
    handlers.get(name)({ ...extras, waitUntil: promise => { work = promise; }, respondWith: promise => { response = promise; } });
    await work;
    return response ? await response : undefined;
  }
  return { dispatch, buckets, network, deleted, scope, get skipCount() { return skipCount; }, get claimCount() { return claimCount; } };
}

test('manifest resolves identity and shortcuts inside a subdirectory and has correctly sized install icons', async () => {
  const base = 'https://folio.test/reader/manifest.webmanifest';
  const scope = new URL(manifest.scope, base).href;
  assert.equal(new URL(manifest.id, base).href, scope);
  assert.ok(new URL(manifest.start_url, base).href.startsWith(scope));
  assert.equal(manifest.display, 'standalone');
  for (const shortcut of manifest.shortcuts) assert.ok(new URL(shortcut.url, base).href.startsWith(scope));
  for (const icon of manifest.icons.filter(icon => icon.type === 'image/png')) {
    const bytes = await readFile(path.join(project, icon.src));
    assert.equal(bytes.subarray(1, 4).toString(), 'PNG');
    const [width, height] = icon.sizes.split('x').map(Number);
    assert.equal(bytes.readUInt32BE(16), width);
    assert.equal(bytes.readUInt32BE(20), height);
  }
  assert.ok(manifest.icons.some(icon => icon.sizes === '192x192' && icon.purpose === 'any'));
  assert.ok(manifest.icons.some(icon => icon.sizes === '512x512' && icon.purpose === 'any'));
  assert.ok(manifest.icons.some(icon => icon.purpose === 'maskable'));
});

test('build contains only public files, removes obsolete output and stamps content-sensitive releases', async t => {
  const root = await fixture(t);
  await writeFile(path.join(root, '.env'), 'PRIVATE_TOKEN=fixture');
  await writeFile(path.join(root, 'books', 'SOURCES.md'), 'not public');
  await writeFile(path.join(root, 'vendor', '.env'), 'not public');
  const first = await build({ root });
  assert.deepEqual(first.files, await publicFiles(root));
  assert.equal(first.files.some(name => /\.env|SOURCES|scripts|tests|work/.test(name)), false);
  assert.equal((await readFile(path.join(first.directory, 'sw.js'), 'utf8')).includes('__FOLIO_RELEASE__'), false);
  await writeFile(path.join(first.directory, 'stale-secret.txt'), 'stale');
  const second = await build({ root });
  assert.equal(first.version, second.version);
  assert.equal((await readdir(second.directory)).includes('stale-secret.txt'), false);
  await writeFile(path.join(root, 'styles.css'), 'body { color: red; }');
  const third = await build({ root });
  assert.notEqual(third.version, first.version);
});

test('failed builds preserve the previous working output', async t => {
  const root = await fixture(t), first = await build({ root });
  const before = await readFile(path.join(first.directory, 'sw.js'), 'utf8');
  await writeFile(path.join(root, 'app.js'), 'function {');
  await assert.rejects(build({ root }), SyntaxError);
  assert.equal(await readFile(path.join(first.directory, 'sw.js'), 'utf8'), before);
  await writeFile(path.join(root, 'app.js'), 'void 0;');
  await writeFile(path.join(root, 'index.html'), '<script src="missing.js"></script>');
  await assert.rejects(build({ root }), /Recurso do HTML ausente/);
  assert.equal(await readFile(path.join(first.directory, 'sw.js'), 'utf8'), before);
});

test('server excludes project files, traversal, hidden assets and unsupported methods', async t => {
  const root = await fixture(t), base = await serve(t, root);
  await writeFile(path.join(root, 'package.json'), '{"private":true}');
  await writeFile(path.join(root, 'books', 'SOURCES.md'), 'private');
  for (const name of ['/package.json', '/.git/config', '/books/SOURCES.md', '/scripts/build.mjs', '/vendor/.env', '/%2e%2e%2fpackage.json', '/books/%2e%2e%5cpackage.json']) {
    assert.equal((await fetch(base + name)).status, 404, name);
  }
  assert.equal((await fetch(base + '/%E0%A4%A')).status, 400);
  const post = await fetch(base + '/', { method: 'POST' });
  assert.equal(post.status, 405); assert.equal(post.headers.get('allow'), 'GET, HEAD');
  const head = await fetch(base + '/index.html', { method: 'HEAD' });
  assert.equal(head.status, 200); assert.equal(await head.text(), '');
  assert.equal(head.headers.get('x-content-type-options'), 'nosniff');
  assert.match((await fetch(base + '/manifest.webmanifest')).headers.get('content-type'), /application\/manifest\+json/);
});

test('development worker release changes with source assets; production serves the stamped worker', async t => {
  const root = await fixture(t), base = await serve(t, root);
  const initial = await fetch(base + '/sw.js');
  const first = await initial.text();
  assert.equal(initial.headers.get('cache-control'), 'no-store');
  assert.equal(initial.headers.get('service-worker-allowed'), './');
  assert.equal(first.includes('__FOLIO_RELEASE__'), false);
  assert.equal(await (await fetch(base + '/sw.js')).text(), first);
  await writeFile(path.join(root, 'app.js'), 'void 1;');
  assert.notEqual(await (await fetch(base + '/sw.js')).text(), first);
  const output = await build({ root }), production = await serve(t, output.directory);
  assert.equal(await (await fetch(production + '/sw.js')).text(), await readFile(path.join(output.directory, 'sw.js'), 'utf8'));
});

test('worker precaches complete app under its scope and waits for explicit update acceptance', async () => {
  const runtime = worker();
  await runtime.dispatch('install');
  assert.equal(runtime.skipCount, 0);
  const urls = [...runtime.buckets.values()][0];
  for (const name of ['reader.css', 'reader.js', 'storage.js', 'import.js', 'catalog.js', 'vendor/fflate.min.js', 'icons/icon-maskable-512.png']) {
    assert.ok(urls.has(runtime.scope + name), name);
  }
  assert.equal([...urls.keys()].some(url => /books\/|data\.js|googleapis/.test(url)), false);
  await runtime.dispatch('message', { data: { type: 'UNRELATED' } });
  assert.equal(runtime.skipCount, 0);
  await runtime.dispatch('message', { data: { type: 'SKIP_WAITING' } });
  assert.equal(runtime.skipCount, 1);
});

test('worker keeps one complete shell offline without network revalidation or external/API interception', async () => {
  const runtime = worker();
  await runtime.dispatch('install');
  const nav = await runtime.dispatch('fetch', { request: { method: 'GET', mode: 'navigate', url: runtime.scope + '?launch=shortcut' } });
  assert.equal(await nav.text(), 'cached:/reader/index.html');
  const asset = await runtime.dispatch('fetch', { request: { method: 'GET', mode: 'cors', url: runtime.scope + 'reader.js?v=anything' } });
  assert.equal(await asset.text(), 'cached:/reader/reader.js');
  for (const url of ['https://third-party.test/font.woff2', runtime.scope + 'api/user', runtime.scope + 'books/fixture.json', 'https://folio.test/other/index.html']) {
    assert.equal(await runtime.dispatch('fetch', { request: { method: 'GET', mode: 'cors', url } }), undefined);
  }
  assert.equal(runtime.network.length, 0);
});

test('worker activation removes only its own obsolete caches and leaves other apps and scopes intact', async () => {
  const runtime = worker();
  await runtime.dispatch('install');
  const current = [...runtime.buckets.keys()][0];
  const old = current.replace('__FOLIO_RELEASE__', 'old');
  runtime.buckets.set(old, new Map());
  runtime.buckets.set('other-app-v1', new Map());
  runtime.buckets.set('folio-shell:' + encodeURIComponent('https://folio.test/other/') + ':old', new Map());
  runtime.buckets.set('folio-v2-shell', new Map());
  await runtime.dispatch('activate');
  assert.deepEqual(runtime.deleted.sort(), [old, 'folio-v2-shell'].sort());
  assert.ok(runtime.buckets.has(current));
  assert.ok(runtime.buckets.has('other-app-v1'));
  assert.equal(runtime.claimCount, 1);
});

test('real browser keeps a waiting update inactive, activates on acceptance, and reloads offline without losing data', { timeout: 30000 }, async t => {
  const { chromium } = await import('playwright');
  const root = await fixture(t), base = await serve(t, root);
  await writeFile(path.join(root, 'app.js'), "window.pwaVersion = 'v1';");
  const browser = await chromium.launch({ headless: true,
    ...(process.env.PLAYWRIGHT_CHANNEL ? { channel: process.env.PLAYWRIGHT_CHANNEL }
      : process.platform === 'win32' ? { channel: 'msedge' } : {}) });
  t.after(() => browser.close());
  const context = await browser.newContext();
  const page = await context.newPage();
  await page.goto(base);
  await page.evaluate(async () => {
    await navigator.serviceWorker.register('./sw.js', { updateViaCache: 'none' });
    await navigator.serviceWorker.ready;
    if (!navigator.serviceWorker.controller) await new Promise(resolve => navigator.serviceWorker.addEventListener('controllerchange', resolve, { once: true }));
    localStorage.setItem('reading-position-fixture', 'chapter:3,paragraph:12');
  });
  assert.equal(await page.evaluate(() => window.pwaVersion), 'v1');
  const cdp = await context.newCDPSession(page);
  const installability = await cdp.send('Page.getInstallabilityErrors');
  // Playwright contexts are private profiles; ignore only that environment flag.
  assert.deepEqual(installability.installabilityErrors.filter(error => error.errorId !== 'in-incognito'), []);
  await writeFile(path.join(root, 'app.js'), "window.pwaVersion = 'v2';");
  await page.evaluate(async () => { const registration = await navigator.serviceWorker.getRegistration(); await registration.update(); });
  await page.waitForFunction(async () => !!(await navigator.serviceWorker.getRegistration()).waiting);
  await page.reload();
  assert.equal(await page.evaluate(() => window.pwaVersion), 'v1');
  await page.evaluate(async () => {
    const registration = await navigator.serviceWorker.getRegistration();
    await new Promise(resolve => {
      navigator.serviceWorker.addEventListener('controllerchange', resolve, { once: true });
      registration.waiting.postMessage({ type: 'SKIP_WAITING' });
    });
  });
  await page.reload();
  assert.equal(await page.evaluate(() => window.pwaVersion), 'v2');
  await context.setOffline(true);
  await page.reload();
  assert.equal(await page.evaluate(() => window.pwaVersion), 'v2');
  assert.equal(await page.evaluate(() => localStorage.getItem('reading-position-fixture')), 'chapter:3,paragraph:12');
  assert.equal(await page.evaluate(async () => (await fetch('reader.css')).ok), true);
  assert.equal(await page.evaluate(async () => { try { await fetch('books/fixture.json'); return true; } catch { return false; } }), false);
});
