# 本地运行证据索引

原始日志、JSON、截图、测试脚本、数据库和临时令牌没有随本目录发布。原开发机保留原始 `docs/development/evidence/<run-id>/` 档案；Git 中的报告保留结论、命令语义、构建标识与未执行项。引用本页表示证据存在于本地档案，不代表读取本页就完成了原始证据核验。

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
