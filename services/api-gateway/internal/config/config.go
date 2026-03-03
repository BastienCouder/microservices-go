package config

import (
	"fmt"
	"os"
	"strconv"
	"strings"
)

type Config struct {
	HTTPAddr                string
	UserServiceURL          string
	AuthServiceURL          string
	OrganizationsServiceURL string
	PermissionServiceURL    string
	PermissionServiceGRPC   string
	BillingServiceURL       string
	NotificationServiceURL  string
	RateLimitRPM            int
	InternalJWTSecret       string
	InternalJWTIssuer       string
	CORSAllowedOrigins      []string
}

func Load() (Config, error) {
	httpAddr, err := requiredEnv("HTTP_ADDR")
	if err != nil {
		return Config{}, err
	}

	userServiceURL, err := requiredEnv("USER_SERVICE_URL")
	if err != nil {
		return Config{}, err
	}

	authServiceURL, err := requiredEnv("AUTH_SERVICE_URL")
	if err != nil {
		return Config{}, err
	}

	organizationsServiceURL, err := requiredEnv("ORGANIZATIONS_SERVICE_URL")
	if err != nil {
		return Config{}, err
	}

	permissionServiceURL, err := requiredEnv("PERMISSION_SERVICE_URL")
	if err != nil {
		return Config{}, err
	}
	permissionServiceGRPC, err := requiredEnv("PERMISSION_SERVICE_GRPC_ADDR")
	if err != nil {
		return Config{}, err
	}

	billingServiceURL, err := requiredEnv("BILLING_SERVICE_URL")
	if err != nil {
		return Config{}, err
	}

	notificationServiceURL, err := requiredEnv("NOTIFICATION_SERVICE_URL")
	if err != nil {
		return Config{}, err
	}

	rateLimitRPM, err := requiredPositiveIntEnv("RATE_LIMIT_RPM")
	if err != nil {
		return Config{}, err
	}
	internalJWTSecret, err := requiredEnv("INTERNAL_JWT_SECRET")
	if err != nil {
		return Config{}, err
	}
	internalJWTIssuer, err := requiredEnv("INTERNAL_JWT_ISSUER")
	if err != nil {
		return Config{}, err
	}

	corsAllowedOrigins, err := requiredCSVEnv("CORS_ALLOWED_ORIGINS")
	if err != nil {
		return Config{}, err
	}

	return Config{
		HTTPAddr:                httpAddr,
		UserServiceURL:          userServiceURL,
		AuthServiceURL:          authServiceURL,
		OrganizationsServiceURL: organizationsServiceURL,
		PermissionServiceURL:    permissionServiceURL,
		PermissionServiceGRPC:   permissionServiceGRPC,
		BillingServiceURL:       billingServiceURL,
		NotificationServiceURL:  notificationServiceURL,
		RateLimitRPM:            rateLimitRPM,
		InternalJWTSecret:       internalJWTSecret,
		InternalJWTIssuer:       internalJWTIssuer,
		CORSAllowedOrigins:      corsAllowedOrigins,
	}, nil
}

func requiredEnv(key string) (string, error) {
	value := os.Getenv(key)
	if value == "" {
		return "", fmt.Errorf("missing required environment variable %s", key)
	}
	return value, nil
}

func requiredPositiveIntEnv(key string) (int, error) {
	value, err := requiredEnv(key)
	if err != nil {
		return 0, err
	}
	parsed, err := strconv.Atoi(value)
	if err != nil || parsed <= 0 {
		return 0, fmt.Errorf("invalid required environment variable %s: must be a positive integer", key)
	}
	return parsed, nil
}

func requiredCSVEnv(key string) ([]string, error) {
	raw, err := requiredEnv(key)
	if err != nil {
		return nil, err
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
		return nil, fmt.Errorf("invalid required environment variable %s: must contain at least one origin", key)
	}
	return parts, nil
}
