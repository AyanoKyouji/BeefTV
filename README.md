<p align="center">
  <img src="assets/yuntv-wordmark.svg" width="430" alt="YUNTV">
</p>

<p align="center"><strong>AI 媒体创作工作台 · 本地优先 · Agent 协作</strong></p>

YUNTV 是基于 [BeefTV](https://github.com/glanderness/BeefTV) 二次开发的 AI 媒体创作 Demo。在无限画布中组织文本、分镜、图片与视频，让用户和 Agent 共同编辑同一份项目内容。

- Agent 按指令创建和修改创作对象，读取最新编辑，按依赖顺序提交生成任务。
- 支持手动生成、参考图、素材复用、本地保存与恢复。
- 模型通过已有渠道和声明式协议接入；当前已验证 DeepSeek、FLUX 与 MiniMax H3 的部分实际流程。
- 日常使用 Mac 原生客户端，Windows 按阶段回归；完整验收状态见 [Demo 项目记录](docs/demo/README.md)。

## 开始使用

本机客户端为 `/Applications/YUNTV.app`，启动后添加自己的模型渠道即可创作。首次安装、更新与 Windows 构建见 [快速开始](QUICKSTART.md) 和 [Mac 客户端说明](docs/demo/development/Mac原生客户端.md)。

在仓库根目录开发：

```bash
make dev
make stop
```

更新已安装的 Mac 客户端：

```bash
./scripts/update-local-beeftv-app.sh
```

脚本会在新构建及签名校验通过后，将已有 BeefTV 安装更名为 YUNTV。现有工作区继续使用原数据目录，避免品牌调整影响项目、素材或凭证。详细品牌边界见 [YUNTV 品牌说明](docs/demo/development/YUNTV品牌说明.md)。

## 文档

- [功能清单](docs/content/docs/overview/features.mdx)
- [需求、执行计划与验收报告](docs/demo/README.md)
- [本机一键启动](docs/demo/development/本机一键启动.md)
- [参与开发](CONTRIBUTING.md)

## 来源与许可

本 Demo 基于 BeefTV 及其上游工作开发。原始许可证和版权声明保留于 [LICENSE](LICENSE) 与 [NOTICE](NOTICE)。YUNTV 是本 fork 的 Demo 名称，不代表上游项目或第三方模型服务商。
