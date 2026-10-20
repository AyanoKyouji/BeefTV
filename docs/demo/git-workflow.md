# 分支与同步约定

## 仓库与分支

| 名称 | 作用 |
|---|---|
| origin | `https://github.com/AyanoKyouji/BeefTV.git`，本项目 fork，日常推送目标 |
| upstream | `https://github.com/glanderness/BeefTV.git`，原项目，只作为上游同步来源 |
| main | 保持上游主线内容，跟踪 upstream/main，不包含 Demo 专属提交 |
| demo/ai-media | 长期 Demo 开发分支，跟踪 origin/demo/ai-media |

开发分支从已验证的 `2327ee2d80282b10dd8bef0f26b48990d46f5c3b` 创建，保留 DEV-002 的修复；建立工作流时 main、origin/main 与 upstream/main 对齐到 `9898785336b51d3edd4cfc100e0629370bfe015e`。主线前进不自动升级当前开发基线。

本地配置 `remote.pushDefault=origin`、`push.default=simple`、`pull.ff=only`，开发分支明确向 origin 推送。源码修改、相关测试和报告按任务提交；代码与大规模文档迁移分别提交，便于回看。

## 日常工作

在 BeefTV 仓库目录中操作：

```sh
git switch demo/ai-media
git status --short
# 编辑代码及 docs/demo 中的记录，执行适用检查。
git add <本次任务的明确文件>
git commit -m "fix(模块): 业务 - 具体修改"
git push origin demo/ai-media
```

提交前核对暂存差异和文件清单，保留其他未完成工作。推送遵守用户授权；不自动创建 PR、合并主线或发版。

## 同步上游

在当前工作已妥善提交、工作区干净后更新镜像主线：

```sh
git fetch upstream main
git switch main
git merge --ff-only upstream/main
git push origin main
git switch demo/ai-media
```

这一步只推进 main。准备做阶段回归时，再把选定主线合入开发分支：

```sh
git merge main
```

合入前评估上游变更范围，冲突逐项解决，并运行受影响检查。已共享的开发分支采用 merge 保留历史；不默认 rebase 或强制推送。若 main 无法快进，先查明它为何出现独立提交，不用 reset 覆盖。

## Mac 与 Windows 接续

Mac 为主开发环境。Windows 阶段回归时获取同一开发分支提交，记录 Commit 与本机改动，按现有原生入口构建；源码分支一致不能替代运行验收。正常迭代不再依赖反复发送完整源码 zip，已有历史交接包继续留档。

需要更新 Mac 本机原生应用时仍遵守根 AGENTS 和现有安装脚本。具体平台检查点见[跨平台验证约定](development/开发与跨平台验证约定.md)。
