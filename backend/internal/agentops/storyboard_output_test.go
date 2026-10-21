package agentops_test

import (
	"reflect"
	"testing"

	"infinite-canvas/backend/internal/app"
)

func storyboardOutputFixture(t *testing.T) *harness {
	t.Helper()
	h := newHarness(t)
	doc := h.canvas(t)
	node := doc["nodes"].([]any)[0].(map[string]any)
	node["type"] = "script"
	node["metadata"] = map[string]any{"storyboard": map[string]any{"rows": []any{
		map[string]any{"id": "row-a", "shotNumber": 1, "durationSeconds": 5, "imageGenerationPrompt": "new input", "imageBindingStale": true},
		map[string]any{"id": "row-b", "shotNumber": 2, "durationSeconds": 5, "imageGenerationPrompt": "other input"},
	}}}
	doc["nodes"] = append(doc["nodes"].([]any), map[string]any{"id": "other-image", "type": "image", "metadata": map[string]any{"prompt": "other"}})
	doc["connections"] = []any{}
	if _, err := h.service.UpsertUserCanvasProject(h.userID, mustRaw(t, doc)); err != nil {
		t.Fatal(err)
	}
	return h
}

func TestStoryboardOutputConnectReceiptReplayAndUndo(t *testing.T) {
	h := storyboardOutputFixture(t)
	before := h.canvas(t)
	const turn = "abcd7788"
	if _, err := h.service.BeginAssistantTurn(h.userID, h.canvasID, turn, app.AssistantTurnInput{}); err != nil {
		t.Fatal(err)
	}
	p := map[string]any{"canvasId": h.canvasID, "fromNodeId": "n1", "toNodeId": "n2", "storyboardRowId": "row-a", "expectedRevision": before["revision"]}
	first, err := accessWrite(t, h, turn, "canvas", "canvas.edge.create", "bind-output", p)
	if err != nil {
		t.Fatal(err)
	}
	after := h.canvas(t)
	rows := after["nodes"].([]any)[0].(map[string]any)["metadata"].(map[string]any)["storyboard"].(map[string]any)["rows"].([]any)
	row := rows[0].(map[string]any)
	if row["imageNodeId"] != "n2" || row["imageBindingStale"] != nil || row["imageGenerationPrompt"] != "new input" {
		t.Fatalf("wrong output binding: %v", row)
	}
	edge := after["connections"].([]any)[0].(map[string]any)
	if edge["fromNodeId"] != "n1" || edge["toNodeId"] != "n2" || edge["storyboardRowId"] != "row-a" || edge["fromHandleId"] != "row:row-a" || edge["relation"] != "storyboard-output" {
		t.Fatalf("not the UI output contract: %v", edge)
	}
	if _, err := accessWrite(t, h, turn, "canvas", "canvas.edge.create", "stale-output", p); err == nil {
		t.Fatal("stale revision accepted")
	}
	replayed, err := accessWrite(t, h, turn, "canvas", "canvas.edge.create", "bind-output", p)
	if err != nil || !replayed.Replayed || replayed.Revision != first.Revision {
		t.Fatalf("replay: %+v %v", replayed, err)
	}
	p["expectedRevision"] = after["revision"]
	duplicate, err := accessWrite(t, h, turn, "canvas", "canvas.edge.create", "duplicate-output", p)
	if err != nil || duplicate.Result.(map[string]any)["created"] != false || !reflect.DeepEqual(after, h.canvas(t)) {
		t.Fatalf("duplicate changed the document: %+v %v", duplicate, err)
	}
	if err := h.service.FinalizeAssistantTurn(turn); err != nil {
		t.Fatal(err)
	}
	state, err := h.service.ReadAssistantTurnHistoryState(h.userID, h.canvasID, turn)
	if err != nil || state.Change == nil || !reflect.DeepEqual(state.Change.UpdatedNodeIDs, []string{"n1"}) || !reflect.DeepEqual(state.Change.CreatedEdgeIDs, []string{edge["id"].(string)}) {
		t.Fatalf("missing binding receipt: %+v %v", state, err)
	}
	if _, err := h.service.UndoAssistantTurn(h.userID, h.canvasID, turn); err != nil {
		t.Fatal(err)
	}
	if !reflect.DeepEqual(before["nodes"], h.canvas(t)["nodes"]) || !reflect.DeepEqual(before["connections"], h.canvas(t)["connections"]) {
		t.Fatal("undo did not restore both row binding and edge")
	}
}

func TestStoryboardOutputConnectRejectsInvalidTargetsWithoutWriting(t *testing.T) {
	for _, scenario := range []string{"missing-row", "foreign-node", "wrong-direction", "not-script", "readonly", "another-row", "replace-output"} {
		t.Run(scenario, func(t *testing.T) {
			h := storyboardOutputFixture(t)
			const turn = "abcd7799"
			if _, err := h.service.BeginAssistantTurn(h.userID, h.canvasID, turn, app.AssistantTurnInput{}); err != nil {
				t.Fatal(err)
			}
			p := map[string]any{"canvasId": h.canvasID, "fromNodeId": "n1", "toNodeId": "n2", "storyboardRowId": "row-a", "expectedRevision": h.canvas(t)["revision"]}
			mode := "canvas"
			switch scenario {
			case "missing-row":
				p["storyboardRowId"] = "missing"
			case "foreign-node":
				p["toNodeId"] = "foreign"
			case "wrong-direction":
				p["fromNodeId"], p["toNodeId"] = "n2", "n1"
			case "not-script":
				p["fromNodeId"] = "other-image"
			case "readonly":
				mode = "read-only"
			case "another-row", "replace-output":
				if _, err := accessWrite(t, h, turn, "canvas", "canvas.edge.create", "first-binding", p); err != nil {
					t.Fatal(err)
				}
				p["expectedRevision"] = h.canvas(t)["revision"]
				if scenario == "another-row" {
					p["storyboardRowId"] = "row-b"
				} else {
					p["toNodeId"] = "other-image"
				}
			}
			before := h.canvas(t)
			if _, err := accessWrite(t, h, turn, mode, "canvas.edge.create", "invalid-binding", p); err == nil {
				t.Fatal("invalid binding accepted")
			}
			if !reflect.DeepEqual(before, h.canvas(t)) {
				t.Fatal("rejected binding changed the document")
			}
		})
	}
}
