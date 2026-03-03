package config

import (
	"fmt"
	"net/url"
	"os"
	"strings"
)

type Config struct {
	HTTPAddr          string
	DatabaseURL       string
	InternalJWTSecret string
	InternalJWTIssuer string
	Stripe            StripeConfig
}

type StripeConfig struct {
	Enabled                  bool
	SecretKey                string
	WebhookSecret            string
	CheckoutSuccessURL       string
	CheckoutCancelURL        string
	CustomerPortalReturnURL  string
	StarterMonthlyPriceID    string
	StarterYearlyPriceID     string
	GrowthMonthlyPriceID     string
	GrowthYearlyPriceID      string
	ProMonthlyPriceID        string
	ProYearlyPriceID         string
	CorrectionCreditsPriceID string
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
	internalJWTSecret, err := requiredEnv("INTERNAL_JWT_SECRET")
	if err != nil {
		return Config{}, err
	}
	internalJWTIssuer, err := requiredEnv("INTERNAL_JWT_ISSUER")
	if err != nil {
		return Config{}, err
	}
	stripeCfg, err := loadStripeConfig()
	if err != nil {
		return Config{}, err
	}
	return Config{
		HTTPAddr:          httpAddr,
		DatabaseURL:       databaseURL,
		InternalJWTSecret: internalJWTSecret,
		InternalJWTIssuer: internalJWTIssuer,
		Stripe:            stripeCfg,
	}, nil
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

func optionalEnv(key string) string {
	return strings.TrimSpace(os.Getenv(key))
}

func optionalBoolEnv(key string, defaultValue bool) (bool, error) {
	raw := strings.TrimSpace(os.Getenv(key))
	if raw == "" {
		return defaultValue, nil
	}
	switch strings.ToLower(raw) {
	case "1", "true", "yes", "on":
		return true, nil
	case "0", "false", "no", "off":
		return false, nil
	default:
		return false, fmt.Errorf("invalid environment variable %s: must be a boolean", key)
	}
}

func loadStripeConfig() (StripeConfig, error) {
	enabled, err := optionalBoolEnv("STRIPE_ENABLED", false)
	if err != nil {
		return StripeConfig{}, err
	}
	secretKey, err := optionalEnvOrFile("STRIPE_SECRET_KEY", "STRIPE_SECRET_KEY_FILE")
	if err != nil {
		return StripeConfig{}, err
	}
	webhookSecret, err := optionalEnvOrFile("STRIPE_WEBHOOK_SECRET", "STRIPE_WEBHOOK_SECRET_FILE")
	if err != nil {
		return StripeConfig{}, err
	}
	checkoutSuccessURL, err := optionalEnvOrFile("STRIPE_CHECKOUT_SUCCESS_URL", "STRIPE_CHECKOUT_SUCCESS_URL_FILE")
	if err != nil {
		return StripeConfig{}, err
	}
	checkoutCancelURL, err := optionalEnvOrFile("STRIPE_CHECKOUT_CANCEL_URL", "STRIPE_CHECKOUT_CANCEL_URL_FILE")
	if err != nil {
		return StripeConfig{}, err
	}
	customerPortalReturnURL, err := optionalEnvOrFile("STRIPE_CUSTOMER_PORTAL_RETURN_URL", "STRIPE_CUSTOMER_PORTAL_RETURN_URL_FILE")
	if err != nil {
		return StripeConfig{}, err
	}
	starterMonthlyPriceID, err := optionalEnvOrFile("STRIPE_PRICE_STARTER_MONTHLY", "STRIPE_PRICE_STARTER_MONTHLY_FILE")
	if err != nil {
		return StripeConfig{}, err
	}
	starterYearlyPriceID, err := optionalEnvOrFile("STRIPE_PRICE_STARTER_YEARLY", "STRIPE_PRICE_STARTER_YEARLY_FILE")
	if err != nil {
		return StripeConfig{}, err
	}
	growthMonthlyPriceID, err := optionalEnvOrFile("STRIPE_PRICE_GROWTH_MONTHLY", "STRIPE_PRICE_GROWTH_MONTHLY_FILE")
	if err != nil {
		return StripeConfig{}, err
	}
	growthYearlyPriceID, err := optionalEnvOrFile("STRIPE_PRICE_GROWTH_YEARLY", "STRIPE_PRICE_GROWTH_YEARLY_FILE")
	if err != nil {
		return StripeConfig{}, err
	}
	proMonthlyPriceID, err := optionalEnvOrFile("STRIPE_PRICE_PRO_MONTHLY", "STRIPE_PRICE_PRO_MONTHLY_FILE")
	if err != nil {
		return StripeConfig{}, err
	}
	proYearlyPriceID, err := optionalEnvOrFile("STRIPE_PRICE_PRO_YEARLY", "STRIPE_PRICE_PRO_YEARLY_FILE")
	if err != nil {
		return StripeConfig{}, err
	}
	correctionCreditsPriceID, err := optionalEnvOrFile("STRIPE_PRICE_CORRECTION_CREDITS", "STRIPE_PRICE_CORRECTION_CREDITS_FILE")
	if err != nil {
		return StripeConfig{}, err
	}

	cfg := StripeConfig{
		Enabled:                  enabled,
		SecretKey:                secretKey,
		WebhookSecret:            webhookSecret,
		CheckoutSuccessURL:       checkoutSuccessURL,
		CheckoutCancelURL:        checkoutCancelURL,
		CustomerPortalReturnURL:  customerPortalReturnURL,
		StarterMonthlyPriceID:    starterMonthlyPriceID,
		StarterYearlyPriceID:     starterYearlyPriceID,
		GrowthMonthlyPriceID:     growthMonthlyPriceID,
		GrowthYearlyPriceID:      growthYearlyPriceID,
		ProMonthlyPriceID:        proMonthlyPriceID,
		ProYearlyPriceID:         proYearlyPriceID,
		CorrectionCreditsPriceID: correctionCreditsPriceID,
	}
	if !enabled {
		return cfg, nil
	}

	required := map[string]string{
		"STRIPE_SECRET_KEY":            cfg.SecretKey,
		"STRIPE_WEBHOOK_SECRET":        cfg.WebhookSecret,
		"STRIPE_CHECKOUT_SUCCESS_URL":  cfg.CheckoutSuccessURL,
		"STRIPE_CHECKOUT_CANCEL_URL":   cfg.CheckoutCancelURL,
		"STRIPE_PRICE_STARTER_MONTHLY": cfg.StarterMonthlyPriceID,
		"STRIPE_PRICE_GROWTH_MONTHLY":  cfg.GrowthMonthlyPriceID,
		"STRIPE_PRICE_PRO_MONTHLY":     cfg.ProMonthlyPriceID,
	}
	for name, value := range required {
		if strings.TrimSpace(value) == "" {
			return StripeConfig{}, fmt.Errorf("missing required environment variable %s when STRIPE_ENABLED=true", name)
		}
	}
	return cfg, nil
}

func optionalEnvOrFile(valueKey, fileKey string) (string, error) {
	if value := strings.TrimSpace(os.Getenv(valueKey)); value != "" {
		return value, nil
	}
	filePath := strings.TrimSpace(os.Getenv(fileKey))
	if filePath == "" {
		return "", nil
	}
	raw, err := os.ReadFile(filePath)
	if err != nil {
		return "", fmt.Errorf("read value file %s for %s: %w", filePath, valueKey, err)
	}
	return strings.TrimSpace(string(raw)), nil
}
