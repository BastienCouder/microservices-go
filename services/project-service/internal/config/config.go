package config

import (
	"time"

	"github.com/bastiencouder/microservices-go/contracts/pkg/envcfg"
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
	httpAddr, err := envcfg.RequiredEnv("HTTP_ADDR")
	if err != nil {
		return Config{}, err
	}
	grpcAddr, err := envcfg.RequiredEnv("GRPC_ADDR")
	if err != nil {
		return Config{}, err
	}
	databaseURL, err := DatabaseURLFromEnv()
	if err != nil {
		return Config{}, err
	}
	analysisServiceGRPCAddr, err := envcfg.RequiredEnv("ANALYSIS_SERVICE_GRPC_ADDR")
	if err != nil {
		return Config{}, err
	}
	iaServiceGRPCAddr, err := envcfg.RequiredEnv("IA_SERVICE_GRPC_ADDR")
	if err != nil {
		return Config{}, err
	}
	iaPromptTimeoutMS, err := envcfg.OptionalPositiveIntEnv("PROJECT_IA_PROMPT_TIMEOUT_MS", 30000)
	if err != nil {
		return Config{}, err
	}
	rabbitMQURL, err := envcfg.RequiredEnvOrFile("RABBITMQ_URL", "RABBITMQ_URL_FILE")
	if err != nil {
		return Config{}, err
	}
	rabbitMQExchange, err := envcfg.RequiredEnv("RABBITMQ_EXCHANGE")
	if err != nil {
		return Config{}, err
	}
	rabbitMQFinalizeQueue, err := envcfg.RequiredEnv("RABBITMQ_PROJECT_FINALIZE_QUEUE")
	if err != nil {
		return Config{}, err
	}
	rabbitMQFinalizeRouteKey, err := envcfg.RequiredEnv("RABBITMQ_PROJECT_FINALIZE_ROUTING_KEY")
	if err != nil {
		return Config{}, err
	}
	internalJWTSecret, err := envcfg.SecretFromEnv("INTERNAL_JWT_SECRET", "INTERNAL_JWT_SECRET_FILE")
	if err != nil {
		return Config{}, err
	}
	internalJWTIssuer, err := envcfg.RequiredEnv("INTERNAL_JWT_ISSUER")
	if err != nil {
		return Config{}, err
	}
	secretEncryptionKey, err := envcfg.RequiredEnvOrFile("PROJECT_SECRET_ENCRYPTION_KEY", "PROJECT_SECRET_ENCRYPTION_KEY_FILE")
	if err != nil {
		return Config{}, err
	}
	grpcAllowInsecure, err := envcfg.OptionalBoolEnv("GRPC_ALLOW_INSECURE", false)
	if err != nil {
		return Config{}, err
	}
	grpcTLSRequireClientCert, err := envcfg.OptionalBoolEnv("GRPC_TLS_REQUIRE_CLIENT_CERT", false)
	if err != nil {
		return Config{}, err
	}
	ga4OAuthClientID, err := envcfg.SecretFromEnv("GA4_OAUTH_CLIENT_ID", "GA4_OAUTH_CLIENT_ID_FILE")
	if err != nil {
		return Config{}, err
	}
	ga4OAuthClientSecret, err := envcfg.SecretFromEnv("GA4_OAUTH_CLIENT_SECRET", "GA4_OAUTH_CLIENT_SECRET_FILE")
	if err != nil {
		return Config{}, err
	}

	return Config{
		HTTPAddr:                 httpAddr,
		MetricsAddr:              envcfg.OptionalEnv("METRICS_ADDR"),
		GRPCAddr:                 grpcAddr,
		DatabaseURL:              databaseURL,
		BillingServiceURL:        envcfg.OptionalEnv("BILLING_SERVICE_URL"),
		AnalysisServiceGRPCAddr:  analysisServiceGRPCAddr,
		IAServiceGRPCAddr:        iaServiceGRPCAddr,
		IAPromptTimeout:          time.Duration(iaPromptTimeoutMS) * time.Millisecond,
		AttributionServiceURL:    envcfg.OptionalEnv("ATTRIBUTION_SERVICE_URL"),
		SecretEncryptionKey:      secretEncryptionKey,
		RabbitMQURL:              rabbitMQURL,
		RabbitMQExchange:         rabbitMQExchange,
		RabbitMQFinalizeQueue:    rabbitMQFinalizeQueue,
		RabbitMQFinalizeRouteKey: rabbitMQFinalizeRouteKey,
		InternalJWTSecret:        internalJWTSecret,
		InternalJWTIssuer:        internalJWTIssuer,
		GRPCAllowInsecure:        grpcAllowInsecure,
		GRPCTLSCAFile:            envcfg.OptionalEnv("GRPC_TLS_CA_FILE"),
		GRPCTLSCertFile:          envcfg.OptionalEnv("GRPC_TLS_CERT_FILE"),
		GRPCTLSKeyFile:           envcfg.OptionalEnv("GRPC_TLS_KEY_FILE"),
		GRPCTLSServerName:        envcfg.OptionalEnv("GRPC_TLS_SERVER_NAME"),
		GRPCTLSClientCAFile:      envcfg.OptionalEnv("GRPC_TLS_CLIENT_CA_FILE"),
		GRPCTLSRequireClientCert: grpcTLSRequireClientCert,
		GA4OAuthClientID:         ga4OAuthClientID,
		GA4OAuthClientSecret:     ga4OAuthClientSecret,
	}, nil
}

func DatabaseURLFromEnv() (string, error) {
	return envcfg.PostgresURL(
		"PROJECT_DB_HOST",
		"PROJECT_DB_PORT",
		"PROJECT_DB_USER",
		"PROJECT_DB_NAME",
		"PROJECT_DB_SSLMODE",
		"PROJECT_DB_PASSWORD",
		"PROJECT_DB_PASSWORD_FILE",
	)
}
