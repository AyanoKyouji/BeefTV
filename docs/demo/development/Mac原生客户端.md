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

若应用中有未保存内容，先保存。脚本先退出旧客户端释放数据目录锁，再完成发布检查、原生构建、资源打包及签名校验，最后更新 `/Applications/BeefTV.app`；临时构建出的 `.app` 会清理，不保留第二份可用应用。首次构建需要下载并编译 Wails/媒体依赖，耗时长于后续构建。

后续本机更新可复用原应用中签名有效、固定版本和哈希一致的媒体组件，减少重复下载；媒体运行检查仍会执行。

浏览器开发仍用 `make dev`；安装版的运行结果、源码检查、真实模型和最终平台验收分别记录。Mac 原生启动/基础持久化不自动等于真实 Agent 双轮、完整 AT 或 Windows 验收通过。

本机首次安装与实际验证结果见[Mac 原生构建和基础验证](reports/MAC-NATIVE_20261021.md)。

2026-10-21 补充修复了切换数据目录后画布缓存与数据库不一致、Agent 读取对话返回 404 的问题，见[修复记录](reports/MAC-AGENT-CANVAS_20261021.md)。已有窗口仍显示旧错误时，更新并重新打开客户端，再次发送消息。

同日补充了当前中转的 H3 自动参考素材上传与 Predictions 协议，现有图片生成视频无需手填网址；接入规则见[说明](中转平台图生视频接入.md)，验证边界见[记录](reports/PREDICTIONS-H3_20261021.md)。

2026-10-22 在此原生客户端中补验真实基础 H3：现有图片自动上传、单次 5 秒视频生成、本地资源交付、画布回填与播放器显示通过，实际费用 0.30 USD。见[真实验证记录](reports/PREDICTIONS-H3-REAL_20261022.md)。

同日修复生成期间的取消入口：准备中即可点击方形取消按钮；迟到的创建回执会对原任务执行取消，编辑稿保留。已受理的上游请求仍可能计费，详见[取消修复记录](reports/GENERATION-CANCELLATION_20261022.md)。

同日进一步支持取消后在同一节点直接重新生成。修改提示词后点击生成即可；未知旧请求保存到“查看上次请求”，不再占用当前节点。原请求仍可能计费，旧结果不会覆盖新的请求。详见[同节点重新生成记录](reports/GENERATION-RESUBMIT_20261022.md)。

同日内置 Agent 改为按明确指令直接生成，按“首图 → 分镜 → 分镜图 → 视频”等依赖等待真实产物后继续，无需逐次点击确认；普通移动节点不再使生成方案失效。历史方案仅保留记录，在原对话发送“按刚才的完整要求继续”即可使用新流程。详见[直接生成记录](reports/AGENT-DIRECT-GENERATION_20261022.md)。
