package config

import (
	"fmt"
	"net/url"
	"os"
	"strings"
)

type Config struct {
	HTTPAddr    string
	DatabaseURL string
}

func Load() (Config, error) {
	httpAddr, err := requiredEnv("HTTP_ADDR")
	if err != nil {
		return Config{}, err
	}
	databaseURL, err := DatabaseURLFromEnv()
	if err != nil {
		return Config{}, err
	}
	return Config{HTTPAddr: httpAddr, DatabaseURL: databaseURL}, nil
}

func DatabaseURLFromEnv() (string, error) {
	host, err := requiredEnv("BILLING_DB_HOST")
	if err != nil {
		return "", err
	}
	port, err := requiredEnv("BILLING_DB_PORT")
	if err != nil {
		return "", err
	}
	user, err := requiredEnv("BILLING_DB_USER")
	if err != nil {
		return "", err
	}
	name, err := requiredEnv("BILLING_DB_NAME")
	if err != nil {
		return "", err
	}
	sslMode, err := requiredEnv("BILLING_DB_SSLMODE")
	if err != nil {
		return "", err
	}
	password, err := passwordFromEnv("BILLING_DB_PASSWORD", "BILLING_DB_PASSWORD_FILE")
	if err != nil {
		return "", err
	}

	return fmt.Sprintf(
		"postgres://%s:%s@%s:%s/%s?sslmode=%s",
		url.QueryEscape(user),
		url.QueryEscape(password),
		host,
		port,
		name,
		sslMode,
	), nil
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

func requiredEnv(key string) (string, error) {
	value := os.Getenv(key)
	if value == "" {
		return "", fmt.Errorf("missing required environment variable %s", key)
	}
	return value, nil
}
