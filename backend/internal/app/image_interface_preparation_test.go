package app

import (
	"context"
	"encoding/json"
	"errors"
	"net/http"
	"net/http/httptest"
	"strings"
	"sync/atomic"
	"testing"
	"time"

	"infinite-canvas/backend/internal/generation"
	"infinite-canvas/backend/internal/model"
)

func TestMissingImageInterfaceFailsBeforeDispatchWithoutUnknownSubmission(t *testing.T) {
	t.Setenv("CANVAS_ALLOW_PRIVATE_UPSTREAMS", "true")
	var hits atomic.Int32
	upstream := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		hits.Add(1)
		w.WriteHeader(http.StatusInternalServerError)
	}))
	t.Cleanup(upstream.Close)
	s, db := newTimelineTaskTestService(t)
	s.dataDir = t.TempDir()
	raw, _ := json.Marshal(canvasGenerationInput{Mode: "image", Prompt: "manual fixture", Config: providerConfig{
		BaseURL: upstream.URL, APIKey: "synthetic", Model: "test-image", InterfaceType: "uninstalled-image-test",
	}})
	expires := time.Now().Add(time.Hour)
	task := model.Task{ID: "missing-interface-task", UserID: "user", Type: "canvas_image", Status: model.TaskStatusRunning,
		InputJSON: string(raw), LeaseOwner: "owner", LeaseExpiresAt: &expires}
	attempt := &model.RouteAttempt{ID: "missing-interface-attempt", TaskID: task.ID, AttemptNumber: 1, Status: "selected", DispatchState: "not_sent", StartedAt: time.Now()}
	for _, row := range []any{&task, attempt} {
		if err := db.Create(row).Error; err != nil {
			t.Fatal(err)
		}
	}
	execution, err := s.routeExecutor().execute(context.Background(), &task, attempt)
	if err != nil || execution.err == nil {
		t.Fatalf("execution=%+v err=%v", execution, err)
	}
	if hits.Load() != 0 {
		t.Fatalf("local validation sent %d upstream calls", hits.Load())
	}
	var preparation generation.RequestPreparationError
	if !errors.As(execution.err, &preparation) || isImageRecoveryError(execution.err) {
		t.Fatalf("local interface failure lost unsent proof: %v; attempt=%+v", execution.err, attempt)
	}
	if attempt.DispatchState != "rejected_no_job" || attempt.FailureCode != "request_preparation_failed" {
		t.Fatalf("local interface failure state = %s code = %s", attempt.DispatchState, attempt.FailureCode)
	}
	_ = s.terminalCoordinator().handleExecutionFailure(&task, execution.err, false, false)
	stored, err := s.repo.Task(task.ID)
	if err != nil {
		t.Fatal(err)
	}
	output := taskForOutput(*stored)
	if output.Status != model.TaskStatusFailed || output.Stage == "submission_unknown" || output.ErrorCode == "submission_uncertain" || !strings.Contains(output.Error, "未发送到模型服务") {
		t.Fatalf("wrong persisted failure: %+v", output)
	}
	if err := s.validateImageTaskRetry(stored); err != nil {
		t.Fatalf("confirmed unsent task remained locked: %v", err)
	}
	var receipts int64
	db.Model(&model.ImageSubmission{}).Where("task_id = ?", task.ID).Count(&receipts)
	if receipts != 0 || hits.Load() != 0 {
		t.Fatalf("local failure produced receipts=%d calls=%d", receipts, hits.Load())
	}
}
