# 本地运行证据索引

原始日志、JSON、截图、测试脚本、数据库和临时令牌没有随本目录发布。原开发机保留原始 `docs/development/evidence/<run-id>/` 档案；Git 中的报告保留结论、命令语义、构建标识与未执行项。引用本页表示证据存在于本地档案，不代表读取本页就完成了原始证据核验。

## 20261021-104440-DEV-011

DEV-011 目标分镜绑定，起始提交 `d224faf`，结果 Fixed（Mac，受控回放）。真实图片字节经本地等待/释放端点进入正式 Task 与交付链；重排、删除、UI / 正式行操作改输入四场景及冷启动恢复通过。修复过期图片关联，保留原产物并持久显示行内提示；回执、重放及整轮撤销专项通过。前端 41 项、Go 69 主测试/49 子测试、生产构建及明暗主题通过；没有远程模型调用，不作为新真实模型生成或 Agent 自主关联证据。

本机档案含 `run.json`、各场景的 initial、submitted、identity、fixture-request、running、changed-while-running、task、states、final、result JSON，原版复现及失败截图、正式行编辑回执、持久提示明暗截图、`checkpoint-result.json`、`restore-result.json`、`cold-stop.json`、`cleanup-final.json`、`storage-audit.json`、测试/构建日志、源码哈希与差异、浏览器/恢复/核对控制器。8 次本地回放含 1 次控制器中止失败，失败档案保留；日志及媒体不发布。详见[DEV-011 报告](../reports/DEV-011_20261021-104440-DEV-011.md)。

## 20261021-102534-DEV-010

DEV-010 本地资源与离线恢复，起始提交 `ad4978f57ba755e3f9de6e59977f5d7a9f802a09`，结果 Fixed（Mac）。修复开发入口素材库误读浏览器私有存储，现有项目节点→Asset→Resource→真实文件一致；全新浏览器及仅允许 localhost 的进程环境冷启动后，完整节点/连线、素材登记与三处图片哈希一致。Go 6 主测试/42 子测试、前端 75 项及生产构建通过，新增文本/图片调用为零。

本机档案含 `run.json`、`baseline-counts.json`、修复前失败截图、`checkpoint-*` / `offline-*` 文档与截图、`cold-stop.json`、`storage-audit.json`、`cleanup-final.json`、测试/构建日志、源码哈希及差异、浏览器与离线运行控制器。原始运行文档可能含本地配置，不发布。详见[DEV-010 报告](../reports/DEV-010_20261021-102534-DEV-010.md)。

## 20261021-100551-DEV-009

DEV-009 Agent 提案与确认验证，源码提交 `de0121b44386be05d593afdbcae9ee8a827f634b`，结果 Verified（Mac），无需产品源码修改。两次 UI 编辑后真实工具读取、节点草稿和正式提案对应；拒绝零图片任务，确认后一次真实 Flux 请求的 prompt 与第二次编辑逐字一致，图片归于提案节点。10 次文本 dispatch、1 次图片生成；冷启动后完整节点/连线、分镜、历史及文件哈希一致。Go 18 主测试/3 子测试、前端 55 项通过。

原文件包括 `run.json`、reject/confirm 的 fixture、before、history、chat-input、proposed、result JSON 与 stream NDJSON、`reject-proposal.png`、`confirm-proposal.png`、`rejected.png`、`confirmed.png`、`accepted-task.json`、`confirm-submitted.json`、`task.json`、`task-states.json`、`final.json`、`tool-input-comparison.json`、`audit.json`、`before-restart.json`、`after-restart.json`、`checkpoint.json`、`restore-result.json`、`cold-stop.json`、`cleanup-final.json`、`go-tests.jsonl`、`web-tests.log`、控制/核对脚本及失败截图。原始模型/媒体记录和凭据保留本机，不发布；详细边界及控制器修正见[DEV-009 报告](../reports/DEV-009_20261021-100551-DEV-009.md)。

## 20261020-204809-DEV-007

