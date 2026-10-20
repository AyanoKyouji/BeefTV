# 本地运行证据索引

原始日志、JSON、截图、测试脚本、数据库和临时令牌没有随本目录发布。原开发机保留原始 `docs/development/evidence/<run-id>/` 档案；Git 中的报告保留结论、命令语义、构建标识与未执行项。引用本页表示证据存在于本地档案，不代表读取本页就完成了原始证据核验。

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
