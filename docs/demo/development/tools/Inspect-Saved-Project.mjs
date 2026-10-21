// 画布项目快照采集器：从 SQLite 读取项目并输出 JSON（可 --compare 与先前快照对比）。
// Windows/macOS 通用。文本节点正文读取顺序：composerContent → prompt → content（DEV-017 W3 修正）。
// 用法：
//   node Inspect-Saved-Project.mjs --db <path> --title <项目标题> --out <out.json> [--compare <prev.json>]
import { readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { existsSync } from 'node:fs';
import path from 'node:path';

const args = process.argv.slice(2);
const getArg = (name) => {
  const i = args.indexOf('--' + name);
  return i >= 0 ? args[i + 1] : undefined;
};
const dbPath = getArg('db');
const title = getArg('title');
const outPath = getArg('out');
const comparePath = getArg('compare');
if (!dbPath || !title || !outPath) {
  console.error('Usage: node Inspect-Saved-Project.mjs --db <path> --title <title> --out <out.json> [--compare <prev.json>]');
  process.exit(2);
}
if (!existsSync(dbPath)) {
  console.error('Database not found: ' + dbPath);
  process.exit(2);
}
if (comparePath && path.resolve(outPath) === path.resolve(comparePath)) {
  console.error('--out 与 --compare 必须使用不同文件，避免覆盖基准后自我对照。');
  process.exit(2);
}

// 使用随包 Node 的内置 SQLite，只读打开，不修改项目或数据库。
let project = null;
try {
  const { DatabaseSync } = await import('node:sqlite');
  const db = new DatabaseSync(dbPath, { readOnly: true });
  const row = db.prepare('SELECT id, payload_json, revision FROM canvas_projects WHERE title = ? ORDER BY updated_at DESC LIMIT 1').get(title);
  db.close();
  if (!row) { console.error('Project not found: ' + title); process.exit(1); }
  project = { id: row.id, revision: row.revision, document: JSON.parse(row.payload_json) };
} catch (e) {
  console.error('Failed to read SQLite: ' + e.message);
  console.error('请使用带 node:sqlite 的 Node 运行时（优先使用项目随包 Node）。');
  process.exit(1);
}

const nodes = (project.document.nodes || []).map((n) => ({
  id: n.id,
  type: n.type,
  title: n.title,
  position: n.position,
  ...(n.type === 'text' ? {
    // DEV-017 W3 修正：文本正文在 composerContent（UI 回退 prompt → content）
    content: n.metadata?.composerContent ?? n.metadata?.prompt ?? n.metadata?.content ?? '',
  } : {}),
  ...(n.type === 'script' ? {
    storyboard: n.metadata?.storyboard?.rows || [],
  } : {}),
  ...(n.type === 'image' ? {
    image: {
      taskId: n.metadata?.taskId,
      assetId: n.metadata?.assetId,
      storageKey: n.metadata?.storageKey,
      status: n.metadata?.status,
      content: n.metadata?.content,
    },
  } : {}),
}));
const connections = project.document.connections || [];

function canonicalize(value) {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.keys(value).sort().map(key => [key, canonicalize(value[key])]));
  }
  return value;
}

const snapshot = {
  schemaVersion: 2,
  title,
  canvasId: project.id,
  revision: project.revision,
  // 摘要覆盖整个持久化文档，防止投影之外的字段丢失仍被报为 PASS。
  documentSha256: createHash('sha256').update(JSON.stringify(canonicalize(project.document))).digest('hex'),
  nodes,
  connections,
  capturedAt: new Date().toISOString(),
};
await writeFile(outPath, JSON.stringify(snapshot, null, 2));
console.log(`Saved: ${outPath} (revision=${project.revision}, nodes=${nodes.length}, connections=${connections.length})`);

if (comparePath) {
  if (!existsSync(comparePath)) { console.error('Compare file not found: ' + comparePath); process.exit(1); }
  const prev = JSON.parse(await readFile(comparePath, 'utf8'));
  const normalize = (s) => {
    const cloned = JSON.parse(JSON.stringify(s));
    delete cloned.capturedAt;
    return JSON.stringify(canonicalize(cloned));
  };
  const same = normalize(prev) === normalize(snapshot);
  const result = { compared: true, pass: same, prevRevision: prev.revision, currRevision: snapshot.revision };
  if (same) {
    console.log(`PASS readonly saved snapshot; compared=true; revision=${snapshot.revision}; nodes=${nodes.length}`);
  } else {
    console.error('FAIL: snapshots differ');
    if (prev.schemaVersion !== snapshot.schemaVersion || !prev.documentSha256) {
      console.error('  旧版快照没有全文档摘要，请用当前采集器重新采集 before/after；不能据此宣称旧记录已完整复验。');
    }
    // 输出 diff 简要信息
    for (const key of ['canvasId', 'revision', 'documentSha256']) {
      if (prev[key] !== snapshot[key]) console.error(`  ${key}: ${prev[key]} → ${snapshot[key]}`);
    }
    const prevNodes = new Map(prev.nodes.map((n) => [n.id, n]));
    for (const curr of snapshot.nodes) {
      const before = prevNodes.get(curr.id);
      if (!before) { console.error(`  node ${curr.id} (${curr.type}) 新增`); continue; }
      const a = JSON.stringify(before), b = JSON.stringify(curr);
      if (a !== b) {
        console.error(`  node ${curr.id} (${curr.type}) 差异`);
        for (const k of new Set([...Object.keys(before), ...Object.keys(curr)])) {
          const av = JSON.stringify(before[k]), bv = JSON.stringify(curr[k]);
          if (av !== bv) console.error(`    ${k}: ${av} → ${bv}`);
        }
      }
      prevNodes.delete(curr.id);
    }
    for (const [id, before] of prevNodes) console.error(`  node ${id} (${before.type}) 缺失`);
    process.exitCode = 1;
  }
  const resultPath = outPath.endsWith('.json') ? outPath.replace(/\.json$/, '-compare.json') : outPath + '-compare.json';
  await writeFile(resultPath, JSON.stringify(result, null, 2));
}
