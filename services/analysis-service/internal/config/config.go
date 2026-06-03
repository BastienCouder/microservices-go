package config

import (
	"time"

	"github.com/bastiencouder/microservices-go/contracts/pkg/envcfg"
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
	projectServiceGRPCAddr, err := envcfg.RequiredEnv("PROJECT_SERVICE_GRPC_ADDR")
	if err != nil {
		return Config{}, err
	}
	billingServiceURL, err := envcfg.RequiredEnv("BILLING_SERVICE_URL")
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
	grpcAllowInsecure, err := envcfg.OptionalBoolEnv("GRPC_ALLOW_INSECURE", false)
	if err != nil {
		return Config{}, err
	}
	grpcTLSRequireClientCert, err := envcfg.OptionalBoolEnv("GRPC_TLS_REQUIRE_CLIENT_CERT", false)
	if err != nil {
		return Config{}, err
	}
	redisAddr, err := envcfg.RequiredEnv("REDIS_ADDR")
	if err != nil {
		return Config{}, err
	}
	redisPassword, err := envcfg.OptionalSecretFromEnv("REDIS_PASSWORD", "REDIS_PASSWORD_FILE")
	if err != nil {
		return Config{}, err
	}
	dashboardCacheTTL, err := envcfg.RequiredDurationEnv("DASHBOARD_CACHE_TTL")
	if err != nil {
		return Config{}, err
	}
	cloudflareAccountID, err := envcfg.OptionalValueFromEnv("CLOUDFLARE_ACCOUNT_ID", "CLOUDFLARE_ACCOUNT_ID_FILE")
	if err != nil {
		return Config{}, err
	}
	cloudflareAPIToken, err := envcfg.OptionalSecretFromEnv("CLOUDFLARE_API_TOKEN", "CLOUDFLARE_API_TOKEN_FILE")
	if err != nil {
		return Config{}, err
	}

	return Config{
		HTTPAddr:                       httpAddr,
		MetricsAddr:                    envcfg.OptionalEnv("METRICS_ADDR"),
		GRPCAddr:                       grpcAddr,
		DatabaseURL:                    databaseURL,
		BillingServiceURL:              billingServiceURL,
		ProjectServiceGRPCAddr:         projectServiceGRPCAddr,
		InternalJWTSecret:              internalJWTSecret,
		InternalJWTIssuer:              internalJWTIssuer,
		GRPCAllowInsecure:              grpcAllowInsecure,
		GRPCTLSCAFile:                  envcfg.OptionalEnv("GRPC_TLS_CA_FILE"),
		GRPCTLSCertFile:                envcfg.OptionalEnv("GRPC_TLS_CERT_FILE"),
		GRPCTLSKeyFile:                 envcfg.OptionalEnv("GRPC_TLS_KEY_FILE"),
		GRPCTLSServerName:              envcfg.OptionalEnv("GRPC_TLS_SERVER_NAME"),
		GRPCTLSClientCAFile:            envcfg.OptionalEnv("GRPC_TLS_CLIENT_CA_FILE"),
		GRPCTLSRequireClientCert:       grpcTLSRequireClientCert,
		RedisAddr:                      redisAddr,
		RedisPassword:                  redisPassword,
		DashboardCacheTTL:              dashboardCacheTTL,
		CloudflareAccountID:            cloudflareAccountID,
		CloudflareAPIToken:             cloudflareAPIToken,
		IAServiceURL:                   envcfg.OptionalEnv("IA_SERVICE_URL"),
		ContentIssueAnalyzerModelID:    envcfg.OptionalEnv("CONTENT_ISSUE_ANALYZER_MODEL_ID"),
		ContentIssueAnalyzerProviderID: envcfg.OptionalEnv("CONTENT_ISSUE_ANALYZER_PROVIDER_ID"),
	}, nil
}

func DatabaseURLFromEnv() (string, error) {
	return envcfg.PostgresURL(
		"ANALYSIS_DB_HOST",
		"ANALYSIS_DB_PORT",
		"ANALYSIS_DB_USER",
		"ANALYSIS_DB_NAME",
		"ANALYSIS_DB_SSLMODE",
		"ANALYSIS_DB_PASSWORD",
		"ANALYSIS_DB_PASSWORD_FILE",
	)
}
