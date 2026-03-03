package config

import (
	"fmt"
	"os"
	"strconv"
	"strings"
)

type Config struct {
	HTTPAddr                 string
	GRPCAddr                 string
	InternalJWTSecret        string
	InternalJWTIssuer        string
	GRPCAllowInsecure        bool
	GRPCTLSCAFile            string
	GRPCTLSCertFile          string
	GRPCTLSKeyFile           string
	GRPCTLSClientCAFile      string
	GRPCTLSRequireClientCert bool
	GRPCTLSServerName        string
	ExecutionMode            string
	ProviderBaseURL          string
	ProviderAPIKey           string
	ProviderTimeoutMS        int
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
	internalJWTSecret, err := passwordFromEnv("INTERNAL_JWT_SECRET", "INTERNAL_JWT_SECRET_FILE")
	if err != nil {
		return Config{}, err
	}
	internalJWTIssuer, err := requiredEnv("INTERNAL_JWT_ISSUER")
	if err != nil {
		return Config{}, err
	}
	executionMode, err := requiredEnv("IA_EXECUTION_MODE")
	if err != nil {
		return Config{}, err
	}
	executionMode = strings.ToLower(strings.TrimSpace(executionMode))
	if executionMode != "mock" && executionMode != "provider" {
		return Config{}, fmt.Errorf("invalid required environment variable IA_EXECUTION_MODE: must be mock or provider")
	}

	providerTimeoutMS, err := requiredPositiveIntEnv("IA_PROVIDER_TIMEOUT_MS")
	if err != nil {
		return Config{}, err
	}

	providerBaseURL := ""
	providerAPIKey := ""
	if executionMode == "provider" {
		providerBaseURL, err = requiredEnv("IA_PROVIDER_BASE_URL")
		if err != nil {
			return Config{}, err
		}
		providerAPIKey, err = passwordFromEnv("IA_PROVIDER_API_KEY", "IA_PROVIDER_API_KEY_FILE")
		if err != nil {
			return Config{}, err
		}
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
		GRPCAddr:                 grpcAddr,
		InternalJWTSecret:        internalJWTSecret,
		InternalJWTIssuer:        internalJWTIssuer,
		GRPCAllowInsecure:        grpcAllowInsecure,
		GRPCTLSCAFile:            optionalEnv("GRPC_TLS_CA_FILE"),
		GRPCTLSCertFile:          optionalEnv("GRPC_TLS_CERT_FILE"),
		GRPCTLSKeyFile:           optionalEnv("GRPC_TLS_KEY_FILE"),
		GRPCTLSClientCAFile:      optionalEnv("GRPC_TLS_CLIENT_CA_FILE"),
		GRPCTLSRequireClientCert: grpcTLSRequireClientCert,
		GRPCTLSServerName:        optionalEnv("GRPC_TLS_SERVER_NAME"),
		ExecutionMode:            executionMode,
		ProviderBaseURL:          providerBaseURL,
		ProviderAPIKey:           providerAPIKey,
		ProviderTimeoutMS:        providerTimeoutMS,
	}, nil
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
