# DEV-017 Windows 11 x64 测试与构建记录

- 日期：2026-10-21
- 机器：Windows 11 Pro 26300（x64），PowerShell 5.1.26100.9711
- 任务：README（DEV-017）——`demo/ai-media` @ `f84d5a1` 完整构建 + 独立运行验证 + DEV-003 遗留 §4/§5 补齐
- 操作分工：CLI/构建/日志/DB 由验证代理完成；客户端 GUI 操作（建项目、编辑、核对）由操作员完成

## 1. 结论摘要

| README §7 标准 | 结果 |
|---|---|
| 构建退出码 0，产物齐备，exe SHA-256 已记录 | ✅（SHA256 `ffc8a465…3e9f4a`，144,571,392 字节） |
| 独立启动正常，Agent 面板可开，随包 node.exe 拉起，0 付费请求 | ✅（4 会话全量日志审计，0 次非回环上游请求） |
| 六步保存恢复 before/after 对照 PASS | ✅（`windows-after.json` `compared=true`，r71↔r71 逐字一致含坐标） |

**源码零改动**：`git status` 全程 clean（HEAD `f84d5a16e70231eb34dc59db72a6552152fedf5b`）。本机所有新增/修改文件均在包根（Git 跟踪树之外），完整清单见 §5。

## 2. 环境与工具链（全部复用 DEV-003，无新安装）

| 工具 | 路径/版本 |
|---|---|
| Go 1.27.3 | `C:\Tools\go\bin\go.exe` |
| Bun 1.4.2 | `C:\Tools\bun\bun.exe` |
| Node runtime 24.15.0 win32/x64 | `C:\Tools\node-v24.15.0-win-x64`（`BEEFTV_NODE_RUNTIME` 指向） |
| MSYS2 UCRT64 gcc 16.2.0 / binutils 2.47 | `C:\msys64`（TUNA 镜像已置顶） |
| GOPROXY | `https://goproxy.cn,direct`（P2 规避） |

DEV-003 P1–P5 规避全部沿用（详见 DEV-003 记录 §4；构建子进程 PATH 仍排除 git，见 P4）。go.sum / bun.lock / 构建脚本与 DEV-003 基线逐字一致，构建一次通过。

## 3. 源码获取与完整性

```text
git clone https://github.com/AyanoKyouji/BeefTV.git C:\BeefTV-DEV017
git fetch --depth 5 origin demo/ai-media
git checkout f84d5a1
git status --short    # clean（全程）
```

- 直接 `git fetch origin f84d5a1…` 被 GitHub 拒绝（非分支 tip 的裸 SHA 不通告），改用按分支浅取 5 个提交再 checkout（API compare 确认目标仅落后 tip 2 个提交）。
- 未用离线包（网络可用）；`source-manifest.json` 机制由 Git 保证（README §1）。
- 证据文件：`windows-source-git.txt`（HEAD、subject、clean tree）；`windows-environment.json`（Check-Windows 产物）。

## 4. 本轮遇到的问题与解决（W1–W4；P1–P5 见 DEV-003 记录）

### W1 — git 无法按裸 SHA fetch
`git fetch origin f84d5a1` 报 `couldn't find remote ref`。GitHub 不通告非 tip SHA。解决：`git fetch --depth 5 origin demo/ai-media` + `git checkout f84d5a1`。

### W2 — `/api/health` 返回 403（token 门禁，非缺陷）
f84d5a1 中后端 API 全部要求内存态 `X-Desktop-Token`（`backend/internal/transport/http/token.go:34` 仅豁免 `/api/health/live` 与 OPTIONS）。README §4 期望 `/api/health` 200 与实现不符。解决：用豁免端点 `/api/health/live` 取证（返回 v1.7.26 / go1.27.3 / status ok / commit unknown——commit=unknown 为 P4 规避的预期结果，README 明文允许）。`/api/workspace/bootstrap` 正常 200。

### W3 — Inspect-Saved-Project.mjs 文本字段读取缺陷（关键，采集器 bug）
**现象**：操作员两轮均确认已填入两个文本节点内容，采集器输出 `content: ""`。
**根因**：采集器读 `node.metadata.content`；f84d5a1 数据模型下文本节点正文实际存于 `composerContent`（回退 `prompt`），`content` 仅在生成完成后写入。UI 依据：`web/src/components/canvas/canvas-node-prompt-panel.tsx:88`
```ts
const savedPrompt = node.metadata?.composerContent ?? node.metadata?.prompt ?? "";
```
DEV-003 基线从未执行过 §5（遗留补齐），故该缺陷此前未暴露。
**修正**：复制采集器到 DEV-017 包根并修一行（比较逻辑未动）：
```diff
-      ...(node.type === 'text' ? { content: node.metadata?.content } : {}),
+      // DEV-017: text body lives in composerContent (UI fallback prompt→content,
+      // canvas-node-prompt-panel.tsx:88); metadata.content only fills after generation.
+      ...(node.type === 'text' ? { content: node.metadata?.composerContent ?? node.metadata?.prompt ?? node.metadata?.content } : {}),
```
DEV-003 包内原件未动。建议 Mac 侧合入同名修正。

