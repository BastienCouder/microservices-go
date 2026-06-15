package config

import "github.com/bastiencouder/microservices-go/contracts/pkg/envcfg"

type Config struct {
	HTTPAddr                 string
	MetricsAddr              string
	GRPCAddr                 string
	DatabaseURL              string
	ProjectServiceURL        string
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
	internalJWTSecret, err := envcfg.SecretFromEnv("INTERNAL_JWT_SECRET", "INTERNAL_JWT_SECRET_FILE")
	if err != nil {
		return Config{}, err
	}
	internalJWTIssuer, err := envcfg.RequiredEnv("INTERNAL_JWT_ISSUER")
	if err != nil {
		return Config{}, err
	}
	projectServiceURL, err := envcfg.RequiredEnv("PROJECT_SERVICE_URL")
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

	return Config{
		HTTPAddr:                 httpAddr,
		MetricsAddr:              envcfg.OptionalEnv("METRICS_ADDR"),
		GRPCAddr:                 grpcAddr,
		DatabaseURL:              databaseURL,
		ProjectServiceURL:        projectServiceURL,
		InternalJWTSecret:        internalJWTSecret,
		InternalJWTIssuer:        internalJWTIssuer,
		GRPCAllowInsecure:        grpcAllowInsecure,
		GRPCTLSCAFile:            envcfg.OptionalEnv("GRPC_TLS_CA_FILE"),
		GRPCTLSCertFile:          envcfg.OptionalEnv("GRPC_TLS_CERT_FILE"),
		GRPCTLSKeyFile:           envcfg.OptionalEnv("GRPC_TLS_KEY_FILE"),
		GRPCTLSClientCAFile:      envcfg.OptionalEnv("GRPC_TLS_CLIENT_CA_FILE"),
		GRPCTLSRequireClientCert: grpcTLSRequireClientCert,
	}, nil
}

func DatabaseURLFromEnv() (string, error) {
	return envcfg.PostgresURL(
		"PERMISSION_DB_HOST",
		"PERMISSION_DB_PORT",
		"PERMISSION_DB_USER",
		"PERMISSION_DB_NAME",
		"PERMISSION_DB_SSLMODE",
		"PERMISSION_DB_PASSWORD",
		"PERMISSION_DB_PASSWORD_FILE",
	)
}
