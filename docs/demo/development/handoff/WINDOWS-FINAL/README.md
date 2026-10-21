# Windows 11 x64 最终构建与验收交接说明

这是一份可直接交给 Windows 侧模型的独立执行说明。目标是用当前本地源码构建新的完整便携客户端，完成原生启动、保存恢复及最终业务验收，再回传可核对的报告。**本文件和辅助脚本已在 Mac 准备；Windows 构建及以下操作尚未执行，不能照抄为 PASS。**

随附源码包解压后应包含 `START-HERE.md`、`source-manifest.json`、`source/`。`source/` 是本次完整 Git 源码快照，没有 `.git`、依赖、数据库或凭证；精确提交以清单的 `sourceCommit` 为准。产品最近修复基线为 `84f918c9f71c78d17a744b5d748da16d4f761142`，包含 AT010 及此前 DEV-018/019、关联和状态修复；文档/交接工具有后续提交。

**已有匹配快照和交接工具时，只发送本说明即可；如果 Windows 仍是旧 `f84d5a1` 或没有本次源码，需把配套源码 zip 一起发过去。文档本身不能传输尚未同步的代码。** 不要假设 GitHub 已有本次所有本地提交，不用远端源码替换本地快照。

## 1. 给 Windows 侧模型的执行指令

> 请执行这份说明。先找到并读取本地源码的 AGENTS.md、本说明和相关构建/启动入口，核对 source-manifest.json，再开始。需要理解源码时只读本地 source，不去 GitHub/远端搜索代码，也不自动 pull、升级依赖、重建架构或切换主分支。允许为缺失依赖使用正式下载源，为已配置模型使用用户授权接口；这不等于允许用远端源码代替本地实现。
>
> 分阶段执行：源码/环境核对 → Windows 原生构建和完整包 → 零模型启动/保存恢复 → 同一构建上的真实 Agent 双轮和手动闭环 → 相关异常检查 → 脱敏回传。先复用已装工具。构建和数据使用新目录，不覆盖旧安装或旧测试数据，不启动 Vite/Go 开发服务器冒充客户端。每步记录真实结果；构建成功、进程存在、面板打开都不能代替业务验收。无法操作 GUI 时请操作员完成对应交互并明确分工，不伪造截图或结果。
>
> 真实模型优先 DeepSeek 文本，图片只选当前平台可用且非 Seedream 的模型，历史已验证渠道名为 flux-3-image；禁止 Seedream/Seedance，本次不生成视频。先做零模型阶段，再由操作员在正式设置里配置凭证；没有凭证就保留真实 E2E 为 NOT TESTED 并报告，不向聊天索取或回显完整 API Key。真实验收初始计划共三次图片提交（Agent 两次、手动一次），所有失败/额外请求都计数；达到三次仍未取得连续双轮时先报告，勿盲目追加收费重试。文本调用按实际 dispatch 计数，不按聊天条数计数。
>
> 需要局部修复时保留失败证据和修改清单，修复后重建、更新全部产物标识，并重新取得受影响结果；两次 Agent 成功必须来自同一最终构建且连续，不拼接修复前后结果。不推送、不发 PR、不合并、不发布。完成后按本说明模板输出报告和脱敏证据清单，明确未测项、失败及剩余风险。

## 2. 交付目标与完成边界

| 检查 | 本轮要求 |
|---|---|
| 源码 | 本地快照逐文件 SHA-256/大小核对；保留精确 sourceCommit 和清单摘要 |
| 原生构建 | Windows 11 x64 原生编译，CGO、Wails、前端、随包 Node/官方 pi SDK/插件/媒体运行时/CLI 完整 |
| 独立运行 | 无 Vite 或额外 Go/Node 开发服务器；窗口、业务后端和随包宿主就绪 |
| 基础持久化 | 两文本、三镜、布局/关系，退出后新进程恢复；当前 schemaVersion 2 全文档快照对照 |
| 最终 E2E-001 | 同一完整包两个独立新项目连续成功：真实 Agent 创建三镜 → 人工改第二镜 → 读取最新已保存内容 → 提案/确认 → 一张真实图/正式归属 → 离线恢复 |
| 最终 E2E-002 | 同一完整包，不用 Agent：中文路径图片导入 + 一次手动真实生成，区分来源、关联、素材复用及两轮离线编辑恢复 |
| 平台/异常 | 中文路径、窗口基础操作、Agent/图片状态区分、参数拒绝/503/未知/查询超时和恢复；实测与受控/专项测试分开列 |
| 回传 | 构建和完整包标识、逐项结果、请求计数、全文档快照/比较、实际资源哈希、必要截图和失败记录 |

