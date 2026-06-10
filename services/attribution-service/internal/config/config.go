package config

import "github.com/bastiencouder/microservices-go/contracts/pkg/envcfg"

type Config struct {
	HTTPAddr               string
	MetricsAddr            string
	ProjectServiceGRPCAddr string
	InternalJWTSecret      string
	InternalJWTIssuer      string
	GRPCAllowInsecure      bool
	GRPCTLSCAFile          string
	GRPCTLSCertFile        string
	GRPCTLSKeyFile         string
	GRPCTLSServerName      string
	GA4                    GA4Config
}

type GA4Config struct {
	FakeTrafficEnabled bool
	OAuthClientID      string
	OAuthClientSecret  string
}

func Load() (Config, error) {
	httpAddr, err := envcfg.RequiredEnv("HTTP_ADDR")
	if err != nil {
		return Config{}, err
	}
	projectServiceGRPCAddr, err := envcfg.RequiredEnv("PROJECT_SERVICE_GRPC_ADDR")
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
	ga4Config, err := loadGA4Config()
	if err != nil {
		return Config{}, err
	}

	return Config{
		HTTPAddr:               httpAddr,
		MetricsAddr:            envcfg.OptionalEnv("METRICS_ADDR"),
		ProjectServiceGRPCAddr: projectServiceGRPCAddr,
		InternalJWTSecret:      internalJWTSecret,
		InternalJWTIssuer:      internalJWTIssuer,
		GRPCAllowInsecure:      grpcAllowInsecure,
		GRPCTLSCAFile:          envcfg.OptionalEnv("GRPC_TLS_CA_FILE"),
		GRPCTLSCertFile:        envcfg.OptionalEnv("GRPC_TLS_CERT_FILE"),
		GRPCTLSKeyFile:         envcfg.OptionalEnv("GRPC_TLS_KEY_FILE"),
		GRPCTLSServerName:      envcfg.OptionalEnv("GRPC_TLS_SERVER_NAME"),
		GA4:                    ga4Config,
	}, nil
}

func loadGA4Config() (GA4Config, error) {
	fakeTrafficEnabled, err := envcfg.OptionalBoolEnv("ATTRIBUTION_ENABLE_FAKE_TRAFFIC", false)
	if err != nil {
		return GA4Config{}, err
	}
	oAuthClientID, err := envcfg.SecretFromEnv("GA4_OAUTH_CLIENT_ID", "GA4_OAUTH_CLIENT_ID_FILE")
	if err != nil {
		return GA4Config{}, err
	}
	oAuthClientSecret, err := envcfg.SecretFromEnv("GA4_OAUTH_CLIENT_SECRET", "GA4_OAUTH_CLIENT_SECRET_FILE")
	if err != nil {
		return GA4Config{}, err
	}
	return GA4Config{
		FakeTrafficEnabled: fakeTrafficEnabled,
		OAuthClientID:      oAuthClientID,
		OAuthClientSecret:  oAuthClientSecret,
	}, nil
}
