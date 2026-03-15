package usecase

import (
	"encoding/base64"
	"fmt"
	"strings"
)

func encodeReportPDF(payload []byte) string {
	if len(payload) == 0 {
		return ""
	}
	return base64.StdEncoding.EncodeToString(payload)
}

func decodeReportPDF(value string) ([]byte, error) {
	value = strings.TrimSpace(value)
	if value == "" {
		return nil, fmt.Errorf("%w: report pdf is empty", ErrNotFound)
	}
	payload, err := base64.StdEncoding.DecodeString(value)
	if err != nil {
		return nil, fmt.Errorf("decode report pdf: %w", err)
	}
	return payload, nil
}
