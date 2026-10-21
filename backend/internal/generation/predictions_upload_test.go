package generation

import (
	"context"
	"encoding/json"
	"errors"
	"io"
	"net/http"
	"net/http/httptest"
	"os"
	"strings"
	"testing"

	"infinite-canvas/backend/internal/protocol"
)

func predictionsAdapter(t *testing.T) protocol.Adapter {
	t.Helper()
	raw, err := os.ReadFile("../../../plugin-packages/predictions-h3-video/manifest.json")
	if err != nil {
		t.Fatal(err)
	}
	adapter, err := protocol.LoadManifest(raw)
	if err != nil {
		t.Fatal(err)
	}
	return adapter
}

type predictionsResources struct {
	stageResources
	deny bool
}

func (p predictionsResources) Lookup(userID, id string) (ResourceInfo, error) {
	if p.deny || userID != "owner" {
		return ResourceInfo{}, errors.New("resource not owned")
	}
	return ResourceInfo{Status: "ready", Kind: "image", MimeType: "image/png", Width: 512, Height: 512}, nil
}

func TestPredictionsExecutorFailureAndOwnershipStopBeforeCreate(t *testing.T) {
	t.Setenv("CANVAS_ALLOW_PRIVATE_UPSTREAMS", "true")
	for _, deny := range []bool{false, true} {
		calls := 0
		server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			calls++
			if r.URL.Path != "/api/v1/files" {
				t.Error("reached paid create")
			}
			w.WriteHeader(503)
		}))
		var events []string
		runtime := taskRuntime(func(r *Runtime) {
			r.Config = stageConfig{events: &events}
			r.Call.UserID = "owner"
			r.Resources = predictionsResources{stageResources: stageResources{events: &events}, deny: deny}
		})
		registry, _ := protocol.NewRegistry(predictionsAdapter(t))
		ctx := WithProtocolRegistry(WithRuntime(context.Background(), runtime), registry)
		input := Input{Mode: "video", Prompt: "Move gently", Config: Config{Model: "minimax-h3", InterfaceType: predictionsH3Protocol, BaseURL: server.URL, APIKey: "fixture", VideoSeconds: "5"}, ReferenceImages: []Media{{StorageKey: "resource:owned"}}}
		_, err := Execute(ctx, input)
		var preparation RequestPreparationError
		want := 1
		if deny {
			want = 0
		}
		if !errors.As(err, &preparation) || calls != want || ClassifyError(err).Uncertain {
			t.Fatalf("wrong failure boundary: %v requests=%d deny=%v", err, calls, deny)
		}
		server.Close()
	}
}

func TestPredictionsOwnedReferenceUploadAndTaskContract(t *testing.T) {
	t.Setenv("CANVAS_ALLOW_PRIVATE_UPSTREAMS", "true")
	adapter := predictionsAdapter(t)
	registry, _ := protocol.NewRegistry(adapter)
	var events []string
	requests := []string{}
	var server *httptest.Server
	server = httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		requests = append(requests, r.Method+" "+r.URL.Path)
		if r.Header.Get("Authorization") != "Bearer fixture" {
			t.Error("missing channel authorization")
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
				t.Errorf("lost owned resource bytes: %q", body)
			}
			json.NewEncoder(w).Encode(map[string]any{"code": 0, "data": map[string]any{"list": []any{map[string]any{"url": server.URL + "/public.png"}}}})
		case "/api/v1/predictions":
			if r.Header.Get("Idempotency-Key") != "stable-operation" {
				t.Error("lost submission identity")
			}
			var body map[string]any
			json.NewDecoder(r.Body).Decode(&body)
			input := body["input"].(map[string]any)
			if body["model"] != "minimax-h3" || input["image_url"] != server.URL+"/public.png" || input["duration"] != float64(5) || input["resolution"] != "768P" {
				t.Errorf("wrong relay body: %#v", body)
			}
			for _, key := range []string{"aspect_ratio", "watermark", "generate_audio", "reference_image_urls"} {
				if _, ok := input[key]; ok {
					t.Errorf("unexpected frame parameter %s", key)
				}
			}
			io.WriteString(w, `{"code":0,"data":{"task_id":"one-task","status":"pending"}}`)
		case "/api/v1/predictions/one-task":
			io.WriteString(w, `{"code":0,"data":{"status":"success","outputs":["https://cdn.example/result.mp4"]}}`)
		default:
			t.Errorf("unexpected request %s", r.URL.Path)
			w.WriteHeader(404)
		}
	}))
	defer server.Close()
	ctx := WithProtocolRegistry(WithRuntime(context.Background(), Runtime{Resources: stageResources{events: &events}}), registry)
	input := Input{Mode: "video", Prompt: "A gentle camera movement", Config: Config{InterfaceType: predictionsH3Protocol, BaseURL: server.URL + "/v1", APIKey: "fixture", Model: "minimax-h3", VideoSeconds: "5", VQuality: "768P", Size: "9:16"}, ReferenceImages: []Media{{ID: "image-one", Name: "reference.png", StorageKey: "resource:owned"}}, Metadata: map[string]any{"videoStartFrameNodeId": "image-one"}}
	if err := ValidateMediaTransport(ctx, input); err != nil || len(requests) != 0 {
		t.Fatalf("admission uploaded or blocked the owned image: %v %#v", err, requests)
	}
	if err := HydrateMedia(ctx, "owner", &input, MediaHydrationPolicyFor(ctx, input)); err != nil {
		t.Fatal(err)
	}
	if input.ReferenceImages[0].DataURL != "" || input.ReferenceImages[0].StorageKey != "" {
		t.Fatal("local bytes escaped into provider JSON")
	}
	request := ProtocolRequestFromInput(input)
	request.Extra["idempotencyKey"] = "stable-operation"
	spec, err := adapter.BuildCreate(ctx, protocol.RequestContext{BaseURL: input.Config.BaseURL, Request: request})
	if err != nil {
		t.Fatal(err)
	}
	raw, err := ExecuteProtocolRequest(ctx, input.Config, spec)
	if err != nil {
		t.Fatal(err)
	}
	created, err := adapter.ParseCreate(ctx, raw)
	if err != nil || created.TaskID != "one-task" {
		t.Fatalf("bad create receipt: %#v %v", created, err)
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
	if err != nil || done.Status != protocol.StatusSucceeded || len(done.Result.Videos) != 1 {
		t.Fatalf("bad completion: %#v %v", done, err)
	}
	if strings.Join(requests, ",") != "POST /api/v1/files,POST /api/v1/predictions,GET /api/v1/predictions/one-task" {
		t.Fatalf("wrong lifecycle: %#v", requests)
	}
}

