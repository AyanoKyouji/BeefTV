# 历史 Windows 交接归档

当前使用 Git fork 的 `demo/ai-media` 分支管理源码，见[分支约定](../../git-workflow.md)。本页仅索引早期交接材料。

本地保留 `DEV-003-Windows-source-20261020-112554-DEV-003-v3.zip`（约 72.6 MiB），SHA-256：`e067c71f476fdd0f601e3c2db5674510fdc934c398d9f1aee6fceb270c6a0255`。它包含当时基线的 3565 个源码文件、DEV-002 四文件补丁、逐文件 manifest 以及 Windows 接续工具。该 zip、旧版本包、工具脚本及生成的 manifest 在本机历史档案保留，不加入本 Git 分支。

[早期包内说明](DEV-003/README.md)对应该快照，包含后来在 Windows 回传报告中发现的调用/路径问题；未来交接应按当前源码和已登记问题处理，不能直接把历史包当作最新版本。

新的 Windows 回归优先检出指定 Git 提交并按仓库原生脚本构建，继续保留产物摘要、系统环境、宿主就绪和项目恢复证据。
