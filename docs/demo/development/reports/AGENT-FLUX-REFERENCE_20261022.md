# Agent FLUX 参考图与静态预览修复

日期：2026-10-22。产品提交：`63ab298`。验证环境：Mac 原生 v1.7.26 / darwin-arm64，唯一正式应用 `/Applications/BeefTV.app`，运行中的 `/system/version` 已核实提交。

## 原因

角色图成功，但第一张带参考图的 FLUX 任务失败。任务诊断确认：配置选择 `openai-image`，文生图生成接口成功，参考图请求 `/images/edits` 却在 18 ms 内收到 HTTP 404。该中转的只读 `GET /api/v1/models/flux-3-image` schema 确认，参考图应由 `/api/v1/files` 上传，再经 `/api/v1/predictions` 的 `input.image_urls` 提交。错误属于协议不匹配，不能通过改提示词解决，也没有证据要求更换图片模型。

另有两个问题：`media.overview` 对静态 PNG 也先运行视频工具，实际返回 `media_probe_failed`；失败任务的节点持久投影仍为 `loading`，直接生成入口只看节点标记，会阻止明确失败后的新请求。

## 修改

- 增加声明式 `predictions-flux-image` 插件。文生图和参考图编辑使用同一异步 API，每 3 秒查询；下载真实产物后经既有任务交付器绑定。提交使用稳定幂等标识，业务 `code != 0` 保持失败。
- 与 H3 共用渠道鉴权、资源归属检查、免费上传和 20 MiB 限制。不发送 base64 参考图，不创建新模型执行循环。最多十张参考图，每节点一个产物，默认 1k，关闭提示词扩展。
- 前后端能力合同按实际 schema 对齐。通过正式版本化配置 API，仅把当前中转的 `flux-3-image` profile 改到新协议；其他 profile、模型选择、凭证及配置比较一致。
- PNG/JPEG/GIF 静态检查使用本地图片解码，先检查像素上限，再生成最长边 640 的 JPEG 预览；保留归属、版本哈希、区间和模式校验。GIF 只看静态帧，音视频与其他图片格式仍沿用原工具链。
- 节点残留 `loading` 时回查当前用户、当前画布的真实任务，允许明确失败的任务释放阻塞。活动任务、成功待交付、未知提交、待上游取消及需下载/交付恢复的任务继续受保护。不会因此自动提交新收费任务。

## 验证

后端专项通过：

```bash
cd backend
go test ./internal/generation ./internal/operations ./internal/modelcatalog ./internal/app \
  -run 'Test(FluxPredictions|Predictions|StillImage|GenerationLoading|AssistantDirectGeneration|AssistantGenerationModel)' -count=1
```

覆盖上传、URL 参数、路由、鉴权、幂等标识、查询成功、业务失败和参数限制；静态图片在无视频工具 PATH 时可读取和缩放，拒绝过期版本、非关联资源、错误模式及损坏图片；Agent 事务准入、幂等重放与依赖等待回归通过。前端 `model-capabilities.test.ts` 11 项及 `tsc --noEmit` 通过。原生更新脚本包含的前端构建、桌面路由隔离、随包媒体检查和签名校验通过。

真实验证只新增 **一张** FLUX 分镜图：

- 复用原画布真实角色基准图及分镜 1 提示词，通过正式 `canvas.generation.start` 入口提交。
- Task `dfb9a2154ebf80f99d25d1ea98f3fbc5`，平台返回可查询任务 ID，最终 `succeeded / READY`，一个产物。
- 图片 1360×768，已绑定原「分镜1 · 图片」节点，可再次读取预览，原生窗口可显示。
- 任务前后仅新增一个媒体生成任务，结束时活动任务为零；分镜表、连线与其余草稿节点比较一致。
- 1k 的 schema 报价为 0.024 USD/张；本次未查询账单，不把报价当作已核实扣款。

另在原对话通过实际 `deepseek-flash` Agent 发起一次明确禁止生成和修改的只读检查。原生界面确认 Agent 成功调用 `media.overview`，描述白衬衫、深蓝百褶裙、帆布包和城市街角等内容，与实际预览核对一致，不再报告媒体工具不可用。这只能证明当前连接读取这张静态图成功，不能泛化为所有文本模型都支持视觉输入。

## 边界与继续方式

没有重跑完整收费链，未生成剩余两张分镜图或视频，未调用 Seedance、Seedream；Windows 未回归。原任务与错误历史保留。继续时可发送：

> 参考图协议已修复。先读取最新画布和任务，复用已成功的角色基准图及分镜1，不要重复生成。使用 flux 依次生成剩余分镜2、3，全部成功交付后，再用 minimax-h3 参考三张分镜生成一条5秒视频。严格按依赖顺序执行，失败如实停止。

原始任务、模型 schema、配置比较、构建日志、预览及验证脚本保存在忽略目录 `.local/agent-flux-reference-20261022/`，不提交媒体、凭证、数据库或原始日志。
