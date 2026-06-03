package config

import (
	"fmt"
	"strings"

	"github.com/bastiencouder/microservices-go/contracts/pkg/envcfg"
)

type Config struct {
	HTTPAddr              string
	MetricsAddr           string
	DatabaseURL           string
	InternalJWTSecret     string
	InternalJWTIssuer     string
	AttributionServiceURL string
	ProjectServiceURL     string
	Stripe                StripeConfig
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
	httpAddr, err := envcfg.RequiredEnv("HTTP_ADDR")
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
	stripeCfg, err := loadStripeConfig()
	if err != nil {
		return Config{}, err
	}

	return Config{
		HTTPAddr:              httpAddr,
		MetricsAddr:           envcfg.OptionalEnv("METRICS_ADDR"),
		DatabaseURL:           databaseURL,
		InternalJWTSecret:     internalJWTSecret,
		InternalJWTIssuer:     internalJWTIssuer,
		AttributionServiceURL: envcfg.OptionalEnv("ATTRIBUTION_SERVICE_URL"),
		ProjectServiceURL:     envcfg.OptionalEnv("PROJECT_SERVICE_URL"),
		Stripe:                stripeCfg,
	}, nil
}

func DatabaseURLFromEnv() (string, error) {
	return envcfg.PostgresURL(
		"BILLING_DB_HOST",
		"BILLING_DB_PORT",
		"BILLING_DB_USER",
		"BILLING_DB_NAME",
		"BILLING_DB_SSLMODE",
		"BILLING_DB_PASSWORD",
		"BILLING_DB_PASSWORD_FILE",
	)
}

func loadStripeConfig() (StripeConfig, error) {
	enabled, err := envcfg.OptionalBoolEnvOrFile("STRIPE_ENABLED", "STRIPE_ENABLED_FILE", false)
	if err != nil {
		return StripeConfig{}, err
	}
	secretKey, err := envcfg.OptionalValueFromEnv("STRIPE_SECRET_KEY", "STRIPE_SECRET_KEY_FILE")
	if err != nil {
		return StripeConfig{}, err
	}
	webhookSecret, err := envcfg.OptionalValueFromEnv("STRIPE_WEBHOOK_SECRET", "STRIPE_WEBHOOK_SECRET_FILE")
	if err != nil {
		return StripeConfig{}, err
	}
	checkoutSuccessURL, err := envcfg.OptionalValueFromEnv("STRIPE_CHECKOUT_SUCCESS_URL", "STRIPE_CHECKOUT_SUCCESS_URL_FILE")
	if err != nil {
		return StripeConfig{}, err
	}
	checkoutCancelURL, err := envcfg.OptionalValueFromEnv("STRIPE_CHECKOUT_CANCEL_URL", "STRIPE_CHECKOUT_CANCEL_URL_FILE")
	if err != nil {
		return StripeConfig{}, err
	}
	customerPortalReturnURL, err := envcfg.OptionalValueFromEnv("STRIPE_CUSTOMER_PORTAL_RETURN_URL", "STRIPE_CUSTOMER_PORTAL_RETURN_URL_FILE")
	if err != nil {
		return StripeConfig{}, err
	}
	starterMonthlyPriceID, err := envcfg.OptionalValueFromEnv("STRIPE_PRICE_STARTER_MONTHLY", "STRIPE_PRICE_STARTER_MONTHLY_FILE")
	if err != nil {
		return StripeConfig{}, err
	}
	starterYearlyPriceID, err := envcfg.OptionalValueFromEnv("STRIPE_PRICE_STARTER_YEARLY", "STRIPE_PRICE_STARTER_YEARLY_FILE")
	if err != nil {
		return StripeConfig{}, err
	}
	growthMonthlyPriceID, err := envcfg.OptionalValueFromEnv("STRIPE_PRICE_GROWTH_MONTHLY", "STRIPE_PRICE_GROWTH_MONTHLY_FILE")
	if err != nil {
		return StripeConfig{}, err
	}
	growthYearlyPriceID, err := envcfg.OptionalValueFromEnv("STRIPE_PRICE_GROWTH_YEARLY", "STRIPE_PRICE_GROWTH_YEARLY_FILE")
	if err != nil {
		return StripeConfig{}, err
	}
	proMonthlyPriceID, err := envcfg.OptionalValueFromEnv("STRIPE_PRICE_PRO_MONTHLY", "STRIPE_PRICE_PRO_MONTHLY_FILE")
	if err != nil {
		return StripeConfig{}, err
	}
	proYearlyPriceID, err := envcfg.OptionalValueFromEnv("STRIPE_PRICE_PRO_YEARLY", "STRIPE_PRICE_PRO_YEARLY_FILE")
	if err != nil {
		return StripeConfig{}, err
	}
	correctionCreditsPriceID, err := envcfg.OptionalValueFromEnv("STRIPE_PRICE_CORRECTION_CREDITS", "STRIPE_PRICE_CORRECTION_CREDITS_FILE")
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
