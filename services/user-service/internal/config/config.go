package config

import "github.com/bastiencouder/microservices-go/contracts/pkg/envcfg"

type Config struct {
	HTTPAddr          string
	MetricsAddr       string
	DatabaseURL       string
	InternalJWTSecret string
	InternalJWTIssuer string
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
	internalJWTSecret, err := envcfg.SecretFromEnv("INTERNAL_JWT_SECRET", "INTERNAL_JWT_SECRET_FILE")
	if err != nil {
		return Config{}, err
	}
	internalJWTIssuer, err := envcfg.RequiredEnv("INTERNAL_JWT_ISSUER")
	if err != nil {
		return Config{}, err
	}

	return Config{
		HTTPAddr:          httpAddr,
		MetricsAddr:       envcfg.OptionalEnv("METRICS_ADDR"),
		DatabaseURL:       databaseURL,
		InternalJWTSecret: internalJWTSecret,
		InternalJWTIssuer: internalJWTIssuer,
	}, nil
}

func DatabaseURLFromEnv() (string, error) {
	return envcfg.PostgresURL(
		"USER_DB_HOST",
		"USER_DB_PORT",
		"USER_DB_USER",
		"USER_DB_NAME",
		"USER_DB_SSLMODE",
		"USER_DB_PASSWORD",
		"USER_DB_PASSWORD_FILE",
	)
}
