package config

import (
	"fmt"
	"net/url"
	"os"
	"strings"
)

type Config struct {
	HTTPAddr                 string
	MetricsAddr              string
	GRPCAddr                 string
	DatabaseURL              string
	OrganizationsServiceURL  string
	InternalJWTSecret        string
	InternalJWTIssuer        string
	GRPCAllowInsecure        bool
	GRPCTLSCAFile            string
	GRPCTLSCertFile          string
	GRPCTLSKeyFile           string
	GRPCTLSClientCAFile      string
	GRPCTLSRequireClientCert bool
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
	organizationsServiceURL, err := requiredEnv("ORGANIZATIONS_SERVICE_URL")
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
	return Config{
		HTTPAddr:                 httpAddr,
		MetricsAddr:              optionalEnv("METRICS_ADDR"),
		GRPCAddr:                 grpcAddr,
		DatabaseURL:              databaseURL,
		OrganizationsServiceURL:  organizationsServiceURL,
		InternalJWTSecret:        internalJWTSecret,
		InternalJWTIssuer:        internalJWTIssuer,
		GRPCAllowInsecure:        grpcAllowInsecure,
		GRPCTLSCAFile:            optionalEnv("GRPC_TLS_CA_FILE"),
		GRPCTLSCertFile:          optionalEnv("GRPC_TLS_CERT_FILE"),
		GRPCTLSKeyFile:           optionalEnv("GRPC_TLS_KEY_FILE"),
		GRPCTLSClientCAFile:      optionalEnv("GRPC_TLS_CLIENT_CA_FILE"),
		GRPCTLSRequireClientCert: grpcTLSRequireClientCert,
	}, nil
}

func DatabaseURLFromEnv() (string, error) {
	host, err := requiredEnv("PERMISSION_DB_HOST")
	if err != nil {
		return "", err
	}
	port, err := requiredEnv("PERMISSION_DB_PORT")
	if err != nil {
		return "", err
	}
	user, err := requiredEnv("PERMISSION_DB_USER")
	if err != nil {
		return "", err
	}
	name, err := requiredEnv("PERMISSION_DB_NAME")
	if err != nil {
		return "", err
	}
	sslMode, err := requiredEnv("PERMISSION_DB_SSLMODE")
	if err != nil {
		return "", err
	}
	password, err := passwordFromEnv("PERMISSION_DB_PASSWORD", "PERMISSION_DB_PASSWORD_FILE")
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
