# DEV-003 Windows 11 x64 测试与构建记录

| 项 | 值 |
|---|---|
| 任务 | DEV-003：Windows 11 x64 基础原生构建 + 正常保存恢复验证 |
| 执行日期 | 2026-10-20（UTC+8），12:01–14:31 |
| 执行人 | 操作员+ Claude Code 代理执行；GUI 操作由操作员完成 |
| 测试机 | Windows 11 专业版 10.0.26300，AMD64，PowerShell 5.1.26100.9711 |
| 交接包 | `C:\BeefTV-DEV003`（源码基线 `2327ee2d80282b10dd8bef0f26b48990d46f5c3b`，v1.7.26，含 DEV-002 四文件补丁） |

## 1. 结论摘要

- **环境检查（README §1）通过**：源码 3565 个文件 SHA256 与 `source-manifest.json` 全部一致，mismatches 为空；产物 `windows-environment.json` 已生成（含工具齐全后的复检版）。
- **工具链（README §2）就绪**：Go 1.27.3、Bun 1.4.2、Node 24.15.0 win32/x64（官方 SHASUMS256 校验通过）、MSYS2 UCRT64 GCC 16.2.0 + binutils 2.47（≥2.37）、WebView2 155.0.4283.62（系统自带）。
- **原生构建（README §3）成功**：退出码 0，`BeefTV.exe`（144,556,032 字节，SHA256 `A7439E8B2DA4FD381E7CB020559444E331AC6DC4C2D01841E6C77DADC8CF8C9F`）及全部随包产物齐备。
- **启动（README §4）正常**：应用以独立数据目录启动（PID 13768），后端 API 全部 200，操作员确认窗口正常打开。**§4 的 Agent 面板宿主就绪证据与 §5 六步操作尚未完成**（见 §8）。
- **source/ 目录零修改**：所有适配都在包外新增的驱动脚本与会话环境变量中完成，manifest 完整性不受影响。

## 2. 环境与工具链安装

全部采用官方便携 zip 安装到固定目录，**未改全局 PATH、未用管理员权限、未设 CGO_ENABLED=0**：

| 工具 | 版本 | 位置 | 完整性验证 |
|---|---|---|---|
| Go | 1.27.3 windows/amd64 | `C:\Tools\go` | zip SHA256 `f26081f438319757f8a1b46d7d0b2c5ec7583d4038e485e0aa725cfde7885fff` = go.dev 发布值 |
| Bun | 1.4.2（GitHub release `bun-v1.4.2/bun-windows-x64.zip`） | `C:\Tools\bun` | 官方未发布校验文件；本机记录 SHA256 `ce4c17497b2f29712a99d3d53f028de28cd42e3bacb8589599e7f000e49b6405`，`bun --version` = 1.4.2 |
| Node 运行时 | 24.15.0 win32/x64 | `C:\Tools\node-v24.15.0-win-x64` | 官方 `SHASUMS256.txt` 校验 OK（zip SHA256 `cc5149eabd53779ce1e7bdc5401643622d0c7e6900ade18928a767e940bb0e62`）；运行验证 `win32/x64/24.15.0` |
| MSYS2 | nightly 安装器（msys2.org 官方直链 `nightly-x86_64/msys2-x86_64-latest.exe`） | `C:\msys64` | 大小 85,000,088 = GitHub API 值；SHA256 `0072f55bf05bfb0e2b9a485564c992254ff2189829ce9061bdc0d4a59bbed76d` = 官方 digest；CLI 安装 `install --confirm-command --accept-messages --root C:/msys64` |
| UCRT64 GCC | 16.2.0 (Rev6) | `C:\msys64\ucrt64\bin` | `pacman -S --needed mingw-w64-ucrt-x86_64-gcc mingw-w64-ucrt-x86_64-binutils` |
| binutils | 2.47.20260726 | 同上 | `ld --version` ≥ 2.37，满足 DWARF 5 要求 |
| WebView2 | 155.0.4283.62 | 系统自带 | `C:\Program Files (x86)\Microsoft\EdgeWebView\Application` |
| Git | 2.54.0（本机已有） | `<GIT_INSTALL_DIR>` | 非必需；构建子进程 PATH 中刻意排除（见问题 P4） |

