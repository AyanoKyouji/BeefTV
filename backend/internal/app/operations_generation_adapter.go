package app

import (
	"encoding/json"
	"fmt"
	"strings"

	"infinite-canvas/backend/internal/generation"
	"infinite-canvas/backend/internal/model"
	"infinite-canvas/backend/internal/modelcatalog"
	"infinite-canvas/backend/internal/operations"
	localtask "infinite-canvas/backend/internal/task"
	"infinite-canvas/backend/internal/workspace"
)

func (s *operationSession) CreateCanvasGeneration(userID, canvasID, nodeID, kind, prompt, operationID string, metadata map[string]any, references []generation.Media) (*model.Task, error) {
	if s.tx == nil || !s.service.IsLocalMode() {
		return nil, operations.Unsupported("generation_unavailable", "直接生成需要本地工作区事务")
	}
	store, err := workspace.NewProviderConfig(s.service.dataDir)
	if err != nil {
		return nil, err
	}
	effective, _, err := store.LoadEffectiveModelConfig()
	if err != nil {
		return nil, err
	}
	config, err := assistantGenerationConfig(effective.Config, kind, metadata)
	if err != nil {
		return nil, err
	}
	input := generation.Input{Mode: kind, Prompt: prompt, Config: config, Metadata: map[string]any{"nodeId": nodeID, "source": "canvas", "clientOperationId": operationID}}
	for _, reference := range references {
		switch reference.Type {
		case "image":
			input.ReferenceImages = append(input.ReferenceImages, reference)
		case "video":
			input.ReferenceVideos = append(input.ReferenceVideos, reference)
		case "audio":
			input.ReferenceAudios = append(input.ReferenceAudios, reference)
		}
	}
	if kind == "image" && (len(input.ReferenceVideos) > 0 || len(input.ReferenceAudios) > 0) {
		return nil, operations.InvalidArg("unsupported_reference", "图片生成不能忽略已连接的音视频参考，请调整参考连线")
	}
	if kind == "video" {
		if len(input.ReferenceImages) > 0 {
			input.Metadata["videoEditOperation"] = "image_to_video"
		} else {
			input.Metadata["videoEditOperation"] = "text_to_video"
		}
	}
	body, err := generation.RequestAsMap(input)
	if err != nil {
		return nil, err
	}
	// A narrow admission view binds every database read to the operation's
	// connection, without copying service mutexes or starting another worker.
	view := &Service{repo: s.repo, dataDir: s.service.dataDir, mode: s.service.mode, localResourceStorage: s.service.localResourceStorage, pluginRuntime: s.service.pluginRuntime, pluginRuntimeErr: s.service.pluginRuntimeErr, coordinator: s.service.coordinator, beefAPI: s.service.beefAPI}
	policy, err := s.service.runtimePolicyWithRepo(s.repo)
	if err != nil {
		return nil, err
	}
	adapter := operationRenderDependencies{s: s, policy: policy}
	deps := view.taskDependencies()
	deps.Projects = adapter
	deps.Policy = adapter
	deps.Persist = adapter
	deps.Runtime = taskRuntimeAdapter{s.service}
	deps.Present = operationRenderPresenter{}
	deps.Activity = nil
	deps.Logs = nil
	domain := localtask.NewService(localtask.NewStore(s.repo), deps)
	return domain.CreateTask(userID, localtask.CreateRequest{ProjectID: canvasID, Type: "canvas_" + kind, Prompt: prompt, Model: config.Model, Input: body})
}

func assistantGenerationConfig(raw map[string]any, kind string, meta map[string]any) (generation.Config, error) {
	encoded, err := json.Marshal(raw)
	if err != nil {
		return generation.Config{}, err
	}
	var snapshot assistantConfigSnapshot
	if err = json.Unmarshal(encoded, &snapshot); err != nil {
		return generation.Config{}, err
	}
	selected, _ := meta["model"].(string)
	choice := modelcatalog.ResolveAssistantGenerationModel(snapshot, kind, selected)
	if choice.KindMismatch || choice.ModelKey == "" {
		return generation.Config{}, operations.InvalidArg("generation_model_unavailable", "节点或默认生成模型不可用，请先配置模型")
	}
	channelID, modelID := modelcatalog.SplitModelKey(choice.ModelKey)
	if strings.Contains(strings.ToLower(modelID), "seedance") || strings.Contains(strings.ToLower(modelID), "seedream") {
		return generation.Config{}, operations.InvalidArg("generation_model_restricted", "本项目不使用 Seedance 或 Seedream，请选择其他已配置模型；视频使用 minimax-h3")
	}
	var channel map[string]any
	if items, ok := raw["channels"].([]any); ok {
		for _, item := range items {
			c, _ := item.(map[string]any)
			if c["id"] == channelID && c["enabled"] == true {
				channel = c
				break
			}
		}
	}
	if channel == nil {
		return generation.Config{}, operations.InvalidArg("generation_model_unavailable", "所选模型渠道不可用")
	}
	values := map[string]any{}
	for _, key := range []string{"size", "quality", "transparentBackground", "videoSeconds", "vquality", "videoGenerateAudio", "videoWatermark", "videoArkPrivateAssetUpload"} {
		if value, ok := raw[key]; ok {
			values[key] = value
		}
	}
	for _, key := range []string{"baseUrl", "apiKey", "secretKey", "headers", "credentialRef", "apiFormat", "interfaceType", "referenceAssetOrigin", "referenceMediaTransport"} {
		if value, ok := channel[key]; ok {
			values[key] = value
		}
	}
	for _, key := range []string{"size", "quality", "vquality", "transparentBackground"} {
		if value, ok := meta[key]; ok {
			values[key] = value
		}
	}
	for from, to := range map[string]string{"seconds": "videoSeconds", "generateAudio": "videoGenerateAudio", "watermark": "videoWatermark"} {
		if value, ok := meta[from]; ok {
			values[to] = value
		}
	}
	if count, ok := meta["count"]; ok && fmt.Sprint(count) != "1" {
		return generation.Config{}, operations.InvalidArg("generation_batch_requires_nodes", "自动生成每个节点对应一个产物，请按要求创建多个独立节点")
	}
	values["count"] = "1"
	values["model"] = modelID
	values["channelId"] = ""
	if channel["scope"] == "system" {
		values["channelId"] = channelID
	}
	if profiles, ok := channel["modelProfiles"].([]any); ok {
		for _, item := range profiles {
			profile, _ := item.(map[string]any)
			if profile["model"] != modelID {
				continue
			}
			if protocol, ok := profile["protocol"].(string); ok && protocol != "" {
				values["interfaceType"] = protocol
			}
			if capability, ok := profile["capabilityConfig"]; ok {
				values["capabilityConfig"] = capability
			}
		}
	}
	for _, key := range []string{"videoGenerateAudio", "videoWatermark", "videoArkPrivateAssetUpload"} {
		if value, ok := values[key]; ok {
			values[key] = fmt.Sprint(value)
		}
	}
	body, err := json.Marshal(values)
	if err != nil {
		return generation.Config{}, err
	}
	var config generation.Config
	if err = json.Unmarshal(body, &config); err != nil {
		return config, err
	}
	if config.CapabilityConfig == nil {
		config.CapabilityConfig = modelcatalog.DefaultModelCapabilityConfigForModel(config.InterfaceType, config.Model)
	}
	if config.BaseURL == "" {
		config.BaseURL = snapshot.BaseURL
	}
	return config, nil
}

var _ operations.CanvasGenerationAdmission = (*operationSession)(nil)