DEV-007 非 Seedream 图片服务验证，起始提交 `0cbccb9`，结果 Verified（Mac）。中转标识 `flux-3-image` 经官方 `openai-image` 协议单张生成成功，唯一一次上游 POST 返回 HTTP 200；实际图片为 1024×1024 JPEG、402,472 bytes，与请求的尺寸/格式不同。费用及底层别名未核实。另有一个缺少协议包的本地失败任务，上游请求数为零，错误分类问题保留到 DEV-008。

原始文件包括 `model-catalog.json`、`selected-model.json`、`plugin-ready.json`、`submitted-request.json`、`task-identity.json`、`task-states.json`、`task-summary.json`、`result-audit.json`、`initial-document.json`、`image-node.json`、`before-generation.json`、`after-generation.json`、`dev-proxy-auth.json`、`before-cold-restart.json`、`after-restart.json`、`restore-result.json`、`cold-stop.json`、`cold-stop-settled.json`、`cleanup-final.json`、`web-build.log`、源码差异/摘要、浏览器脚本、核对脚本及截图；`preflight-plugin-missing/` 保存初次本地失败记录。图片文件和数据库位于隔离开发数据目录。实际中转地址、API Key、owner 凭据、原始响应均不发布；详见[DEV-007 报告](../reports/DEV-007_20261020-204809-DEV-007.md)。

## 20261020-212542-IMAGE-CONFIG

图片能力配置缺失字段修复，起始提交 `314a1c0`，结果 Fixed。原代码新增用例 4 FAIL/1 PASS，修复后 63 项专项及相邻回归通过，前端构建通过。浏览器用原能力模块复现路由异常，再以相同缺失字段响应验证修复后的深色/浅色画布和图片设置；没有付费请求。

原材料包括 `baseline-tests.log`、`regression.log`、`build.log`、`baseline-crash.png`、`fixed-dark.png`、`fixed-light.png`、`browser-results.json`、测试控制器失败 JSON/截图、`image-config-browser.mjs`、源码差异及摘要。截图准备问题与覆盖情况见[修复记录](../reports/FIX-IMAGE-CONFIG_20261020-212542.md)。后续 DEV-008 若复用该运行副本，任务新增以独立证据记录，不覆盖本轮零付费结论。

## 20261020-213847-DEV-008

手动任务与失败反馈修复，基线 `1006882`。真实成功链路复用 DEV-007，不追加付费调用。本地未安装接口的校验失败不再误报未知提交，保留未知响应和既有供应商任务保护。最终受控浏览器三次点击仅一个本地失败任务、上游零请求，助手 API 被屏蔽后手动入口仍可用；失败后编辑保存通过。Go 40 主测试/36 子测试及前端 16 项通过。

原文件包括 `baseline.log`、`go-tests.jsonl`、`web-tests.log`、`before.json`、`after.json`、`browser-result.json`、`manual-local-failure.png`、`audit.json`、`cleanup-final.json`、`source.patch`、源码摘要和 `dev008-browser.mjs`。`first-candidate/` 保留内部 failure_code 尚未修正的首轮结果；本项两个受控失败任务均无上游请求。详见[DEV-008 报告](../reports/DEV-008_20261020-213847-DEV-008.md)。

## 20261020-202155-DEV-006

DEV-006 稳定对象定位，结果 Fixed（Mac），起始提交 `c86ca713f8e00ed1336e7f2c8b8caaf4f861257d`。真实基线复现发送后重排误改补位行；修复后六场景通过，发送时顺序由已有轮前快照派生，正式 Durable 输入、工具回执及业务数据对应。完全退出后的新进程/新浏览器恢复通过，最终 revision 49；21 次文本模型 dispatch，无媒体任务，测试服务均已停止。

原文件包括 `result.json`、`tool-business-comparison.json`、各场景 initial/reordered/final/history/result/chat-input JSON、流式 NDJSON 与截图、`business-http.ndjson`、`cold-stop.json`、`cold-stop-corrected.json`、`restore-result.json`、`restored-history.json`、`restore-failure.png`、`cleanup-final.json`、Go 专项结构化日志、`checks-summary.json`、`source.patch`、`validated-source-hashes.json`、浏览器与运行/核对脚本。模型凭据、真实中转地址和完整原始日志不发布。失败与修正及验证范围见[任务报告](../reports/DEV-006_20261020-202155-DEV-006.md)。

