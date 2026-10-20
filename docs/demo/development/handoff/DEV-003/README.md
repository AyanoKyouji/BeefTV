> 历史交接说明：对应早期源码包，不作为当前 Git 工作流入口。当前开发方式见 [项目入口](../../../README.md)。

# DEV-003：Windows 11 x64 接续包

这是源码与操作材料，**不是已构建的 Windows 客户端**。本包包含基线 `2327ee2d80282b10dd8bef0f26b48990d46f5c3b` 的当前文件，以及 DEV-002 的四文件修改；不含 Mac 的依赖、工具、测试数据库、凭证或 `.git`。当前版本为 v1.7.26。

用户已确认设备为 Windows 11 x64，尚未安装开发环境。本次只做基础原生构建与正常保存恢复，不需要真实 API Key。

## 1. 传递与环境检查

把本 zip 复制到 Windows，完整解压到一个新的短路径，例如 `C:\BeefTV-DEV003`。目录中应有本 README、`Check-Windows.ps1`、`source-manifest.json` 和 `source\`。不要覆盖其他工作区或既有 BeefTV 安装。

在该目录打开 **64 位 PowerShell**，执行：

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\Check-Windows.ps1
```

该命令只读取系统/工具版本、核对本包文件摘要，生成 `windows-environment.json`；不安装环境、不改变全局 PATH 或执行策略。缺少的工具可以先记下；单独将该 JSON 提供给当前聊天即可继续核实。目录和工具路径可在回传前脱敏。

准备构建工具后，用 Node 的实际解压目录再次检查：

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\Check-Windows.ps1 -NodeRuntime 'C:\Tools\node-v24.15.0-win-x64'
```

## 2. 本基线要求的环境

下表版本来自当前仓库配置/CI，不是升级技术栈的建议。先使用官方来源准备；有现成工具时核对版本即可。

| 条件 | 本次要求与来源 |
|---|---|
| Go | 1.25 或更新（go.mod）；[官方 Windows 安装说明](https://go.dev/doc/install) |
| Bun | 本次采用 1.4.2，与 CI/DEV-002 一致；[官方指定版本及直接下载说明](https://bun.sh/docs/installation)、[1.4.2 发布页](https://github.com/oven-sh/bun/releases/tag/bun-v1.4.2)；不使用 npm/pnpm 安装项目依赖 |
| Node runtime | 必须精确为 **24.15.0、win32/x64**，指向包含 node.exe 的完整官方目录；[官方 x64 zip](https://nodejs.org/dist/v24.15.0/node-v24.15.0-win-x64.zip)，下载后与同版本官方 SHASUMS256.txt 核对 |
| C 编译工具 | 采用仓库 CI 的 MSYS2 UCRT64 GCC 和 binutils；[MSYS2 官方安装说明](https://www.msys2.org/)。在 UCRT64 终端中安装 `mingw-w64-ucrt-x86_64-gcc` 和 `mingw-w64-ucrt-x86_64-binutils`；仓库检查要求 binutils ≥ 2.37 |
| WebView2 | Wails 窗口运行所需；实际启动时核对，缺失时按 Wails 既有 download 策略提示处理 |
| Git | 使用此源码快照构建不强制要求 Git；没有 .git 时上游脚本的 Commit 元数据显示 unknown，准确来源以 source-manifest.json 和补丁摘要为准 |
| 网络 | Go/Bun 冻结依赖及既有脚本中的媒体运行时下载需可访问对应官方源 |

MSYS2 UCRT64 终端中的包安装命令：

```sh
pacman -S --needed mingw-w64-ucrt-x86_64-gcc mingw-w64-ucrt-x86_64-binutils
```

不需要全局安装 Wails、FFmpeg、Python 或 NSIS 来完成本次便携客户端基础构建。现有脚本钉选 Wails，并打包 Node/媒体运行时；本任务不制作正式发布安装器。

## 3. 原生构建

先确认 `windows-environment.json` 的 source.checked 为 true 且 mismatches 为空；Node 检查值应为 `win32/x64/24.15.0`。下面路径需替换为实际工具目录；Bun/Go 应已在当前 PowerShell 的 PATH 中。

```powershell
$ErrorActionPreference = 'Stop'
$env:BEEFTV_NODE_RUNTIME = 'C:\Tools\node-v24.15.0-win-x64'
$env:PATH = "$env:BEEFTV_NODE_RUNTIME;$env:PATH"
Set-Location .\source

# 只为当前进程选择既有 UCRT64 编译器；非默认 MSYS2 安装先设 MSYSTEM_PREFIX。
& .\scripts\assert-windows-dwarf5-cgo.ps1

# 后台进程返回非零时保留日志并停止，不把旧 exe 当作本轮产物。
$previousEap = $ErrorActionPreference
$ErrorActionPreference = 'Continue'
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\build-beeftv-windows-release.ps1 1> ..\windows-build.stdout.log 2> ..\windows-build.stderr.log
$buildExit = $LASTEXITCODE
$ErrorActionPreference = $previousEap
$buildExit | Set-Content ..\windows-build.exit.txt
if ($buildExit -ne 0) { throw 'Windows build failed; keep both build logs.' }
```

这是仓库原有 Windows 入口，内部执行 web 的冻结安装/desktop 构建、Go/Wails 原生编译、插件打包、Node 宿主依赖及导入检查、FFmpeg/FFprobe 打包和媒体冒烟、CLI 编译。不要设置 CGO_ENABLED=0 或改用 Mac 构建结果。

成功输出目录：`source\backend\cmd\desktop\build\bin\`。应保留整个目录，至少包括：

```text
BeefTV.exe
cli\beeftv.exe
plugin-packages\*.beeftv-plugin
agent-host\server.mjs
agent-host\node_modules\...
agent-host\runtime\node.exe
agent-host\media-runtime\ffmpeg.exe
agent-host\media-runtime\ffprobe.exe
agent-host\media-runtime\manifest.json
```

记录产物标识（仍在 source 目录）：

```powershell
Get-FileHash .\backend\cmd\desktop\build\bin\BeefTV.exe -Algorithm SHA256 |
    Format-List | Out-File ..\windows-exe-sha256.txt -Encoding UTF8
