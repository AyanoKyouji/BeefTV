# DEV-017：最终 Windows 构建 — 交接与验证说明

- 目标提交：`demo/ai-media` 分支 `f84d5a1`（2026-10-21，W5 已完成，含 DEV-012～016 全部验证与文档）。
- 基线差异：相较 DEV-003 交接基线 `2327ee2` 前进 19 个提交、98 文件、+6367/-76 行。
- 目标产物：Windows x64 便携客户端（BeefTV.exe + 随包 Node / 插件包 / 媒体运行时）。
- 本轮验证范围：**DEV-017 构建完整 + 独立运行**；DEV-003 遗留的 §4 宿主就绪 + §5 六步保存恢复补齐；DEV-018/019 完整 E2E 另行执行。

## 1. 源码获取

Windows 侧执行：

```powershell
git clone https://github.com/AyanoKyouji/BeefTV.git BeefTV-DEV017
cd BeefTV-DEV017
git checkout f84d5a1
git status --short   # 期望 clean
```

如需离线包，Mac 侧已生成并放到仓库内 `.local/handoff/` 目录（不提交 Git）：

```
SHA-256: 3f979fe415dbbdb06e3b7afc7bea75956d8912e5ac7c9f1a7e6abb0b8f37c709
来源：git archive --format=zip f84d5a1
```

解压后目录结构与 Git 检出一致；`source-manifest.json` 机制改由 Git 保证完整性（`git status` clean 即可）。

## 2. 环境要求（与 DEV-003 一致，可复用已有 C:\Tools）

| 工具 | 版本 | 备注 |
|------|------|------|
| Go | ≥1.25（go.mod） | 已装 1.27.3 可用 |
| Bun | 1.4.2 | 已装可用 |
| Node runtime | **24.15.0 win32/x64**（精确版本） | 必须用 `BEEFTV_NODE_RUNTIME` 指向 |
| MSYS2 UCRT64 GCC | binutils ≥ 2.37 | 已装 16.2.0 可用 |
| WebView2 | 系统自带 | |
| 网络 | `GOPROXY=https://goproxy.cn,direct`（本网络必需） | |

已知问题（DEV-003 登记，本轮仍适用）：

- P1 `-File` 调用包内脚本 `$PSScriptRoot` 为空 → 用 `-Command "& '…\script.ps1'"`
- P2 `proxy.golang.org` 不可达 → `GOPROXY=https://goproxy.cn,direct`
- P3 `$ProgressPreference` 默认导致 Invoke-WebRequest 极慢 → SilentlyContinue
- P4 git 不得进入构建子进程 PATH
- P5 `[IO.Path]::GetFullPath` 不跟随 `Set-Location`；PS 重定向日志为 UTF-16LE

## 3. 构建步骤

```powershell
cd C:\BeefTV-DEV017
$env:BEEFTV_NODE_RUNTIME = 'C:\Tools\node-v24.15.0-win-x64'
$env:GOPROXY = 'https://goproxy.cn,direct'
$env:PATH = "$env:BEEFTV_NODE_RUNTIME;$env:PATH"

# DWARF5 编译器断言 + 构建
powershell -NoProfile -ExecutionPolicy Bypass -Command "& '$PWD\scripts\assert-windows-dwarf5-cgo.ps1'"
powershell -NoProfile -ExecutionPolicy Bypass -Command "& '$PWD\scripts\build-beeftv-windows-release.ps1'" *> windows-build.log
echo $LASTEXITCODE | Out-File windows-build.exit.txt
```

构建产物核对（`backend\cmd\desktop\build\bin\`）：

| 产物 | 期望 |
|------|------|
| `BeefTV.exe` | 记录 SHA-256 与字节数 |
| `cli\beeftv.exe` | 存在 |
| `plugin-packages\*.beeftv-plugin` | 86 个 |
| `agent-host\server.mjs` | 存在 |
| `agent-host\node_modules\` | 77 顶层包 |
| `agent-host\runtime\node.exe` | win32/x64/24.15.0 |
| `agent-host\media-runtime\{ffmpeg.exe, ffprobe.exe, manifest.json}` | 齐备 |

## 4. 启动验证（DEV-003 §4 遗留补齐 + DEV-017 基础）

启动驱动（复用 DEV-003 的 `launch-dev003.ps1` 逻辑，改包路径与数据目录）：

```powershell
# 占位 Agent 配置、独立数据目录，无开发服务器
$env:BEEFTV_AGENT_BASE_URL = 'http://127.0.0.1:9/v1'
$env:BEEFTV_AGENT_API_KEY = 'dev017-no-model'
$env:BEEFTV_AGENT_MODEL = 'dev017-no-model'
$dataDir = "$PWD\dev017-test-data"
```

启动后按序核对并留存证据：

1. **窗口正常打开**（截图）
2. **后端 API**：`/api/health`、`/api/workspace/bootstrap` 均 200（日志片段）
3. **打开 Agent 面板**：记录日志中宿主状态查询（截图 + 日志片段）
4. **Node 宿主进程**：任务管理器确认 `node.exe`（随包 runtime）被拉起（截图）
5. **模型请求数 = 0**：日志无付费上游 POST

## 5. 保存恢复六步（DEV-003 §5 遗留补齐）

在客户端中执行并全程截图：

1. 创建项目 `DEV-017 Windows 基础验证`
2. 添加两个文本节点 + 一个"脚本"节点（三镜，填入内容）
3. 修改第二镜提示词为 `DEV-017 Windows 修改后的第二镜：银色汽车驶入雨夜街道`
4. 完全退出（记录 PID 1）
5. 重新启动（记录 PID 2）
6. 核对项目内容与素材

对比脚本（复用 DEV-003 `Inspect-Saved-Project.mjs`）：

```powershell
# 首次保存后
node Inspect-Saved-Project.mjs --out windows-before.json
# 重启后
node Inspect-Saved-Project.mjs --out windows-after.json --compare windows-before.json
# 期望 PASS
```

## 6. 回传材料清单

| 文件 | 说明 |
|------|------|
| `windows-environment.json` | Check-Windows 产物（工具 + 源码摘要） |
| `windows-build.log` / `windows-build.exit.txt` | 构建日志与退出码 |
| `windows-exe-sha256.txt` | BeefTV.exe SHA-256 |
| 启动截图 ×3 | 窗口打开 / Agent 面板 / 任务管理器 node.exe |
| 后端日志片段 | `/api/health` 200、宿主就绪查询、无付费 POST |
| `windows-before.json` / `windows-after.json` | 保存前后项目对照 |
| 六步操作截图 | 项目创建 → 编辑 → 重启 → 恢复 |

**不要回传**：`dev017-test-data\`、模型配置、令牌、`.settings-key`、原始日志全文（可脱敏后提供关键片段）。

## 7. DEV-017 通过标准

- 构建退出码 0，全部产物齐备，exe SHA-256 已记录
- 独立启动正常，Agent 面板可打开，随包 Node 宿主被拉起，0 次付费请求
- 六步保存恢复通过（before/after 对照 PASS）
- 所有证据按 §6 清单回传

通过后由 Mac 侧记录到 DEV-017 报告并更新台账；DEV-018/019 完整 E2E 另行安排。
