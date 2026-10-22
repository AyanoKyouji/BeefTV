package operations

import (
	"infinite-canvas/backend/internal/model"
	"testing"
)

func TestGenerationLoadingProjectionUsesDefinitiveFailure(t *testing.T) {
	task := model.Task{ProjectID: "canvas", Status: model.TaskStatusFailed, Error: "当前模型或接口不可用。请检查模型名称和渠道配置。"}
	if !canReplaceFailedGeneration(&task, "canvas") {
		t.Fatal("failed task held by stale loading projection")
	}
	if canReplaceFailedGeneration(&task, "foreign") {
		t.Fatal("accepted foreign task")
	}
	task.Stage = "submission_unknown"
	if canReplaceFailedGeneration(&task, "canvas") {
		t.Fatal("accepted uncertain submission")
	}
	task.Stage = ""
	task.Status = model.TaskStatusRunning
	if canReplaceFailedGeneration(&task, "canvas") {
		t.Fatal("accepted active task")
	}
	task.Status = model.TaskStatusSucceeded
	if canReplaceFailedGeneration(&task, "canvas") {
		t.Fatal("discarded pending delivery")
	}
	task.Status = model.TaskStatusFailed
	task.ProviderCancelStatus = model.ProviderCancelStatusRequested
	if canReplaceFailedGeneration(&task, "canvas") {
		t.Fatal("accepted pending upstream cancellation")
	}
}
