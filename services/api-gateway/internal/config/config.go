package config

import (
	"fmt"
	"os"
	"strconv"
	"strings"
)

type Config struct {
	HTTPAddr                    string
	MetricsAddr                 string
	UserServiceURL              string
	AuthServiceURL              string
	OrganizationsServiceURL     string
	PermissionServiceURL        string
	PermissionServiceGRPC       string
	BillingServiceURL           string
	NotificationServiceURL      string
	ProjectServiceURL           string
	AnalysisServiceURL          string
	IAServiceURL                string
	AttributionServiceURL       string
	RateLimitRPM                int
	InternalJWTSecret           string
	InternalJWTIssuer           string
	CORSAllowedOrigins          []string
	TrustedProxyCIDRs           []string
	PermissionGRPCAllowInsecure bool
	PermissionGRPCTLSCAFile     string
	PermissionGRPCTLSCertFile   string
	PermissionGRPCTLSKeyFile    string
	PermissionGRPCTLSServerName string
}

func Load() (Config, error) {
	httpAddr, err := requiredEnv("HTTP_ADDR")
	if err != nil {
		return Config{}, err
	}

	userServiceURL, err := requiredEnv("USER_SERVICE_URL")
	if err != nil {
		return Config{}, err
	}

	authServiceURL, err := requiredEnv("AUTH_SERVICE_URL")
	if err != nil {
		return Config{}, err
	}

	organizationsServiceURL, err := requiredEnv("ORGANIZATIONS_SERVICE_URL")
	if err != nil {
		return Config{}, err
	}

	permissionServiceURL, err := requiredEnv("PERMISSION_SERVICE_URL")
	if err != nil {
		return Config{}, err
	}
	permissionServiceGRPC, err := requiredEnv("PERMISSION_SERVICE_GRPC_ADDR")
	if err != nil {
		return Config{}, err
	}

	billingServiceURL, err := requiredEnv("BILLING_SERVICE_URL")
	if err != nil {
		return Config{}, err
	}

	notificationServiceURL, err := requiredEnv("NOTIFICATION_SERVICE_URL")
	if err != nil {
		return Config{}, err
	}
	projectServiceURL, err := requiredEnv("PROJECT_SERVICE_URL")
	if err != nil {
		return Config{}, err
	}
	analysisServiceURL, err := requiredEnv("ANALYSIS_SERVICE_URL")
	if err != nil {
		return Config{}, err
	}
	iaServiceURL, err := requiredEnv("IA_SERVICE_URL")
	if err != nil {
		return Config{}, err
	}
	attributionServiceURL, err := requiredEnv("ATTRIBUTION_SERVICE_URL")
	if err != nil {
		return Config{}, err
	}

	rateLimitRPM, err := requiredPositiveIntEnv("RATE_LIMIT_RPM")
	if err != nil {
		return Config{}, err
	}
	internalJWTSecret, err := passwordFromEnv("INTERNAL_JWT_SECRET", "INTERNAL_JWT_SECRET_FILE")
	if err != nil {
		return Config{}, err
	}
	internalJWTIssuer, err := requiredEnv("INTERNAL_JWT_ISSUER")
	if err != nil {
		return Config{}, err
	}

	corsAllowedOrigins, err := requiredCSVEnv("CORS_ALLOWED_ORIGINS")
	if err != nil {
		return Config{}, err
	}
	trustedProxyCIDRs := optionalCSVEnv("TRUSTED_PROXY_CIDRS")
	permissionGRPCAllowInsecure, err := optionalBoolEnv("PERMISSION_GRPC_ALLOW_INSECURE", false)
	if err != nil {
		return Config{}, err
	}

	return Config{
		HTTPAddr:                    httpAddr,
		MetricsAddr:                 optionalEnv("METRICS_ADDR"),
		UserServiceURL:              userServiceURL,
		AuthServiceURL:              authServiceURL,
		OrganizationsServiceURL:     organizationsServiceURL,
		PermissionServiceURL:        permissionServiceURL,
		PermissionServiceGRPC:       permissionServiceGRPC,
		BillingServiceURL:           billingServiceURL,
		NotificationServiceURL:      notificationServiceURL,
		ProjectServiceURL:           projectServiceURL,
		AnalysisServiceURL:          analysisServiceURL,
		IAServiceURL:                iaServiceURL,
		AttributionServiceURL:       attributionServiceURL,
		RateLimitRPM:                rateLimitRPM,
		InternalJWTSecret:           internalJWTSecret,
		InternalJWTIssuer:           internalJWTIssuer,
		CORSAllowedOrigins:          corsAllowedOrigins,
		TrustedProxyCIDRs:           trustedProxyCIDRs,
		PermissionGRPCAllowInsecure: permissionGRPCAllowInsecure,
		PermissionGRPCTLSCAFile:     optionalEnv("PERMISSION_GRPC_TLS_CA_FILE"),
		PermissionGRPCTLSCertFile:   optionalEnv("PERMISSION_GRPC_TLS_CERT_FILE"),
		PermissionGRPCTLSKeyFile:    optionalEnv("PERMISSION_GRPC_TLS_KEY_FILE"),
		PermissionGRPCTLSServerName: optionalEnv("PERMISSION_GRPC_TLS_SERVER_NAME"),
	}, nil
}

