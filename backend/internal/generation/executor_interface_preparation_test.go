package generation

import (
	"context"
	"errors"
	"strings"
	"testing"
)

func TestImageInterfaceValidationOnlyProvesUnsentForNewImageRequests(t *testing.T) {
	for _, tc := range []struct {
		name, mode, providerID string
		unsent                 bool
	}{
		{"new-image", "image", "", true},
		{"resumed-image", "image", "accepted-provider-job", false},
		{"other-mode", "video", "", false},
	} {
		t.Run(tc.name, func(t *testing.T) {
			ctx := context.Background()
			if tc.providerID != "" {
				ctx = WithRuntime(ctx, Runtime{Call: CallMeta{ProviderRequestID: tc.providerID}})
			}
			err := validatePreparedInput(ctx, Input{Mode: tc.mode, Config: Config{
				InterfaceType: "uninstalled-image-test", Model: "fixture", BaseURL: "https://example.invalid", APIKey: "synthetic",
			}})
			var preparation RequestPreparationError
			if err == nil || !strings.Contains(err.Error(), "未安装") || errors.As(err, &preparation) != tc.unsent {
				t.Fatalf("unsent=%v err=%v", tc.unsent, err)
			}
		})
	}
}
