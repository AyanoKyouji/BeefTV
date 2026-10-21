package generation

import (
	"context"
	"encoding/base64"
	"encoding/json"
	"errors"
	"net/url"
	"strings"

	"infinite-canvas/backend/internal/protocol"
)

const predictionsH3Protocol = "predictions-h3-video"
const predictionsFileLimit = 20 << 20

// This upload belongs to the selected relay contract, not arbitrary URL-only
// providers. Use the same authenticated outbound transport as generation.
func hydratePredictionsReference(ctx context.Context, userID string, media *Media, config Config) error {
	if err := ctx.Err(); err != nil {
		return err
	}
	if !strings.HasPrefix(media.StorageKey, "resource:") && !strings.HasPrefix(media.DataURL, "data:") && !strings.HasPrefix(media.URL, "data:") {
		if predictionsPublicURL(media.URL) {
			return nil
		}
		return errors.New("参考素材地址无效")
	}
	if media.Bytes > predictionsFileLimit {
		return errors.New("参考素材超过中转平台 20 MiB 限制")
	}
	if err := HydrateOne(ctx, userID, media, MediaHydrationPolicy{}); err != nil {
		return err
	}
	value := firstNonEmpty(media.DataURL, media.URL)
	_, encoded, ok := strings.Cut(value, ",")
	if !ok || !strings.HasPrefix(value, "data:") || !strings.Contains(strings.SplitN(value, ",", 2)[0], ";base64") {
		return errors.New("参考素材内容无效")
	}
	body, err := base64.StdEncoding.DecodeString(encoded)
	if err != nil || len(body) == 0 {
		return errors.New("参考素材内容无效")
	}
	if len(body) > predictionsFileLimit {
		return errors.New("参考素材超过中转平台 20 MiB 限制")
	}
	raw, err := ExecuteProtocolRequest(WithRequestKind(ctx, "reference_upload"), config, protocol.RequestSpec{
		Method: "POST", Path: "/api/v1/files", OriginPath: true, ContentType: "multipart/form-data",
		Auth:  protocol.ManifestAuth{Type: "bearer"},
		Files: []protocol.RequestFilePart{{Name: "files", Filename: media.Name, MIMEType: media.MimeType, Reference: protocol.MediaReference{DataURL: value}}},
	})
	if err != nil {
		return err
	}
	var receipt struct {
		Code *int `json:"code"`
		Data struct {
			List []struct {
				URL string `json:"url"`
			} `json:"list"`
		} `json:"data"`
	}
	if json.Unmarshal(raw, &receipt) != nil || receipt.Code == nil || *receipt.Code != 0 || len(receipt.Data.List) != 1 || !predictionsPublicURL(receipt.Data.List[0].URL) {
		return errors.New("参考素材上传回执无效，本次尚未开始生成")
	}
	media.URL, media.DataURL, media.StorageKey = receipt.Data.List[0].URL, "", ""
	return nil
}

func predictionsPublicURL(value string) bool {
	address, err := url.Parse(strings.TrimSpace(value))
	return err == nil && (address.Scheme == "https" || address.Scheme == "http") && address.Hostname() != "" && address.User == nil
}
