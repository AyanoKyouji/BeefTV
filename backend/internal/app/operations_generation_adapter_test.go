package app

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"image"
	"image/png"
	"strings"
	"testing"
	"time"

	"gorm.io/gorm"
	"infinite-canvas/backend/internal/agentops"
	"infinite-canvas/backend/internal/model"
	"infinite-canvas/backend/internal/operations"
	"infinite-canvas/backend/internal/repository"
)

func TestAssistantDirectGenerationAtomicReplayAndMovedNode(t *testing.T) {
	_, db := newTimelineTaskTestService(t)
	sqlDB, _ := db.DB()
	sqlDB.SetMaxOpenConns(1)
	svc := NewLocal(repository.New(db), t.TempDir())
	t.Cleanup(func() { _ = svc.Close() })
	if err := db.Create(&model.Workspace{ID: "owner", Name: "test"}).Error; err != nil {
		t.Fatal(err)
	}
	config := map[string]any{"imageModel": "relay::gpt-image-2", "videoModel": "relay::minimax-h3", "size": "16:9", "videoSeconds": "5", "vquality": "768P", "channels": []any{map[string]any{"id": "relay", "enabled": true, "baseUrl": "http://127.0.0.1:9", "apiKey": "synthetic-key", "models": []string{"gpt-image-2", "minimax-h3"}, "modelProfiles": []any{map[string]any{"model": "gpt-image-2", "capability": "image", "protocol": "openai-image"}, map[string]any{"model": "minimax-h3", "capability": "video", "protocol": "predictions-h3-video"}}}}}
	body, _ := json.Marshal(config)
	if err := svc.SaveLocalModelConfig(body); err != nil {
		t.Fatal(err)
	}
	doc := map[string]any{"id": "canvas", "revision": 0, "title": "test", "nodes": []any{map[string]any{"id": "first", "type": "image", "title": "首图", "position": map[string]any{"x": 0, "y": 0}, "metadata": map[string]any{"composerContent": "按要求生成首图", "status": "idle"}}, map[string]any{"id": "video", "type": "video", "title": "视频", "metadata": map[string]any{"composerContent": "依据实际图片生成视频", "status": "idle"}}}, "connections": []any{map[string]any{"id": "edge", "fromNodeId": "first", "toNodeId": "video"}}}
	raw, _ := json.Marshal(doc)
	if _, err := svc.UpsertUserCanvasProject("owner", raw); err != nil {
		t.Fatal(err)
	}
	turn := "abcdef1234567890"
	if _, err := svc.BeginAssistantTurn("owner", "canvas", turn, AssistantTurnInput{}); err != nil {
		t.Fatal(err)
	}
	registry := operations.NewRegistry(svc, operations.NewStore(db))
	operations.RegisterDefaultOps(registry)
	call := func(id, node, kind, prompt string) (operations.Result, error) {
		p, _ := json.Marshal(map[string]any{"canvasId": "canvas", "nodeId": node, "kind": kind, "prompt": prompt})
		ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
		defer cancel()
		return registry.Execute(operations.Request{Context: ctx, UserID: "owner", Caller: operations.AssistantCaller(&agentops.AssistantScope{CanvasID: "canvas"}, false), TurnID: turn, Op: "canvas.generation.start", OpID: id, Params: p})
	}
	if _, err := call("early-video", "video", "video", "依据实际图片生成视频"); err == nil {
		t.Fatal("accepted video with empty reference")
	}
	// Move the image after the assistant read it. No stale whole-canvas proposal
	// revision is required for generation; the current prompt still must match.
	raw, _ = svc.UserCanvasProject("owner", "canvas")
	json.Unmarshal(raw, &doc)
	doc["nodes"].([]any)[0].(map[string]any)["position"] = map[string]any{"x": 900, "y": 200}
	raw, _ = json.Marshal(doc)
	if _, err := svc.UpsertUserCanvasProject("owner", raw); err != nil {
		t.Fatal(err)
	}
	if _, err := call("stale-prompt", "first", "image", "different prompt"); err == nil {
		t.Fatal("accepted outdated content")
	}
	first, err := call("first-generation", "first", "image", "按要求生成首图")
	if err != nil {
		t.Fatal(err)
	}
	again, err := call("first-generation", "first", "image", "按要求生成首图")
	if err != nil || !again.Replayed {
		t.Fatalf("replay: %v", err)
	}
	id := first.Result.(map[string]any)["taskId"].(string)
	if again.Result.(map[string]any)["taskId"] != id {
		t.Fatal("duplicate task")
	}
	if _, err := call("double-generation", "first", "image", "按要求生成首图"); err == nil {
		t.Fatal("allowed concurrent duplicate")
	}
	scope, ok, err := svc.AssistantTurnScopeForHost("owner", turn)
	if err != nil || !ok || len(scope.TaskIDs) != 1 || scope.TaskIDs[0] != id {
		t.Fatalf("missing trusted task receipt: %+v %v", scope, err)
	}
	var stored model.Task
	if err = db.First(&stored, "id = ?", id).Error; err != nil {
		t.Fatal(err)
	}
	if stored.Model != "gpt-image-2" || stored.Status != "queued" {
		t.Fatalf("wrong selection %s", stored.Model)
	}
	if !stringsContainsProtected(stored.InputJSON) {
		t.Fatal("credentials not protected")
	}
	var imageBytes bytes.Buffer
	if err = png.Encode(&imageBytes, image.NewRGBA(image.Rect(0, 0, 4, 4))); err != nil {
		t.Fatal(err)
	}
	resource, err := svc.UploadLocalResourceFile("owner", "result.png", int64(imageBytes.Len()), "image", 4, 4, 0, bytes.NewReader(imageBytes.Bytes()))
	if err != nil {
		t.Fatal(err)
	}
	result, _ := json.Marshal(map[string]any{"mode": "image", "images": []any{map[string]any{"resourceId": resource.ID, "storageKey": "resource:" + resource.ID}}})
	stored.Status = model.TaskStatusSucceeded
	stored.ResultJSON = string(result)
	if err = db.Save(&stored).Error; err != nil {
		t.Fatal(err)
	}
	if err = svc.DeliverSucceededTask(stored); err != nil {
		t.Fatal(err)
	}
	video, err := call("dependent-video", "video", "video", "依据实际图片生成视频")
	if err != nil {
		t.Fatalf("ready image not usable: %v", err)
	}
	var videoTask model.Task
	if err = db.First(&videoTask, "id = ?", video.Result.(map[string]any)["taskId"]).Error; err != nil {
		t.Fatal(err)
	}
	decoded, err := svc.decryptTaskInputJSON(videoTask.InputJSON)
	if err != nil {
		t.Fatal(err)
	}
	var videoInput map[string]any
	if err = json.Unmarshal([]byte(decoded), &videoInput); err != nil {
		t.Fatal(err)
	}
	refs := videoInput["referenceImages"].([]any)
	if len(refs) != 1 || refs[0].(map[string]any)["storageKey"] != "resource:"+resource.ID {
		t.Fatal("generated image reference lost")
	}
	if videoTask.Model != "minimax-h3" {
		t.Fatal("video model changed")
	}
	// Force a receipt write failure. A second fresh node must not leave an
	// orphan paid task or a loading node outside the rollback.
	if err = db.Callback().Update().Before("gorm:update").Register("generation_receipt_fail", func(tx *gorm.DB) {
		if tx.Statement.Table == "agent_op_records" {
			tx.AddError(errors.New("receipt failed"))
		}
	}); err != nil {
		t.Fatal(err)
	}
	raw, _ = svc.UserCanvasProject("owner", "canvas")
	json.Unmarshal(raw, &doc)
	nodes := doc["nodes"].([]any)
	nodes = append(nodes, map[string]any{"id": "rollback", "type": "image", "metadata": map[string]any{"composerContent": "rollback", "status": "idle"}})
	doc["nodes"] = nodes
	raw, _ = json.Marshal(doc)
	if _, err := svc.UpsertUserCanvasProject("owner", raw); err != nil {
		t.Fatal(err)
	}
	if _, err := call("rollback-operation", "rollback", "image", "rollback"); err == nil {
		t.Fatal("receipt failure accepted")
	}
	db.Callback().Update().Remove("generation_receipt_fail")
	var count int64
	db.Model(&model.Task{}).Count(&count)
	if count != 2 {
		t.Fatalf("orphan tasks: %d", count)
	}
	raw, _ = svc.UserCanvasProject("owner", "canvas")
	json.Unmarshal(raw, &doc)
	for _, n := range doc["nodes"].([]any) {
		node := n.(map[string]any)
		if node["id"] == "rollback" && node["metadata"].(map[string]any)["status"] != "idle" {
			t.Fatal("rollback node mutated")
		}
	}
}

func stringsContainsProtected(value string) bool { return !strings.Contains(value, "synthetic-key") }

func TestAssistantGenerationModelRestrictions(t *testing.T) {
	for _, name := range []string{"seedance-2.5", "seedream-v5-flash"} {
		raw := map[string]any{"imageModel": "relay::" + name, "channels": []any{map[string]any{"id": "relay", "enabled": true, "models": []string{name}}}}
		if _, err := assistantGenerationConfig(raw, "image", map[string]any{}); err == nil {
			t.Fatal("restricted model allowed")
		}
	}
}
