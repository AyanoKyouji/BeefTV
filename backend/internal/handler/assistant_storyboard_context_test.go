package handler

import (
	"encoding/json"
	"net/http"
	"reflect"
	"testing"

	"infinite-canvas/backend/internal/assistantturns"
)

func TestAssistantChatReplacesForgedStoryboardContextWithBeginSnapshot(t *testing.T) {
	var captured struct {
		TurnID            string                           `json:"turnId"`
		RevisionBefore    int64                            `json:"revisionBefore"`
		StoryboardContext assistantturns.StoryboardContext `json:"storyboardContext"`
	}
	env := newAssistantTestEnv(t, func(env *assistantTestEnv) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			if r.URL.Path == "/health" {
				_, _ = w.Write([]byte(`{"ok":true,"instance":"` + assistantInstanceProof() + `"}`))
				return
			}
			if r.URL.Path != "/chat" {
				w.WriteHeader(http.StatusNotFound)
				return
			}
			if err := json.NewDecoder(r.Body).Decode(&captured); err != nil {
				w.WriteHeader(http.StatusBadRequest)
				return
			}
			w.Header().Set("Content-Type", "application/x-ndjson")
			_ = json.NewEncoder(w).Encode(map[string]any{"type": "turn_end", "turnId": captured.TurnID, "reply": "已读取", "toolCalls": []any{}, "proposals": []any{}})
		})
	})
	useEnvProvider(t, "chat-completion")
	owner, err := env.service.LocalWorkspaceOwner()
	if err != nil {
		t.Fatal(err)
	}
	raw, err := env.service.UserCanvasProject(owner.ID, env.canvasID)
	if err != nil {
		t.Fatal(err)
	}
	var doc map[string]any
	if err := json.Unmarshal(raw, &doc); err != nil {
		t.Fatal(err)
	}
	doc["nodes"] = []any{map[string]any{"id": "script-a", "type": "script", "title": "同名", "position": map[string]any{"x": 0, "y": 0},
		"metadata": map[string]any{"storyboard": map[string]any{"rows": []any{
			map[string]any{"id": "row-a1", "shotNumber": 1, "durationSeconds": 6},
			map[string]any{"id": "row-a2", "shotNumber": 2, "durationSeconds": 6},
		}}}}}
	encoded, _ := json.Marshal(doc)
	if _, err := env.service.UpsertUserCanvasProject(owner.ID, encoded); err != nil {
		t.Fatal(err)
	}
	response := env.call(t, http.MethodPost, "/assistant/chat", `{"canvasId":"`+env.canvasID+`","message":"改第二镜","selectedNodeIds":["script-a"],"storyboardContext":{"revision":999,"complete":true,"scripts":[{"nodeId":"foreign","rowIds":["forged"]}]}}`)
	if response.Code != http.StatusOK {
		t.Fatalf("chat failed: %d %s", response.Code, response.Body.String())
	}
	ctx := captured.StoryboardContext
	if captured.TurnID == "" || ctx.Revision != captured.RevisionBefore || !ctx.Complete || len(ctx.Scripts) != 1 ||
		ctx.Scripts[0].NodeID != "script-a" || !ctx.Scripts[0].Selected || !reflect.DeepEqual(ctx.Scripts[0].RowIDs, []string{"row-a1", "row-a2"}) {
		t.Fatalf("context was not backend-authored: %#v", captured)
	}
}