## 20261019-233713-DEV-001

DEV-001 基线检查。原文件包括 `baseline.json`、`final-worktree.json`，保存源码与工具采集。开发源码基线为 `2327ee2d80282b10dd8bef0f26b48990d46f5c3b`。

## 20261020-105004-DEV-002

DEV-002 构建、组件、界面及正常退出冷启动验证。原文件包括：

- `run.json`、`result.json`、`source.patch`、`dependency-hashes.json`。
- `web-install.log`、`agent-install.log`、`node-runtime-check.log`、`agent-import.log`、`backend-build.log`、`web-build.log`、`web-components.log`、`backend-components-unsandboxed.log`。
- `before-cold-restart.json`、`before-cold-restart-ui.json`、`cold-stop.json`、`desktop-verify-comparison.json`、`desktop-verifyfresh-comparison.json`、`sqlite-readonly-check.json`。
- `desktop-checkpoint.log`、`dev002-browser.mjs`、`desktop-runtime.go.txt`，保存前后截图与其他失败尝试日志。

结果为 Fixed：Script 创建入口修复，前端 14 项检查、后端 3 项检查通过，保存及正常退出冷启动恢复通过。平台为 Mac 开发联调与独立真实 Node 宿主检查；没有真实模型或 Windows 完整流程验收。

## 20261020-112554-DEV-003

DEV-003 Mac 侧准备记录。原文件包括 `run.json`、`result.json`、`mac-runtime-windows-target.log`、`handoff-integrity.json`、`handoff.sha256`、`readonly-check-result.json` 及只读采集对照。源码交接包 v3 SHA-256：`e067c71f476fdd0f601e3c2db5674510fdc934c398d9f1aee6fceb270c6a0255`。

这批证据只证明交接准备和 Mac 采集工具检查，不是 Windows 验收。后续 Windows 结果以[回传报告](../reports/DEV-003-Windows-Build-Test-Record.md)单独记录；其正文仍列有宿主就绪与编辑/恢复待完成项。

## 20261020-163206-DEV-004-01

DEV-004-01 对象编辑、稳定身份及持久化验证，结果为 Verified。源码基线 `c7dfc2b21acc1cfaceed0f49e0a3861b4dd3b8e1`，没有产品源码修改。Mac 浏览器界面连接生产 Go 桌面组合根及 SQLite，17 个字段编辑、排序、复制/删除和全新浏览器资料下的进程重启恢复通过；最终 revision 17。后端 19 个顶层测试及 3 个子测试、前端 13 个测试通过。

原文件包括 `run.json`、`result.json`、`backend-storyboard.log`、`web-storyboard.log`、`runtime-build.log`、`runtime-live-1.log`、`runtime-live-2.log`、`vite-live-1.log`、`vite-live-2.log`、`initial-document.json`、`control-before-edit.json`、`edited-fields.json`、`duplicate-identity.json`、`identities.json`、`before-restart.json`、`after-restart.json`、`restart-comparison.json`、`process-stop.json`、`process-restart.json`、`sqlite-closed-process-comparison.json`、`dev004-browser.mjs`、`desktop-runtime.go.txt`、浏览器操作/失败日志及截图。自动化定位失败与比较字段修正见[任务报告](../reports/DEV-004-01_20261020-163206-DEV-004-01.md)。运行时凭据仅在隔离数据目录保存，不加入证据发布。

没有真实模型调用、Mac 原生窗口或本轮 Windows 验证；DEV-004-02、03 尚未执行。

## 20261020-165126-DEV-004-02

DEV-004-02 真实 Agent 读取项目对象，结果为 Verified，基线 `5e21fa9`。用户授权中转的 `deepseek-flash` 经正式 Go/Node/Durable 工具链完成一个只读回合，4 次模型 dispatch、5 次 `canvas.get`。正式工具结果与 Go 业务读取及 SQLite 一致：两个 Script 的六行完整对象、文本节点及目标行 24 个字段对应；业务文档保持 revision 17，没有生成任务或产品代码修改。