func requiredEnv(key string) (string, error) {
	value := os.Getenv(key)
	if value == "" {
		return "", fmt.Errorf("missing required environment variable %s", key)
	}
	return value, nil
}

func passwordFromEnv(passwordKey, fileKey string) (string, error) {
	if value := strings.TrimSpace(os.Getenv(passwordKey)); value != "" {
		return value, nil
	}
	filePath := strings.TrimSpace(os.Getenv(fileKey))
	if filePath == "" {
		return "", fmt.Errorf("missing required environment variable %s or %s", passwordKey, fileKey)
	}
	raw, err := os.ReadFile(filePath)
	if err != nil {
		return "", fmt.Errorf("read password file %s: %w", filePath, err)
	}
	value := strings.TrimSpace(string(raw))
	if value == "" {
		return "", fmt.Errorf("password file %s is empty", filePath)
	}
	return value, nil
}

func requiredPositiveIntEnv(key string) (int, error) {
	value, err := requiredEnv(key)
	if err != nil {
		return 0, err
	}
	parsed, err := strconv.Atoi(value)
	if err != nil || parsed <= 0 {
		return 0, fmt.Errorf("invalid required environment variable %s: must be a positive integer", key)
	}
	return parsed, nil
}

func requiredCSVEnv(key string) ([]string, error) {
	raw, err := requiredEnv(key)
	if err != nil {
		return nil, err
	}
	parts := make([]string, 0)
	for _, part := range strings.Split(raw, ",") {
		trimmed := strings.TrimSpace(part)
		if trimmed == "" {
			continue
		}
		parts = append(parts, trimmed)
	}
	if len(parts) == 0 {
		return nil, fmt.Errorf("invalid required environment variable %s: must contain at least one origin", key)
	}
	return parts, nil
}

func optionalCSVEnv(key string) []string {
	raw := strings.TrimSpace(os.Getenv(key))
	if raw == "" {
		return nil
	}
	parts := make([]string, 0)
	for _, part := range strings.Split(raw, ",") {
		trimmed := strings.TrimSpace(part)
		if trimmed == "" {
			continue
		}
		parts = append(parts, trimmed)
	}
	if len(parts) == 0 {
		return nil
	}
	return parts
}

func optionalEnv(key string) string {
	return strings.TrimSpace(os.Getenv(key))
}

func optionalBoolEnv(key string, defaultValue bool) (bool, error) {
	raw := strings.TrimSpace(os.Getenv(key))
	if raw == "" {
		return defaultValue, nil
	}
	switch strings.ToLower(raw) {
	case "1", "true", "yes", "on":
		return true, nil
	case "0", "false", "no", "off":
		return false, nil
	default:
		return false, fmt.Errorf("invalid environment variable %s: must be a boolean", key)
	}
}
