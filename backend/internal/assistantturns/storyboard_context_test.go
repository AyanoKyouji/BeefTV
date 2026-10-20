package assistantturns_test

import (
	"fmt"
	"reflect"
	"strings"
	"testing"

	"infinite-canvas/backend/internal/assistantturns"
)

func storyboardNode(id string, ids ...string) map[string]any {
	rows := []any{}
	for index, rowID := range ids {
		rows = append(rows, map[string]any{"id": rowID, "shotNumber": index + 1, "durationSeconds": 6, "videoMotionPrompt": "相似镜头"})
	}
	return map[string]any{"id": id, "type": "script", "title": "同名脚本", "position": map[string]any{"x": 0, "y": 0},
		"metadata": map[string]any{"storyboard": map[string]any{"rows": rows}}}
}

func TestStoryboardContextPinsSendOrderAcrossReorderAndDeletion(t *testing.T) {
	fx := openTurnFixture(t)
	doc := fx.readCanvas(t)
	doc["nodes"] = []any{storyboardNode("a", "a1", "a2", "a3"), storyboardNode("b", "b1", "b2")}
	fx.writeCanvas(t, doc)
	turnID := "aabbccdd00600001"
	revision, err := fx.turns.Begin(fx.userID, fx.canvasID, turnID, assistantturns.Input{SelectedNodeIDs: []string{"a"}})
	if err != nil {
		t.Fatal(err)
	}
	doc = fx.readCanvas(t)
	doc["nodes"] = []any{storyboardNode("a", "a3", "a1"), storyboardNode("b", "b1", "b2")}
	fx.writeCanvas(t, doc)
	got, err := fx.turns.StoryboardContextForHost(fx.userID, turnID)
	if err != nil {
		t.Fatal(err)
	}
	want := assistantturns.StoryboardContext{Revision: revision, Complete: true, Scripts: []assistantturns.StoryboardScriptContext{
		{NodeID: "a", Title: "同名脚本", Selected: true, RowIDs: []string{"a1", "a2", "a3"}},
		{NodeID: "b", Title: "同名脚本", RowIDs: []string{"b1", "b2"}},
	}}
	if !reflect.DeepEqual(got, want) {
		t.Fatalf("live reorder/deletion changed send identities: %#v", got)
	}
	if _, err := fx.turns.Begin(fx.userID, fx.canvasID, "aabbccdd00600002", assistantturns.Input{}); err != nil {
		t.Fatal(err)
	}
	next, err := fx.turns.StoryboardContextForHost(fx.userID, "aabbccdd00600002")
	if err != nil || !reflect.DeepEqual(next.Scripts[0].RowIDs, []string{"a3", "a1"}) || next.Revision <= revision {
		t.Fatalf("new turn must capture its own order: %#v, %v", next, err)
	}
}

func TestStoryboardContextRequiresOpenOwnedTurn(t *testing.T) {
	fx := openTurnFixture(t)
	turnID := "aabbccdd00600003"
	if _, err := fx.turns.Begin(fx.userID, fx.canvasID, turnID, assistantturns.Input{}); err != nil {
		t.Fatal(err)
	}
	if _, err := fx.turns.StoryboardContextForHost("other-owner", turnID); err == nil {
		t.Fatal("foreign owner read snapshot")
	}
	if err := fx.turns.Finalize(turnID); err != nil {
		t.Fatal(err)
	}
	if _, err := fx.turns.StoryboardContextForHost(fx.userID, turnID); err == nil {
		t.Fatal("settled snapshot exposed for a new dispatch")
	}
}

func TestStoryboardContextOversizeOmitsEntireOrder(t *testing.T) {
	fx := openTurnFixture(t)
	ids := make([]string, 400)
	for index := range ids {
		ids[index] = fmt.Sprintf("row-%d-%s", index, strings.Repeat("x", 80))
	}
	doc := fx.readCanvas(t)
	doc["nodes"] = []any{storyboardNode("large", ids...)}
	fx.writeCanvas(t, doc)
	turnID := "aabbccdd00600004"
	if _, err := fx.turns.Begin(fx.userID, fx.canvasID, turnID, assistantturns.Input{}); err != nil {
		t.Fatal(err)
	}
	got, err := fx.turns.StoryboardContextForHost(fx.userID, turnID)
	if err != nil || got.Complete || len(got.Scripts) != 0 {
		t.Fatalf("partial order could misbind an ordinal: %#v, %v", got, err)
	}
}
