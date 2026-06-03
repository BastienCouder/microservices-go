package config

import (
	"fmt"
	"strings"

	"github.com/bastiencouder/microservices-go/contracts/pkg/envcfg"
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
	FakeTrafficEnabled bool
	PropertyID         string
	ServiceAccountJSON string
	OAuthClientID      string
	OAuthClientSecret  string
}

func Load() (Config, error) {
	httpAddr, err := envcfg.RequiredEnv("HTTP_ADDR")
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
	internalJWTSecret, err := envcfg.SecretFromEnv("INTERNAL_JWT_SECRET", "INTERNAL_JWT_SECRET_FILE")
	if err != nil {
		return Config{}, err
	}
	internalJWTIssuer, err := envcfg.RequiredEnv("INTERNAL_JWT_ISSUER")
	if err != nil {
		return Config{}, err
	}
	ga4Config, err := loadGA4Config()
	if err != nil {
		return Config{}, err
	}
	grpcAllowInsecure, err := envcfg.OptionalBoolEnv("GRPC_ALLOW_INSECURE", false)
	if err != nil {
		return Config{}, err
	}

	return Config{
		HTTPAddr:               httpAddr,
		MetricsAddr:            envcfg.OptionalEnv("METRICS_ADDR"),
		DatabaseURL:            databaseURL,
		ProjectServiceGRPCAddr: projectServiceGRPCAddr,
		ProjectServiceURL:      envcfg.OptionalEnv("PROJECT_SERVICE_URL"),
		InternalJWTSecret:      internalJWTSecret,
		InternalJWTIssuer:      internalJWTIssuer,
		GA4:                    ga4Config,
		GRPCAllowInsecure:      grpcAllowInsecure,
		GRPCTLSCAFile:          envcfg.OptionalEnv("GRPC_TLS_CA_FILE"),
		GRPCTLSCertFile:        envcfg.OptionalEnv("GRPC_TLS_CERT_FILE"),
		GRPCTLSKeyFile:         envcfg.OptionalEnv("GRPC_TLS_KEY_FILE"),
		GRPCTLSServerName:      envcfg.OptionalEnv("GRPC_TLS_SERVER_NAME"),
	}, nil
}

func DatabaseURLFromEnv() (string, error) {
	return envcfg.PostgresURL(
		"ATTRIBUTION_DB_HOST",
		"ATTRIBUTION_DB_PORT",
		"ATTRIBUTION_DB_USER",
		"ATTRIBUTION_DB_NAME",
		"ATTRIBUTION_DB_SSLMODE",
		"ATTRIBUTION_DB_PASSWORD",
		"ATTRIBUTION_DB_PASSWORD_FILE",
	)
}

func loadGA4Config() (GA4Config, error) {
	enabled, err := envcfg.OptionalBoolEnv("GA4_ENABLED", false)
	if err != nil {
		return GA4Config{}, err
	}
	fakeTrafficEnabled, err := envcfg.OptionalBoolEnv("ATTRIBUTION_ENABLE_FAKE_TRAFFIC", false)
	if err != nil {
		return GA4Config{}, err
	}
	serviceAccountJSON, err := envcfg.OptionalValueFromEnv("GA4_SERVICE_ACCOUNT_JSON", "GA4_SERVICE_ACCOUNT_JSON_FILE")
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
	cfg := GA4Config{
		Enabled:            enabled,
		FakeTrafficEnabled: fakeTrafficEnabled,
		PropertyID:         envcfg.OptionalEnv("GA4_PROPERTY_ID"),
		ServiceAccountJSON: serviceAccountJSON,
		OAuthClientID:      oAuthClientID,
		OAuthClientSecret:  oAuthClientSecret,
	}
	if !enabled {
		return cfg, nil
	}
	if strings.TrimSpace(cfg.PropertyID) == "" || strings.TrimSpace(cfg.ServiceAccountJSON) == "" {
		return GA4Config{}, fmt.Errorf("missing required ga4 configuration when GA4_ENABLED=true")
	}
	return cfg, nil
}
