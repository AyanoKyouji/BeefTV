# T401 — BeefTV 技术调研报告

调研日期：2026 年 10 月 19 日（北京时间）
状态：调研完成，结论待逐项讨论；尚未进入 T402。

## 一、初步结论

**BeefTV 值得继续作为 Demo 的优先基础候选。** Windows 桌面端、无限画布、结构化分镜、真实模型调用、本地项目和素材、持久异步任务均有实际代码，复用价值较高。但目前还不能认定它已经通过我们的核心 Demo 验收，也不能认定现有整包可以直接用于闭源商业分发。

最影响决策的四项发现是：

1. **Windows 路线成立。** 已有 Wails 桌面入口、本机构建、独立安装包脚本和正式发布附件；仍需在目标 Windows 环境完成完整业务验收。
2. **Agent 能创建和修改分镜，但读取“刚刚手改的最新状态”存在待核实窗口。** 后端读写和版本冲突保护已有；前端编辑延迟提交，普通聊天发送路径未见等待画布保存成功的屏障。这是静态推断的风险，尚未运行重现。
3. **Agent 出图目前需要用户确认。** 现有流程是提出生成方案 → 用户确认 → 真实生成 → 保存与绑定；如果 Demo 要求完全自动执行，存在明确交互差异。
4. **主项目 MIT 允许二次开发和商业使用，但随包媒体组件有 GPL 条件。** Windows 脚本实际捆绑声明为 GPL-3.0-or-later 的原生 FFmpeg；前端第三方清单也将 FFmpeg.wasm core 标为 GPL。商业分发应以实际产物和组件边界继续核查，不能只读取根 LICENSE。

以下“符合程度”评价的是源码对需求的覆盖程度，**不代表本次端到端运行验收已经通过**。

## 二、调研版本、方法与验证边界