安装包留档：`C:\Tools\dl\{node,go,bun,msys2}\`。

预下载（并行节省时间，不影响构建语义）：Go 模块缓存（`go mod download`，backend 全量 + wails v2.16.0 CLI）、web 前端 `bun install --frozen-lockfile`（1315 包）。

## 3. 包传递与完整性

- 原解压位置 `<WINDOWS_ORIGINAL_HANDOFF>`（路径较深），按 README 建议复制到短路径 `C:\BeefTV-DEV003`；复制后文件数 3565 与 manifest 一致。
- `Check-Windows.ps1` 两轮运行（装工具前 / 装工具后带 `-NodeRuntime`），`source.checked=true`、`head=2327ee2d…`、`patchSHA256=b452fdc2…`、`files=3565`、`mismatches=[]`。
- 最终 `windows-environment.json`：go/bun/git/bundledNode(24.15.0)/ucrtGcc/ucrtBinutils 全部 found，64 位进程。

## 4. 遇到的问题与解决

### P1 — PowerShell 5.1 `-File` 调用时 `$PSScriptRoot` 在 param 默认值中为空
- **现象**：`powershell -File .\Check-Windows.ps1` 报 `Join-Path : 无法将参数绑定到参数“Path”，因为该参数为空字符串`（脚本第 4 行 param 默认值）。绝对路径同样复现；最小复现脚本证实仅 param 默认值受影响，**函数体中的 `$PSScriptRoot` 在 `-File` 下正常**。
- **解决**：改用 `powershell -NoProfile -ExecutionPolicy Bypass -Command "& 'C:\abs\path\script.ps1'"` 调用，一切正常。README §3 的子进程 `powershell -File .\scripts\build-beeftv-windows-release.ps1` 因只用函数体 `$PSScriptRoot`，不受影响，按原文保留。
- **影响**：仅调用方式差异，无内容改动。

### P2 — `proxy.golang.org` 本网络完全不可达
- **现象**：`go mod download` 对 `proxy.golang.org` IPv4/IPv6 均连接超时（curl 实测双栈超时；`go.dev`/`dl.google.com` 正常）。
- **解决**：会话级 `GOPROXY=https://goproxy.cn,direct`。goproxy.cn 代理 sumdb 端点，模块校验和仍按 sum.golang.org 数据校验，完整性不受影响。
- **影响**：环境变量层面，见 §5 驱动脚本偏离项 2。

### P3 — `repo.msys2.org` 仅 ~13KB/s
- **解决**：pacman mirrorlist 置顶 TUNA 镜像 `https://mirrors.tuna.tsinghua.edu.cn/msys2/`（实测 7.2MB/s）。MSYS2 官方 mirrorlist 机制，非侵入修改。
- **影响**：仅 `C:\msys64\etc\pacman.d\mirrorlist.*`（MSYS2 自身配置）。

### P4 — 构建失败：上游脚本无 .git 路径在 PS 5.1 下的真实缺陷（关键问题）
- **现象**：`build-beeftv-windows-release.ps1` 退出码 1，stderr 仅两条：① `fatal: not a git repository`（来自脚本第 357–367 行的 `git -C <repo> rev-parse --short HEAD`，无 .git 时预期，且带 `-AllowFailure`）；② `不能对 Null 值表达式调用方法`（InvokeMethodOnNull，无行号）。stdout 停在插件打包完成之后、`Write-Step "Building BeefTV…"` 之前。
- **定位**：独立复现脚本逐段还原 → 精确命中 `([string]$gitResult.Output).Trim()`（构建脚本第 360 行）。探针证实：git 存在且 exit 128、stdout 为空时，`Invoke-NativeExecutable` 返回 hashtable `{ExitCode=128; Output=$null}`，而在 **stderr 被重定向的 PS 5.1 会话中 `[string]$null` 强制转换结果为 `$null` 而非 `""`**（无重定向时为 `""`，对照探针证实差异），`.Trim()` 即抛 InvokeMethodOnNull。CI（有 .git，git 成功返回字符串）与 Mac（bash 入口）不触发，故上游未发现。
- **解决**：构建子进程 PATH 中**排除 git** → 脚本走 `$git = $null` 分支 → `commitValue="unknown"`。这正是 README 明文记载的快照构建行为（“没有 .git 时上游脚本的 Commit 元数据显示 unknown，准确来源以 source-manifest.json 和补丁摘要为准”），且 `embed-documentation.mjs` 经查不使用 git。
- **约束**：不修改 source/ 任何文件（否则 manifest 校验失败），故不用打补丁方案。
- **建议上游修复**：第 360 行改为对 `$null` 防御，如 `$commitText = if ($null -ne $gitResult.Output) { ([string]$gitResult.Output).Trim() } else { '' }`。

