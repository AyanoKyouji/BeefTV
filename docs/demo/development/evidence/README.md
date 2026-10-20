# 本地运行证据索引

原始日志、JSON、截图、测试脚本、数据库和临时令牌没有随本目录发布。原开发机保留原始 `docs/development/evidence/<run-id>/` 档案；Git 中的报告保留结论、命令语义、构建标识与未执行项。引用本页表示证据存在于本地档案，不代表读取本页就完成了原始证据核验。

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