### W4 — 首轮 before/after 对照 FAIL：仅脚本节点坐标漂移 19px
**现象**：官方重启（PID 16412）后内容全部恢复（操作员确认"与重启前一模一样"），但严格对照断言失败，唯一差异为脚本节点 position `(-33.999…, 164.319…)` → `(-14.999…, 176.319…)`，Δ=(19, 12)。
**定性**：重启会话日志有 4 次 `POST /api/ops/canvas.document.commit`（14:03:49–14:04:32，revision 67→71）。源码核实提交是变更驱动的（`web/src/services/local-workspace-repository.ts:491` `sameCanvasDocument` 相同即短路不提交）→ 坐标变化来自**核对期间的真实交互**（19px 轻微拖动，操作员无感知），应用如实持久化。恢复本身无损。
**解决**：以 r71 静止状态重采 before（`windows-before.r67.step4-exit.json` 归档留证），补一轮"只看不碰"重启（PID 18056，0 次提交，r71→r71），严格对照 PASS。结论：全文档（含坐标）跨重启持久化成立。

## 5. 本机文件变更清单（重要：回显给 Mac 侧）

**Git 跟踪树（源码）：零改动。** `git status --short` 全程为空，HEAD `f84d5a1`。

包根新增/修改的验证工具（均通过 `.git/info/exclude` 本机排除，不影响 tracked tree）：

| 文件 | 性质 | 说明 |
|---|---|---|
| `run-build017.ps1` | 新增 | 构建驱动（README §3 语义 + P1–P5 规避：`-Command` 调用、GOPROXY、PATH 排除 git、便携工具链置前） |
| `launch-dev017.ps1` | 新增 | 启动驱动（占位 Agent 配置：baseUrl=127.0.0.1:9 丢弃口、budget=1；独立数据目录 `dev017-test-data\`；`GetTempPath()` 工作目录规避 P5；stdout/stderr/pid 落盘） |
| `Inspect-Saved-Project.mjs` | **复制自 DEV-003 包并修正 1 行** | W3 修正，diff 见 §4；比较逻辑未动 |
| `.git/info/exclude` | 本机 git 元数据 | 排除上述工具及全部生成产物，保持 `git status` clean |
| `Check-Windows.ps1` | 复制自 DEV-003 包 | 未改动，产出现 `windows-environment.json` |

生成产物（非代码）：`windows-build.log` / `windows-build.exit.txt`（0）/ `windows-exe-sha256.txt` / `windows-environment.json` / `windows-source-git.txt` / `windows-before.json`（r71）/ `windows-after.json`（r71，compared=true）/ 归档三份（`windows-before.r67.step4-exit.json`、`windows-before.collector-v1.json`、`windows-before.discarded-incomplete.json`）/ `dev017-precheck2.json`（预检）/ `desktop-20261021-{134046,135515,140226,140752}.{stdout,stderr}.log` 与 `.pid.txt` / `dev017-test-data\`（隔离数据目录，按 §6 不回传）。

## 6. 构建结果（README §3）

- 构建退出码 **0**（`windows-build.exit.txt`），单日志 `windows-build.log`（UTF-16LE，PS5.1 重定向所致，P5 备注）
- DWARF5 CGO 断言通过（gcc 16.2.0 / binutils 2.47）

| 产物 | 实测 |
|---|---|
| `BeefTV.exe` | 144,571,392 字节；SHA-256 `ffc8a4653500f7f1f4329fe93d5bd8cb93f0a2f9aea3f00866b5485b373e9f4a` |
| `cli\beeftv.exe` | 存在 |
| `plugin-packages\*.beeftv-plugin` | 86 个 ✓ |
| `agent-host\server.mjs` | 存在 |
| `agent-host\node_modules\` | 77 顶层包 ✓ |
| `agent-host\runtime\node.exe` | win32/x64/24.15.0 ✓ |
| `agent-host\media-runtime\` | ffmpeg.exe / ffprobe.exe / manifest.json 齐备 ✓ |

## 7. 启动验证（README §4）

占位 Agent 配置（loopback 丢弃口、无真实模型、budget=1），独立数据目录，无开发服务器。会话 1（PID 12316）证据：

1. 窗口正常打开（操作员确认；截图见 §9 偏差 1）
2. `GET /api/workspace/bootstrap` 200；`/api/health` 403→`/api/health/live` 200（W2）
3. Agent 面板打开，宿主就绪：`agent-host 已启动 http://127.0.0.1:62636 model=dev017-no-model api=openai-completions baseUrl=http://127.0.0.1:9/v1 readOnly=false reason=ok`
4. `node.exe` PID 17968，父进程 = BeefTV.exe 12316，路径 = 随包 runtime ✓
5. 模型请求数 = 0：4 个会话全部日志审计，无任何非回环 POST/PUT，budget 从未消耗