原文件包括 `run.json`、`result.json`、`model-discovery.json`、`host-status.json`、`runtime-live.log`、`vite-live.log`、`browser.log`、`before-agent.json`、`after-agent.json`、`user-prompt.json`、`agent-stream.ndjson`、`agent-history.json`、`agent-body.txt`、`agent-read.png`、`browser-result.json`、`durable-tool-results.json`、`durable-entries.json`、`tool-business-comparison.json`、`model-usage.json`、`cleanup.json`、`dev00402-browser.mjs`、`dev00402-audit.py`。本地模型密钥与运行凭据不加入证据发布，公开材料省略实际中转地址。

真实模型读取通过不代表真实模型创建/写入、即时编辑时序、图片生成、Mac 原生窗口或 Windows 回归已通过；范围见[任务报告](../reports/DEV-004-02_20261020-165126-DEV-004-02.md)。

## 20261020-170041-DEV-004-03

DEV-004-03 真实 Agent 创建三个分镜，结果为 Verified（Mac 开发联调），基线 `60162e5b47f54b4cdbafdd4cfe9dac2ecc814168`。一个真实 `deepseek-flash` 回合完成 Script 创建与三行追加，官方写入回执及模型字段与业务对象一致；9 次模型 dispatch、10 次官方工具执行，其中两次旧版本读取被拒绝后恢复。原四个节点除编辑器更新时间外，业务字段全部保留。

三条新行 ID 唯一，第二镜人工编辑四个字段后 ID/归属保持正确。完全关闭 Go/Vite/Node 后，以全新进程和浏览器资料恢复，完整文档、三行及修改、Agent 历史一致，最终 revision 23；没有生成任务或产品代码修改。DEV-004 三个子项均通过，最终 Windows 验收保留。

原文件包括 `run.json`、`result.json`、`user-prompt.json`、`agent-stream.ndjson`、`agent-history.json`、`before-agent.json`、`after-agent.json`、`existing-node-comparison.json`、`identities.json`、`manual-edit.json`、`before-restart.json`、`after-restart.json`、`restart-comparison.json`、`restored-history.json`、`cold-stop.json`、`cleanup.json`、`durable-entries.json`、`durable-tool-results.json`、`tool-business-comparison.json`、`runtime-live-1.log`、`runtime-live-2.log`、`vite-live-1.log`、`vite-live-2.log`、各浏览器成功/失败日志及截图、`dev00403-browser.mjs`、`dev00403-audit.py`、`desktop-runtime.go.txt`。具体失败、恢复与验证范围见[任务报告](../reports/DEV-004-03_20261020-170041-DEV-004-03.md)。模型配置、密钥及运行凭据不发布。

## 20261020-171515-DEV-005

DEV-005 发送前提交屏障，结果为 Fixed（Mac），起始基线 `a018bc448393fe826f3b31fd6c37d8634b2e1c06`。基线受控复现聊天先于保存，拦截聊天避免调用模型；修复复用现有保存队列，在实际消息/补充请求前确认保存。最终五场景通过，正式工具返回与业务行 24 个字段、ID/版本一致，保存失败聊天增加 0，旧模型写入 HTTP 409，用户并发编辑保留，最终 revision 40。

有效验收四个模型回合 9 次 dispatch；计入候选和测试脚本失败尝试，本轮实际总计 22 次。去重专项检查 42 PASS，类型检查、前端构建、lint 通过。旧测试信号导致的工具超时、旧源码断言失败及修正原文均保留，未计为通过；见[任务报告](../reports/DEV-005_20261020-171515-DEV-005.md)。

原材料包括 `run.json`、`result.json`、`baseline-result.json`、`baseline-events.json`、`scenario-results.json`、`verification-start.json`、`verify-events.json`、`T05-final-events.json`、各场景 history/document/stream JSON 与 NDJSON、`row-update-arrived.json`、`business-http.ndjson`、`durable-entries.json`、`durable-tool-results.json`、`final-document.json`、`cleanup-final.json`、`source.patch`、`validated-source-hashes.json`、`web-regression.log`、`assistant-barrier-final.log`、`storage-regression.log`、`storage-regression-2.log`、`typecheck.log`、`web-build-final.log`、`lint.log`、`privacy-check.json`、运行/浏览器日志及截图。`first-candidate/` 和 `stale-test-gate-attempt/` 保留中间结果；`dev005-browser.mjs`、`dev005-audit.py`、`desktop-runtime.go.txt` 保存控制和只读核对方法。

