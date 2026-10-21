import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { DatabaseSync } from 'node:sqlite';
import { test } from 'node:test';

const tool = path.join(import.meta.dirname, 'Inspect-Saved-Project.mjs');

test('saved snapshot checks the full persisted document and refuses incomplete legacy evidence', async t => {
  const dir = await mkdtemp(path.join(tmpdir(), 'beeftv-中文快照 '));
  t.after(() => rm(dir, { recursive: true, force: true }));
  const dbPath = path.join(dir, 'canvas.db');
  const db = new DatabaseSync(dbPath);
  t.after(() => db.close());
  db.exec('CREATE TABLE canvas_projects (id TEXT, title TEXT, payload_json TEXT, revision INTEGER, updated_at TEXT)');
  const document = {
    id: 'canvas', projectId: 'project', revision: 7,
    nodes: [
      { id: 'script', type: 'script', width: 640, metadata: { storyboard: { rows: [{ id: 'row', shotNumber: 1, durationSeconds: 3, camera: '平视', videoMotionPrompt: '缓慢推进', assetBindings: [] }], referenceNodeIds: [] } } },
      { id: 'text', type: 'text', metadata: { composerContent: '已编辑文本', prompt: '旧提示词', content: '旧输出' } },
    ],
    connections: [{ id: 'edge', fromNodeId: 'script', toNodeId: 'text', storyboardRowId: 'row', relation: 'storyboard-output' }],
  };
  db.prepare('INSERT INTO canvas_projects VALUES (?, ?, ?, ?, ?)').run('canvas', '快照回归', JSON.stringify(document), 7, '2026-10-21');
  const before = path.join(dir, 'before.json');
  let index = 0;
  function capture(compare) {
    const out = path.join(dir, 'after-' + index++ + '.json');
    return spawnSync(process.execPath, [tool, '--db', dbPath, '--title', '快照回归', '--out', compare ? out : before, ...(compare ? ['--compare', compare] : [])], { encoding: 'utf8' });
  }
  assert.equal(capture().status, 0);
  const snapshot = JSON.parse(await readFile(before, 'utf8'));
  assert.equal(snapshot.nodes[1].content, '已编辑文本');
  assert.equal(snapshot.nodes[0].storyboard[0].durationSeconds, 3);
  await t.test('unchanged document passes', () => assert.equal(capture(before).status, 0));
  await t.test('output cannot overwrite the baseline and compare to itself', async () => {
    const original = await readFile(before, 'utf8');
    const result = spawnSync(process.execPath, [tool, '--db', dbPath, '--title', '快照回归', '--out', before, '--compare', before], { encoding: 'utf8' });
    assert.equal(result.status, 2);
    assert.equal(await readFile(before, 'utf8'), original);
  });
  const reverseKeys = value => Array.isArray(value) ? value.map(reverseKeys) : value && typeof value === 'object' ? Object.fromEntries(Object.keys(value).reverse().map(k => [k, reverseKeys(value[k])])) : value;
  await t.test('object key order alone does not imply data loss', () => {
    db.prepare('UPDATE canvas_projects SET payload_json = ?').run(JSON.stringify(reverseKeys(document)));
    assert.equal(capture(before).status, 0);
  });
  for (const [name, change] of [
    ['camera field', d => { d.nodes[0].metadata.storyboard.rows[0].camera = '俯视'; }],
    ['duration field', d => { d.nodes[0].metadata.storyboard.rows[0].durationSeconds = 9; }],
    ['video motion prompt', d => { d.nodes[0].metadata.storyboard.rows[0].videoMotionPrompt = '快速拉远'; }],
    ['node width outside the readable projection', d => { d.nodes[0].width = 999; }],
    ['project ownership field', d => { d.projectId = 'other-project'; }],
    ['connection target', d => { d.connections[0].toNodeId = 'other-node'; }],
    ['removed node', d => { d.nodes.pop(); }],
  ]) await t.test(name + ' changes fail even at the same revision', () => {
    const changed = structuredClone(document); change(changed);
    db.prepare('UPDATE canvas_projects SET payload_json = ?').run(JSON.stringify(changed));
    assert.equal(capture(before).status, 1);
  });
  await t.test('legacy snapshots cannot pass as full-document evidence', async () => {
    db.prepare('UPDATE canvas_projects SET payload_json = ?').run(JSON.stringify(document));
    delete snapshot.documentSha256; delete snapshot.schemaVersion;
    const legacy = path.join(dir, 'legacy.json');
    await writeFile(legacy, JSON.stringify(snapshot));
    const result = capture(legacy);
    assert.equal(result.status, 1);
    assert.match(result.stderr, /旧版快照/);
  });
});