### P5 — `Start-Process` 启动 exe 报“系统找不到指定的文件”（两处独立原因）
1. git-bash 环境传给子 PowerShell 的 `TEMP`/`TMP` 为无效值 → `-WorkingDirectory $env:TEMP` 失败。改用 `[IO.Path]::GetTempPath()`（同目录，符合 README “从 TEMP 启动”意图）。
2. `[IO.Path]::GetFullPath('.\backend\…')` 按 **.NET 进程当前目录**解析，不跟随 PowerShell 的 `Set-Location` → exe 解析到不存在的 `C:\BeefTV-DEV003\backend\…`。在解析前同步 `[Environment]::CurrentDirectory = (Get-Location).Path` 后按原文解析。
   - 注：README §4 片段在“从包根打开 PowerShell、§3 曾 `Set-Location .\source`”的会话里同样会踩到第 2 点，属交接文档的潜在坑，值得上游知悉。

### P6 — MSYS2 安装器下载中断
- **现象**：GitHub 直连仅 ~30KB/s，且中途 curl 退出码 18（传输提前关闭，85MB 断在 62.9MB）。
- **解决**：`curl -C -` 断点续传补齐；完成后大小与 SHA256 均与官方一致（见 §2 表）。

### 其他备忘
- PS5.1 的 `1>`/`2>` 重定向日志为 UTF-16LE，读取需 `iconv -f UTF-16LE -t UTF-8`。
- 权限系统曾要求操作员显式确认运行包内 `Check-Windows.ps1`（外来源脚本 + `-ExecutionPolicy Bypass`），确认后放行——过程性事项，无残留影响。

## 5. 文件变更清单