原始凭据及中转地址不发布；没有本轮原生窗口、Windows 或真实图片/视频验收。


## 20261021-120800-DEV-012

DEV-012 双入口交付一致性，起始提交 `2d0c81b`，结果 Verified（Mac，受控图片回放 + 真实 DeepSeek 提案）。三个场景（手动有目标 / Agent 有目标 / 手动无目标）在共享交付层产出一致结果，独立 Task / Asset / storageKey，文件 SHA-256 均等于 DEV-009 真实字节；冷启动后完整恢复。图片为本机 `openai-image` 回放（3 次 POST），文本为 1 次真实 DeepSeek dispatch。

本机档案含 `dev012-shared.mjs`、`dev012-manual-target.mjs`、`dev012-agent-target.mjs`、`dev012-manual-standalone.mjs`、`dev012-cold-restart.mjs`，各场景 `initial / running / delivered / final / task / result` JSON 与截图、fixture 请求、`cold-restart-result.json`。数据库、模型凭据、原始日志和媒体文件保留本机，不发布。详见[DEV-012 报告](../reports/DEV-012_20261021-122500-DEV-012.md)。

## 20261021-144414-DEV-012-017-RETEST

独立复测基线 `e6d39ee`。原材料位于本机 Git 忽略目录 `.local/retest-dev012-017-20261021-144414/`：`runtime.py`、`browser.mjs`、`uncertainty.mjs`、`final-audit.mjs`；`go-tests*.jsonl`、`go-app-targeted.jsonl`、`go-fixed-final.jsonl`、`go-adjacent-final.jsonl` 及各 summary；`web-tests.log`、`web-build.log`、`collector-tests.log`；`collector-repro.json`、`uncertain-before-fix.log`、所有 `browser/uncertainty/final-audit-failure-*`；最终 `browser-result.json`、`uncertainty-result.json`、`offline-edit-before/after.json` 与对照、截图、进程日志、egress 探针、`final-manifest.json` 及 `cleanup-final.json`。修复前问题与控制器失败未删除。隔离数据、配置及媒体不提交，详细事实见[复测报告](../reports/DEV-012-017_Retest_20261021-144414.md)。

## 20261021-152916-DEV-018

Mac Agent 完整闭环，最终版本 `04522b8`。起始 `e382ac7` 暴露自主分镜关联缺口，业务修复 `afb2caf`。同版两新项目各完成真实创建三镜、最新输入读取、正式行关联、提案确认、真实图片落盘与离线冷启动，结果 Fixed（Mac Go/Vite/官方宿主，明示第二镜）；最终 revision 16/18。真实图片共 2 张，文本 dispatch 含失败总计 76；没有视频或 Seedream，费用未核实。

本机忽略目录 `.local/dev018-20261021-152916/` 保存 `runtime.py`、`browser.mjs`、`audit.py`、`finish.py`；`result.json`、`final-audit.json`、专项/共享层测试 JSONL、宿主测试日志。`run1/run1b/run1c` 为失败尝试；`run1d/run2d` 为最终连续两轮，分别含 `run.json`、`state.json`、`initial/created/proposed/before-restart/after-restart` JSON、`creation-message/edited-input/model-summary`、真实 stream/history/events、`task.json`、`task-states.json`、`task-submission-*`、`audit-result.json`、`binary-sha256.json`、`restore-result.json`、`offline-egress.json`、`runtime-state.json`、运行日志与创建/提案/交付/离线截图。所有 `*-failure-*` 和控制器失败日志保留。

历史 before/after 全文档深比较为跨进程依据；停止后两份 `collector-*` 是同库只读检查，不能误称历史退出前采集。独立隔离数据在 `.local/project-workbench-debug/dev018-20261021-152916-<run>/`，含正式业务 SQLite、Durable SQLite、请求账本和真实媒体；这些文件及凭证不提交。详细结果和限制见 [DEV-018 报告](../reports/DEV-018_20261021-152916.md)。