NSIS 安装程序、签名、自动更新发布、视频生成/合成、专业时间线均非本轮目标。以前 Mac 的 11 项证据和旧 Windows 回传可作背景，不替代当前构建的 Windows 结果。未完成的项按 PASS / PARTIAL / FAIL / NOT TESTED 如实记录，阶段六和 G2/G3 不能预先关闭。

## 3. 先核对本地环境

建议把源码包完整解压到新的短路径，例如 `C:\BeefTV-Final-20261021`。不要解压覆盖旧仓库。后续示例在 Windows PowerShell 中执行；路径需替换成该机实际路径，不能把占位符原样执行。

| 工具 | 当前源码要求/已知条件 |
|---|---|
| Windows | Windows 11 x64；记录实际系统构建号 |
| PowerShell | 5.1+；仅当前进程需要时放行脚本，不改整机策略 |
| Go | 满足 `backend/go.mod` 的 1.25.0 最低要求；记录实际版本，旧机器已装版本可复用，禁止凭旧报告推断当前版本 |
| Bun | 推荐复用此前验证的 1.4.2；按仓库 `bun.lock` 冻结安装，不换 npm/pnpm、不重写锁文件 |
| Node | **24.15.0 / win32 / x64 精确版本**；`BEEFTV_NODE_RUNTIME` 指向包含 node.exe 的目录，不是 exe 本身 |
| CGO | MSYS2 UCRT64 gcc，binutils ≥2.37；默认 `C:\msys64\ucrt64\bin`，以仓库断言脚本为准 |
| WebView2 | 检查实际运行时；Windows 11 常有，不能只按系统名推定已满足 |
| 下载 | Go/Bun 依赖、Wails 和打包脚本中钉选的 FFmpeg 包；网络失败应记录，不能降低校验或随意换版本 |

旧机器曾用 `C:\Tools\go\bin`、`C:\Tools\bun`、`C:\Tools\node-v24.15.0-win-x64`。先 `Get-Command go,bun`、检查实际文件，再在**当前会话**补 PATH。确需安装时只补缺失依赖，不默认重装系统环境。这里没有打包 Mac 的 node_modules/Go 缓存给 Windows 使用。

```powershell
$handoff = (Resolve-Path 'C:\BeefTV-Final-20261021').Path
$source = Join-Path $handoff 'source'
$tools = Join-Path $source 'docs\demo\development\handoff\WINDOWS-FINAL'
$nodeRuntime = 'C:\Tools\node-v24.15.0-win-x64'  # 按实际路径修改
$node = Join-Path $nodeRuntime 'node.exe'
Set-ExecutionPolicy -Scope Process -ExecutionPolicy Bypass
Get-Command go,bun
& $node -p 'JSON.stringify([process.platform,process.arch,process.versions.node])'
# 必须得到 ["win32","x64","24.15.0"]，并检查 $LASTEXITCODE 为 0
```

先用 PowerShell 自带解析器检查两个辅助脚本，再执行；解析失败保留完整错误，不跳过：

```powershell
foreach ($name in @('Build-Windows.ps1','Launch-Windows.ps1')) {
    $tokens = $null; $parseErrors = $null
    [System.Management.Automation.Language.Parser]::ParseFile(
        (Join-Path $tools $name), [ref]$tokens, [ref]$parseErrors) | Out-Null
    if ($parseErrors.Count) { $parseErrors; throw "PowerShell parse failed: $name" }
}
$check = Join-Path $handoff ('private-check-' + (Get-Date -Format 'yyyyMMdd-HHmmss'))
& (Join-Path $tools 'Build-Windows.ps1') -SourceRoot $source `
    -NodeRuntime $nodeRuntime -OutputRoot $check
