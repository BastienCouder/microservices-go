package config

import (
	"fmt"
	"net/url"
	"os"
	"strings"
)

type Config struct {
	HTTPAddr           string
	MetricsAddr        string
	DatabaseURL        string
	ProjectServiceURL  string
	UserServiceURL     string
	AppBaseURL         string
	InvitationLoginURL string
	RabbitMQURL        string
	RabbitMQExchange   string
	RabbitMQEmailQueue string
	RabbitMQEmailRoute string
	InternalJWTSecret  string
	InternalJWTIssuer  string
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
	internalJWTSecret, err := passwordFromEnv("INTERNAL_JWT_SECRET", "INTERNAL_JWT_SECRET_FILE")
	if err != nil {
		return Config{}, err
	}
	internalJWTIssuer, err := requiredEnv("INTERNAL_JWT_ISSUER")
	if err != nil {
		return Config{}, err
	}
	rabbitMQURL, err := requiredEnvOrFile("RABBITMQ_URL", "RABBITMQ_URL_FILE")
	if err != nil {
		return Config{}, err
	}
	rabbitMQExchange, err := requiredEnv("RABBITMQ_EXCHANGE")
	if err != nil {
		return Config{}, err
	}
	rabbitMQEmailQueue, err := requiredEnv("RABBITMQ_NOTIFICATION_EMAIL_QUEUE")
	if err != nil {
		return Config{}, err
	}
	rabbitMQEmailRoute, err := requiredEnv("RABBITMQ_NOTIFICATION_EMAIL_ROUTING_KEY")
	if err != nil {
		return Config{}, err
	}

	return Config{
		HTTPAddr:           httpAddr,
		MetricsAddr:        optionalEnv("METRICS_ADDR"),
		DatabaseURL:        databaseURL,
		ProjectServiceURL:  optionalEnv("PROJECT_SERVICE_URL"),
		UserServiceURL:     optionalEnv("USER_SERVICE_URL"),
		AppBaseURL:         optionalEnv("APP_BASE_URL"),
		InvitationLoginURL: optionalEnv("INVITATION_LOGIN_URL"),
		RabbitMQURL:        rabbitMQURL,
		RabbitMQExchange:   rabbitMQExchange,
		RabbitMQEmailQueue: rabbitMQEmailQueue,
		RabbitMQEmailRoute: rabbitMQEmailRoute,
		InternalJWTSecret:  internalJWTSecret,
		InternalJWTIssuer:  internalJWTIssuer,
	}, nil
}

func DatabaseURLFromEnv() (string, error) {
	host, err := requiredEnv("ORG_DB_HOST")
	if err != nil {
		return "", err
	}
	port, err := requiredEnv("ORG_DB_PORT")
	if err != nil {
		return "", err
	}
	user, err := requiredEnv("ORG_DB_USER")
	if err != nil {
		return "", err
	}
	name, err := requiredEnv("ORG_DB_NAME")
	if err != nil {
		return "", err
	}
	sslMode, err := requiredEnv("ORG_DB_SSLMODE")
	if err != nil {
		return "", err
	}
	password, err := passwordFromEnv("ORG_DB_PASSWORD", "ORG_DB_PASSWORD_FILE")
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

func requiredEnvOrFile(valueKey, fileKey string) (string, error) {
	if value := strings.TrimSpace(os.Getenv(valueKey)); value != "" {
		return value, nil
	}
	filePath := strings.TrimSpace(os.Getenv(fileKey))
	if filePath == "" {
		return "", fmt.Errorf("missing required environment variable %s or %s", valueKey, fileKey)
	}
	raw, err := os.ReadFile(filePath)
	if err != nil {
		return "", fmt.Errorf("read %s: %w", fileKey, err)
	}
	value := strings.TrimSpace(string(raw))
	if value == "" {
		return "", fmt.Errorf("%s is empty", fileKey)
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

func optionalEnv(key string) string {
	return strings.TrimSpace(os.Getenv(key))
}
