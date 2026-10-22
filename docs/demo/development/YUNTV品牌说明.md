# YUNTV 品牌说明

本 fork 的 Demo 展示名称为 **YUNTV**。标记为几何 Y 与播放三角，界面使用单色版本，桌面应用图标采用白色圆角底。

## 覆盖范围

- 首页与侧栏、画布品牌入口、Agent 面板、加载画面、页面标题与 favicon。
- 桌面窗口、Mac 应用名称及图标；Windows/Linux 的构建产物、安装器和更新包布局。
- 随包命令行 `yuntv` 与新建 MCP 连接的展示名称。
- 当前使用说明、默认外观及相关产品提示。

源图：`web/public/yuntv-mark.svg`、`assets/yuntv-wordmark.svg`、`assets/app-icon.svg`。`assets/app-icon.png` 是桌面构建使用的 1024×1024 图标。

## 兼容边界

Mac 唯一正式应用路径改为 `/Applications/YUNTV.app`。继续使用 `scripts/update-local-beeftv-app.sh` 更新；该脚本在新构建完成后将旧安装原位更名，保留唯一正式应用。

已有项目、素材、历史对话和模型配置不改名、不重写。默认工作区继续使用 `BeefTV` 数据目录；Mac bundle ID 保持既有值以复用 WebView 配置。`BEEFTV_*` 环境变量、插件协议 ID、`.beeftv-plugin` 扩展名、源码目录与构建脚本名称继续兼容。它们是技术标识，不是界面品牌。

使用旧应用绝对路径配置的外部 MCP 客户端，需要在「YUNTV MCP」重新复制配置。

原作者署名、许可证、历史报告与原项目来源保留。原项目的模型连接以第三方 **BeefAPI** 名称展示，不冒称 YUNTV 官方服务；侧栏源码指向当前 fork，并保留上游致谢入口。

更名不会自动证明完整业务验收通过。Mac 安装与界面检查、Windows/Linux 原生运行应分别记录；本次品牌验证不需要调用收费模型。