## 20261021-161026-DEV-019

Mac 手动闭环，起始 `db4a15a`，空图片设置上传入口修复 `af9282c`，结果 Fixed（Mac Go/Vite/Chrome）。实际 UI 创建脚本/两镜，第一镜导入本地 PNG，第二镜一次真实 Flux 生成；两组全文档/图片/素材离线恢复及继续编辑移动后再恢复通过。0 次文本 dispatch、1 次真实图片 POST；另一个项目有 1 个 INTERNAL 本地准备失败任务，零外部请求。全部失败、接续与边界见 [DEV-019 报告](../reports/DEV-019_20261021-161026.md)。

本机 Git 忽略目录 `.local/dev019-20261021-161026/` 保存 `runtime.py/browser.mjs/finish.py/audit.py`、`import-source.json`、“本地测试素材.png”、`flow-result.json/result.json`、构建/定向测试日志及 Go JSONL。`manual/` 含版本、状态、创建/导入/生成前/退出前/首次恢复/离线编辑/最终恢复 JSON；两素材在线及离线文档、实际任务状态与安全提交摘要、受控失败任务/编辑快照、各阶段结果和截图、禁止外网探针、进程状态/日志、所有 `*-failure-*`。只读审计曾误把 INTERNAL 计为外部请求的原日志也保留。

独立数据位于 `.local/project-workbench-debug/dev019-20261021-161026-manual/`，含业务 SQLite、本地配置及两个真实来源的资源字节；不提交数据库、媒体、凭证、浏览器资料和原日志。首次离线编辑后定位中断，接续仅继续移动/保存/恢复，没有第二次真实生成；不把它记为一次无中断自动运行。

## 20261021-STAGE6-ACCEPTANCE-AUDIT

阶段六证据盘点，基线 `cce5bbc`。本轮仅对照计划/报告并只读核对现存文档与媒体，未启动应用、运行新业务验收或调用模型。DEV-018 两轮的 before/after 记录及图片哈希、DEV-019 两组恢复记录及两种来源的图片哈希均对应；这不是对历史测试的重新执行。最新剩余项见[收口核对报告](../reports/STAGE-6_Acceptance-Audit_20261021.md)。

忽略目录 `.local/stage6-audit-20261021/` 保存 `audit-evidence.py`、`evidence-audit.json`、`evidence-audit.log`。本轮读到的 DEV-018 `final-audit.json` SHA-256 为 `7916deac9643788613cad580d58a52b4728c1812858300f3f85fb486b7d900c5`，DEV-019 `result.json` 为 `1390aecf336185ac90a6d02ea3e9a03551cc808baf9cf629f22762bd4f6e2f4c`；另记录复测 manifest/cleanup 摘要，仅用于定位材料，不证明当前进程状态或最终平台通过。没有修改原业务数据或原始运行材料。

## 20261021-164543-AT007

AT007 状态反馈补验，起始 `0a8dfd6`，修复 `f010bbd`，Fixed（Mac Go/Vite/Chrome，正式官方 pi 宿主及 Task 链，上游为本机受控响应）。基线复现处理动画缺失，修复后最终 `fixed4` 完整 10 阶段/30 帧通过；明暗、减少动画、停止与 Agent 结束但图片仍生成的区分已核对。50 项相关测试及生产构建通过。计入失败尝试为 12 次本机文本请求、3 次已知 PNG 图片回放，零真实模型调用；不能计为新图片模型创作或最终 Windows 验收。

本机忽略目录 `.local/at007-20261021-164543/` 保存 `runtime.py`、`supplier.mjs`、`browser.mjs`、`replay.png`、`supplier-events.jsonl`、`presentation-tests.log`、`stop-regression.log`、`web-build.log` 及 `final-audit.json`。`states/` 保存 `run.json`、`state.json`、`runtime-state.json`、`baseline-result.json`、`fixed4-result.json`，各阶段带时间的 DOM/动画采样、每阶段三帧截图、回合历史、外网拒绝探针及运行日志。`baseline` 与 `fixed/fixed2/fixed3` 中间尝试、所有 `*-failure-*` 原记录均保留；最终完整序列不是失败材料拼接。