func TestPredictionsUploadFailuresNeverBecomeUncertainGeneration(t *testing.T) {
	t.Setenv("CANVAS_ALLOW_PRIVATE_UPSTREAMS", "true")
	for _, body := range []string{`{"code":8,"msg":"rejected"}`, `{"code":0,"data":{"list":[]}}`, `{"code":0,"data":{"list":[{"url":"file:///etc/passwd"}]}}`, `{"code":0,"data":{"list":[{"url":"https://user:secret@example.com/file"}]}}`} {
		t.Run(body, func(t *testing.T) {
			calls := 0
			server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
				calls++
				if r.URL.Path != "/api/v1/files" {
					t.Error("failure reached model create")
				}
				io.WriteString(w, body)
			}))
			defer server.Close()
			var events []string
			ctx := WithRuntime(context.Background(), Runtime{Resources: stageResources{events: &events}})
			input := Input{Config: Config{InterfaceType: predictionsH3Protocol, BaseURL: server.URL, APIKey: "fixture"}, ReferenceImages: []Media{{StorageKey: "resource:owned"}}}
			err := HydrateMedia(ctx, "owner", &input, MediaHydrationPolicy{})
			var preparation RequestPreparationError
			if !errors.As(err, &preparation) || calls != 1 || ClassifyError(err).Uncertain {
				t.Fatalf("lost pre-submission failure: %v calls=%d", err, calls)
			}
		})
	}
}

func TestPredictionsOversizeAndCancellationDoNotUpload(t *testing.T) {
	for _, cancelled := range []bool{false, true} {
		ctx, cancel := context.WithCancel(context.Background())
		if cancelled {
			cancel()
		} else {
			defer cancel()
		}
		media := Media{DataURL: "data:image/png;base64,aW1hZ2U=", Bytes: predictionsFileLimit + 1}
		if cancelled {
			media.Bytes = 0
		}
		if err := hydratePredictionsReference(ctx, "owner", &media, Config{}); err == nil {
			t.Fatal("invalid upload admitted")
		}
	}
}

func TestPredictionsRejectsMixedFramesAndInvalidDuration(t *testing.T) {
	adapter := predictionsAdapter(t)
	for _, request := range []protocol.GenerationRequest{
		{Model: "minimax-h3", Duration: 4},
		{Model: "minimax-h3", Duration: 16},
		{Model: "minimax-h3-max", Duration: 5, Resolution: "2K"},
		{Model: "minimax-h3-max-turbo", Duration: 5, Videos: []protocol.MediaReference{{URL: "https://example.com/video.mp4"}}},
		{Model: "minimax-h3", Duration: 5, Images: []protocol.MediaReference{{Role: "first_frame", URL: "https://example.com/first.png"}, {Role: "reference_image", URL: "https://example.com/ref.png"}}},
		{Model: "minimax-h3", Duration: 5, Images: []protocol.MediaReference{{Role: "last_frame", URL: "https://example.com/last.png"}}},
		{Model: "minimax-h3", Duration: 5, Audios: []protocol.MediaReference{{URL: "https://example.com/audio.wav"}}},
	} {
		if _, err := adapter.BuildCreate(context.Background(), protocol.RequestContext{Request: request}); err == nil {
			t.Fatalf("invalid relay input was admitted: %#v", request)
		}
	}
	failed, err := adapter.ParseCreate(context.Background(), []byte(`{"code":17,"msg":"rejected","data":{"task_id":"must-not-use"}}`))
	if err != nil || failed.Status != protocol.StatusFailed {
		t.Fatalf("HTTP 200 business error became success: %#v %v", failed, err)
	}
}

func TestPredictionsTurboUsesFramesAndReferenceModeKeepsURLArrays(t *testing.T) {
	adapter := predictionsAdapter(t)
	for _, turbo := range []bool{false, true} {
		model := "minimax-h3"
		if turbo {
			model = "minimax-h3-max-turbo"
		}
		spec, err := adapter.BuildCreate(context.Background(), protocol.RequestContext{Request: protocol.GenerationRequest{Model: model, Prompt: "Move", Duration: 5, Resolution: "768P", Images: []protocol.MediaReference{{URL: "https://example.com/one.png"}}}})
		if err != nil {
			t.Fatal(err)
		}
		body, _ := json.Marshal(spec.Body)
		var parsed map[string]any
		json.Unmarshal(body, &parsed)
		input := parsed["input"].(map[string]any)
		if turbo {
			if input["image_url"] != "https://example.com/one.png" || input["reference_image_urls"] != nil || input["aspect_ratio"] != nil {
				t.Fatalf("wrong turbo shape: %s", body)
			}
		} else if input["image_url"] != nil || len(input["reference_image_urls"].([]any)) != 1 {
			t.Fatalf("wrong reference shape: %s", body)
		}
	}
}
