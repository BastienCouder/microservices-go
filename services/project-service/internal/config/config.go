package config

import (
	"fmt"
	"net/url"
	"os"
	"strconv"
	"strings"
	"time"
)

type Config struct {
	HTTPAddr                 string
	MetricsAddr              string
	GRPCAddr                 string
	DatabaseURL              string
	BillingServiceURL        string
	AnalysisServiceGRPCAddr  string
	IAServiceGRPCAddr        string
	IAPromptTimeout          time.Duration
	AttributionServiceURL    string
	SecretEncryptionKey      string
	RabbitMQURL              string
	RabbitMQExchange         string
	RabbitMQFinalizeQueue    string
	RabbitMQFinalizeRouteKey string
	InternalJWTSecret        string
	InternalJWTIssuer        string
	GRPCAllowInsecure        bool
	GRPCTLSCAFile            string
	GRPCTLSCertFile          string
	GRPCTLSKeyFile           string
	GRPCTLSServerName        string
	GRPCTLSClientCAFile      string
	GRPCTLSRequireClientCert bool
	GA4OAuthClientID         string
	GA4OAuthClientSecret     string
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
	analysisServiceGRPCAddr, err := requiredEnv("ANALYSIS_SERVICE_GRPC_ADDR")
	if err != nil {
		return Config{}, err
	}
	iaServiceGRPCAddr, err := requiredEnv("IA_SERVICE_GRPC_ADDR")
	if err != nil {
		return Config{}, err
	}
	iaPromptTimeoutMS, err := optionalPositiveIntEnv("PROJECT_IA_PROMPT_TIMEOUT_MS", 30000)
	if err != nil {
		return Config{}, err
	}
	rabbitMQURL, err := requiredEnvOrFile("RABBITMQ_URL", "RABBITMQ_URL_FILE")
	if err != nil {
		return Config{}, err
	}
	rabbitMQExchange, err := requiredEnv("RABBITMQ_EXCHANGE")
	if err != nil {
		return Config{}, err
	}
	rabbitMQFinalizeQueue, err := requiredEnv("RABBITMQ_PROJECT_FINALIZE_QUEUE")
	if err != nil {
		return Config{}, err
	}
	rabbitMQFinalizeRouteKey, err := requiredEnv("RABBITMQ_PROJECT_FINALIZE_ROUTING_KEY")
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
	secretEncryptionKey, err := requiredEnvOrFile("PROJECT_SECRET_ENCRYPTION_KEY", "PROJECT_SECRET_ENCRYPTION_KEY_FILE")
	if err != nil {
		return Config{}, err
	}
	grpcAllowInsecure, err := optionalBoolEnv("GRPC_ALLOW_INSECURE", false)
	if err != nil {
		return Config{}, err
	}
	grpcTLSCAFile := optionalEnv("GRPC_TLS_CA_FILE")
	grpcTLSCertFile := optionalEnv("GRPC_TLS_CERT_FILE")
	grpcTLSKeyFile := optionalEnv("GRPC_TLS_KEY_FILE")
	grpcTLSServerName := optionalEnv("GRPC_TLS_SERVER_NAME")
	grpcTLSClientCAFile := optionalEnv("GRPC_TLS_CLIENT_CA_FILE")
	grpcTLSRequireClientCert, err := optionalBoolEnv("GRPC_TLS_REQUIRE_CLIENT_CERT", false)
	if err != nil {
		return Config{}, err
	}
	ga4OAuthClientID, err := passwordFromEnv("GA4_OAUTH_CLIENT_ID", "GA4_OAUTH_CLIENT_ID_FILE")
	if err != nil {
		return Config{}, err
	}
	ga4OAuthClientSecret, err := passwordFromEnv("GA4_OAUTH_CLIENT_SECRET", "GA4_OAUTH_CLIENT_SECRET_FILE")
	if err != nil {
		return Config{}, err
	}

	return Config{
		HTTPAddr:                 httpAddr,
		MetricsAddr:              optionalEnv("METRICS_ADDR"),
		GRPCAddr:                 grpcAddr,
		DatabaseURL:              databaseURL,
		BillingServiceURL:        optionalEnv("BILLING_SERVICE_URL"),
		AnalysisServiceGRPCAddr:  analysisServiceGRPCAddr,
		IAServiceGRPCAddr:        iaServiceGRPCAddr,
		IAPromptTimeout:          time.Duration(iaPromptTimeoutMS) * time.Millisecond,
		AttributionServiceURL:    optionalEnv("ATTRIBUTION_SERVICE_URL"),
		SecretEncryptionKey:      secretEncryptionKey,
		RabbitMQURL:              rabbitMQURL,
		RabbitMQExchange:         rabbitMQExchange,
		RabbitMQFinalizeQueue:    rabbitMQFinalizeQueue,
		RabbitMQFinalizeRouteKey: rabbitMQFinalizeRouteKey,
		InternalJWTSecret:        internalJWTSecret,
		InternalJWTIssuer:        internalJWTIssuer,
		GRPCAllowInsecure:        grpcAllowInsecure,
		GRPCTLSCAFile:            grpcTLSCAFile,
		GRPCTLSCertFile:          grpcTLSCertFile,
		GRPCTLSKeyFile:           grpcTLSKeyFile,
		GRPCTLSServerName:        grpcTLSServerName,
		GRPCTLSClientCAFile:      grpcTLSClientCAFile,
		GRPCTLSRequireClientCert: grpcTLSRequireClientCert,
		GA4OAuthClientID:         ga4OAuthClientID,
		GA4OAuthClientSecret:     ga4OAuthClientSecret,
	}, nil
}

func DatabaseURLFromEnv() (string, error) {
	host, err := requiredEnv("PROJECT_DB_HOST")
	if err != nil {
		return "", err
	}
	port, err := requiredEnv("PROJECT_DB_PORT")
	if err != nil {
		return "", err
	}
	user, err := requiredEnv("PROJECT_DB_USER")
	if err != nil {
		return "", err
	}
	name, err := requiredEnv("PROJECT_DB_NAME")
	if err != nil {
		return "", err
	}
	sslMode, err := requiredEnv("PROJECT_DB_SSLMODE")
	if err != nil {
		return "", err
	}
	password, err := passwordFromEnv("PROJECT_DB_PASSWORD", "PROJECT_DB_PASSWORD_FILE")
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

func requiredEnvOrFile(key, fileKey string) (string, error) {
	if value := strings.TrimSpace(os.Getenv(key)); value != "" {
		return value, nil
	}
	filePath := strings.TrimSpace(os.Getenv(fileKey))
	if filePath == "" {
		return "", fmt.Errorf("missing required environment variable %s or %s", key, fileKey)
	}
	raw, err := os.ReadFile(filePath)
	if err != nil {
		return "", fmt.Errorf("read value file %s: %w", filePath, err)
	}
	value := strings.TrimSpace(string(raw))
	if value == "" {
		return "", fmt.Errorf("value file %s is empty", filePath)
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

func optionalPositiveIntEnv(key string, defaultValue int) (int, error) {
	value := strings.TrimSpace(os.Getenv(key))
	if value == "" {
		return defaultValue, nil
	}
	parsed, err := strconv.Atoi(value)
	if err != nil || parsed <= 0 {
		return 0, fmt.Errorf("invalid environment variable %s: must be a positive integer", key)
	}
	return parsed, nil
}
