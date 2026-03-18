package config

import (
	"fmt"
	"os"
	"strings"
)

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
	httpAddr, err := requiredEnv("HTTP_ADDR")
	if err != nil {
		return Config{}, err
	}

	kratosPublicURL, err := requiredEnv("KRATOS_PUBLIC_URL")
	if err != nil {
		return Config{}, err
	}

	allowedOrigin, err := requiredEnv("ALLOWED_ORIGIN")
	if err != nil {
		return Config{}, err
	}
	kratosBrowserURL, err := requiredEnv("KRATOS_BROWSER_URL")
	if err != nil {
		return Config{}, err
	}
	userServiceURL, err := requiredEnv("USER_SERVICE_URL")
	if err != nil {
		return Config{}, err
	}
	appReturnURL := optionalEnv("APP_RETURN_URL")
	internalJWTSecret, err := passwordFromEnv("INTERNAL_JWT_SECRET", "INTERNAL_JWT_SECRET_FILE")
	if err != nil {
		return Config{}, err
	}
	internalJWTIssuer, err := requiredEnv("INTERNAL_JWT_ISSUER")
	if err != nil {
		return Config{}, err
	}

	return Config{
		HTTPAddr:          httpAddr,
		MetricsAddr:       optionalEnv("METRICS_ADDR"),
		KratosPublicURL:   kratosPublicURL,
		KratosBrowserURL:  kratosBrowserURL,
		UserServiceURL:    userServiceURL,
		AppReturnURL:      appReturnURL,
		AllowedOrigin:     allowedOrigin,
		InternalJWTSecret: internalJWTSecret,
		InternalJWTIssuer: internalJWTIssuer,
	}, nil
}

func requiredEnv(key string) (string, error) {
	value := os.Getenv(key)
	if value == "" {
		return "", fmt.Errorf("missing required environment variable %s", key)
	}
	return value, nil
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

func optionalEnv(key string) string {
	return strings.TrimSpace(os.Getenv(key))
}
