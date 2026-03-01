package config

import (
	"fmt"
	"os"
)

type Config struct {
	HTTPAddr         string
	KratosPublicURL  string
	KratosBrowserURL string
	AllowedOrigin    string
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

	return Config{
		HTTPAddr:         httpAddr,
		KratosPublicURL:  kratosPublicURL,
		KratosBrowserURL: kratosBrowserURL,
		AllowedOrigin:    allowedOrigin,
	}, nil
}

func requiredEnv(key string) (string, error) {
	value := os.Getenv(key)
	if value == "" {
		return "", fmt.Errorf("missing required environment variable %s", key)
	}
	return value, nil
}