```

不传 `-Build` 时只校验源码、工具、Node 和 CGO；不会编译、启动客户端或调用模型。`source-check.json` 的 pass 必须为 true。此检查按清单验证快照文件，不校验后续下载的任意额外文件；请使用新解压目录，避免旧二进制或插件混入。

## 4. 原生构建与完整包核对

在前置检查通过后：

```powershell
$run = Join-Path $handoff ('private-build-' + (Get-Date -Format 'yyyyMMdd-HHmmss'))
& (Join-Path $tools 'Build-Windows.ps1') -SourceRoot $source `
    -NodeRuntime $nodeRuntime -OutputRoot $run -Build
```

辅助脚本调用现有正式入口 `scripts/build-beeftv-windows-release.ps1`，没有替换发行体系。它设置 windows/amd64 和 CGO 所需环境，记录构建日志，校验以下文件，然后复制完整 `build/bin` 为 `$run\portable`，生成 zip、实际解压再逐文件比较。末尾还复核源码清单，不能静默将构建过程中改过的源码当作原快照。

| 文件/目录（portable 下） | 核对 |
|---|---|
| `BeefTV.exe` | AMD64 PE，记录字节数/SHA-256；最终验收一直使用该文件 |
| `cli\beeftv.exe` | AMD64 PE；不能放到根目录与 BeefTV.exe 发生大小写重名 |
| `agent-host\runtime\node.exe` | AMD64 PE，实际运行报告 win32/x64/24.15.0 |
| `agent-host\server.mjs`、`package.json`、`bun.lock` | 齐全 |
| `agent-host\node_modules` | 四个官方 SDK 包为 1.2.0；不得套用历史“77 个顶层包”作为唯一通过标准 |
| `plugin-packages\*.beeftv-plugin` | 名称逐项对应源码；本次源码 86 个，以当前清单和源码为准。正式打包入口校验 zip 条目，不能有反斜杠路径 |
| `agent-host\media-runtime` | ffmpeg.exe、ffprobe.exe、manifest.json 及许可文件；正式脚本下载固定 8.0.1 包并校验摘要/执行媒体冒烟 |

输出含 `environment.json`、`source-check.json`、`windows-build.log`、`payload-manifest.json`、`portable-manifest.json`、`zip-check-manifest.json`、`source-after-build.json`、`snapshot-tests.log`、`BeefTV-windows-x64.zip`、压缩包摘要及 `preparation-result.json`。具体文件以实际成功阶段为准；中途失败不会假造后续文件。

`environment.json.nativeBuildTested=false` 是构建前采集时的边界，最终构建结果看 `preparation-result.json.buildCompleted`、日志和实际清单；`nativeLaunchTested` 在这些准备文件里始终为 false，运行检查应在正式报告里另记。完整包清单通过只能证明文件/架构及版本条件，不代表 GUI 或宿主已运行。

冻结后记录：sourceCommit、源清单 SHA-256、BeefTV.exe SHA-256、完整 `portable-manifest.json` SHA-256 和便携 zip SHA-256。使用 `$run\portable` 或经验证的 zip 解压版；不要只拷 exe。若另搬到中文目录，先重新跑 `Verify-Handoff.mjs bundle` 并与原清单比较，输出必须放到包外的新文件。

```powershell
$portable = Join-Path $run 'portable'
Get-FileHash (Join-Path $portable 'BeefTV.exe') -Algorithm SHA256
& (Join-Path $portable 'agent-host\runtime\node.exe') `
    (Join-Path $tools 'Verify-Handoff.mjs') bundle --source $source `
    --bundle $portable --out (Join-Path $handoff 'portable-before-acceptance.json')
```

`--out` 不覆盖已有文件；失败后换新文件名保留历史。任何源码或包改动都要重新构建并更新标识，不可沿用旧快照结论。

## 5. 零模型原生启动及基础恢复

关闭同一测试包已运行的窗口并保存内容，不结束无关用户进程。确认没有为本次测试额外开 Vite、Go server 或全局 Node Agent。系统其他程序无需关闭。

```powershell
$evidence = Join-Path $handoff 'private-evidence'
$baseData = Join-Path $handoff 'private-data-base'
& (Join-Path $tools 'Launch-Windows.ps1') -PackageRoot $portable `
    -DataDir $baseData -EvidenceDir $evidence