独立数据在 `.local/project-workbench-debug/at007-20261021-164543-states/`；仅配置合成凭证和 localhost 上游，操作系统及浏览器限制外网，日常数据和原 DEV-018/019 数据未改动。`final-audit.json` 记录四个修复文件 SHA-256、本机请求账本/服务计数、三个成功 Task 和 3027/8107/18107 端口关闭结果。数据库、配置、媒体、浏览器资料及原始日志不提交，详细结果与控制器失败说明见[任务报告](../reports/AT007_20261021-164543.md)。

## 20261021-171649-AT004-011

起始 `ca2cf58`，修复 `27e3b6a`。Mac Go/Vite/Chrome，AT004 Fixed、AT011 Verified；AT006 节点选择/表格批量勾选及显式镜头指令边界已核对。复制 DEV-019 冻结数据库与资源到新隔离数据目录，实际 UI 再插入导入图/历史生成图；复现并修复删除线后 `imageNodeId` 残留，再做解除/交替关联、移动与完全重启恢复，全文档及四个图片节点字节一致。75 项前端专项、4 项 Go 上下文测试和构建通过，零新增真实模型、生成 Task 或 Agent dispatch。一次聊天请求在进入后端前拦截，仅用于看选择字段。

忽略目录 `.local/at004-011-20261021-171649/` 保存 `runtime.py`、`browser.mjs`、`audit.py`、`final-audit.json`，`web-tests.log`、四份专项测试日志、`web-build.log`、首次沙箱监听失败 `go-context.jsonl` 及最终 `go-context-final.jsonl`。`assets/` 含 `run.json/state.json/initial.json`、两个 `source-*-asset.json`、`reused-*` 文档/截图、`disconnected.json` 及基线产品失败、`fixed-relinked-original/fixed-unlinked/fixed-rebound-generated/fixed-rebound-import/fixed-final-binding`、`before-restart.json/after-restart.json`、明暗恢复截图、表格第二行选择及 Agent 节点选择截图、`blocked-chat-*` 与结果 JSON。右键落点错误、无模型配置阻止发送等控制器失败原记录均保留。

数据在 `.local/project-workbench-debug/at004-011-20261021-171649-assets/`，未复制原模型配置/密钥/令牌；选择检查只用本机合成文本配置，没有把请求送到模型。`final-audit.json` 记录三个源码摘要、原数据库不变、全文档恢复、两项资源哈希、历史表数量无新增及 3028/8108 端口关闭。原始数据、媒体、凭证和日志不提交；详见[任务报告](../reports/AT004-011_20261021-171649.md)。

## 20261021-173538-AT010

起始 `cd057af`，修复 `84f918c`。Mac Go/Vite/Chrome，受控模型 400、服务 503、正式异步图片查询无响应 45 秒补验，修复明确参数拒绝误判和已受理查询超时丢失，503 同时显示服务原因和未知结果保护。105 前端、去重 122 主/80 子 Go 及构建通过。受控阶段 5 个创建 POST/2 GET（含修复前），零真实模型；随后按用户追加授权执行 1 次真实 `flux-3-image` POST、0 文本/视频，未用 Seedance/Seedream，新 JPEG 及完整离线重启恢复通过。

忽略目录 `.local/at010-20261021-173538/` 保存 `runtime.py/browser.mjs/supplier.mjs/audit.py`、受控 `final-audit.json`、`supplier-events.jsonl`、Go JSONL 和七个前端测试日志、`web-build.log`。`errors/` 含受控 `state/run/initial/before-restart/after-restart`、三个场景的提交摘要/Task/状态/反馈/运行中/失败/可编辑截图、两份重试拒绝 JSON、明暗恢复截图、`baseline-*` 和所有控制器/产品失败。两次查询实际 45,009/45,002 ms；不把 HTTP 504 模拟成真实等待。

