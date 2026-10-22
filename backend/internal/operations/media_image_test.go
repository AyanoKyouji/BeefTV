package operations

import (
	"bytes"
	"encoding/base64"
	"image"
	"image/color"
	"image/jpeg"
	"image/png"
	"testing"
)

func TestStillImageInspectionWithoutVideoTools(t *testing.T) {
	t.Setenv("CANVAS_FFMPEG_PATH", "/missing/ffmpeg")
	t.Setenv("CANVAS_FFPROBE_PATH", "/missing/ffprobe")
	t.Setenv("PATH", "")
	source := image.NewRGBA(image.Rect(0, 0, 1360, 768))
	source.Set(0, 0, color.RGBA{R: 255, A: 255})
	for _, format := range []string{"png", "jpeg"} {
		t.Run(format, func(t *testing.T) {
			var encoded bytes.Buffer
			if format == "png" {
				png.Encode(&encoded, source)
			} else {
				jpeg.Encode(&encoded, source, nil)
			}
			d := &mediaDomain{owner: "owner", data: encoded.Bytes(), mimeType: "image/" + format}
			args := mediaArgs{CanvasID: "canvas", NodeID: "node"}
			overview, err := mediaTestCall(t, d, "media.overview", args)
			if err != nil {
				t.Fatal(err)
			}
			if overview.Source.Version == "" || overview.Source.ResourceID != "resource" || overview.Source.TimestampKind != "static_image" || len(overview.Content) != 1 {
				t.Fatalf("wrong overview %+v", overview.Source)
			}
			args.ExpectedVersion = overview.Source.Version
			args.Mode = "frames"
			inspected, err := mediaTestCall(t, d, "media.inspect", args)
			if err != nil {
				t.Fatal(err)
			}
			data, err := base64.StdEncoding.DecodeString(inspected.Content[0].Data)
			if err != nil {
				t.Fatal(err)
			}
			config, err := jpeg.DecodeConfig(bytes.NewReader(data))
			if err != nil || config.Width != 640 || config.Height != 361 {
				t.Fatalf("invalid bounded preview %+v %v", config, err)
			}
			args.ExpectedVersion = "stale"
			if _, err = mediaTestCall(t, d, "media.inspect", args); AsError(err).Reason != "stale_media_version" {
				t.Fatalf("accepted stale source %v", err)
			}
			args.ExpectedVersion = overview.Source.Version
			for _, mode := range []string{"audio", "video", "invalid"} {
				args.Mode = mode
				if _, err = mediaTestCall(t, d, "media.inspect", args); err == nil {
					t.Fatalf("accepted %s", mode)
				}
			}
			args.Mode = "frames"
			args.EndMs = 1
			if _, err = mediaTestCall(t, d, "media.inspect", args); err == nil {
				t.Fatal("accepted image interval")
			}
			args.EndMs = 0
			args.ResourceID = "foreign"
			if _, err = mediaTestCall(t, d, "media.inspect", args); AsError(err).Reason != "media_not_referenced" {
				t.Fatalf("accepted foreign media %v", err)
			}
		})
	}
}

func TestStillImageRejectsTruncatedSource(t *testing.T) {
	d := &mediaDomain{owner: "owner", mimeType: "image/png", data: []byte("\x89PNG\r\n\x1a\ninvalid")}
	if _, err := mediaTestCall(t, d, "media.overview", mediaArgs{CanvasID: "canvas", NodeID: "node"}); err == nil {
		t.Fatal("accepted invalid PNG")
	}
}