```

该模式用本机回环丢弃端口的**文本模型占位**启动，便于核对宿主而无需真实文本服务。它没有全局封锁图片请求；本阶段必须用新数据目录，不配置真实图片、不点击任何生成。不能把 `BEEFTV_AGENT_TOTAL_REQUEST_BUDGET=0` 理解成“禁止调用”（0 在现实现里并非禁用开关）。

按顺序执行并截图/记录：

1. 原生窗口可见，调整尺寸、最小化/最大化、回到画布，明暗主题和主要弹层无阻断。
2. Go 业务就绪。`/api/health/live` 可用于存活；其他受保护 API 的裸请求可能 403，这是桌面令牌门禁，不能通过关闭鉴权来“修复”。动态端口从当前日志/实例状态读取，不套用旧日志端口。
3. 打开 Agent 面板，记录正式宿主 ready/reason/status 及随包 node.exe 子进程路径。面板可见或 node.exe 存在都不足以证明 ready；使用既有授权 UI/状态/日志取证，不泄露桌面令牌。
4. 新建工作区项目，设置**画布标题**为 `WIN-FINAL-BASE`，添加两个有正文的文本节点和含三镜的 Script，修改第二镜图片提示词；记录稳定节点/行 ID、位置、视图及保存完成状态。注意采集器按画布标题查找，不是仅工作区项目名。
5. 保存并通过窗口正常退出，确认该进程及随包子进程退出，采集 before；再以同数据目录启动，只查看不拖动、不编辑，关闭后采集 after。不得用固定等待代替保存确认。

```powershell
$snapshot = Join-Path $source 'docs\demo\development\tools\Inspect-Saved-Project.mjs'
$shippedNode = Join-Path $portable 'agent-host\runtime\node.exe'
$db = Join-Path $baseData 'open_ai_canvas.db'
# 首次保存并退出后
& $shippedNode $snapshot --db $db --title 'WIN-FINAL-BASE' `
    --out (Join-Path $evidence 'base-before.json')
if ($LASTEXITCODE -ne 0) { throw 'before capture failed' }
# 重新执行 Launch-Windows，确认恢复，只看不碰，再退出后：
& $shippedNode $snapshot --db $db --title 'WIN-FINAL-BASE' `
    --out (Join-Path $evidence 'base-after.json') `
    --compare (Join-Path $evidence 'base-before.json')
if ($LASTEXITCODE -ne 0) { throw 'restore compare failed; preserve evidence' }
```

快照必须 schemaVersion 2 且含 `documentSha256`，比较 JSON 的 `pass=true`；这覆盖全文档，并有文本正文/行/连线的可读投影。图像文件字节需另外核对。若核对期间发生真实拖动，保留差异，解释后以新的静止基准重采，不能删坐标/版本/时间字段规避差异。旧采集器缺正文/全文档摘要的问题已修复，不要复制旧机手工改版。

## 6. 同构建真实 E2E-001：两个独立项目连续成功

先完成第 5 节。用**另一个新数据目录**启动真实模式，由操作员在正式设置中填本机渠道与凭证：

```powershell
$realData = Join-Path $handoff 'private-data-real'
& (Join-Path $tools 'Launch-Windows.ps1') -PackageRoot $portable `
    -DataDir $realData -EvidenceDir $evidence -RealModels
