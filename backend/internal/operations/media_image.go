package operations

import (
	"bytes"
	"context"
	"crypto/sha256"
	"encoding/base64"
	"encoding/hex"
	"image"
	"image/color"
	"image/draw"
	_ "image/gif"
	"image/jpeg"
	_ "image/png"
	"os"
)

// Static image inspection does not require process-wide video decoders.
// Check dimensions before decoding so a small compressed file cannot allocate
// unbounded image memory. The source hash remains the version authority.
func inspectStillImage(ctx context.Context, operation string, args mediaArgs, resourceID, version, input string) (any, error) {
	if args.StartMs != 0 || args.EndMs != 0 || (args.Mode != "" && args.Mode != "frames") || operation == "media.check" {
		return nil, InvalidArg("invalid_media_interval", "图片仅支持 overview 或零区间的 frames 检查")
	}
	if err := ctx.Err(); err != nil {
		return nil, err
	}
	file, err := os.Open(input)
	if err != nil {
		return nil, PreconditionFailed("media_read_failed", "无法读取图片", nil)
	}
	defer file.Close()
	config, _, err := image.DecodeConfig(file)
	if err != nil || config.Width <= 0 || config.Height <= 0 || int64(config.Width)*int64(config.Height) > 32000000 {
		return nil, PreconditionFailed("media_image_decode_failed", "图片格式无效或尺寸超过静态预览限制", nil)
	}
	if _, err = file.Seek(0, 0); err != nil {
		return nil, err
	}
	source, _, err := image.Decode(file)
	if err != nil {
		return nil, PreconditionFailed("media_image_decode_failed", "图片解码失败", nil)
	}
	width, height := config.Width, config.Height
	if width > 640 || height > 640 {
		if width >= height {
			height = max(1, height*640/width)
			width = 640
		} else {
			width = max(1, width*640/height)
			height = 640
		}
	}
	preview := image.NewRGBA(image.Rect(0, 0, width, height))
	bounds := source.Bounds()
	for y := 0; y < height; y++ {
		for x := 0; x < width; x++ {
			preview.Set(x, y, source.At(bounds.Min.X+x*config.Width/width, bounds.Min.Y+y*config.Height/height))
		}
	}
	flattened := image.NewRGBA(preview.Bounds())
	draw.Draw(flattened, flattened.Bounds(), &image.Uniform{C: color.White}, image.Point{}, draw.Src)
	draw.Draw(flattened, flattened.Bounds(), preview, image.Point{}, draw.Over)
	if err = ctx.Err(); err != nil {
		return nil, err
	}
	var encoded bytes.Buffer
	if err = jpeg.Encode(&encoded, flattened, &jpeg.Options{Quality: 88}); err != nil {
		return nil, err
	}
	data := encoded.Bytes()
	hash := sha256.Sum256(data)
	src := MediaSource{CanvasID: args.CanvasID, NodeID: args.NodeID, AssetID: args.AssetID, ResourceID: resourceID, Version: version, TimestampKind: "static_image"}
	return MediaResult{Source: src, HasVideo: true, Content: []MediaPart{{Type: "image", MimeType: "image/jpeg", Data: base64.StdEncoding.EncodeToString(data), SHA256: hex.EncodeToString(hash[:]), Source: src}}, Note: "实际静态图片预览；不代表已查看动画、视频或音频。"}, nil
}