| 项目 | 本次依据 |
|---|---|
| 仓库 | [glanderness/BeefTV](https://github.com/glanderness/BeefTV) |
| 固定源码 | [2327ee2d80282b10dd8bef0f26b48990d46f5c3b][REV]，main 在本次取样时的 HEAD |
| 提交时间 | 2026-10-19 16:41:51，+08:00 |
| 提交主题 | Merge pull request #196 from glanderness/codex/cos-update-migration-20261019 |
| 当时最新正式发行版 | [v1.7.26][REL]，2026-10-17 20:27:22 发布（北京时间） |
| 发行版对应提交 | ddaf5f9abc64b16567c28ea5399d8f2069c47832；与本次源码 HEAD 不同 |
| 检查方法 | 下载只读源码副本；阅读 README、快速开始、许可与归属、依赖和锁文件、运行入口、构建/安装脚本、关键业务源码、相邻测试及上游 CI 记录 |
| 本次没有执行 | 安装依赖、启动应用、本地构建、本地测试、Windows 真机操作、真实付费模型请求、发行二进制解包审计 |

本报告标记含义：**事实**是源码、配置或已查询上游记录直接支持的内容；**推断**是据此评估的适配难度或风险；**未验证**是必须通过运行、实际资源或更完整许可审计才能确定的事项。下文所有源码链接固定到上述 SHA，避免 main 后续更新导致证据漂移。

已查询当前 SHA 的 [Quality checks 记录][CI]：Backend checks、Web checks、Windows storage migration、Release publisher checks 均成功；手动触发的 SQLite/runtime 平台矩阵、已发布 Windows 升级回滚任务在该次运行中被跳过。**这些是上游运行结果，不是本次重新执行的结果，也不覆盖真实模型和完整 Windows 创作流程。**

## 三、项目实际技术结构

| 部分 | 实际技术与职责 | 证据 |
|---|---|---|
| 创作界面 | React 19、TypeScript、Vite、Ant Design、Zustand；画布交互、编辑器状态和模型配置 | [web/package.json][S01] |
| 本地业务后端 | Go 1.25、Gin、GORM、SQLite；项目、资源、任务、模型协议、共享操作层 | [backend/go.mod][S02]、[桌面后端启动][S03] |
| 桌面容器 | Wails v2.16.0；嵌入前端产物，启动本地 Go runtime，默认监听回环随机端口 | [main.go][S04]、[app.go][S03]、[wails.json][S05] |
| 内置 Agent | 独立 Node 宿主；pi-coding-agent / pi-durable / pi-ai / chord 固定 1.2.0；Go 管理轮次、权限与业务操作 | [agent-host/package.json][S06]、[模型初始化][S54]、[会话执行][S07] |
| 媒体处理 | 浏览器 FFmpeg.wasm，以及桌面随包原生 FFmpeg/FFprobe；视频播放兼容副本 | [前端调用][S08]、[Windows 媒体打包][S09] |

主要数据流为：

~~~mermaid
flowchart LR
    UI[画布与分镜编辑] -->|保存文档和版本| GO[本地 Go 业务操作层]
    AG[Node Agent 宿主] -->|读取与受控修改| GO
    GO --> DB[(SQLite 项目和任务)]
    GO --> FS[本地资源文件]
    GO --> MODEL[配置的文本与图片模型]
    MODEL -->|任务产物| GO
    GO -->|状态和素材引用| UI
~~~

**推断：**它已是一套多运行时创作工作台。采用它能省去大量基础开发，但需要理解前端编辑态、缓存、后端文档版本、Agent 操作和任务交付之间的合同；改造难点主要在集成与一致性。

旧内置 Agent 调度代码与当前助手不能混为一谈：旧 cloud_agent 等任务已被当前 worker 拒绝；当前有效入口是 /api/assistant/* 和 pi Durable 宿主。[旧路径退出证据][S10]、[当前聊天执行][S07]

## 四、与已确认 Demo 范围逐项对照

难度为相对评估：低＝沿现有能力配置、收敛或局部适配；中＝跨若干模块联调；高＝可能触及核心数据或运行边界。不是工期承诺。

| Demo 要求 | 符合程度与源码事实 | 改造难点和风险 | 初步难度 |
|---|---|---|---|
| Windows 客户端 | **高**。Wails 有 Windows 选项，原生 amd64 构建与 NSIS 安装路径；v1.7.26 已有 setup.exe 和 ZIP | 工具链、WebView2、Node 和媒体侧文件必须齐全；当前 HEAD 与发行版不同；目标机业务流程未测 | 中 |
| 无限画布 | **高**。世界坐标/视口变换、缩放平移、可见节点与 SVG 连线实际渲染 | “无限”表示可移动扩展的工作空间，不代表任意节点数都流畅；Windows WebView 下大画布性能未测 | 低—中 |
| 文本、分镜、图片节点与关系 | **高，但需确认数据语义**。Text/Image/Script 内建；StoryboardRow 有镜号、时长、台词、图像提示词和产物节点 ID；边有分镜输出关系 | 分镜主要是 Script 节点中的结构化行；若要求每镜头都是独立节点，要适配 UI、关系和 Agent 工具 | 低；改变语义则中—高 |
| Agent 创建分镜 | **高**。节点创建、连线、分镜行追加/更新/删除都通过真实操作层写文档 | 模型能否稳定组织镜头、补足图片节点和关联仍需实调；部分角色/资产绑定不在行级写白名单 | 中 |
| Agent 读用户手改后的最新状态 | **部分满足，是重点风险**。每次 canvas.get 读后端真实文档，有 revision 冲突检查和外部变更合并 | UI 自动提交有 500ms 延迟；普通聊天发送未见画布同步屏障；已保存最新状态与屏幕即时状态有区别 | 中，具体修补量待重现 |
| 真实 LLM 与图片生成 | **高**。LLM/图片有真实认证 HTTP 请求，非 mock；Agent 有真实 SDK provider/session | Key、模型 ID、协议、供应商参数与网络均待确认；普通文本生成和 Agent 是两条调用栈，需分别验收 | 低—中 |
| Agent 触发生成并回填 | **有条件满足**。现有提案、用户确认、生成、保存和任务绑定链路 | 当前不会由 Agent 直接无人确认扣费；分镜行到图片节点、结果回填是否符合指定演示流程待实测 | 中 |
| 异步任务与素材保存 | **高**。数据库任务、租约/进度/上游请求 ID、产物下载、资源落盘、资产/画布绑定都有实现 | 生成完成、下载完成、素材入库、画布绑定是不同阶段；强退恢复和异常磁盘情形待测 | 中 |
| 离线本地项目 | **高，具备本地架构基础**。SQLite 文档、资源目录、缓存降级、项目素材 ZIP 迁移 | 必须确认保存到本地后端且素材已落盘；裸外链不保证离线；项目 ZIP 不等于完整工作区及 Agent 会话备份 | 低—中 |
| 可选视频导入与预览 | **高，需约束格式**。视频文件识别、上传、播放器和兼容副本转码已有 | 导入成功不等于任意编码可播放；HEVC/MKV/大文件受 WebView、转码、磁盘和 FFmpeg 分发条件影响 | 普通 MP4 低；全格式中—高 |

对应证据：Windows [构建入口][S11]、[安装器][S12]；画布 [视口控制][S13]、[节点连线渲染][S14]；数据 [类型定义][S15]、[分镜编辑][S16]；Agent [操作注册][S17]、[分镜写入][S18]；同步 [自动保存][S19]、[聊天发送][S20]；模型 [文本][S21]、[图片][S22]；任务 [数据结构][S23]、[交付][S24]；本地 [资源文件保存][S25]、[项目导出][S26]；视频 [文件识别][S27]、[播放兼容处理][S28]。

## 五、重点核查：Agent 与画布是否共享最新状态

### 5.1 已经成立的部分

**事实：**Agent 工具不是只在对话内维护一份虚拟项目。canvas.get 调用 Domain.UserCanvasProject；节点和分镜修改走 Go 业务层，携带 expectedRevision，以版本相符才提交的方式避免盲写覆盖。[读文档][S29]、[操作注册][S17]

分镜行写入有字段白名单和校验。现有单次追加上限为 32 行，时长范围 1—60 秒；行 ID 和镜号由服务端分配。角色/资产引用和产物节点绑定不属于该行级写入白名单，不能据此认定 Agent 已能任意编排所有分镜关系。[storyboard_writes.go，第 17—61 行及后续实现][S18]

前端接收外部 Agent 变更时会合并字段；相同字段冲突保留本地编辑并暂停提交，防止旧画布静默覆盖新内容。[编辑器外部变更处理，第 273—303 行][S30]

模型读视图还有分页和长字段补读：上限 40,000 字节、50 项，后续页核对 revision。因此大项目并非一次全部塞进模型上下文，模型是否正确补读仍影响理解。[canvas-read-view.mjs，第 1—49 行][S31]

### 5.2 不能直接判定完全满足的部分

手动修改后的路径是：

1. React 编辑态更新，再更新本地 store。
2. scheduleLocalCanvasBackendSync 等待 500ms 后提交后端。
3. Agent 从后端文档读取内容。

**事实：**普通聊天的 send 只明确等待模型配置保存、助手可用和历史载入；随后发送 canvasId、消息、选中对象和引用，没有把屏幕上完整画布快照随请求提交，也未见等待画布保存的明确调用。[前端自动保存][S19]、[普通发送，第 372—389 行][S20]、[请求正文，第 425—436 行][S32]

**推断：**手改后立即发送、保存较慢或保存失败时，Agent 可能读到旧的后端状态。CAS 能拒绝已提交版本之间的冲突，不能自动补上尚未提交的 UI 内容。实际是否出现及可复现频率，本次没有运行证明；也未发现系统强制每轮必须先重新读取相关画布的保证，模型可能沿用历史理解。

这意味着本项应判“部分满足、需专项验证”，而不是“完全缺失”或“已完全解决”。

### 5.3 生成确认具有更强校验，但不能替代聊天同步

**事实：**canvas.generation.propose 只提出图片/视频生成，限制 1—8 个节点，并返回来源版本；真正执行前由 UI 最多等待 3 秒保存完成，核对画布版本、模型配置版本和内容快照。提案过期会被拒绝。[提案注册与校验][S17]、[确认前快照检查，第 85—127 行][S33]

这道校验属于付费提案执行阶段，不能据此反推普通聊天发送时也已读取最新手改。若“Agent 调用模型”允许一次用户确认，现有交互具有复用基础；如果需要一句话后完全自动运行，需要在后续阶段明确需求差异。

## 六、模型、任务、素材与离线保存的核查

**真实模型调用：**普通文本任务路由到 Responses、Chat Completions 或 Claude Messages；图片实现有 /images/generations、参考图/蒙版 /images/edits 和 Gemini 图像路径。底层构建认证请求并执行真实 HTTP client.Do。Agent 则使用独立 Node 模型宿主，支持 openai-completions、openai-responses、anthropic-messages。[文本][S21]、[图片][S22]、[HTTP 派发][S34]、[Agent 协议][S35]

**未验证：**没有使用用户的真实 Key、额度或服务地址，无法确认某一模型当下可用、参数兼容或能稳定完成中文分镜与图片生成。不能将“支持 OpenAI 兼容”理解为所有兼容服务均已验证。

**异步与交付：**Task 保存稳定操作身份、上游请求 ID、状态、阶段、租约、结果和产物；worker 取得任务后执行生成，结果还要下载/写入本地资源并形成资产和输出绑定。交付器能继续扫描持久任务恢复未完成交付。[任务模型][S23]、[worker runtime][S36]、[交付器][S24]

恢复路径专门区分“查询原供应商任务”和“重新提交生成”，有降低重复付费风险的设计；本次没有验证所有供应商和异常窗口，不能保证任何故障都绝不会重复计费。[provider_task_recovery.go][S37]

**本地项目：**桌面端启动本地 Go runtime 与 SQLite，默认数据根来自用户配置目录下 BeefTV，并可通过存储位置设置迁移。画布文档保存 payload JSON 和 revision；IndexedDB 是缓存/后端不可用时的降级，不应将缓存成功当作 SQLite 保存成功。[桌面启动][S03]、[数据位置][S38]、[文档模型][S39]、[缓存与提交分层][S40]

**素材落盘：**本地资源写入 dataDir/resources，采用临时文件、同步、重命名发布，之后才可以将资源标为就绪。画布保存引用，不应仅保存临时 object URL。[file_store.go，第 12—20、67—114 行][S25]

**迁移边界：**项目 ZIP 包含 projects.json 和收集到的媒体字节，缺失媒体会拒绝导出；收集器按合法 storageKey 递归找文件。裸远程 URL 不会因此自动变成离线素材。项目 ZIP 也不等于工作区数据库、模型凭据、全部任务和 Agent 会话的完整备份。[canvas-export.ts，第 23—47、97—111、246—250 行][S26]

**离线结论（推断）：**在本地 runtime 正常、项目提交完成、媒体已落盘时，离线编辑和读取已有素材在架构上成立。配置外部模型仍需网络；已有网络外链或未下载产物也不属于离线保证。

**视频：**MP4/MOV/MKV/WebM/AVI 等有识别入口，源码明确“能否解码不决定能否导入”；预览采用播放器及本地兼容副本服务。原生转码通过独立 FFmpeg 进程执行，并使用 libx264 生成 H.264 副本。[导入][S27]、[兼容服务][S28]、[转码进程][S41]。可选 Demo 宜先限定明确的 MP4 编码组合；尚未实测 Windows 的 H.264/HEVC/MKV、大文件和进度体验。

## 七、运行、构建与 Windows 客户端可行性

### 7.1 源码与发布证据

Windows 已超出理论可行性：

- Wails 入口有 Windows 配置，嵌入 Vite 产物，启动本地后端。[main.go][S04]、[wails.json][S05]
- 本机构建脚本明确使用 windows/amd64 和 -webview2 download。[构建参数，第 402—416 行][S11]
- 独立 Python/NSIS 流程生成安装器；构建 EXE 的脚本末尾说“不产生 NSIS”仅指该步骤，不能据此断言整个仓库没有安装包。[package-desktop-installer.py，第 37—44 行][S12]
- 安装器工作流配置 windows-2022，安装编译器、选择 Node、构建并运行安装检查。[desktop-installers.yml，第 41—124 行][S42]
- [v1.7.26 正式附件][REL]确有 BeefTV-v1.7.26-windows-amd64-setup.exe（约 152 MB，十进制）和 ZIP（约 219 MB）。存在发布包不等于本次已验证包内功能与当前 main 一致。

### 7.2 实际前提

| 前提 | 依据与影响 |
|---|---|
| Windows 本机 amd64 | 仓库当前正式 Windows 目标；脚本拒绝其他 OS。没有据此确认 Windows ARM64 原生产物 |
| Go 1.25 + CGO/GCC/binutils | SQLite 使用 go-sqlite3；需兼容工具链，不能只装 Go |
| Bun | 前端和 Agent 依赖按锁文件安装；web 声明 bun@1.3.9，打包 CI 采用 1.4.2，复现时应沿选定入口及对应 CI 环境 |
| Node 24.15.0 运行时 | 必须通过 BEEFTV_NODE_RUNTIME 指定待捆绑目录；校验器严格检查平台、架构和版本，不能只依赖用户的全局 Node |
| WebView2 | Wails Windows 运行需要；缺失时下载路径意味着首次完全断网安装还需单独准备 |
| NSIS + Python | 生成 setup.exe 的额外工具；EXE 编译与安装器封装是两步 |
| sidecar 文件 | plugin-packages、agent-host、随包 Node、media-runtime 和 CLI 需要随目录一起分发，单独复制 BeefTV.exe 不足以代表完整功能包 |

证据：[QUICKSTART，第 15—33 行][S43]、[Windows 构建脚本][S11]、[Node 校验与打包][S44]、[安装器 CI][S42]；WebView2 前提亦与 [Wails 官方说明](https://wails.io/docs/gettingstarted/installation/)一致。

快速开始没有完整列出当前 Node/Agent 打包前提，实际复现应同时读脚本。以下仅记录支持的入口，**本次未执行**：

~~~powershell
# 先准备符合版本的平台工具链，并设置 BEEFTV_NODE_RUNTIME。
# 它指向含 node.exe 的 Node 24.15.0 Windows x64 目录。
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\build-beeftv-windows-release.ps1

# EXE 与 sidecar 构建完成后，再封装安装器。
python scripts/package-desktop-installer.py --platform windows-amd64
~~~

输出主程序为 backend/cmd/desktop/build/bin/BeefTV.exe；安装器输出到 dist。前端普通 build 执行 TypeScript 检查后再 Vite 构建，但 build:desktop 只执行 Vite，不能把桌面打包成功等同于类型检查通过；类型检查在上游质量工作流中另行执行。[package.json，第 6—17 行][S01]、[质量工作流][S45]

本地开发可分别运行 Go server 与 Bun/Vite，并为后端显式指定隔离的数据目录；生产桌面应用不要求用户另开服务器。仓库也有 Docker/网页路径，但不能拿网页运行替代 Windows 桌面验收。[开发约定，第 7 节][S46]、[桌面组合根][S03]

**推断：**Windows 技术路线可继续评估，无需先假定要换 Electron/Tauri。实际测试环境仍是必须补齐的资源条件；若缺少 Windows 机器或虚拟机，当前 macOS 环境不足以作出验收通过结论。

## 八、许可证、二次开发与商业分发

### 8.1 主项目许可与来源

**事实：**根 LICENSE 是 MIT，包含 BeefTV、basketikun 和 ddcat 的版权声明，允许使用、修改、合并、发布、分发、再许可和销售，要求保留版权与许可声明。[LICENSE，第 1—23 行][S47]

NOTICE 记载源自 basketikun/infinite-canvas v0.5.0，以及上游后续转为 MIT 的提交。已额外打开该 [上游改许可提交](https://github.com/basketikun/infinite-canvas/commit/890ba95858bbb13496d23978003716656109abb2)，可以核实上游确实公开做过 MIT 迁移。[NOTICE，第 17—31 行][S48]

**判断：**就主项目及该公开来源声明而言，有支持二次开发和商业使用的明确许可依据。MIT 本身不强制公开自有改动；但它不替代第三方许可，也不自动证明所有历史贡献及资产权属均已完成审计。本次没有逐提交审计全部版权来源。

### 8.2 两条 FFmpeg 路径必须分别看

| 组件 | 已核实事实 | 商业分发含义 |
|---|---|---|
| 浏览器 FFmpeg.wasm core | web/package.json 固定 @ffmpeg/core 0.12.10；项目 THIRD_PARTY_NOTICES 将其列为 GPL-2.0-or-later，明确要求随包构建履行 GPL 声明和源码分发要求；画布/时间线有实际 core/wasm 引入 | 必须按实际安装包及构建配置核实其许可和源码对应关系，不能被外层 JS 包或根 MIT 覆盖 |
| Windows 原生 FFmpeg/FFprobe | 打包脚本下载 GyanD 8.0.1 essentials、校验 SHA，复制 EXE、LICENSE、README；manifest 明确标 GPL-3.0-or-later；Windows 正式构建直接调用该脚本 | 已有实际随包路径，不能只检查 npm 依赖；需要对应构建的完整源代码与适用组件声明等合规依据 |

源码证据：[THIRD_PARTY_NOTICES，第 16、26—33 行][S49]、[前端 core 引入][S08]、[原生 FFmpeg 打包，第 9—45 行][S09]、[正式构建调用，第 438—442 行][S11]。

另有一个需要精确处理的差异：本次打开 ffmpeg.wasm 的 v0.12.10 Git 标签下 core/package.json，页面内容仍显示较早包版本和 MIT 字段，不能据此替代 npm 0.12.10 发布包及其编译进核心的 FFmpeg/外部库许可。**本次未取得已安装 core 包及实际二进制的完整许可档案**，因此浏览器 core 的具体分发义务保留为待确认；项目自己的 GPL 声明已足以否定“全包只需遵守 MIT”的判断。[上游该标签文件](https://github.com/ffmpegwasm/ffmpeg.wasm/blob/v0.12.10/packages/core/package.json)

FFmpeg 官方也明确：是否启用 GPL 部件会改变 FFmpeg 构建的许可条件，必须核对实际配置。[FFmpeg 官方许可说明](https://ffmpeg.org/legal.html)

### 8.3 不能作出的两种过度结论

不能说“用了 GPL，所以不能商业使用”。GPL 可以商业分发，关键是遵守其条件。也不能只因随包一个独立 FFmpeg EXE，就直接判定整个 BeefTV 或所有自有代码必然都要 GPL 开源；程序间独立性、链接/通信方式与组合边界会影响判断。GPLv3 第 5 节区分独立作品的集合，第 6 节规定二进制分发对应源码的提供方式。[FFmpeg 随附 GPLv3 原文](https://raw.githubusercontent.com/FFmpeg/FFmpeg/n8.0.1/COPYING.GPLv3)

**事实：**已检查的视频兼容路径通过独立进程和文件调用原生 FFmpeg；浏览器 WASM 则是另一条集成路径。[transcode.go，第 25—42 行][S41]

**判断：**“可以二次开发”有较强许可依据；“现有产物可以直接闭源商业分发”目前证据不足。商业发布前需要以实际要分发的组件、版本、二进制配置和对应源码为单位完成许可审查，不能把这个问题推迟为只改产品名称。

### 8.4 归属材料和打包完整性缺口

THIRD_PARTY_NOTICES 已列字体 OFL、MediaPipe Apache、部分展示媒体 CC BY 4.0 等条件；其 Vite 构建会移除已退场 welcome 目录，所以源仓库中的素材不一定全部进入应用。[第三方资产清单][S49]、[Vite 产物裁剪，第 15—30 行][S50]

**事实/风险：**当前第三方清单未覆盖现版新增的原生 FFmpeg、Node 和 pi/chord 运行时全貌；Agent 打包器复制 Node 可执行文件与生产依赖，未见汇总 Node 自身许可与所有传递依赖声明的专门步骤。Windows 主要打包链也未见统一复制根 LICENSE/NOTICE/THIRD_PARTY_NOTICES 的步骤。以上是脚本层面的覆盖缺口，**不能代替实际发行二进制审计，更不能据此断言上游违法**。[清单][S49]、[Agent 打包器，第 36—60 行][S44]、[Windows 构建][S11]

此外，模型供应商服务条款、生成素材使用条件及商标标识不由 MIT 授予。Demo 不做正式授权系统，并不取消二次分发时的版权声明义务。

## 九、主要风险与尚未验证事项

| 风险 | 等级 | 已有依据 | 对 Demo 的影响 |
|---|---|---|---|
| UI 最新手改尚未提交，Agent 读取旧后端状态 | 高 | 500ms 自动保存与普通聊天发送路径之间未见同步屏障 | 直接影响核心验证目标；需要辨识字段、立即发送和保存失败场景验证 |
| 真实模型资源与协议未实调 | 高 | 真实代码存在，但本次无 Key/模型调用结果 | 不能确认真实 LLM→图片→落盘闭环或供应商稳定性 |
| 商业分发许可与归属材料未闭合 | 高（商业分发） | 原生 GPL FFmpeg 随包，WASM 声明及运行时清单待核对 | 不阻止继续技术调研，但不能直接承诺原样闭源商用交付 |
| Windows 实机与发布版本差异 | 中—高 | 发布 tag 与本次 HEAD 不同；本次无目标机验收 | 需要固定实际采用的提交/发行包，再测安装和业务闭环 |
| 多层状态与异步交付复杂度 | 中—高 | 编辑态、缓存、journal、SQLite、Agent revision、task delivery 并存 | 绕开现有操作合同可能造成覆盖、悬空素材和重复提交 |
| 分镜语义或自动化程度与预期不同 | 中 | Script 行结构；付费生成需用户确认 | 应先明确可接受交互，再估改造，不能默认为全自动镜头节点体系 |
| 视频格式与大文件 | 中（可选范围） | 解码与导入分离，兼容副本依赖媒体运行时 | 可限定普通 MP4，避免可选功能扩成完整视频系统 |

本次尚未验证：Windows 安装/启动/中文路径/权限及 WebView2 缺失；真实模型请求、中文分镜质量与工具调用成功率；手改后立即继续、并发同字段修改与冲突处理；强退和断网恢复、不重复提交；素材完整落盘、重启离线打开、ZIP 异机恢复；实际 Windows 发行包的完整许可与对应源码材料。

仓库中可见重启资源恢复、分镜 revision 冲突、项目导入回滚、媒体路径等相邻测试。它们说明项目有相应验证设计，但测试文件存在不等于本次实测成功；部分前端合同测试通过源码文本断言，也不能等价为完整 UI E2E。[本地 runtime 重开测试][S51]、[分镜写入测试][S52]、[归档恢复测试][S53]

## 十、是否值得继续与本阶段收口

**初步建议：保留 BeefTV 为优先候选，值得在确认 T401 后进入 T402 的复用路线评估。** 当前证据不支持因缺少画布、本地项目或 Agent 而立刻从零重写；这些基础已经存在。更值得先判断的是：能否以可控修改补齐最新状态一致性，并在 Windows 上用实际可用模型证明核心链路。

这个建议有条件：

- 接受沿现有 Script/StoryboardRow 数据语义评估，或明确承担改变语义的成本。
- 将 Agent 生成前的用户确认视为待确认的产品交互差异。
- 在商业分发结论中保留 FFmpeg 与完整运行时许可审查条件。
- 后续固定实际验证版本，分别记录源码能力、CI 证据和真实业务验收结果。

最有区分力的后续验证样例是：创建三行分镜 → 用户手改一行独特内容 → 立即要求 Agent 复述该改动并继续 → 提出并确认图片生成 → 实际模型返回 → 素材落盘并关联画布 → 关闭应用、断网重开。**这里只定义尚缺的证据，没有在 T401 执行或实现。**

T401 的报告已完成，但不自动标记“正式通过”。接下来按用户要求逐项讨论与确认；建议先讨论许可证与商业分发边界，再确认最新状态一致性判断及基础项目初步结论。确认前不进入 T402，不改仓库、不实现功能。

[REV]: https://github.com/glanderness/BeefTV/commit/2327ee2d80282b10dd8bef0f26b48990d46f5c3b
[REL]: https://github.com/glanderness/BeefTV/releases/tag/v1.7.26
[CI]: https://github.com/glanderness/BeefTV/actions/runs/39224613490
[S01]: https://github.com/glanderness/BeefTV/blob/2327ee2d80282b10dd8bef0f26b48990d46f5c3b/web/package.json#L6-L115
[S02]: https://github.com/glanderness/BeefTV/blob/2327ee2d80282b10dd8bef0f26b48990d46f5c3b/backend/go.mod#L1-L25
[S03]: https://github.com/glanderness/BeefTV/blob/2327ee2d80282b10dd8bef0f26b48990d46f5c3b/backend/cmd/desktop/app.go#L82-L103
[S04]: https://github.com/glanderness/BeefTV/blob/2327ee2d80282b10dd8bef0f26b48990d46f5c3b/backend/cmd/desktop/main.go#L50-L85
[S05]: https://github.com/glanderness/BeefTV/blob/2327ee2d80282b10dd8bef0f26b48990d46f5c3b/backend/cmd/desktop/wails.json#L1-L15
[S06]: https://github.com/glanderness/BeefTV/blob/2327ee2d80282b10dd8bef0f26b48990d46f5c3b/agent-host/package.json#L6-L21
[S07]: https://github.com/glanderness/BeefTV/blob/2327ee2d80282b10dd8bef0f26b48990d46f5c3b/agent-host/server.mjs#L454-L486
[S08]: https://github.com/glanderness/BeefTV/blob/2327ee2d80282b10dd8bef0f26b48990d46f5c3b/web/src/lib/canvas/canvas-ffmpeg-session.ts#L35-L60
[S09]: https://github.com/glanderness/BeefTV/blob/2327ee2d80282b10dd8bef0f26b48990d46f5c3b/scripts/package-media-runtime-windows.ps1#L9-L45
[S10]: https://github.com/glanderness/BeefTV/blob/2327ee2d80282b10dd8bef0f26b48990d46f5c3b/backend/internal/app/task_worker.go#L40-L73
[S11]: https://github.com/glanderness/BeefTV/blob/2327ee2d80282b10dd8bef0f26b48990d46f5c3b/scripts/build-beeftv-windows-release.ps1#L393-L470
[S12]: https://github.com/glanderness/BeefTV/blob/2327ee2d80282b10dd8bef0f26b48990d46f5c3b/scripts/package-desktop-installer.py#L19-L44
[S13]: https://github.com/glanderness/BeefTV/blob/2327ee2d80282b10dd8bef0f26b48990d46f5c3b/web/src/pages/canvas/use-canvas-viewport-controller.ts#L43-L165
[S14]: https://github.com/glanderness/BeefTV/blob/2327ee2d80282b10dd8bef0f26b48990d46f5c3b/web/src/pages/canvas/canvas-project-world-layers.tsx#L159-L238
[S15]: https://github.com/glanderness/BeefTV/blob/2327ee2d80282b10dd8bef0f26b48990d46f5c3b/web/src/types/canvas.ts#L108-L145
[S16]: https://github.com/glanderness/BeefTV/blob/2327ee2d80282b10dd8bef0f26b48990d46f5c3b/web/src/pages/canvas/use-canvas-storyboard.ts#L95-L147
[S17]: https://github.com/glanderness/BeefTV/blob/2327ee2d80282b10dd8bef0f26b48990d46f5c3b/backend/internal/operations/ops.go#L15-L156
[S18]: https://github.com/glanderness/BeefTV/blob/2327ee2d80282b10dd8bef0f26b48990d46f5c3b/backend/internal/canvas/storyboard_writes.go#L17-L164
[S19]: https://github.com/glanderness/BeefTV/blob/2327ee2d80282b10dd8bef0f26b48990d46f5c3b/web/src/services/local-workspace-repository.ts#L729-L742
[S20]: https://github.com/glanderness/BeefTV/blob/2327ee2d80282b10dd8bef0f26b48990d46f5c3b/web/src/pages/canvas/use-canvas-assistant.ts#L324-L389
[S21]: https://github.com/glanderness/BeefTV/blob/2327ee2d80282b10dd8bef0f26b48990d46f5c3b/backend/internal/generation/text.go#L719-L815
[S22]: https://github.com/glanderness/BeefTV/blob/2327ee2d80282b10dd8bef0f26b48990d46f5c3b/backend/internal/generation/image.go#L23-L178
[S23]: https://github.com/glanderness/BeefTV/blob/2327ee2d80282b10dd8bef0f26b48990d46f5c3b/backend/internal/model/models_task.go#L5-L53
[S24]: https://github.com/glanderness/BeefTV/blob/2327ee2d80282b10dd8bef0f26b48990d46f5c3b/backend/internal/taskdelivery/deliver.go#L29-L150
[S25]: https://github.com/glanderness/BeefTV/blob/2327ee2d80282b10dd8bef0f26b48990d46f5c3b/backend/internal/asset/file_store.go#L12-L114
[S26]: https://github.com/glanderness/BeefTV/blob/2327ee2d80282b10dd8bef0f26b48990d46f5c3b/web/src/lib/canvas/canvas-export.ts#L23-L250
[S27]: https://github.com/glanderness/BeefTV/blob/2327ee2d80282b10dd8bef0f26b48990d46f5c3b/web/src/lib/canvas/canvas-file-upload.ts#L5-L34
[S28]: https://github.com/glanderness/BeefTV/blob/2327ee2d80282b10dd8bef0f26b48990d46f5c3b/backend/internal/playback/service.go#L77-L191
[S29]: https://github.com/glanderness/BeefTV/blob/2327ee2d80282b10dd8bef0f26b48990d46f5c3b/backend/internal/operations/ops.go#L204-L222
[S30]: https://github.com/glanderness/BeefTV/blob/2327ee2d80282b10dd8bef0f26b48990d46f5c3b/web/src/pages/canvas/use-canvas-project-lifecycle.ts#L273-L330
[S31]: https://github.com/glanderness/BeefTV/blob/2327ee2d80282b10dd8bef0f26b48990d46f5c3b/agent-host/canvas-read-view.mjs#L1-L49
[S32]: https://github.com/glanderness/BeefTV/blob/2327ee2d80282b10dd8bef0f26b48990d46f5c3b/web/src/services/api/agent-assistant.ts#L410-L436
[S33]: https://github.com/glanderness/BeefTV/blob/2327ee2d80282b10dd8bef0f26b48990d46f5c3b/web/src/pages/canvas/canvas-assistant-proposal-snapshot.ts#L85-L127
[S34]: https://github.com/glanderness/BeefTV/blob/2327ee2d80282b10dd8bef0f26b48990d46f5c3b/backend/internal/generation/http.go#L390-L405
[S35]: https://github.com/glanderness/BeefTV/blob/2327ee2d80282b10dd8bef0f26b48990d46f5c3b/agent-host/canvas-turn.mjs#L1-L7
[S36]: https://github.com/glanderness/BeefTV/blob/2327ee2d80282b10dd8bef0f26b48990d46f5c3b/backend/internal/taskruntime/runtime.go#L17-L130
[S37]: https://github.com/glanderness/BeefTV/blob/2327ee2d80282b10dd8bef0f26b48990d46f5c3b/backend/internal/app/provider_task_recovery.go#L160-L188
[S38]: https://github.com/glanderness/BeefTV/blob/2327ee2d80282b10dd8bef0f26b48990d46f5c3b/backend/internal/desktopstorage/location.go#L20-L48
[S39]: https://github.com/glanderness/BeefTV/blob/2327ee2d80282b10dd8bef0f26b48990d46f5c3b/backend/internal/model/models_project.go#L374-L384
[S40]: https://github.com/glanderness/BeefTV/blob/2327ee2d80282b10dd8bef0f26b48990d46f5c3b/web/src/services/local-workspace-repository.ts#L369-L412
[S41]: https://github.com/glanderness/BeefTV/blob/2327ee2d80282b10dd8bef0f26b48990d46f5c3b/backend/internal/playback/transcode.go#L25-L42
[S42]: https://github.com/glanderness/BeefTV/blob/2327ee2d80282b10dd8bef0f26b48990d46f5c3b/.github/workflows/desktop-installers.yml#L41-L124
[S43]: https://github.com/glanderness/BeefTV/blob/2327ee2d80282b10dd8bef0f26b48990d46f5c3b/QUICKSTART.md#L15-L33
[S44]: https://github.com/glanderness/BeefTV/blob/2327ee2d80282b10dd8bef0f26b48990d46f5c3b/scripts/package-agent-host.mjs#L7-L72
[S45]: https://github.com/glanderness/BeefTV/blob/2327ee2d80282b10dd8bef0f26b48990d46f5c3b/.github/workflows/quality.yml#L85-L150
[S46]: https://github.com/glanderness/BeefTV/blob/2327ee2d80282b10dd8bef0f26b48990d46f5c3b/AGENTS.md#L110-L118
[S47]: https://github.com/glanderness/BeefTV/blob/2327ee2d80282b10dd8bef0f26b48990d46f5c3b/LICENSE#L1-L23
[S48]: https://github.com/glanderness/BeefTV/blob/2327ee2d80282b10dd8bef0f26b48990d46f5c3b/NOTICE#L17-L31
[S49]: https://github.com/glanderness/BeefTV/blob/2327ee2d80282b10dd8bef0f26b48990d46f5c3b/THIRD_PARTY_NOTICES.md#L1-L78
[S50]: https://github.com/glanderness/BeefTV/blob/2327ee2d80282b10dd8bef0f26b48990d46f5c3b/web/vite.config.ts#L15-L30
[S51]: https://github.com/glanderness/BeefTV/blob/2327ee2d80282b10dd8bef0f26b48990d46f5c3b/backend/internal/bootstrap/runtime_test.go#L234-L337
[S52]: https://github.com/glanderness/BeefTV/blob/2327ee2d80282b10dd8bef0f26b48990d46f5c3b/backend/internal/canvas/storyboard_writes_test.go#L239
[S53]: https://github.com/glanderness/BeefTV/blob/2327ee2d80282b10dd8bef0f26b48990d46f5c3b/web/test/canvas-archive-restore.test.ts#L213-L425
[S54]: https://github.com/glanderness/BeefTV/blob/2327ee2d80282b10dd8bef0f26b48990d46f5c3b/agent-host/server.mjs#L68-L85