**source/ 内：零修改、零删除**（构建产物目录 `source\backend\cmd\desktop\build\bin\` 及 `web\node_modules`、`plugin-packages\*.beeftv-plugin` 为构建自然产物，非手工改动；后者 86 个包由构建脚本第 1 次尝试时生成，第 3 次成功运行复用并校验数量一致）。

**包根新增（`C:\BeefTV-DEV003\`）**：

| 文件 | 说明 |
|---|---|
| `run-build.ps1` | 构建驱动，复刻 README §3；偏离项：① 便携工具链 PATH 组装；② `GOPROXY=goproxy.cn,direct`；③ `$ProgressPreference='SilentlyContinue'`（避免 Invoke-WebRequest 被进度渲染拖慢，FFmpeg 下载因此从预估 30+ 分钟回到分钟级）；④ 子进程 PATH 排除 git（问题 P4，见脚本内注释） |
| `launch-dev003.ps1` | 启动驱动，复刻 README §4 占位环境变量与 TEMP 工作目录；偏离项：`GetTempPath()` 替代失效的 `$env:TEMP`、解析 exe 前同步 .NET 当前目录（问题 P5） |
| `windows-environment.json` | 官方检查产物（最终版：工具全 found、源码零差异） |
| `windows-build.stdout.log` / `windows-build.stderr.log` / `windows-build.exit.txt` | 构建日志与退出码（0）；前两次失败日志已被成功运行按同名覆盖，失败根因完整记录于本文档 §4 |
| `windows-exe-sha256.txt` | `BeefTV.exe` SHA256 |
| `desktop-20261020-143046.{stdout,stderr}.log`、`desktop-20261020-143046.pid.txt` | 桌面进程日志与 PID（13768）；另两组 0 字节日志来自 P5 排障时的两次失败启动尝试 |

**系统层新增**：`C:\Tools\`（工具链 + 安装包留档）、`C:\msys64\`（MSYS2，pacman 镜像置顶 TUNA）。

## 6. 构建结果（README §3）

- 驱动：`powershell -NoProfile -ExecutionPolicy Bypass -Command "& 'C:\BeefTV-DEV003\run-build.ps1'"`（内部先跑 `assert-windows-dwarf5-cgo.ps1` → 输出 `Using DWARF 5 CGO compiler C:\msys64\ucrt64\bin\gcc.exe (gcc 16.2.0, GNU ld 2.47.20260726)`，再按 README 以子进程 `-File` 跑构建入口并重定向日志）。
- **退出码 0**（`windows-build.exit.txt`），构建日志尾部含媒体冒烟测试 PASS（`TestBundledMediaMetadataWithoutSystemFFprobe`、`TestProbeLocalDoesNotFetchPlaylistURLs` 等）与产物清单输出。
- `source\backend\cmd\desktop\build\bin\` 全量核对：

| 产物 | 大小/数量 | 核对 |
|---|---|---|
| `BeefTV.exe` | 144,556,032 B | OK，SHA256 见 §1 |
| `cli\beeftv.exe` | 13,429,248 B | OK |
| `plugin-packages\*.beeftv-plugin` | 86 个 | OK，与源目录数一致（脚本强制校验） |
| `agent-host\server.mjs` | 28,928 B | OK |
| `agent-host\node_modules\` | 77 个顶层包 | OK（bun `--frozen-lockfile --production` 干净暂存安装） |
| `agent-host\runtime\node.exe` | 91,694,408 B | OK，运行验证 `win32/x64/24.15.0` |
| `agent-host\media-runtime\{ffmpeg.exe, ffprobe.exe, manifest.json}` | 99.3MB / 99.1MB / 529 B | OK（8.0.1-essentials_build，SHA256 由打包脚本校验 + H.264/FFprobe 冒烟通过） |

- 未制作安装器（按 README，本次不含 NSIS）。

## 7. 启动结果（README §4，进行中）

- 环境：占位 Agent 配置（`BEEFTV_AGENT_BASE_URL=http://127.0.0.1:9/v1`、占位 Key、`BEEFTV_AGENT_MODEL=dev003-no-model`、协议 chat-completion、总预算 1），数据目录 `C:\BeefTV-DEV003\dev003-test-data`，工作目录 = TEMP，未启动任何开发服务器。
- 进程：PID 13768（`desktop-20261020-143046.pid.txt`），运行中。
- 日志：Go 后端路由注册正常，`GET /api/workspace/bootstrap`、`GET /api/workspace/model-config`、`POST /api/diagnostics/environment`、`GET /api/canvas-projects` 等均 200。
- 操作员确认：**窗口正常启动、界面可用**。
- 尚待补齐：打开 Agent 面板触发宿主状态查询的**日志/诊断截图**、确认随包 node.exe 宿主进程被拉起且模型请求数为 0（截至记录时 node.exe 尚未出现，符合“按需加载”预期，待面板触发后复查）。

## 8. 待完成事项（按 README）

1. §4：Agent 面板操作 + 宿主就绪证据（截图/日志），核对 0 次模型请求。
2. §5 六步：窗口操作截图 → 建项目 `DEV-003 Windows 基础验证` → 两个文本节点 + 一个“脚本”节点（三镜）→ 修改第二镜（`DEV-003 Windows 修改后的第二镜：银色汽车驶入雨夜街道`）→ 完全退出重开（记录新旧 PID）→ 恢复核对。
3. §5 采集：首次保存退出后 `Inspect-Saved-Project.mjs` → `windows-before.json`；重启核对后再采 → `windows-after.json --compare`，期望 PASS。
4. 回传材料：`windows-environment.json`、两份构建日志、退出码、exe 摘要、启动/重启结果与截图（不回传 test-data、模型配置、令牌、.settings-key）。

## 9. 速查（本机复跑要点）

```powershell
# 环境（新会话）
$env:BEEFTV_NODE_RUNTIME = 'C:\Tools\node-v24.15.0-win-x64'
$env:GOPROXY = 'https://goproxy.cn,direct'   # 本网络必需，见 P2

# 构建（包根）
powershell -NoProfile -ExecutionPolicy Bypass -Command "& 'C:\BeefTV-DEV003\run-build.ps1'"

# 启动测试客户端（README §4 语义）
powershell -NoProfile -ExecutionPolicy Bypass -Command "& 'C:\BeefTV-DEV003\launch-dev003.ps1'"
```

已知本机坑（详见 §4）：`-File` 调用包内脚本会因 `$PSScriptRoot` 空而失败（用 `-Command "& …"`）；git 不得进入构建子进程 PATH（P4）；`[IO.Path]::GetFullPath` 不跟随 `Set-Location`（P5）；PS 重定向日志是 UTF-16LE。
