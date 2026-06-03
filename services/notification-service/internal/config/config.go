package config

import "github.com/bastiencouder/microservices-go/contracts/pkg/envcfg"

type Config struct {
	HTTPAddr           string
	MetricsAddr        string
	DatabaseURL        string
	EmailRendererURL   string
	ResendAPIKey       string
	ResendFromEmail    string
	RabbitMQURL        string
	RabbitMQExchange   string
	RabbitMQEmailQueue string
	RabbitMQEmailRoute string
	InternalJWTSecret  string
	InternalJWTIssuer  string
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
	emailRendererURL, err := envcfg.RequiredEnv("EMAIL_RENDERER_URL")
	if err != nil {
		return Config{}, err
	}
	resendAPIKey, err := envcfg.SecretFromEnv("RESEND_API_KEY", "RESEND_API_KEY_FILE")
	if err != nil {
		return Config{}, err
	}
	resendFromEmail, err := envcfg.RequiredEnvOrFile("RESEND_FROM_EMAIL", "RESEND_FROM_EMAIL_FILE")
	if err != nil {
		return Config{}, err
	}
	rabbitMQURL, err := envcfg.RequiredEnvOrFile("RABBITMQ_URL", "RABBITMQ_URL_FILE")
	if err != nil {
		return Config{}, err
	}
	rabbitMQExchange, err := envcfg.RequiredEnv("RABBITMQ_EXCHANGE")
	if err != nil {
		return Config{}, err
	}
	rabbitMQEmailQueue, err := envcfg.RequiredEnv("RABBITMQ_NOTIFICATION_EMAIL_QUEUE")
	if err != nil {
		return Config{}, err
	}
	rabbitMQEmailRoute, err := envcfg.RequiredEnv("RABBITMQ_NOTIFICATION_EMAIL_ROUTING_KEY")
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
		HTTPAddr:           httpAddr,
		MetricsAddr:        envcfg.OptionalEnv("METRICS_ADDR"),
		DatabaseURL:        databaseURL,
		EmailRendererURL:   emailRendererURL,
		ResendAPIKey:       resendAPIKey,
		ResendFromEmail:    resendFromEmail,
		RabbitMQURL:        rabbitMQURL,
		RabbitMQExchange:   rabbitMQExchange,
		RabbitMQEmailQueue: rabbitMQEmailQueue,
		RabbitMQEmailRoute: rabbitMQEmailRoute,
		InternalJWTSecret:  internalJWTSecret,
		InternalJWTIssuer:  internalJWTIssuer,
	}, nil
}

func DatabaseURLFromEnv() (string, error) {
	return envcfg.PostgresURL(
		"NOTIFICATION_DB_HOST",
		"NOTIFICATION_DB_PORT",
		"NOTIFICATION_DB_USER",
		"NOTIFICATION_DB_NAME",
		"NOTIFICATION_DB_SSLMODE",
		"NOTIFICATION_DB_PASSWORD",
		"NOTIFICATION_DB_PASSWORD_FILE",
	)
}