```

`-RealModels` 清除继承的文本占位环境，让应用读取正式本地模型配置；脚本不传 API Key、不自动调用模型。凭证不在本说明内，不能从 Mac 原始数据库或配置文件复制。文本选择当前可用 DeepSeek；图片核实 `flux-3-image` 或其他允许且可用的非 Seedream 模型及实际计价。标记渠道/模型/协议/尺寸/张数，API Key 只留在正式加密配置里。

两个新项目的画布分别命名 `WIN-FINAL-AGENT-01`、`WIN-FINAL-AGENT-02`。每轮：

1. Agent 指令：“为一段 15 秒新能源汽车宣传片创建一个三镜头分镜脚本。先只创建分镜，不生成图片或视频。”通过真实模型/正式工具创建三个可编辑分镜，不能手工预置后冒充 Agent 创建。
2. 记录 Script/三条 Row ID。人工修改第二镜图片提示词并**立即发送下一条指令**，核对发送前真实保存屏障和工具读取最新版本；不人为加固定延时掩盖时序。第一轮可用银色汽车/雨夜/蓝色霓虹/低角度；第二轮可用白车/雪山/极光/橙色路牌/斜俯拍，保持新细节可核对。
3. 选中 Script 节点，发送以下指令，聊天里不要重复刚才的新描述：

   > 请根据当前选中的分镜脚本的第二个镜头生成一张参考图片：先读取它最新保存的图片提示词，将原文用作新图片节点提示词，把图片节点关联到这个镜头，再提出默认图片模型的生成提案。只处理这一镜，不修改分镜内容，不生成视频，等我确认后再生成图片。

4. 核对正式工具读取/提案/生成输入包含最新修改、目标稳定行正确、数量一张、模型允许。生成前需人工确认，不能只相信聊天复述或图片外观；提案前不应发图片请求。
5. 只确认一次，记录 queued/running/完成及错误状态、实际 Task/Asset/Resource 对应；Agent 结束而图片仍在生成时要显示不同状态。表格行勾选属于批量生成，不能据此声称 Agent 已隐含识别某个行选择。
6. 核对图片为第二镜正式输出，另两镜未误改/误绑，资源文件可解码并记录实际尺寸/字节/SHA-256，素材库可见。只画一条装饰连线不能代替行的 `imageNodeId` 等正式关系。
7. 保存并完全退出后采该画布 before；断开外网（保留本机回环）重新启动同一包/数据目录，只读核对后退出，采 after/compare。核对图像/关系/内容/布局、全部已保存结果不再依赖供应商。然后恢复网络继续第二轮。

快照沿用第 5 节命令，将 `$db` 改为 `$realData\open_ai_canvas.db`，标题改为对应画布，文件分别使用 `agent-01-before/after`、`agent-02-before/after`，禁止覆盖前轮。每次重启都记录 PID/时间/数据目录和相同 exe/完整包标识。

两次完整流程须在同一构建连续成功；中途失败、修复或重新付费都保留。图片初始预算为两轮共两次；需要重来时先报告额外费用/原因，由操作员决定是否追加。不要把 DEV-018 历史两轮计入当前 Windows 连续成功次数。

## 7. 同构建 E2E-002：手动生成及中文路径/离线恢复

不调用 Agent，使用同一最终包，画布命名 `WIN-FINAL-MANUAL`。可沿用真实数据目录以复用正式模型设置。

1. 由操作员准备一张无敏感内容的本地图片，放入含中文和空格的测试路径，例如用户专用测试目录下的 `素材 示例\本地 色卡.png`；记录原文件 SHA-256。不从生成结果偷换导入来源。
2. 创建 Script 与图片节点，必要时 Shift 点击只选图片，通过“图片设置 → 上传图片”导入，关联目标行，核对素材库和资源身份；输入节点/参考关联与分镜正式输出不能混淆。
3. 用手动入口设置一张非 Seedream 的真实生成任务。可用“金色日落海岸公路，蓝色概念汽车驶过白色灯塔，高角度远景，真实电影摄影，无文字商标，正方形”。检查模型/尺寸/张数后确认一次；记录完整 Task→节点→Asset→Resource→文件链，关联另一目标镜。
4. 从素材库再次插入已有导入图/生成图，解除并重新关联，移动节点并保存；不重新生图实现所谓复用，不新增付费任务。解除输出线时核对行的正式归属也解除；已有素材应保留。
5. 保存退出、断外网重开，核对两种来源图片及关系；离线修改台词、移动节点并保存，再退出重开核对最新改动。使用两组 before/after（只看不碰的恢复），以及资源文件哈希，不能用有意编辑前后文档相等作要求。
6. 记录文本 dispatch 为 0、真实图片创建 POST 为 1；任务数与收费请求数分开，导入不是 AI 生成。检查窗口、中文导入路径和测试数据路径；如把完整便携包也搬到中文/带空格目录，先验完整包哈希，再实际启动/取资源。

## 8. 异常与恢复：如何记录才有效

异常应在新的隔离数据/项目中做本机受控测试，不用真实供应商反复制造收费故障。若 GUI 受控验证没有执行，明确为 NOT TESTED，不能把专项单测或 Mac 历史结果写成 Windows 桌面 PASS。

| 场景 | 需要核对的行为/证据 |
|---|---|
| 参数明确拒绝、无上游任务 | 结构化参数错误归为 `rejected_no_job`，不是提交未知；能继续编辑，修改参数后的新请求要另计；裸 HTTP 码/随意文本不够证明未受理 |
| HTTP 503 | 展示服务不可用原因；若受理结果未确认同时保留未知保护，不自动解除重试锁 |
| 已受理任务的查询超时 | 仅在支持查询的协议路径测试；确实等待当前 Go 查询期限（此前 45 秒），保留 providerTaskId/未知原因、不重复创建。返回一个立即 504 不等于真实等待超时 |
| 快速重复确认 | 同一操作不意外重复创建/收费；Task 数、真实 POST 与受控计数交叉对照 |
| 拒绝/过期提案 | 拒绝零生成；目标/内容/受保护配置变化后旧提案不能静默执行，原内容保留 |
| 生成中/交付中异常退出 | 在受控窗口对测试进程中断，记录请求是否已送出、是否受理；重启后状态真实。下载支持续传时复用原结果，不能重复登记或误绑；未知原任务不盲目重发 |
| 保存失败/并发冲突 | 明确反馈，不能把未保存的新内容当作已读到；旧版本不覆盖用户新编辑 |

实现与既有受控测试请直接读本地：`backend/internal/app/model_router_test.go`、`task_worker_applied_test.go`、`image_submission_test.go`，以及 `web/test/generation-error.test.ts`、`generation-submission-recovery.test.ts`、`canvas-generation-submission.test.ts` 和对应业务代码。Mac 原始 `.local` 控制器没有随源码包交付，不要声称包里有可直接运行的 Windows GUI 故障注入器。需要补 Windows 受控驱动时按正式 UI/协议/业务链做局部适配，保留源码/事件/计数，不绕过授权或修改原验收数据。

可先跑以下**零远程模型专项检查**，验证故障合同在 Windows 工具链下工作，但它们不能代替上述桌面实测：

```powershell
Push-Location (Join-Path $source 'backend')
try {
    go test ./internal/app -run 'TestImageParameterRejectionKeepsRouteAndTaskFailure|TestAcceptedImageQueryTimeoutPersistsOriginalTaskAndRetryLock|TestImageSubmissionUnknownProviderCannotReplayOrRetryLostResponse|TestImageSubmissionDiskRestartReplaysOneGenerationAndCompletesOnce' -count=1
    if ($LASTEXITCODE -ne 0) { throw 'Go targeted checks failed' }
} finally { Pop-Location }
Push-Location (Join-Path $source 'web')
try {
    bun test test/generation-error.test.ts test/generation-submission-recovery.test.ts test/canvas-generation-submission.test.ts
    if ($LASTEXITCODE -ne 0) { throw 'Web targeted checks failed' }
} finally { Pop-Location }
```

任务/媒体交付链证据优先用现有正式 UI、授权 CLI/业务查询和只读 SQLite 核对。不要把包含配置、headers 或原始请求的整行 Task/日志直接粘回。为每个新图记录 Task/节点/行/Asset/Resource ID、状态、实际文件哈希；读取 resource.object_key 时只从本机资源根目录定位，回传使用资源 ID 和相对说明，不暴露个人路径或凭证。

## 9. 已知历史问题与处理原则

- 旧 Windows 文档中的 `f84d5a1`、旧 exe 哈希和“已通过”属于历史，不对应本次快照。旧源码不能继续最终验收。
- 旧快照采集器漏文本/文档字段已修复；必须使用本包的 schemaVersion 2。当前采集器提供 `--db/--title/--out` 全参；`--compare` 不与输出同名。
- 脚本默认值在函数体里解析根路径，避免旧版参数默认目录问题；首次用解析器检查。不要通过把整机执行策略设成 Unrestricted 来绕过错误。
- PowerShell 的 Set-Location 与 .NET 当前目录曾不一致；构建包装器临时同步并恢复当前目录，启动器明确使用系统临时工作目录，以验证资源不依赖源码工作目录。
- 构建下载进度可能写 stderr；包装器按真实退出码判断，不把所有 stderr 都当失败，也不忽略非零退出码。包装器日志按 UTF-8 写；直接执行旧命令生成的日志可能是 UTF-16LE，先判断编码。
- 无 `.git` 的源码包里，程序 buildinfo.Commit 可能为 unknown；必须用源清单精确提交 + exe/完整包哈希建立追溯，不能伪填成功提交。不要默认从 PATH 移除 Git；当前脚本允许 git 查询失败，若实际仍有问题保留日志再定位。
- 如 Go 官方模块源不可达，按该机网络策略临时配置可用 GOPROXY；不降低 go.sum、锁文件或 FFmpeg 摘要校验，不更改源码里的固定版本“凑成功”。
- 同类失败连续三次停止盲试，整理已排除项和新假设。真实任务结果未知时先查原任务，不直接重新生成。

## 10. 回传文件与报告模板

先在 Windows 私有目录留原始材料，另外整理脱敏分享目录，逐份检查后再传。不要把整个 `$run` 或数据目录压缩回传：其中有 portable 重复件、运行日志及私有数据路径。不得回传 API Key、模型配置、令牌、`.settings-key`、整个数据库、会话目录或未检查的原始日志。

建议回传：

| 文件 | 内容 |
|---|---|
| `WINDOWS-FINAL-REPORT.md` | 下方模板的实际结果，失败与未测不可省略 |
| `source-check.json`、源清单/摘要、`preparation-result.json` | 本次代码与构建边界 |
| `payload-manifest.json`、便携包 zip 摘要 | 完整包标识与 exe/Node/CLI/插件/媒体哈希 |
| 脱敏环境说明、构建日志/退出结果 | 版本、工具链、命令；去个人路径/敏感配置，原件本机保留 |
| base/agent-01/agent-02/manual 的 before/after/compare | 当前 schemaVersion 2，画布独立，包含离线编辑后再次恢复对照 |
| `delivery-evidence.json` 或表格 | 每张图的 Task→行/节点→Asset/Resource→字节哈希、真实/导入来源和计数 |
| 必要 UI 截图或连续录屏 | 原生窗口/宿主状态、修改与提案/确认、实际图片/关联、恢复及异常；截图拒绝或 GUI 不可达也应写清楚 |
| 局部修复补丁、源码/辅助驱动清单、失败记录 | 若有改动，说明为何、重新构建标识与哪些流程重测 |

完整 exe/便携包先留 Windows 本机，若需要交付再单独传；不能只凭报告声称包已回传。

```markdown
# WINDOWS-FINAL 实测报告
- 日期、执行者/GUI 操作分工、Windows 版本/架构：
- 源码获取方式、本地根目录（回传脱敏）、sourceCommit：
- source-manifest SHA-256 / 校验结果：
- Go / Bun / Node / GCC / binutils / PowerShell / WebView2 实际版本：
- 实际命令、构建退出码、是否局部修复：
- BeefTV.exe 字节数/SHA-256、完整包 manifest/zip SHA-256：
- 无开发服务器、原生窗口、宿主 ready、随包 Node 路径检查：

