package config

import "github.com/bastiencouder/microservices-go/contracts/pkg/envcfg"

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
	httpAddr, err := envcfg.RequiredEnvOrFile("HTTP_ADDR", "HTTP_ADDR_FILE")
	if err != nil {
		return Config{}, err
	}
	metricsAddr, err := envcfg.OptionalValueFromEnv("METRICS_ADDR", "METRICS_ADDR_FILE")
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

	return Config{
		HTTPAddr:           httpAddr,
		MetricsAddr:        metricsAddr,
		DatabaseURL:        databaseURL,
		ProjectServiceURL:  envcfg.OptionalEnv("PROJECT_SERVICE_URL"),
		UserServiceURL:     envcfg.OptionalEnv("USER_SERVICE_URL"),
		AppBaseURL:         envcfg.OptionalEnv("APP_BASE_URL"),
		InvitationLoginURL: envcfg.OptionalEnv("INVITATION_LOGIN_URL"),
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
		"ORG_DB_HOST",
		"ORG_DB_PORT",
		"ORG_DB_USER",
		"ORG_DB_NAME",
		"ORG_DB_SSLMODE",
		"ORG_DB_PASSWORD",
		"ORG_DB_PASSWORD_FILE",
	)
}
