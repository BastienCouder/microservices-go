package config

import (
	"fmt"
	"os"
	"strconv"
)

type Config struct {
	HTTPAddr                string
	UserServiceURL          string
	AuthServiceURL          string
	OrganizationsServiceURL string
	PermissionServiceURL    string
	BillingServiceURL       string
	NotificationServiceURL  string
	RateLimitRPM            int
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

	return Config{
		HTTPAddr:                httpAddr,
		UserServiceURL:          userServiceURL,
		AuthServiceURL:          authServiceURL,
		OrganizationsServiceURL: organizationsServiceURL,
		PermissionServiceURL:    permissionServiceURL,
		BillingServiceURL:       billingServiceURL,
		NotificationServiceURL:  notificationServiceURL,
		RateLimitRPM:            rateLimitRPM,
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
