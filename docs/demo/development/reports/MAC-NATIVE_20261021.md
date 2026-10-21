# Mac 原生客户端构建与基础验证

- 日期：2026-10-21（Asia/Shanghai）；用户要求改为先提供 Mac 客户端并在 Mac 测试。
- 构建源码：`a7b7c014f5247f0f11c7afb57685a2a4f19d1e78`，产品最近修复基线 `84f918c`；v1.7.26，darwin/arm64。
- 结果：Mac 原生构建/安装、随包资源/签名、宿主就绪及原生后端保存/受控终止后的离线恢复通过；GUI 窗口及操作由用户确认，自动化未读取成功。不是完整真实模型 E2E 或最终 AT PASS。
- 本轮零文本/图片/视频模型调用，没有业务源码修改。

## 1. 实际客户端

按仓库要求仅用 `scripts/update-local-beeftv-app.sh` 构建并更新 `/Applications/BeefTV.app`。当前为本机 Apple Silicon 应用，未制作额外 `.app` 副本；脚本结束后临时构建应用已清理。

| 内容 | 实际结果 |
|---|---|
| 主程序 SHA-256 | `ff418bfd97b4162ebe7f39bb421ca52dbe982de59a58f9380e018bbdb66025cb` |
| 最终 bundle | 15,554 个文件，合计 400,023,885 bytes；逐文件清单本机留存 |
| 签名 | 最终安装路径 `codesign --verify --deep --strict` 通过；本地 ad-hoc 签名，不是公证发布 |
| Node / SDK | 随包 Node 实际报告 darwin/arm64/24.15.0；四个官方 pi SDK 包均为 1.2.0 |
| 插件 | 86 个官方包，名称逐项对应当前源码 |
| 本地媒体 | 随包 ffprobe 8.0.1，manifest 摘要对应；固定源构建及系统依赖检查通过 |
| CLI | `Contents/MacOS/cli/beeftv` 存在，并通过正式鉴权实际读取原生测试画布 |

构建环境为 Go 1.27.1、Bun 1.4.2、精确 Node 24.15.0 和 Xcode Command Line Tools。构建下载固定 Wails/媒体及锁定依赖，不使用收费模型。

## 2. 构建门禁

没有跳过 `verify-beeftv-local-release.sh`：桌面路由隔离、schema/冷启动、Provider/SQLite 等选定 Go 检查、5 项前端合同、TypeScript/前端生产构建、仓库差异检查及默认大小门禁通过。web 为 101.81 MiB / 105 MiB；workspace 包在所选表达式下没有匹配测试，不能计为额外覆盖。

Wails 完成绑定、桌面前端与原生应用编译，正式脚本打包 Node/插件/媒体/CLI 后重新签名。媒体门禁两次 `TestBundledMediaMetadataWithoutSystemFFprobe` 与 `TestProbeLocalDoesNotFetchPlaylistURLs` 通过。没有为本项扩大到全仓库测试，也未重复计入历史 AT010 的专项结果。

## 3. 原生启动与业务恢复

测试数据独立存于 `.local/project-workbench-debug/mac-native-20261021`，从 `/private/tmp` 启动已安装主程序，动态后端端口和 PID 对应实际原生实例，不启动 Vite/另一个 Go server。机器上原有 daily 开发服务未停止或修改，原生实例使用自己的后端、数据和随包 Node。

首次测试 PID 60651，业务 ready 通过，随包宿主状态 `available=true`，加载 30 个操作。文本配置使用本机回环占位，不访问真实供应商。用户在本会话明确反馈“窗口和操作正常”；CUA 读取本应用路径、bundle ID 均超时，读取系统设置也被中止，因此没有自动 UI 操作/截图证据，不能写成自动化 GUI 验收通过。

后续通过该原生实例的正式本机业务接口，在专用画布 `MAC-NATIVE-BASE` 创建工作区项目、两段文本与三镜 Script，修改第二镜提示词，添加空图片节点并建立第二镜正式输出关系，再提交布局。所有写入使用既有鉴权/CAS 操作层，不直接写 SQLite，不使用 Agent 或生成接口。

最终测试画布 `mac-native-f363eb8d285d4607bec86aea265c19e2`，4 节点、3 镜、1 条分镜输出关系。图片节点为空占位，**没有图片产物或媒体导入验证**。过程、提示词、行/节点 ID、位置及正式行关联均记录在完整文档中。

受控 SIGTERM 终止仅本任务启动的进程组，禁止外网并允许本机回环后以新 PID 61345 冷启动。系统级公网连接探针确认 PermissionError，原生后端全文档即时读取与生成前 revision 10 完全一致，宿主与随包 CLI 可用。这是受控终止恢复，**未自动验证通过菜单正常退出**。

随后原生界面首次打开画布时补齐显示默认值（主题、背景、图片节点角色、面板高度及时间字段），产生 revision 11。原 `native-before/after` 严格比较正确报 FAIL，完整差异及原件保留；两段正文、三镜全字段、稳定 ID、节点位置及连线没有丢失。没有通过删除字段、忽略 revision 或过滤时间来将它改为 PASS。

以初始化完成后的 revision 11 另采新基准，再次离线冷启动 PID 61430，12 个连续一秒采样均为 11；新 before/after 全快照比较 PASS。全文档 SHA-256 为 `ec555e25d1e00d2289d152c3cda82700a5320c10befb9b702de0c824878aba70`。这轮保留全部字段，4 节点/3 镜/1 关系一致。

测试库 SQLite 完整性通过，Task/API 调用日志/assistant_turns/Asset/Resource 数均为 0，证明确未做生成或媒体导入。用户 GUI 回报、业务接口验证和自动快照三类证据分别记录，不把一类当作另一类。

## 4. 控制器问题与边界

- 初次辅助脚本尝试 text→script 连线得到 400，改用受支持的 script→image + storyboardRowId 正式输出；失败保留，不为无效测试关系改业务代码。
- 初次离线 profile 使用数值 loopback 地址，sandbox-exec 要求 localhost；它在启动应用前退出。改正后公网拒绝探针与两次离线原生启动成功，原失败日志保留。
- CLI 结果的首次辅助断言误读顶层字段，已按 `result.canvas/result.canvasId` 核对成功，不是产品读取失败。
- 普通沙箱中的本机 HTTP 读取因权限受限失败，后续在允许本机测试连接的执行环境验证；不把执行环境权限错误算客户端故障。

未做真实 DeepSeek/图片生成、原生文件选择/图片导入、媒体恢复、完整 Agent 双轮、全部异常与窗口交互自动化；历史 Mac Go/Vite 的真实结果继续保留，不能据此追加为本轮 Wails E2E。Windows 源码交接材料保留，按用户要求延后，未执行 Windows 原生构建/验收。

## 5. 交付状态

测试进程已结束，最终以 PID 61472 打开常规默认工作区，业务 ready 通过，没有断网 profile 或占位模型覆盖。默认目录与日常浏览器开发工作区分开，真实模型需在应用正式设置配置；测试目录/数据保留，不复制到用户默认库。

日常双击 `/Applications/BeefTV.app` 即可运行，使用与更新见[Mac 原生客户端说明](../Mac原生客户端.md)。本机证据见[索引](../evidence/README.md#20261021-mac-native)。后续可继续在此原生客户端补实际业务流程；阶段六/G2/G3 与最终平台验收未因安装成功而关闭。
