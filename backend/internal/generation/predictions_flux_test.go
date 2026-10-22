package generation

import (
	"context"
	"encoding/json"
	"io"
	"net/http"
	"net/http/httptest"
	"os"
	"strings"
	"testing"

	"infinite-canvas/backend/internal/protocol"
)

func fluxPredictionsAdapter(t *testing.T) protocol.Adapter {
	t.Helper()
	raw, err := os.ReadFile("../../../plugin-packages/predictions-flux-image/manifest.json")
	if err != nil {
		t.Fatal(err)
	}
	adapter, err := protocol.LoadManifest(raw)
	if err != nil {
		t.Fatal(err)
	}
	return adapter
}

func TestFluxPredictionsReferenceLifecycle(t *testing.T) {
	t.Setenv("CANVAS_ALLOW_PRIVATE_UPSTREAMS", "true")
	adapter := fluxPredictionsAdapter(t)
	var events, requests []string
	var server *httptest.Server
	server = httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		requests = append(requests, r.Method+" "+r.URL.Path)
		if r.Header.Get("Authorization") != "Bearer fixture" {
			t.Error("missing authorization")
		}
		switch r.URL.Path {
		case "/api/v1/files":
			file, _, err := r.FormFile("files")
			if err != nil {
				t.Error(err)
				w.WriteHeader(400)
				return
			}
			defer file.Close()
			body, _ := io.ReadAll(file)
			if string(body) != "image" {
				t.Error("lost owned reference bytes")
			}
			json.NewEncoder(w).Encode(map[string]any{"code": 0, "data": map[string]any{"list": []any{map[string]any{"url": server.URL + "/reference.png"}}}})
		case "/api/v1/predictions":
			if r.Header.Get("Idempotency-Key") != "flux-stable-operation" {
				t.Error("missing idempotency")
			}
			var body map[string]any
			json.NewDecoder(r.Body).Decode(&body)
			input := body["input"].(map[string]any)
			if body["model"] != "flux-3-image" || input["prompt"] != "Keep the character, change the shot" || input["resolution"] != "1k" || input["aspect_ratio"] != "16:9" || input["enable_prompt_expansion"] != false || input["output_format"] != "png" {
				t.Errorf("wrong body %#v", body)
			}
			refs, ok := input["image_urls"].([]any)
			if !ok || len(refs) != 1 || refs[0] != server.URL+"/reference.png" {
				t.Errorf("wrong reference transport %#v", input)
			}
			io.WriteString(w, `{"code":0,"data":{"task_id":"flux-task","status":"pending"}}`)
		case "/api/v1/predictions/flux-task":
			io.WriteString(w, `{"code":0,"data":{"status":"success","outputs":["https://cdn.example/storyboard.png"]}}`)
		default:
			t.Errorf("unexpected route %s", r.URL.Path)
			w.WriteHeader(404)
		}
	}))
	defer server.Close()
	ctx := WithRuntime(context.Background(), Runtime{Resources: stageResources{events: &events}})
	registry, _ := protocol.NewRegistry(adapter)
	ctx = WithProtocolRegistry(ctx, registry)
	input := Input{Mode: "image", Prompt: "Keep the character, change the shot", Config: Config{InterfaceType: predictionsFluxProtocol, BaseURL: server.URL + "/v1", APIKey: "fixture", Model: "flux-3-image", Size: "16:9", Quality: "auto"}, ReferenceImages: []Media{{Name: "reference.png", StorageKey: "resource:owned"}}}
	if err := ValidateMediaTransport(ctx, input); err != nil || len(requests) != 0 {
		t.Fatalf("admission uploaded or rejected: %v", err)
	}
	if err := HydrateMedia(ctx, "owner", &input, MediaHydrationPolicyFor(ctx, input)); err != nil {
		t.Fatal(err)
	}
	request := ProtocolRequestFromInput(input)
	request.Extra["idempotencyKey"] = "flux-stable-operation"
	spec, err := adapter.BuildCreate(ctx, protocol.RequestContext{BaseURL: input.Config.BaseURL, Request: request})
	if err != nil {
		t.Fatal(err)
	}
	raw, err := ExecuteProtocolRequest(ctx, input.Config, spec)
	if err != nil {
		t.Fatal(err)
	}
	created, err := adapter.ParseCreate(ctx, raw)
	if err != nil || created.TaskID != "flux-task" {
		t.Fatalf("bad create %#v %v", created, err)
	}
	poll := protocol.PollContext{BaseURL: input.Config.BaseURL, Model: input.Config.Model, Request: request, TaskID: created.TaskID}
	spec, err = adapter.BuildPoll(ctx, poll)
	if err != nil {
		t.Fatal(err)
	}
	raw, err = ExecuteProtocolRequest(ctx, input.Config, spec)
	if err != nil {
		t.Fatal(err)
	}
	done, err := adapter.ParsePoll(ctx, poll, raw)
	if err != nil || done.Status != protocol.StatusSucceeded || len(done.Result.Images) != 1 {
		t.Fatalf("bad result %#v %v", done, err)
	}
	if strings.Join(requests, ",") != "POST /api/v1/files,POST /api/v1/predictions,GET /api/v1/predictions/flux-task" {
		t.Fatalf("wrong lifecycle %#v", requests)
	}
}

func TestFluxPredictionsValidationAndBusinessFailure(t *testing.T) {
	adapter := fluxPredictionsAdapter(t)
	for _, request := range []protocol.GenerationRequest{
		{Model: "other", Quality: "1k"},
		{Model: "flux-3-image", Quality: "high"},
		{Model: "flux-3-image", Quality: "1k", Images: make([]protocol.MediaReference, 11)},
		{Model: "flux-3-image", Quality: "1k", Videos: []protocol.MediaReference{{URL: "https://example.com/video.mp4"}}},
	} {
		if _, err := adapter.BuildCreate(context.Background(), protocol.RequestContext{Request: request}); err == nil {
			t.Fatalf("accepted %#v", request)
		}
	}
	failed, err := adapter.ParseCreate(context.Background(), []byte(`{"code":17,"msg":"rejected","data":{"task_id":"must-not-use"}}`))
	if err != nil || failed.Status != protocol.StatusFailed {
		t.Fatalf("accepted business failure %#v %v", failed, err)
	}
	spec, err := adapter.BuildCreate(context.Background(), protocol.RequestContext{Request: protocol.GenerationRequest{Model: "flux-3-image", Prompt: "A girl", Quality: "1k", AspectRatio: "auto"}})
	if err != nil {
		t.Fatal(err)
	}
	raw, _ := json.Marshal(spec.Body)
	if strings.Contains(string(raw), "image_urls") {
		t.Fatal("text-only request has references")
	}
}
