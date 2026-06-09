package config

import "github.com/bastiencouder/microservices-go/contracts/pkg/envcfg"

type Config struct {
	HTTPAddr          string
	MetricsAddr       string
	KratosPublicURL   string
	KratosBrowserURL  string
	UserServiceURL    string
	AppReturnURL      string
	AllowedOrigin     string
	InternalJWTSecret string
	InternalJWTIssuer string
}

func Load() (Config, error) {
	httpAddr, err := envcfg.RequiredEnv("HTTP_ADDR")
	if err != nil {
		return Config{}, err
	}
	kratosPublicURL, err := envcfg.RequiredEnv("KRATOS_PUBLIC_URL")
	if err != nil {
		return Config{}, err
	}
	allowedOrigin, err := envcfg.RequiredEnv("ALLOWED_ORIGIN")
	if err != nil {
		return Config{}, err
	}
	kratosBrowserURL, err := envcfg.RequiredEnv("KRATOS_BROWSER_URL")
	if err != nil {
		return Config{}, err
	}
	userServiceURL, err := envcfg.RequiredEnv("USER_SERVICE_URL")
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
		KratosPublicURL:   kratosPublicURL,
		KratosBrowserURL:  kratosBrowserURL,
		UserServiceURL:    userServiceURL,
		AppReturnURL:      envcfg.OptionalEnv("APP_RETURN_URL"),
		AllowedOrigin:     allowedOrigin,
		InternalJWTSecret: internalJWTSecret,
		InternalJWTIssuer: internalJWTIssuer,
	}, nil
}
