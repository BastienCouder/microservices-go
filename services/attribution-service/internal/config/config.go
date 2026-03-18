package config

import (
	"fmt"
	"net/url"
	"os"
	"strings"
)

type Config struct {
	HTTPAddr               string
	MetricsAddr            string
	DatabaseURL            string
	ProjectServiceGRPCAddr string
	ProjectServiceURL      string
	InternalJWTSecret      string
	InternalJWTIssuer      string
	GA4                    GA4Config
	GRPCAllowInsecure      bool
	GRPCTLSCAFile          string
	GRPCTLSCertFile        string
	GRPCTLSKeyFile         string
	GRPCTLSServerName      string
}

type GA4Config struct {
	Enabled            bool
	PropertyID         string
	ServiceAccountJSON string
}

func Load() (Config, error) {
	httpAddr, err := requiredEnv("HTTP_ADDR")
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
	internalJWTSecret, err := passwordFromEnv("INTERNAL_JWT_SECRET", "INTERNAL_JWT_SECRET_FILE")
	if err != nil {
		return Config{}, err
	}
	internalJWTIssuer, err := requiredEnv("INTERNAL_JWT_ISSUER")
	if err != nil {
		return Config{}, err
	}
	ga4Config, err := loadGA4Config()
	if err != nil {
		return Config{}, err
	}
	grpcAllowInsecure, err := optionalBoolEnv("GRPC_ALLOW_INSECURE", false)
	if err != nil {
		return Config{}, err
	}

	return Config{
		HTTPAddr:               httpAddr,
		MetricsAddr:            optionalEnv("METRICS_ADDR"),
		DatabaseURL:            databaseURL,
		ProjectServiceGRPCAddr: projectServiceGRPCAddr,
		ProjectServiceURL:      optionalEnv("PROJECT_SERVICE_URL"),
		InternalJWTSecret:      internalJWTSecret,
		InternalJWTIssuer:      internalJWTIssuer,
		GA4:                    ga4Config,
		GRPCAllowInsecure:      grpcAllowInsecure,
		GRPCTLSCAFile:          optionalEnv("GRPC_TLS_CA_FILE"),
		GRPCTLSCertFile:        optionalEnv("GRPC_TLS_CERT_FILE"),
		GRPCTLSKeyFile:         optionalEnv("GRPC_TLS_KEY_FILE"),
		GRPCTLSServerName:      optionalEnv("GRPC_TLS_SERVER_NAME"),
	}, nil
}

func DatabaseURLFromEnv() (string, error) {
	host, err := requiredEnv("ATTRIBUTION_DB_HOST")
	if err != nil {
		return "", err
	}
	port, err := requiredEnv("ATTRIBUTION_DB_PORT")
	if err != nil {
		return "", err
	}
	user, err := requiredEnv("ATTRIBUTION_DB_USER")
	if err != nil {
		return "", err
	}
	name, err := requiredEnv("ATTRIBUTION_DB_NAME")
	if err != nil {
		return "", err
	}
	sslMode, err := requiredEnv("ATTRIBUTION_DB_SSLMODE")
	if err != nil {
		return "", err
	}
	password, err := passwordFromEnv("ATTRIBUTION_DB_PASSWORD", "ATTRIBUTION_DB_PASSWORD_FILE")
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

func requiredEnv(key string) (string, error) {
	value := os.Getenv(key)
	if value == "" {
		return "", fmt.Errorf("missing required environment variable %s", key)
	}
	return value, nil
}

func loadGA4Config() (GA4Config, error) {
	enabled, err := optionalBoolEnv("GA4_ENABLED", false)
	if err != nil {
		return GA4Config{}, err
	}
	serviceAccountJSON, err := optionalEnvOrFile("GA4_SERVICE_ACCOUNT_JSON", "GA4_SERVICE_ACCOUNT_JSON_FILE")
	if err != nil {
		return GA4Config{}, err
	}
	cfg := GA4Config{
		Enabled:            enabled,
		PropertyID:         optionalEnv("GA4_PROPERTY_ID"),
		ServiceAccountJSON: serviceAccountJSON,
	}
	if !enabled {
		return cfg, nil
	}
	if strings.TrimSpace(cfg.PropertyID) == "" || strings.TrimSpace(cfg.ServiceAccountJSON) == "" {
		return GA4Config{}, fmt.Errorf("missing required ga4 configuration when GA4_ENABLED=true")
	}
	return cfg, nil
}

func optionalEnv(key string) string {
	return strings.TrimSpace(os.Getenv(key))
}

func optionalEnvOrFile(valueKey, fileKey string) (string, error) {
	if value := strings.TrimSpace(os.Getenv(valueKey)); value != "" {
		return value, nil
	}
	filePath := strings.TrimSpace(os.Getenv(fileKey))
	if filePath == "" {
		return "", nil
	}
	raw, err := os.ReadFile(filePath)
	if err != nil {
		return "", fmt.Errorf("read value file %s for %s: %w", filePath, valueKey, err)
	}
	return strings.TrimSpace(string(raw)), nil
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
