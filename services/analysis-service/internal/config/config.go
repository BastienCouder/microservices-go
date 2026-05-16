package config

import (
	"fmt"
	"net/url"
	"os"
	"strings"
	"time"
)

type Config struct {
	HTTPAddr                       string
	MetricsAddr                    string
	GRPCAddr                       string
	DatabaseURL                    string
	BillingServiceURL              string
	ProjectServiceGRPCAddr         string
	InternalJWTSecret              string
	InternalJWTIssuer              string
	GRPCAllowInsecure              bool
	GRPCTLSCAFile                  string
	GRPCTLSCertFile                string
	GRPCTLSKeyFile                 string
	GRPCTLSServerName              string
	GRPCTLSClientCAFile            string
	GRPCTLSRequireClientCert       bool
	RedisAddr                      string
	RedisPassword                  string
	DashboardCacheTTL              time.Duration
	CloudflareAccountID            string
	CloudflareAPIToken             string
	IAServiceURL                   string
	ContentIssueAnalyzerModelID    string
	ContentIssueAnalyzerProviderID string
}

func Load() (Config, error) {
	httpAddr, err := requiredEnv("HTTP_ADDR")
	if err != nil {
		return Config{}, err
	}
	grpcAddr, err := requiredEnv("GRPC_ADDR")
	if err != nil {
		return Config{}, err
	}
	databaseURL, err := DatabaseURLFromEnv()
	if err != nil {
		return Config{}, err
	}
	projectServiceGRPCAddr, err := requiredEnv("PROJECT_SERVICE_GRPC_ADDR")
	if err != nil {
		return Config{}, err
	}
	billingServiceURL, err := requiredEnv("BILLING_SERVICE_URL")
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
	grpcAllowInsecure, err := optionalBoolEnv("GRPC_ALLOW_INSECURE", false)
	if err != nil {
		return Config{}, err
	}
	grpcTLSRequireClientCert, err := optionalBoolEnv("GRPC_TLS_REQUIRE_CLIENT_CERT", false)
	if err != nil {
		return Config{}, err
	}
	redisAddr, err := requiredEnv("REDIS_ADDR")
	if err != nil {
		return Config{}, err
	}
	redisPassword, err := optionalPasswordFromEnv("REDIS_PASSWORD", "REDIS_PASSWORD_FILE")
	if err != nil {
		return Config{}, err
	}
	dashboardCacheTTL, err := requiredDurationEnv("DASHBOARD_CACHE_TTL")
	if err != nil {
		return Config{}, err
	}
	cloudflareAPIToken, err := optionalPasswordFromEnv("CLOUDFLARE_API_TOKEN", "CLOUDFLARE_API_TOKEN_FILE")
	if err != nil {
		return Config{}, err
	}

	return Config{
		HTTPAddr:                       httpAddr,
		MetricsAddr:                    optionalEnv("METRICS_ADDR"),
		GRPCAddr:                       grpcAddr,
		DatabaseURL:                    databaseURL,
		BillingServiceURL:              billingServiceURL,
		ProjectServiceGRPCAddr:         projectServiceGRPCAddr,
		InternalJWTSecret:              internalJWTSecret,
		InternalJWTIssuer:              internalJWTIssuer,
		GRPCAllowInsecure:              grpcAllowInsecure,
		GRPCTLSCAFile:                  optionalEnv("GRPC_TLS_CA_FILE"),
		GRPCTLSCertFile:                optionalEnv("GRPC_TLS_CERT_FILE"),
		GRPCTLSKeyFile:                 optionalEnv("GRPC_TLS_KEY_FILE"),
		GRPCTLSServerName:              optionalEnv("GRPC_TLS_SERVER_NAME"),
		GRPCTLSClientCAFile:            optionalEnv("GRPC_TLS_CLIENT_CA_FILE"),
		GRPCTLSRequireClientCert:       grpcTLSRequireClientCert,
		RedisAddr:                      redisAddr,
		RedisPassword:                  redisPassword,
		DashboardCacheTTL:              dashboardCacheTTL,
		CloudflareAccountID:            optionalEnv("CLOUDFLARE_ACCOUNT_ID"),
		CloudflareAPIToken:             cloudflareAPIToken,
		IAServiceURL:                   optionalEnv("IA_SERVICE_URL"),
		ContentIssueAnalyzerModelID:    optionalEnv("CONTENT_ISSUE_ANALYZER_MODEL_ID"),
		ContentIssueAnalyzerProviderID: optionalEnv("CONTENT_ISSUE_ANALYZER_PROVIDER_ID"),
	}, nil
}

func DatabaseURLFromEnv() (string, error) {
	host, err := requiredEnv("ANALYSIS_DB_HOST")
	if err != nil {
		return "", err
	}
	port, err := requiredEnv("ANALYSIS_DB_PORT")
	if err != nil {
		return "", err
	}
	user, err := requiredEnv("ANALYSIS_DB_USER")
	if err != nil {
		return "", err
	}
	name, err := requiredEnv("ANALYSIS_DB_NAME")
	if err != nil {
		return "", err
	}
	sslMode, err := requiredEnv("ANALYSIS_DB_SSLMODE")
	if err != nil {
		return "", err
	}
	password, err := passwordFromEnv("ANALYSIS_DB_PASSWORD", "ANALYSIS_DB_PASSWORD_FILE")
	if err != nil {
		return "", err
	}

	return fmt.Sprintf(
		"postgres://%s:%s@%s:%s/%s?sslmode=%s",
		url.QueryEscape(user),
		url.QueryEscape(password),
		host,
		port,
		name,
		sslMode,
	), nil
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

func optionalPasswordFromEnv(passwordKey, fileKey string) (string, error) {
	if value := strings.TrimSpace(os.Getenv(passwordKey)); value != "" {
		return value, nil
	}
	filePath := strings.TrimSpace(os.Getenv(fileKey))
	if filePath == "" {
		return "", nil
	}
	raw, err := os.ReadFile(filePath)
	if err != nil {
		return "", fmt.Errorf("read password file %s: %w", filePath, err)
	}
	return strings.TrimSpace(string(raw)), nil
}

func requiredEnv(key string) (string, error) {
	value := os.Getenv(key)
	if value == "" {
		return "", fmt.Errorf("missing required environment variable %s", key)
	}
	return value, nil
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

func requiredDurationEnv(key string) (time.Duration, error) {
	value := strings.TrimSpace(os.Getenv(key))
	if value == "" {
		return 0, fmt.Errorf("missing required environment variable %s", key)
	}
	duration, err := time.ParseDuration(value)
	if err != nil {
		return 0, fmt.Errorf("invalid environment variable %s: %w", key, err)
	}
	return duration, nil
}
