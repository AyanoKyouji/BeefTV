package canvas

import (
	"encoding/json"
	"testing"
)

func TestStoryboardImageBindingFollowsEffectiveInput(t *testing.T) {
	for _, tc := range []struct {
		name, image, plot, output string
		detached                  bool
	}{
		{"edited image", "red car", "old plot", "output", true},
		{"unchanged image and edited plot", "blue car", "new plot", "output", false},
		{"explicit replacement", "red car", "old plot", "replacement", false},
		{"trimmed input", " blue car ", "old plot", "output", false},
	} {
		t.Run(tc.name, func(t *testing.T) {
			before := map[string]any{"imageNodeId": "output", "imageGenerationPrompt": "blue car", "plotDescription": "old plot"}
			after := map[string]any{"imageNodeId": tc.output, "imageGenerationPrompt": tc.image, "plotDescription": tc.plot}
			if got := invalidateStoryboardImageBinding(before, after); (got != "") != tc.detached {
				t.Fatalf("unexpected detach: %q %#v", got, after)
			}
		})
	}
	before := map[string]any{"imageNodeId": "output", "plotDescription": "old plot"}
	after := map[string]any{"imageNodeId": "output", "plotDescription": "new plot"}
	if invalidateStoryboardImageBinding(before, after) != "output" {
		t.Fatal("changed fallback input kept old image")
	}
}

func TestStoryboardImageBindingExternalUpdatePreservesTaskAndCAS(t *testing.T) {
	svc, id, scriptID, revision := storyboardFixture(t)
	initial := json.RawMessage(`{"nodes":[{"id":"script","type":"script","metadata":{"storyboard":{"rows":[{"id":"target","shotNumber":1,"durationSeconds":6,"imageGenerationPrompt":"blue car","imageNodeId":"output"},{"id":"other","shotNumber":2,"durationSeconds":6,"imageGenerationPrompt":"other"}]}}},{"id":"output","type":"image","metadata":{"taskId":"running-task","status":"loading"}}],"connections":[{"id":"output-edge","fromNodeId":"script","toNodeId":"output","fromHandleId":"row:target"},{"id":"reference","fromNodeId":"prop","toNodeId":"script","toHandleId":"row:target"}]}`)
	saved, _, err := svc.CommitUserCanvasDocument("owner", id, revision, initial)
	if err != nil {
		t.Fatal(err)
	}
	patches := []StoryboardRowPatch{{RowID: "target", StoryboardRowDraft: StoryboardRowDraft{ImageGenerationPrompt: strPtr("red car")}}}
	if _, _, err := svc.UpdateUserCanvasStoryboardRows("owner", id, scriptID, patches, revision); err == nil {
		t.Fatal("stale revision accepted")
	}
	if _, _, err := svc.UpdateUserCanvasStoryboardRows("owner", id, scriptID, patches, saved.Revision); err != nil {
		t.Fatal(err)
	}
	doc, err := svc.loadCanvasDoc("owner", id)
	if err != nil {
		t.Fatal(err)
	}
	rows := storyboardDocumentRows(findCanvasNode(doc, scriptID))
	if rows[0].(map[string]any)["imageNodeId"] != nil || rows[0].(map[string]any)["imageBindingStale"] != true || rows[0].(map[string]any)["imageGenerationPrompt"] != "red car" || rows[1].(map[string]any)["imageNodeId"] != nil {
		t.Fatalf("wrong row binding: %#v", rows)
	}
	meta := nodeMetadata(findCanvasNode(doc, "output"))
	if meta["taskId"] != "running-task" || meta["status"] != "loading" {
		t.Fatalf("task or media node lost: %#v", meta)
	}
	edges := doc["connections"].([]any)
	if len(edges) != 1 || edges[0].(map[string]any)["id"] != "reference" {
		t.Fatalf("unrelated input edge changed: %#v", edges)
	}
}

func TestStoryboardDocumentRejectsStaleImageClaim(t *testing.T) {
	before := json.RawMessage(`{"nodes":[{"id":"script","type":"script","metadata":{"storyboard":{"rows":[{"id":"target","durationSeconds":6,"imageGenerationPrompt":"blue car","imageNodeId":"output"}]}}}],"connections":[{"id":"output-edge","fromNodeId":"script","toNodeId":"output","fromHandleId":"row:target"}]}`)
	var after map[string]any
	if err := json.Unmarshal(before, &after); err != nil {
		t.Fatal(err)
	}
	row := storyboardDocumentRows(findCanvasNode(after, "script"))[0].(map[string]any)
	row["imageGenerationPrompt"] = "red car"
	raw, _ := json.Marshal(after)
	if _, err := reconcileStoryboardDocument(before, raw); err == nil {
		t.Fatal("UI changed input but retained an old output")
	}
	delete(row, "imageNodeId")
	row["imageBindingStale"] = true
	raw, _ = json.Marshal(after)
	if _, err := reconcileStoryboardDocument(before, raw); err == nil {
		t.Fatal("UI cleared the row field but retained the stale output edge")
	}
	after["connections"] = []any{}
	raw, _ = json.Marshal(after)
	if _, err := reconcileStoryboardDocument(before, raw); err != nil {
		t.Fatal(err)
	}
}
