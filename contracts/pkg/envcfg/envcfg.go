package envcfg

import (
	"fmt"
	"net/url"
	"os"
	"strconv"
	"strings"
	"time"
)

func RequiredEnv(key string) (string, error) {
	value := os.Getenv(key)
	if value == "" {
		return "", fmt.Errorf("missing required environment variable %s", key)
	}
	return value, nil
}

func OptionalEnv(key string) string {
	return strings.TrimSpace(os.Getenv(key))
}

func SecretFromEnv(key, fileKey string) (string, error) {
	if value := strings.TrimSpace(os.Getenv(key)); value != "" {
		return value, nil
	}
	filePath := strings.TrimSpace(os.Getenv(fileKey))
	if filePath == "" {
		return "", fmt.Errorf("missing required environment variable %s or %s", key, fileKey)
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

func OptionalSecretFromEnv(key, fileKey string) (string, error) {
	if value := strings.TrimSpace(os.Getenv(key)); value != "" {
		return value, nil
	}
	filePath := strings.TrimSpace(os.Getenv(fileKey))
	if filePath == "" {
		return "", nil
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

func RequiredEnvOrFile(key, fileKey string) (string, error) {
	if value := strings.TrimSpace(os.Getenv(key)); value != "" {
		return value, nil
	}
	filePath := strings.TrimSpace(os.Getenv(fileKey))
	if filePath == "" {
		return "", fmt.Errorf("missing required environment variable %s or %s", key, fileKey)
	}
	raw, err := os.ReadFile(filePath)
	if err != nil {
		return "", fmt.Errorf("read value file %s: %w", filePath, err)
	}
	value := strings.TrimSpace(string(raw))
	if value == "" {
		return "", fmt.Errorf("value file %s is empty", filePath)
	}
	return value, nil
}

func OptionalValueFromEnv(key, fileKey string) (string, error) {
	if value := strings.TrimSpace(os.Getenv(key)); value != "" {
		return value, nil
	}
	filePath := strings.TrimSpace(os.Getenv(fileKey))
	if filePath == "" {
		return "", nil
	}
	raw, err := os.ReadFile(filePath)
	if err != nil {
		return "", fmt.Errorf("read value file %s: %w", filePath, err)
	}
	return strings.TrimSpace(string(raw)), nil
}

func RequiredPositiveIntEnv(key string) (int, error) {
	value, err := RequiredEnv(key)
	if err != nil {
		return 0, err
	}
	parsed, err := strconv.Atoi(value)
	if err != nil || parsed <= 0 {
		return 0, fmt.Errorf("invalid required environment variable %s: must be a positive integer", key)
	}
	return parsed, nil
}

func RequiredDurationEnv(key string) (time.Duration, error) {
	value := strings.TrimSpace(os.Getenv(key))
	if value == "" {
		return 0, fmt.Errorf("missing required environment variable %s", key)
	}
	duration, err := time.ParseDuration(value)
	if err != nil {
		return 0, fmt.Errorf("invalid environment variable %s: %w", key, err)
	}
	return duration, nil
}

func OptionalPositiveIntEnv(key string, fallback int) (int, error) {
	value := strings.TrimSpace(os.Getenv(key))
	if value == "" {
		return fallback, nil
	}
	parsed, err := strconv.Atoi(value)
	if err != nil || parsed <= 0 {
		return 0, fmt.Errorf("invalid optional environment variable %s: must be a positive integer", key)
	}
	return parsed, nil
}

func OptionalBoolEnv(key string, defaultValue bool) (bool, error) {
	raw := strings.TrimSpace(os.Getenv(key))
	if raw == "" {
		return defaultValue, nil
	}
	return parseBool(key, raw)
}

func OptionalBoolEnvOrFile(key, fileKey string, defaultValue bool) (bool, error) {
	if value := strings.TrimSpace(os.Getenv(key)); value != "" {
		return parseBool(key, value)
	}
	filePath := strings.TrimSpace(os.Getenv(fileKey))
	if filePath == "" {
		return defaultValue, nil
	}
	raw, err := os.ReadFile(filePath)
	if err != nil {
		return false, fmt.Errorf("read value file %s: %w", filePath, err)
	}
	value := strings.TrimSpace(string(raw))
	if value == "" {
		return defaultValue, nil
	}
	return parseBool(key, value)
}

func RequiredCSVEnv(key string) ([]string, error) {
	raw, err := RequiredEnv(key)
	if err != nil {
		return nil, err
	}
	parts := splitCSV(raw)
	if len(parts) == 0 {
		return nil, fmt.Errorf("invalid required environment variable %s: must contain at least one origin", key)
	}
	return parts, nil
}

func OptionalCSVEnv(key string) []string {
	return splitCSV(strings.TrimSpace(os.Getenv(key)))
}

func PostgresURL(hostKey, portKey, userKey, nameKey, sslModeKey, passwordKey, passwordFileKey string) (string, error) {
	host, err := RequiredEnvOrFile(hostKey, hostKey+"_FILE")
	if err != nil {
		return "", err
	}
	port, err := RequiredEnvOrFile(portKey, portKey+"_FILE")
	if err != nil {
		return "", err
	}
	user, err := RequiredEnvOrFile(userKey, userKey+"_FILE")
	if err != nil {
		return "", err
	}
	name, err := RequiredEnvOrFile(nameKey, nameKey+"_FILE")
	if err != nil {
		return "", err
	}
	sslMode, err := RequiredEnvOrFile(sslModeKey, sslModeKey+"_FILE")
	if err != nil {
		return "", err
	}
	password, err := SecretFromEnv(passwordKey, passwordFileKey)
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

func parseBool(key, raw string) (bool, error) {
	switch strings.ToLower(strings.TrimSpace(raw)) {
	case "1", "true", "yes", "on":
		return true, nil
	case "0", "false", "no", "off":
		return false, nil
	default:
		return false, fmt.Errorf("invalid environment variable %s: must be a boolean", key)
	}
}

func splitCSV(raw string) []string {
	if raw == "" {
		return nil
	}
	parts := make([]string, 0)
	for _, part := range strings.Split(raw, ",") {
		trimmed := strings.TrimSpace(part)
		if trimmed == "" {
			continue
		}
		parts = append(parts, trimmed)
	}
	if len(parts) == 0 {
		return nil
	}
	return parts
}