| 项目 | PASS/PARTIAL/FAIL/NOT TESTED | 证据文件/原因 |
|---|---|---|
| 原生构建/完整载荷/zip 解压一致 | | |
| 窗口/中文路径/随包宿主 | | |
| 基础保存/新进程全文档恢复 | | |
| E2E-001 第一次完整真实流程 | | |
| E2E-001 第二次连续完整真实流程 | | |
| E2E-002 手动导入/真实生成/素材复用 | | |
| 离线看图/编辑保存/再次恢复 | | |
| 相关异常/中断恢复（逐场景另附） | | |

- 两次 Agent 项目/画布/Script/目标 Row ID 与同构建证明：
- 手动导入资源、生成 Task/Asset/Resource、实际文件尺寸/字节/哈希：
- 文本实际 dispatch、图片真实 POST、受控请求、视频调用数（含失败）：
- 所用渠道/模型/协议/张数，不含 API Key；实际费用或“账单未核实”：
- 首次失败/重试/中断/人工改动与最终解决情况：
- AT001～AT012 对应证据、原生 GUI 与专项测试/历史结果的区分：
- 未测项、阻塞、风险、需要 Mac 侧核对的补丁或材料：
- 完整包是否实际交付，最终验收/阶段状态建议及依据：
```

完成准备并不等于所有行 PASS。先回传真实材料，由 Mac 侧核对后更新工程台账；不得仅凭本说明宣布最终验收或发布完成。
