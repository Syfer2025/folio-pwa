import { mkdir, rename, rm, lstat, writeFile } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';
import { publicFiles, readPublicFile, releaseVersion, stampWorker } from './public-files.mjs';

const PROJECT_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

function generatedPath(root, name) {
  if (!/^\.folio-(?:build|previous)-[a-f0-9-]+$/.test(name)) throw new Error('Pasta temporária inválida.');
  const target = path.resolve(root, name);
  if (path.dirname(target) !== path.resolve(root)) throw new Error('Pasta temporária fora do projeto.');
  return target;
}

export async function build({ root = PROJECT_ROOT } = {}) {
  root = path.resolve(root);
  const files = new Map();
  for (const name of await publicFiles(root)) files.set(name, await readPublicFile(root, name));
  for (const [name, content] of files) {
    if (name.endsWith('.js')) new vm.Script(content.toString('utf8'), { filename: name });
  }
  const manifest = JSON.parse(files.get('manifest.webmanifest').toString('utf8'));
  for (const icon of [...(manifest.icons || []), ...(manifest.shortcuts || []).flatMap(item => item.icons || [])]) {
    if (!files.has(icon.src.replace(/^\.\//, ''))) throw new Error('Ícone ausente no pacote: ' + icon.src);
  }
  const html = files.get('index.html').toString('utf8');
  for (const match of html.matchAll(/(?:src|href)=["']([^"'#]+)["']/g)) {
    const reference = match[1];
    if (/^(?:https?:|data:|mailto:|tel:)/.test(reference)) continue;
    if (!files.has(reference.replace(/^\.\//, '').split(/[?#]/)[0])) throw new Error('Recurso do HTML ausente: ' + reference);
  }
  const version = releaseVersion(files);
  files.set('sw.js', stampWorker(files.get('sw.js'), version));
  const temporary = generatedPath(root, '.folio-build-' + randomUUID());
  const previous = generatedPath(root, '.folio-previous-' + randomUUID());
  const destination = path.resolve(root, 'dist');
  // Recursive cleanup targets are explicitly constrained siblings in root.
  let movedPrevious = false, installed = false;
  try {
    await mkdir(temporary);
    for (const [name, content] of files) {
      const output = path.join(temporary, name);
      await mkdir(path.dirname(output), { recursive: true });
      await writeFile(output, content);
    }
    try {
      const current = await lstat(destination);
      if (!current.isDirectory() || current.isSymbolicLink()) throw new Error('dist precisa ser uma pasta regular do projeto.');
      await rename(destination, previous);
      movedPrevious = true;
    } catch (error) { if (error.code !== 'ENOENT') throw error; }
    await rename(temporary, destination);
    installed = true;
    if (movedPrevious) await rm(previous, { recursive: true });
    return { directory: destination, version, files: [...files.keys()] };
  } catch (error) {
    if (movedPrevious && !installed) await rename(previous, destination);
    throw error;
  } finally { await rm(temporary, { recursive: true, force: true }); }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const result = await build();
    process.stdout.write(`Folio pronto em dist/ — ${result.files.length} arquivos públicos, versão ${result.version}.\n`);
  } catch (error) { process.stderr.write('Build interrompido: ' + error.message + '\n'); process.exitCode = 1; }
}