& .\backend\cmd\desktop\build\bin\agent-host\runtime\node.exe -p "[process.platform,process.arch,process.versions.node].join('/')"
```

## 4. 启动与真实 Node 宿主检查

关闭测试客户端后再重开；本次不要求关闭其他用户程序或杀死无关 Node 进程。首次测试使用下面的新目录，后续恢复检查继续使用同一目录。不要启动 Vite/Go/Node 开发服务器。

为在**不配置真实模型**的情况下验证 Go 能加载随包 Node，使用应用已有的受控测试环境覆盖：环回占位地址、占位 Key、总请求上限 1。不要发送聊天或生成指令；宿主启动本身应产生 0 次模型请求，结果须核对日志。这不是 DeepSeek 可用性测试。现有预算合同中 0 表示不启用总上限，不表示禁止请求。

```powershell
$env:BEEFTV_AGENT_BASE_URL = 'http://127.0.0.1:9/v1'
$env:BEEFTV_AGENT_API_KEY = 'dev003-local-placeholder'
$env:BEEFTV_AGENT_MODEL = 'dev003-no-model'
$env:BEEFTV_AGENT_PROTOCOL = 'chat-completion'
$env:BEEFTV_AGENT_TOTAL_REQUEST_BUDGET = '1'
$env:CANVAS_DESKTOP_DATA_DIR = [IO.Path]::GetFullPath((Join-Path (Get-Location) '..\dev003-test-data'))
$exe = [IO.Path]::GetFullPath('.\backend\cmd\desktop\build\bin\BeefTV.exe')
$stamp = Get-Date -Format yyyyMMdd-HHmmss
$desktop = Start-Process -FilePath $exe -WorkingDirectory $env:TEMP -PassThru `
    -RedirectStandardOutput "..\desktop-$stamp.stdout.log" `
    -RedirectStandardError "..\desktop-$stamp.stderr.log"
$desktop.Id | Set-Content "..\desktop-$stamp.pid.txt"
```

打开 Agent 面板触发现有状态查询，保留宿主加载操作、启动/就绪结果的日志或诊断截图；若日志无法取得、宿主没有启动或仍显示配置问题，保留现象交回分析，不能只凭面板出现关闭该检查。不要把测试占位模型当作实际可用模型。相关环境变量只影响这一个 PowerShell 会话及它启动的进程；不要带入后续真实模型任务。

从 TEMP 作为工作目录启动有助于检查程序是否依赖源码工作目录。数据仍由明确的测试目录隔离；无需读取 `%AppData%\BeefTV` 的已有内容。

## 5. 基础操作与恢复

| 顺序 | 实际操作 | 记录 |
|---|---|---|
| 1 | 启动窗口，调整大小、最小化/最大化 | 截图及错误提示；仅 exe 存在不算通过 |
| 2 | 创建新项目，命名 `DEV-003 Windows 基础验证` | 项目名称；能进入画布 |
| 3 | 添加两个文本节点、一个“脚本”节点，保留三镜 | 文本内容、三行各填不同提示词 |
| 4 | 修改第二镜为 `DEV-003 Windows 修改后的第二镜：银色汽车驶入雨夜街道`，修改台词、拖动节点 | 保存确认及截图；不能用刷新代替下面的退出重启 |
| 5 | 完全退出客户端，确认本次进程退出，再用上面的启动命令重开 | 记录新旧 PID；继续同一数据目录 |
| 6 | 打开原项目，核对名称、文字、三个分镜、第二镜修改、布局 | 重启后截图；分镜稳定 ID/版本可用现有诊断或后续受控读取补齐 |

记录谁在什么系统上执行。可先回传 `windows-environment.json`；构建后再提供两份构建日志、退出码、exe 摘要及实际启动/重启结果。不要打包回传完整 test-data、模型配置、令牌文件或 .settings-key。

为核对稳定 ID 和真实落盘，在第一次保存并退出客户端后执行下列只读采集（仍在 source 目录，继续使用刚才的 PowerShell 会话）：

```powershell
$node = [IO.Path]::GetFullPath('.\backend\cmd\desktop\build\bin\agent-host\runtime\node.exe')
$db = Join-Path $env:CANVAS_DESKTOP_DATA_DIR 'open_ai_canvas.db'
& $node ..\Inspect-Saved-Project.mjs --db $db --title 'DEV-003 Windows 基础验证' --out ..\windows-before.json
```

重开原项目并核对界面后再次正常退出，执行：

```powershell
& $node ..\Inspect-Saved-Project.mjs --db $db --title 'DEV-003 Windows 基础验证' --out ..\windows-after.json --compare ..\windows-before.json
```

采集器使用随包 Node 的只读 SQLite 连接，不修改数据库；只读取指定测试画布的名称、版本、节点/分镜 ID、位置及手工内容，不读取模型配置或令牌。成功输出 PASS，且两份 JSON 可用于核对保存/恢复身份；它不能替代窗口实际可用及宿主就绪检查。输出文件已存在时会拒绝覆盖，重新采集应换新文件名。该采集器已在 Mac 的 DEV-002 测试数据库上验证；Windows 执行仍待本机结果。

DEV-003 只有在本次同一 Windows x64 产物独立运行、Go/Node 可用、基础编辑和恢复均有实际结果后才完成。当前 Mac 上的交接包完整性检查不能替代这些结果。