真实补验材料含 `discover.mjs/real-discovery.json/real-browser.mjs/real-audit.py`、`real-final-audit.json`、`real-audit-nontarget-timestamp-diff.json`，以及 `errors/real-state/real-submission/real-task/real-task-states/real-asset/real-before/real-before-restart/real-after-restart`、生成/恢复结果及截图。真实 Task `4b63c7bdecf147c9c57bfa4ac6bec384`，1024×1024 JPEG、535,850 bytes，SHA-256 `ea2d6e8d85a640057251f7ec05da0a6fb24f30cb06ff602368d2574a7e8edc7b`。非目标节点真实生成前后仅 6 个 `updatedAt` 刷新，原严格比较失败及差异记录保留；跨进程全文档比较没有排除字段。

隔离数据在 `.local/project-workbench-debug/at010-20261021-173538-errors/`，原 DEV-019 数据库哈希未变。新真实凭证通过正式 API 加密保存，临时明文输入已删除，不发布地址/密钥/数据库/原日志。受控与真实二进制摘要分别保留，源码摘要对应同一修复；结束时 3030/8110/18110 均关闭。详见[任务报告](../reports/AT010_20261021-173538.md)。

## 20261021-180942-DEMO-MATERIALS

起始 `d69e2f2`，产品基线 `84f918c`。演示材料整理，零新文本/图片/视频调用，未启动 BeefTV 或重跑业务验收。忽略目录 `.local/demo-materials-20261021-180942/` 内保存 `prepare.py/verify.mjs`、`source-check.json/browser-check.json/final-check.json`、桌面/窄屏 `preview-1440.png/preview-390.png`、`presentation/` 与 `presentation.zip`。

静态包内 11 文件：HTML、说明、manifest 与 8 项媒体（DEV-018 两张真实图、DEV-019 真实图/导入色卡、AT010 真实图及三张历史界面截图），版本及受控/真实来源逐项标注。双视口 8 图全部解码、无水平溢出或脚本错误，HTTP 请求 0。压缩包 3,273,653 bytes，SHA-256 `7ccfc44130978bc161d16ce80321bda07f22ea591aa7d19c694b290b6e44deb1`，CRC/路径/媒体哈希通过；包内没有数据库、模型配置、日志或凭证。

私有数据副本位于 `.local/project-workbench-debug/demo-materials-20261021-180942-{agent,manual}`，只含 SQLite 与资源，完整性及资源哈希通过；没有启动排练，也没有复制会话/模型配置/密钥/令牌。选用来源数据库与原媒体哈希不变。首次准备脚本因未关闭备份连接而对临时 WAL/SHM 断言失败，原输出保存在 `attempt1-presentation/` 和 `…-agent-attempt1`；关闭连接后重新准备成功，未影响原业务数据。

媒体/包/业务副本不提交，Git 仅保留文字指南、报告及索引。详见[材料报告](../reports/DEMO-MATERIALS_20261021-180942.md)与[演示操作指南](../演示操作指南.md)。

## 20261021-WINDOWS-FINAL-PREP

起始 `2382cee`，产品代码最近修复基线 `84f918c`。Windows 原生构建交接准备：公开说明和脚本位于 `handoff/WINDOWS-FINAL/`，本机忽略目录 `.local/windows-final-prep-20261021/` 保存 `tool-tests.log`（新增工具 14 + 现有采集器 12，共 26 PASS）、完整源码 `BeefTV-Windows-Final-source.zip`、独立 `START-HERE.md`、`source-manifest.json`、`source-check.json`、`archive-check.json`、`package-summary.json` 及源包摘要。快照精确提交、成员数量/总字节/摘要以这些清单为准；从 Git 提交导出，不包括工作区未提交内容或 `.local`。

源码/完整载荷验证器专项及 schemaVersion 2 全文档采集器在 Mac Node 24.15.0 检查通过；实际源快照逐文件哈希及 zip 路径/成员/CRC 核对。没有 PowerShell 原生解析/执行、Windows 编译/窗口或模型调用；Windows 侧先解析辅助脚本，再按阶段执行并回传。原业务数据、模型配置、缓存、私有日志和媒体成果未进入源码包。详见[准备报告](../reports/WINDOWS-FINAL-PREP_20261021.md)与[可直接交给 Windows 模型的说明](../handoff/WINDOWS-FINAL/README.md)。
