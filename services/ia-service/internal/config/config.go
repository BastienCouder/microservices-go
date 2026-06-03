package config

import (
	"fmt"
	"strings"

	"github.com/bastiencouder/microservices-go/contracts/pkg/envcfg"
)

type Config struct {
	HTTPAddr                 string
	MetricsAddr              string
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
	ProviderHTTPReferer      string
	ProviderAppName          string
	ProviderTimeoutMS        int
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
	internalJWTSecret, err := envcfg.SecretFromEnv("INTERNAL_JWT_SECRET", "INTERNAL_JWT_SECRET_FILE")
	if err != nil {
		return Config{}, err
	}
	internalJWTIssuer, err := envcfg.RequiredEnv("INTERNAL_JWT_ISSUER")
	if err != nil {
		return Config{}, err
	}
	executionMode, err := envcfg.RequiredEnv("IA_EXECUTION_MODE")
	if err != nil {
		return Config{}, err
	}
	executionMode = strings.ToLower(strings.TrimSpace(executionMode))
	if executionMode != "mock" && executionMode != "provider" {
		return Config{}, fmt.Errorf("invalid required environment variable IA_EXECUTION_MODE: must be mock or provider")
	}
	providerTimeoutMS, err := envcfg.RequiredPositiveIntEnv("IA_PROVIDER_TIMEOUT_MS")
	if err != nil {
		return Config{}, err
	}

	providerBaseURL := ""
	providerAPIKey := ""
	providerHTTPReferer := ""
	providerAppName := ""
	if executionMode == "provider" {
		providerBaseURL = envcfg.OptionalEnv("IA_PROVIDER_BASE_URL")
		if providerBaseURL == "" {
			providerBaseURL = "https://openrouter.ai/api/v1"
		}
		providerAPIKey, err = envcfg.OptionalSecretFromEnv("IA_PROVIDER_API_KEY", "IA_PROVIDER_API_KEY_FILE")
		if err != nil {
			return Config{}, err
		}
		providerHTTPReferer = envcfg.OptionalEnv("IA_PROVIDER_HTTP_REFERER")
		providerAppName = envcfg.OptionalEnv("IA_PROVIDER_APP_NAME")
	}
	grpcAllowInsecure, err := envcfg.OptionalBoolEnv("GRPC_ALLOW_INSECURE", false)
	if err != nil {
		return Config{}, err
	}
	grpcTLSRequireClientCert, err := envcfg.OptionalBoolEnv("GRPC_TLS_REQUIRE_CLIENT_CERT", false)
	if err != nil {
		return Config{}, err
	}

	return Config{
		HTTPAddr:                 httpAddr,
		MetricsAddr:              envcfg.OptionalEnv("METRICS_ADDR"),
		GRPCAddr:                 grpcAddr,
		InternalJWTSecret:        internalJWTSecret,
		InternalJWTIssuer:        internalJWTIssuer,
		GRPCAllowInsecure:        grpcAllowInsecure,
		GRPCTLSCAFile:            envcfg.OptionalEnv("GRPC_TLS_CA_FILE"),
		GRPCTLSCertFile:          envcfg.OptionalEnv("GRPC_TLS_CERT_FILE"),
		GRPCTLSKeyFile:           envcfg.OptionalEnv("GRPC_TLS_KEY_FILE"),
		GRPCTLSClientCAFile:      envcfg.OptionalEnv("GRPC_TLS_CLIENT_CA_FILE"),
		GRPCTLSRequireClientCert: grpcTLSRequireClientCert,
		GRPCTLSServerName:        envcfg.OptionalEnv("GRPC_TLS_SERVER_NAME"),
		ExecutionMode:            executionMode,
		ProviderBaseURL:          providerBaseURL,
		ProviderAPIKey:           providerAPIKey,
		ProviderHTTPReferer:      providerHTTPReferer,
		ProviderAppName:          providerAppName,
		ProviderTimeoutMS:        providerTimeoutMS,
	}, nil
}
