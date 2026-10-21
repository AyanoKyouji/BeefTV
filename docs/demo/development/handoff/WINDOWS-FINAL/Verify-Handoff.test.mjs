import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, readFile, rm, symlink } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { verifySource, verifyBundle } from './Verify-Handoff.mjs';

test('source verification detects damaged, incomplete and unsafe snapshots', async t => {
  const dir = await mkdtemp(path.join(tmpdir(), 'beeftv-交接 '));
  t.after(() => rm(dir, { recursive: true, force: true }));
  const source = path.join(dir, 'source'); await mkdir(source);
  await writeFile(path.join(source, 'VERSION'), 'v1.7.26\n');
  const item = { path: 'VERSION', bytes: 8, sha256: createHash('sha256').update('v1.7.26\n').digest('hex') };
  const manifest = { schemaVersion: 1, sourceCommit: 'a'.repeat(40), files: [item] };
  await t.test('valid source', async () => assert.equal((await verifySource(source, manifest)).pass, true));
  await t.test('same-length mutation', async () => {
    await writeFile(path.join(source, 'VERSION'), 'v1.7.27\n');
    await assert.rejects(verifySource(source, manifest), /mismatch/);
    await writeFile(path.join(source, 'VERSION'), 'v1.7.26\n');
  });
  await t.test('missing source', async () => await assert.rejects(verifySource(source, { ...manifest, files: [{ ...item, path: 'missing' }] }), /ENOENT/));
  await t.test('traversal and Windows paths', async () => {
    for (const name of ['../VERSION','/VERSION','C:/VERSION','a\\b','a/../VERSION']) await assert.rejects(verifySource(source, { ...manifest, files: [{ ...item, path: name }] }), /Unsafe/);
  });
  await t.test('case collisions', async () => await assert.rejects(verifySource(source, { ...manifest, files: [item, { ...item, path: 'version' }] }), /colliding/));
  await t.test('external symlink', async () => {
    await writeFile(path.join(dir, 'outside'), 'v1.7.26\n');
    try { await symlink(path.join(dir, 'outside'), path.join(source, 'link')); }
    catch (e) { if (['EPERM','EACCES'].includes(e.code)) return t.skip('Symlink privilege unavailable'); throw e; }
    await assert.rejects(verifySource(source, { ...manifest, files: [{ ...item, path: 'link' }] }), /escapes/);
  });
  await t.test('CLI refuses overwriting source or existing evidence', async () => {
    const mf = path.join(dir, 'manifest.json');await writeFile(mf, JSON.stringify(manifest));
    const run = out => spawnSync(process.execPath, [path.join(import.meta.dirname,'Verify-Handoff.mjs'),'source','--source',source,'--manifest',mf,'--out',out], { encoding:'utf8' });
    assert.equal(run(path.join(source,'VERSION')).status,1);
    const out=path.join(dir,'result.json');assert.equal(run(out).status,0);const saved=await readFile(out,'utf8');assert.equal(run(out).status,1);assert.equal(await readFile(out,'utf8'),saved);
  });
});

test('payload inventory distinguishes missing files, wrong architecture and absent plugins', async t => {
  const dir = await mkdtemp(path.join(tmpdir(), 'beeftv-payload '));t.after(() => rm(dir,{recursive:true,force:true}));
  const source=path.join(dir,'source'),bundle=path.join(dir,'portable');await mkdir(path.join(source,'plugin-packages','fixture'),{recursive:true});await mkdir(bundle);
  const put=async(name,bytes)=>{await mkdir(path.dirname(path.join(bundle,name)),{recursive:true});await writeFile(path.join(bundle,name),bytes);};
  const pe=Buffer.alloc(128);pe.write('MZ');pe.writeUInt32LE(64,60);pe.writeUInt32LE(0x00004550,64);pe.writeUInt16LE(0x8664,68);
  for(const name of ['BeefTV.exe','cli/beeftv.exe','agent-host/runtime/node.exe','agent-host/media-runtime/ffmpeg.exe','agent-host/media-runtime/ffprobe.exe'])await put(name,pe);
  for(const name of ['agent-host/server.mjs','agent-host/package.json','agent-host/bun.lock','agent-host/media-runtime/manifest.json'])await put(name,'{}');
  for(const name of ['pi-coding-agent','pi-ai','pi-durable','chord'])await put(`agent-host/node_modules/@earendil-works/${name}/package.json`,JSON.stringify({version:'1.2.0'}));
  await writeFile(path.join(source,'plugin-packages/fixture/manifest.json'),'{}');await put('plugin-packages/fixture.beeftv-plugin','fixture');
  await t.test('complete inventory is not native acceptance',async()=>{const r=await verifyBundle(bundle,source);assert.equal(r.pass,true);assert.equal(r.nativeLaunchTested,false);assert.equal(r.plugins,1);});
  await t.test('missing required media runtime',async()=>{await rm(path.join(bundle,'agent-host/media-runtime/ffprobe.exe'));await assert.rejects(verifyBundle(bundle,source),/ENOENT/);await put('agent-host/media-runtime/ffprobe.exe',pe);});
  await t.test('wrong executable architecture',async()=>{const wrong=Buffer.from(pe);wrong.writeUInt16LE(0x014c,68);await put('BeefTV.exe',wrong);await assert.rejects(verifyBundle(bundle,source),/AMD64/);await put('BeefTV.exe',pe);});
  await t.test('SDK mismatch',async()=>{await put('agent-host/node_modules/@earendil-works/chord/package.json','{"version":"9"}');await assert.rejects(verifyBundle(bundle,source),/SDK/);await put('agent-host/node_modules/@earendil-works/chord/package.json','{"version":"1.2.0"}');});
  await t.test('missing plugin',async()=>{await rm(path.join(bundle,'plugin-packages/fixture.beeftv-plugin'));await assert.rejects(verifyBundle(bundle,source),/Plugin/);});
});
