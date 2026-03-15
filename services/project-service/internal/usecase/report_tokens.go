package usecase

import (
	"crypto/hmac"
	"crypto/sha256"
	"encoding/base64"
	"encoding/hex"
	"fmt"
	"strconv"
	"strings"
	"time"
)

func (s *Service) buildReportShareToken(report *ProjectReport) (string, error) {
	if report == nil {
		return "", fmt.Errorf("%w: report is required", ErrValidation)
	}
	if strings.TrimSpace(s.reportSigningSecret) == "" {
		return "", fmt.Errorf("report signing secret is not configured")
	}

	expiry := report.ShareExpiresAt.UTC().Unix()
	payload := report.ID + "." + strconv.FormatInt(expiry, 10)
	mac := hmac.New(sha256.New, []byte(s.reportSigningSecret))
	_, _ = mac.Write([]byte(payload))
	signature := hex.EncodeToString(mac.Sum(nil))

	raw := payload + "." + signature
	return base64.RawURLEncoding.EncodeToString([]byte(raw)), nil
}

func (s *Service) verifyReportShareToken(token string) (string, time.Time, error) {
	if strings.TrimSpace(s.reportSigningSecret) == "" {
		return "", time.Time{}, fmt.Errorf("report signing secret is not configured")
	}

	raw, err := base64.RawURLEncoding.DecodeString(strings.TrimSpace(token))
	if err != nil {
		return "", time.Time{}, fmt.Errorf("%w: invalid share token", ErrUnauthorized)
	}

	parts := strings.Split(string(raw), ".")
	if len(parts) != 3 {
		return "", time.Time{}, fmt.Errorf("%w: malformed share token", ErrUnauthorized)
	}

	expiryUnix, err := strconv.ParseInt(parts[1], 10, 64)
	if err != nil || expiryUnix <= 0 {
		return "", time.Time{}, fmt.Errorf("%w: invalid share token expiry", ErrUnauthorized)
	}
	expiry := time.Unix(expiryUnix, 0).UTC()

	mac := hmac.New(sha256.New, []byte(s.reportSigningSecret))
	_, _ = mac.Write([]byte(parts[0] + "." + parts[1]))
	expectedSignature := hex.EncodeToString(mac.Sum(nil))
	if !hmac.Equal([]byte(parts[2]), []byte(expectedSignature)) {
		return "", time.Time{}, fmt.Errorf("%w: invalid share token signature", ErrUnauthorized)
	}
	if s.now().UTC().After(expiry) {
		return "", time.Time{}, fmt.Errorf("%w: share token expired", ErrUnauthorized)
	}

	return parts[0], expiry, nil
}
