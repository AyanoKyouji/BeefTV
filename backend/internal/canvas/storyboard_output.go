package canvas

import (
	"net/http"
	"strconv"
	"strings"
	"time"

	"infinite-canvas/backend/internal/kernel"
)

type StoryboardOutputConnection struct {
	Summary    UserDataSummary
	EdgeID     string
	Created    bool
	RowUpdated bool
}

// 分镜输出是行级归属，不是送往生成节点的普通参考输入。
func (s *Service) ConnectUserCanvasStoryboardOutputAtRevision(userID, canvasID, scriptID, rowID, imageID string, expectedRevision int64) (StoryboardOutputConnection, error) {
	var result StoryboardOutputConnection
	if err := requireExpectedRevision(expectedRevision); err != nil {
		return result, err
	}
	if strings.TrimSpace(rowID) == "" {
		return result, kernel.NewAppError(http.StatusBadRequest, "storyboardRowId 必填")
	}
	doc, err := s.loadCanvasDoc(userID, canvasID)
	if err != nil {
		return result, err
	}
	if canvasRevisionValue(doc) != expectedRevision {
		return result, canvasRevisionConflict()
	}
	script := findCanvasNode(doc, scriptID)
	if script == nil || canvasNodeType(script) != storyboardNodeType {
		return result, kernel.NewAppError(http.StatusBadRequest, "分镜输出起点必须是当前画布的 script 节点")
	}
	row := findStoryboardRow(storyboardDocumentRows(script), rowID)
	if row == nil {
		return result, kernel.NewAppError(http.StatusNotFound, "分镜行不属于指定脚本")
	}
	image := findCanvasNode(doc, imageID)
	if image == nil || canvasNodeType(image) != "image" {
		return result, kernel.NewAppError(http.StatusBadRequest, "分镜图片输出终点必须是当前画布的 image 节点")
	}
	if previous := nodeString(row, "imageNodeId"); previous != "" && previous != imageID {
		return result, kernel.NewAppError(http.StatusConflict, "分镜已有图片输出，请复用原图片节点或先明确解除关联")
	}
	nodes, _ := doc["nodes"].([]any)
	for _, raw := range nodes {
		node, _ := raw.(map[string]any)
		for _, rawRow := range storyboardDocumentRows(node) {
			other, _ := rawRow.(map[string]any)
			if other["imageNodeId"] == imageID && (node["id"] != scriptID || other["id"] != rowID) {
				return result, kernel.NewAppError(http.StatusConflict, "图片节点已归属另一分镜，未更改原关联")
			}
		}
	}
	edges, _ := doc["connections"].([]any)
	for _, raw := range edges {
		edge, _ := raw.(map[string]any)
		if edge["toNodeId"] != imageID || edge["relation"] != "storyboard-output" {
			continue
		}
		if edge["fromNodeId"] != scriptID || edge["storyboardRowId"] != rowID {
			return result, kernel.NewAppError(http.StatusConflict, "图片输出连线已归属另一分镜")
		}
		if row["imageNodeId"] != imageID || row["imageBindingStale"] == true || edge["fromHandleId"] != "row:"+rowID {
			return result, kernel.NewAppError(http.StatusConflict, "已有输出连线与分镜不一致，请先在画布核对")
		}
		summary, err := s.canvasSummary(userID, canvasID)
		if err != nil {
			return result, err
		}
		if summary.Revision != expectedRevision {
			return result, canvasRevisionConflict()
		}
		return StoryboardOutputConnection{Summary: summary, EdgeID: nodeString(edge, "id")}, nil
	}
	_, hadStaleMarker := row["imageBindingStale"]
	result.RowUpdated = row["imageNodeId"] != imageID || hadStaleMarker
	row["imageNodeId"] = imageID
	delete(row, "imageBindingStale")
	result.EdgeID = "edge-" + strconv.FormatInt(time.Now().UnixNano(), 36)
	doc["connections"] = append(edges, map[string]any{
		"id": result.EdgeID, "fromNodeId": scriptID, "toNodeId": imageID,
		"fromHandleId": "row:" + rowID, "storyboardRowId": rowID, "relation": "storyboard-output",
	})
	result.Summary, err = s.saveCanvasDocWithRevision(userID, canvasID, doc, expectedRevision)
	result.Created = err == nil
	return result, err
}
