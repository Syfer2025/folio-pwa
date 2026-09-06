import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { publicFiles, readPublicFile, releaseVersion, stampWorker } from './public-files.mjs';

const PROJECT_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8', '.json': 'application/json; charset=utf-8',
  '.webmanifest': 'application/manifest+json; charset=utf-8', '.png': 'image/png',
  '.svg': 'image/svg+xml', '.txt': 'text/plain; charset=utf-8' };

export function createFolioServer({ root = PROJECT_ROOT } = {}) {
  root = path.resolve(root);
  return http.createServer(async (req, res) => {
    const headers = { 'Cache-Control': 'no-cache', 'X-Content-Type-Options': 'nosniff',
      'Referrer-Policy': 'strict-origin-when-cross-origin', 'X-Frame-Options': 'DENY' };
    const respond = (status, message) => {
      res.writeHead(status, { ...headers, 'Content-Type': 'text/plain; charset=utf-8' });
      res.end(req.method === 'HEAD' ? undefined : message);
    };
    try {
      if (!['GET', 'HEAD'].includes(req.method)) { res.setHeader('Allow', 'GET, HEAD'); respond(405, 'Método não permitido'); return; }
      let pathname;
      try { pathname = decodeURIComponent(new URL(req.url, 'http://localhost').pathname); }
      catch { respond(400, 'Endereço inválido'); return; }
      const relative = pathname === '/' ? 'index.html' : pathname.slice(1);
      const allowed = await publicFiles(root);
      if (!allowed.includes(relative)) { respond(404, 'Não encontrado'); return; }
      let content = await readPublicFile(root, relative);
      if (relative === 'sw.js') {
        if (content.includes('__FOLIO_RELEASE__')) {
          const files = new Map();
          for (const name of allowed) files.set(name, await readPublicFile(root, name));
          content = Buffer.from(stampWorker(content, releaseVersion(files)));
        }
        headers['Service-Worker-Allowed'] = './';
        headers['Cache-Control'] = 'no-store';
      }
      res.writeHead(200, { ...headers, 'Content-Type': TYPES[path.extname(relative)] || 'application/octet-stream', 'Content-Length': content.length });
      res.end(req.method === 'HEAD' ? undefined : content);
    } catch (error) { respond(error.code === 'ENOENT' ? 404 : 500, error.code === 'ENOENT' ? 'Não encontrado' : 'Não foi possível abrir o arquivo.'); }
  });
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const root = process.env.FOLIO_SERVE_DIST || process.argv.includes('--dist') ? path.join(PROJECT_ROOT, 'dist') : PROJECT_ROOT;
  const port = Number(process.env.PORT || 4173);
  if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error('PORT precisa estar entre 1 e 65535.');
  const server = createFolioServer({ root });
  server.on('error', error => { process.stderr.write('Servidor: ' + error.message + '\n'); process.exitCode = 1; });
  server.listen(port, '127.0.0.1', () => process.stdout.write(`Folio: http://localhost:${port}\n`));
}
