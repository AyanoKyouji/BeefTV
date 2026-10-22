# YUNTV 本地桌面版快速开始

YUNTV 是本地优先的 AI 媒体创作工作台，无需登录。项目、素材、任务和模型配置保存在本机；生成时按所选渠道调用模型服务。

## 本机启动与更新

Mac 正式应用为 `/Applications/YUNTV.app`，在「应用程序」中双击 YUNTV 即可。已安装的 BeefTV 将由本仓库更新脚本更名，现有项目和模型配置继续使用。

```bash
./scripts/update-local-beeftv-app.sh
```

详细工具链与本机已准备环境的命令见 [Mac 客户端说明](docs/demo/development/Mac原生客户端.md)。不要从上游 BeefTV 发布页下载并覆盖 YUNTV；上游包不包含本 Demo 的修改。

## 构建

需要 Go、Bun、Node 及 Wails 所需的原生系统组件。Mac 构建入口仍为：

```bash
./scripts/build-beeftv-release.sh
```

构建的主程序与应用包使用 YUNTV 名称。本机安装统一通过上面的更新脚本，不保留第二份可用应用。

Windows x64 在 Windows 本机构建，需要 Go、Bun、Node 和 GCC：

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\build-beeftv-windows-release.ps1
```

输出主程序为 `backend/cmd/desktop/build/bin/YUNTV.exe`，需与 `agent-host`、`plugin-packages`、`cli` 等完整随包资源一起使用。品牌修改后的 Windows 原生运行需要另行验证。

## 浏览器开发

```bash
make dev
make status
make logs
make stop
```

详见 [一键启动说明](docs/demo/development/本机一键启动.md)。

## 数据与接入

为延续已有工作区，默认数据根目录保持兼容：

- macOS：`~/Library/Application Support/BeefTV`
- Windows：`%AppData%/BeefTV`

自定义存储位置沿用原设置。不要为更名手动移动或清空这些目录。

设置中的外部 Agent 连接使用随包 `cli/yuntv`（Windows 为 `cli/yuntv.exe`）；应用路径变更后，可在「YUNTV MCP」中重新复制连接配置。原有 `BEEFTV_*` 环境变量与 `.beeftv-plugin` 格式继续有效。
