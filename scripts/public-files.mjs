import { createHash } from 'node:crypto';
import { lstat, readFile, readdir, realpath } from 'node:fs/promises';
import path from 'node:path';

export const SHELL_FILES = Object.freeze([
  'index.html', 'styles.css', 'reader.css', 'app.js', 'catalog.js', 'storage.js',
  'import.js', 'reader.js', 'manifest.webmanifest', 'sw.js',
  'icons/icon.svg', 'icons/icon-180.png', 'icons/icon-192.png', 'icons/icon-512.png',
  'icons/icon-maskable-512.png', 'vendor/fflate.min.js', 'vendor/fflate.LICENSE.txt'
]);

// Public assets are an allowlist, never a recursive copy of the project.
export async function publicFiles(root) {
  const files = [...SHELL_FILES];
  for (const item of await readdir(path.join(root, 'books'), { withFileTypes: true })) {
    if (item.isFile() && /^[a-zA-Z0-9_-]+\.json$/.test(item.name)) files.push('books/' + item.name);
  }
  return files.sort();
}

export async function readPublicFile(root, relative) {
  const file = path.resolve(root, relative);
  const normalizedRoot = path.resolve(root);
  if (!file.startsWith(normalizedRoot + path.sep)) throw new Error('Caminho fora da pasta pública.');
  const info = await lstat(file);
  if (!info.isFile() || info.isSymbolicLink()) throw new Error('O arquivo público deve ser um arquivo regular: ' + relative);
  const [realRoot, realFile] = await Promise.all([realpath(root), realpath(file)]);
  if (!realFile.startsWith(realRoot + path.sep)) throw new Error('Link para fora da pasta pública: ' + relative);
  return readFile(file);
}

export function releaseVersion(files) {
  const hash = createHash('sha256');
  for (const [name, content] of [...files].sort(([left], [right]) => left.localeCompare(right))) {
    hash.update(name).update('\0').update(content).update('\0');
  }
  return hash.digest('hex').slice(0, 20);
}

export function stampWorker(content, version) {
  return content.toString('utf8').replaceAll('__FOLIO_RELEASE__', version);
}
