# Mac 原生客户端

本机应用固定为 `/Applications/BeefTV.app`，Apple Silicon（arm64）。在 Finder 的“应用程序”中双击 BeefTV 即可打开，无需先执行 `make dev`，也无需另开 Go/Vite/Node 服务。Node Agent、官方协议插件和本地媒体运行时随应用提供。

## 工作区与模型

直接双击应用时，默认数据根目录为 `~/Library/Application Support/BeefTV`；若之前在应用设置中迁移过存储，则以已选目录为准。它与浏览器日常开发目录 `.local/project-workbench-debug/daily` 分开，后者不会自动显示在原生版里。

首次进入独立工作区，可在正式设置中配置文本/图片渠道。文本沿用 DeepSeek，图片使用可用的非 Seedream 模型；此前真实验证的渠道标识为 `flux-3-image`，底层供应商与价格仍须核实。当前 Demo 不调用 Seedance，也不需要视频模型。凭证在应用设置里配置，不写进命令、文档或截图。

Mac 原生基础验证使用仓库忽略目录 `.local/project-workbench-debug/mac-native-20261021`。它是独立测试工作区；从仓库根目录打开该工作区可用：

```bash
open -a /Applications/BeefTV.app --args "--data-dir=$PWD/.local/project-workbench-debug/mac-native-20261021"
```

先保存并退出已有 BeefTV 窗口，再选择另一个数据目录。该命令只指定工作区，不提供模型配置，也不会自动生成内容。普通双击应用继续使用默认工作区。

## 更新本机应用

源码修改不会热更新已安装客户端。更新使用仓库唯一正式入口：

```bash
./scripts/update-local-beeftv-app.sh
```

需要 Go、Bun、精确 Node 24.15.0 arm64 和 Xcode Command Line Tools；构建按锁文件及固定版本准备依赖。若复用本仓库已准备的工具，在仓库根目录执行：

```bash
PATH="$PWD/.local/tools/bun-1.4.2/bun-darwin-aarch64:$PWD/.local/tools/node-v24.15.0-darwin-arm64/bin:/opt/homebrew/bin:$PATH" \
BEEFTV_NODE_RUNTIME="$PWD/.local/tools/node-v24.15.0-darwin-arm64" \
BUN_INSTALL_CACHE_DIR="$PWD/.local/cache/bun" \
GOCACHE="$PWD/.local/cache/go-build" \
GOMODCACHE="$PWD/.local/cache/go-mod" \
GOTOOLCHAIN=local BEEFTV_WAILS_PLATFORM=darwin/arm64 \
./scripts/update-local-beeftv-app.sh
```

脚本先完成发布检查、原生构建、资源打包及签名校验，再更新 `/Applications/BeefTV.app`；临时构建出的 `.app` 会清理，不保留第二份可用应用。若应用中有未保存内容，先保存并退出。首次构建需要下载并编译 Wails/媒体依赖，耗时长于后续构建。

浏览器开发仍用 `make dev`；安装版的运行结果、源码检查、真实模型和最终平台验收分别记录。Mac 原生启动/基础持久化不自动等于真实 Agent 双轮、完整 AT 或 Windows 验收通过。

本机首次安装与实际验证结果见[Mac 原生构建和基础验证](reports/MAC-NATIVE_20261021.md)。
