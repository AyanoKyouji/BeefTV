package operations

import (
	"encoding/json"
	"strings"

	"infinite-canvas/backend/internal/generation"
	"infinite-canvas/backend/internal/model"
)

// Admission and the operation receipt share a transaction. The existing task
// worker owns provider execution; the assistant never receives credentials.
type CanvasGenerationAdmission interface {
	CreateCanvasGeneration(userID, canvasID, nodeID, kind, prompt, operationID string, metadata map[string]any, references []generation.Media) (*model.Task, error)
}

func registerCanvasGenerationOps(r *Registry) {
	r.Register(Op{ReplaySafe: true, AssistantCanvas: true, ID: "canvas.generation.start", Scope: ScopeCanvas,
		Summary: "按用户指令直接生成当前节点的图片或视频，可能计费；读取最新草稿与已就绪参考素材，返回真实任务；必须查询成功并绑定后再做依赖步骤。仅移动节点不影响生成",
		Params:  json.RawMessage(`{"type":"object","additionalProperties":false,"properties":{"canvasId":{"type":"string"},"nodeId":{"type":"string"},"kind":{"type":"string","enum":["image","video"]},"prompt":{"type":"string","description":"刚读取的目标节点完整可编辑提示词，必须与当前草稿一致"}},"required":["canvasId","nodeId","kind","prompt"]}`), Handler: opCanvasGenerationStart})
}

func opCanvasGenerationStart(ctx *Context, raw json.RawMessage) (any, error) {
	var args struct {
		CanvasID string `json:"canvasId"`
		NodeID   string `json:"nodeId"`
		Kind     string `json:"kind"`
		Prompt   string `json:"prompt"`
	}
	if err := decodeParams(raw, &args); err != nil {
		return nil, err
	}
	if args.CanvasID == "" || args.NodeID == "" || strings.TrimSpace(args.Prompt) == "" || (args.Kind != "image" && args.Kind != "video") {
		return nil, InvalidArg("invalid_params", "需要画布、媒体节点、类型和完整提示词")
	}
	admission, ok := ctx.Domain.(CanvasGenerationAdmission)
	if !ok {
		return nil, Unsupported("generation_unavailable", "当前工作区无法直接生成")
	}
	body, err := ctx.Domain.UserCanvasProject(ctx.UserID, args.CanvasID)
	if err != nil {
		return nil, mapDomainError(err)
	}
	var doc map[string]any
	if err = json.Unmarshal(body, &doc); err != nil {
		return nil, AsError(err)
	}
	node := findDocNode(doc, args.NodeID)
	if node == nil {
		return nil, NotFound("node_not_found", "目标节点已不存在")
	}
	if node["type"] != args.Kind {
		return nil, InvalidArg("generation_kind_mismatch", "目标节点类型不匹配")
	}
	meta, _ := node["metadata"].(map[string]any)
	if meta == nil {
		return nil, InvalidArg("prompt_required", "节点尚无提示词")
	}
	prompt, _ := meta["composerContent"].(string)
	if _, exists := meta["composerContent"]; !exists {
		prompt, _ = meta["prompt"].(string)
	}
	if strings.TrimSpace(prompt) != strings.TrimSpace(args.Prompt) {
		return nil, Conflict("generation_input_changed", "提示词已修改，请重新读取节点后按最新要求生成", nil)
	}
	if meta["status"] == "loading" || meta["generationSubmissionState"] == "unknown" || meta["generationSubmissionState"] == "submitting" {
		return nil, PreconditionFailed("generation_pending", "当前节点已有未结束的生成，请查询原任务", nil)
	}
	references := []generation.Media{}
	seen := map[string]bool{}
	connections, _ := doc["connections"].([]any)
	for _, raw := range connections {
		item, ok := raw.(map[string]any)
		if !ok {
			continue
		}
		if item["toNodeId"] != args.NodeID {
			continue
		}
		id, _ := item["fromNodeId"].(string)
		if seen[id] {
			continue
		}
		seen[id] = true
		source := findDocNode(doc, id)
		if source == nil {
			return nil, InvalidArg("reference_missing", "参考节点已删除")
		}
		kind, _ := source["type"].(string)
		if kind != "image" && kind != "video" && kind != "audio" {
			continue
		}
		sm, _ := source["metadata"].(map[string]any)
		key, _ := sm["storageKey"].(string)
		if sm["status"] == "loading" || sm["status"] == "error" || !strings.HasPrefix(key, "resource:") {
			return nil, PreconditionFailed("reference_not_ready", "前一步参考素材尚未成功交付，请先等待并绑定真实结果", nil)
		}
		resource, err := ctx.Domain.OwnedReadyResource(ctx.UserID, strings.TrimPrefix(key, "resource:"))
		if err != nil {
			return nil, mapDomainError(err)
		}
		if resource.Kind != kind {
			return nil, InvalidArg("reference_kind_mismatch", "参考素材类型不一致")
		}
		title, _ := source["title"].(string)
		references = append(references, generation.Media{ID: id, Name: title, Type: kind, StorageKey: key, MimeType: resource.MimeType, Width: resource.Width, Height: resource.Height, DurationMs: resource.DurationMs})
	}
	task, err := admission.CreateCanvasGeneration(ctx.UserID, args.CanvasID, args.NodeID, args.Kind, prompt, "assistant-generation:"+ctx.OperationID, meta, references)
	if err != nil {
		return nil, mapDomainError(err)
	}
	for _, key := range []string{"errorDetails", "generationErrorCode", "generationErrorSummary", "resourceReloadAvailable", "failedPromptFingerprint", "failedInputFingerprint"} {
		delete(meta, key)
	}
	meta["status"] = "loading"
	meta["taskId"] = task.ID
	meta["taskOutputIndex"] = 0
	meta["taskType"] = task.Type
	meta["taskStatus"] = task.Status
	meta["taskProgress"] = task.Progress
	meta["taskStage"] = task.Stage
	meta["taskClientOperationId"] = "assistant-generation:" + ctx.OperationID
	meta["generationSubmissionState"] = "accepted"
	updated, _ := json.Marshal(doc)
	summary, _, err := ctx.Domain.CommitUserCanvasDocument(ctx.UserID, args.CanvasID, canvasRevision(doc), updated)
	if err != nil {
		return nil, mapDomainError(err)
	}
	return map[string]any{"canvasId": args.CanvasID, "nodeId": args.NodeID, "taskId": task.ID, "kind": args.Kind, "status": task.Status, "revision": summary.Revision, "submitted": true}, nil
}
