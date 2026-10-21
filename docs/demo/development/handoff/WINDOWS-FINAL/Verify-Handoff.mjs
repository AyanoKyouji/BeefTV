// Read-only source / portable-payload inventory. Native launch acceptance is separate.
import { readFile, readdir, lstat, realpath, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const hash = bytes => createHash('sha256').update(bytes).digest('hex');
function relativeName(name) {
  if (typeof name !== 'string' || !name || name.includes('\\') || name.includes(':') || name.startsWith('/') || name.split('/').some(p => !p || p === '.' || p === '..')) {
    throw new Error('Unsafe relative path in inventory');
  }
  return name;
}
async function bytesUnder(root, name) {
  relativeName(name);
  const file = path.join(root, ...name.split('/'));
  const resolved = await realpath(file);
  const rel = path.relative(await realpath(root), resolved);
  if (rel.startsWith('..' + path.sep) || rel === '..' || path.isAbsolute(rel) || !(await lstat(file)).isFile()) throw new Error('File escapes root or is not regular: ' + name);
  return readFile(file);
}
export async function verifySource(root, manifest) {
  if (manifest.schemaVersion !== 1 || !/^[a-f0-9]{40}$/.test(manifest.sourceCommit) || !Array.isArray(manifest.files) || !manifest.files.length) throw new Error('Invalid source manifest');
  const seen = new Set();
  for (const item of manifest.files) {
    const name = relativeName(item.path);
    const normalized = name.toLowerCase();
    if (seen.has(normalized)) throw new Error('Duplicate/case-colliding source path: ' + name);
    seen.add(normalized);
    if (!/^[a-f0-9]{64}$/.test(item.sha256) || !Number.isSafeInteger(item.bytes) || item.bytes < 0) throw new Error('Invalid source entry: ' + name);
    const bytes = await bytesUnder(root, name);
    if (bytes.length !== item.bytes || hash(bytes) !== item.sha256) throw new Error('Source mismatch: ' + name);
  }
  return { schemaVersion: 1, kind: 'source-verification', pass: true, sourceCommit: manifest.sourceCommit, files: manifest.files.length };
}
function amd64PE(bytes, name) {
  if (bytes.length < 64 || bytes.toString('ascii', 0, 2) !== 'MZ') throw new Error('Not a PE executable: ' + name);
  const offset = bytes.readUInt32LE(60);
  if (offset + 6 > bytes.length || bytes.readUInt32LE(offset) !== 0x00004550 || bytes.readUInt16LE(offset + 4) !== 0x8664) throw new Error('Not an AMD64 PE executable: ' + name);
}
export async function verifyBundle(root, sourceRoot) {
  const required = ['BeefTV.exe', 'cli/beeftv.exe', 'agent-host/runtime/node.exe', 'agent-host/server.mjs', 'agent-host/package.json', 'agent-host/bun.lock', 'agent-host/media-runtime/ffmpeg.exe', 'agent-host/media-runtime/ffprobe.exe', 'agent-host/media-runtime/manifest.json'];
  for (const name of required) {
    const bytes = await bytesUnder(root, name);
    if (!bytes.length) throw new Error('Empty payload: ' + name);
    if (name.endsWith('.exe')) amd64PE(bytes, name);
  }
  for (const name of ['pi-coding-agent', 'pi-ai', 'pi-durable', 'chord']) {
    const pkg = JSON.parse(await bytesUnder(root, `agent-host/node_modules/@earendil-works/${name}/package.json`));
    if (pkg.version !== '1.2.0') throw new Error('Unexpected SDK version: ' + name);
  }
  const sources = [];
  for (const entry of await readdir(path.join(sourceRoot, 'plugin-packages'), { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;
    try { await bytesUnder(sourceRoot, 'plugin-packages/' + entry.name + '/manifest.json'); }
    catch (error) { if (error.code === 'ENOENT') continue; throw error; }
    sources.push(entry.name + '.beeftv-plugin');
  }
  const plugins = (await readdir(path.join(root, 'plugin-packages'))).filter(n => n.endsWith('.beeftv-plugin')).sort();
  if (!sources.length || JSON.stringify(sources.sort()) !== JSON.stringify(plugins)) throw new Error('Plugin payload differs from source package names');
  const files = [];
  async function walk(dir, prefix = '') {
    for (const entry of await readdir(dir, { withFileTypes: true })) {
      const name = prefix + entry.name;
      relativeName(name);
      if (entry.isDirectory()) await walk(path.join(dir, entry.name), name + '/');
      else {
        if (!entry.isFile()) throw new Error('Non-regular payload entry: ' + name);
        const bytes = await bytesUnder(root, name);
        files.push({ path: name, bytes: bytes.length, sha256: hash(bytes) });
      }
    }
  }
  await walk(root);
  files.sort((a, b) => a.path.localeCompare(b.path, 'en'));
  return { schemaVersion: 1, kind: 'windows-payload-inventory', pass: true, nativeLaunchTested: false, plugins: plugins.length, files };
}
async function main() {
  const args = process.argv.slice(2);
  const get = key => { const i = args.indexOf('--' + key); return i < 0 ? undefined : args[i + 1]; };
  const mode = args[0], source = get('source'), out = get('out');
  if (!source || !out || !['source', 'bundle'].includes(mode)) throw new Error('Usage: node Verify-Handoff.mjs source --source <dir> --manifest <json> --out <new.json> | bundle --source <dir> --bundle <dir> --out <new.json>');
  const manifest = mode === 'source' ? get('manifest') : undefined;
  const bundle = mode === 'bundle' ? get('bundle') : undefined;
  if (mode === 'source' && !manifest || mode === 'bundle' && !bundle) throw new Error('Missing input');
  // Output is evidence, never an input file or part of either verified tree.
  const output = path.resolve(out);
  for (const dir of [source, bundle].filter(Boolean)) {
    const relative = path.relative(await realpath(dir), path.resolve(await realpath(path.dirname(output)), path.basename(output)));
    if (!relative.startsWith('..' + path.sep) && relative !== '..' && !path.isAbsolute(relative)) throw new Error('Output must be outside verified trees');
  }
  if (manifest && path.resolve(manifest) === output) throw new Error('Cannot overwrite manifest');
  const result = mode === 'source' ? await verifySource(source, JSON.parse(await readFile(manifest, 'utf8'))) : await verifyBundle(bundle, source);
  await writeFile(output, JSON.stringify(result, null, 2) + '\n', { flag: 'wx' });
  console.log(`PASS ${mode}; native launch acceptance remains separate`);
}
if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  main().catch(error => { console.error(error.message); process.exitCode = 1; });
}