## 8. 保存恢复六步（README §5）与会话台账

| # | 时间戳 | PID | 内容 | canvas.document.commit | revision |
|---|---|---|---|---|---|
| 1 | 134046 | 12316 | §4 验证 + 步骤 1–3（建项目/加节点/改第二镜） | 59 | →60（首轮 incomplete） |
| 2 | 135515 | 6392 | 补充修正轮（第二镜提示词补全、文本内容填写） | 7 | →67 |
| 3 | 140226 | 16412 | 步骤 5 官方重启 + 步骤 6 核对（操作员确认内容一致；脚本节点被碰动 19px，W4） | 4 | →71 |
| 4 | 140752 | 18056 | 无接触复验轮（只看不碰） | **0** | 71（原地） |

- 六步对照（README 命名对）：`windows-before.json`（r71）↔ `windows-after.json`（r71），`PASS readonly saved snapshot; compared=true; revision=71; nodes=3`——canvasId、标题、workspaceProjectId、三个节点（id/类型/标题/坐标）、两段文本内容、三镜全部字段逐字一致。
- 历程归档：r60 首轮（内容不完整，弃用）、r67 修正轮（采集器缺陷 W3 致文本读空，原件归档 `collector-v1`）、r67↔r71 首次严格对照仅坐标差异（W4）。
- 项目内容终态：文本一 `DEV-017 文本节点一`、文本二 `DEV-017 文本节点二`、镜2 提示词 `DEV-017 Windows 修改后的第二镜：银色汽车驶入雨夜街道`（镜1/镜3 为操作员自填占位内容）。

## 9. 偏差与回传材料对照（README §6/§7）

偏差（均已在上文展开）：

1. **截图缺失**：操作员明确拒截（启动 3 张 + 六步截图均无）——README §6 硬性要求项，需 Mac 侧裁定是否接受或安排补拍
2. README §5 给出的 Inspect 调用缺 `--db/--title` 必需参数，实际按脚本要求以全参运行
3. 采集器 W3 修正（§4/§5 清单已回显 diff，建议 Mac 侧合入）
4. `/api/health` 403 → 以 `/api/health/live` 替代取证（W2）
5. commit=unknown（P4 规避，README 明文允许）；P1/P2/P3/P5 规避致驱动脚本与 README 片段不同（DEV-003 已登记）
6. 会话数超出教科书式 PID1/PID2 两段（6392 修正轮、18056 复验轮），台账见 §8

§6 清单对照：

| 材料 | 状态 |
|---|---|
| `windows-environment.json` | ✅ |
| `windows-build.log` / `windows-build.exit.txt` | ✅ |
| `windows-exe-sha256.txt` | ✅ |
| 启动截图 ×3 | ❌ 偏差 1 |
| 后端日志片段 | ✅（本记录 §7 + 原始日志留存本机） |
| `windows-before.json` / `windows-after.json` | ✅ |
| 六步操作截图 | ❌ 偏差 1 |
| 不回传项 | `dev017-test-data\`、模型配置、令牌、`.settings-key`、原始日志全文 均未含 |

## 10. 速查（本机复跑要点）

```powershell
# 构建（包根，全新会话）
powershell -NoProfile -ExecutionPolicy Bypass -Command "& 'C:\BeefTV-DEV017\run-build017.ps1'"

# 启动（占位 Agent，独立数据目录）
powershell -NoProfile -ExecutionPolicy Bypass -Command "& 'C:\BeefTV-DEV017\launch-dev017.ps1'"

# 快照采集（修正版采集器，wx 模式勿覆盖已有 out）
& "C:\BeefTV-DEV017\backend\cmd\desktop\build\bin\agent-host\runtime\node.exe" `
  Inspect-Saved-Project.mjs --db "C:/BeefTV-DEV017/dev017-test-data/open_ai_canvas.db" `
  --title "DEV-017 Windows 基础验证" --out windows-after.json --compare windows-before.json
```

约束提醒：构建子进程 PATH 勿含 git（P4）；PS5.1 驱动一律 `-Command "& '…'"`（P1）；`GOPROXY=goproxy.cn,direct`（P2）。
