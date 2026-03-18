package config

import "testing"

func TestLoadProviderModeDefaultsToOpenRouterBaseURL(t *testing.T) {
	t.Setenv("HTTP_ADDR", ":8091")
	t.Setenv("GRPC_ADDR", ":9091")
	t.Setenv("INTERNAL_JWT_SECRET", "secret")
	t.Setenv("INTERNAL_JWT_ISSUER", "api-gateway")
	t.Setenv("IA_EXECUTION_MODE", "provider")
	t.Setenv("IA_PROVIDER_API_KEY", "openrouter-key")
	t.Setenv("IA_PROVIDER_TIMEOUT_MS", "5000")

	cfg, err := Load()
	if err != nil {
		t.Fatalf("load config: %v", err)
	}
	if cfg.ProviderBaseURL != "https://openrouter.ai/api/v1" {
		t.Fatalf("expected openrouter base url, got %q", cfg.ProviderBaseURL)
	}
}

func TestLoadProviderModeReadsOpenRouterAttributionHeaders(t *testing.T) {
	t.Setenv("HTTP_ADDR", ":8091")
	t.Setenv("GRPC_ADDR", ":9091")
	t.Setenv("INTERNAL_JWT_SECRET", "secret")
	t.Setenv("INTERNAL_JWT_ISSUER", "api-gateway")
	t.Setenv("IA_EXECUTION_MODE", "provider")
	t.Setenv("IA_PROVIDER_API_KEY", "openrouter-key")
	t.Setenv("IA_PROVIDER_TIMEOUT_MS", "5000")
	t.Setenv("IA_PROVIDER_BASE_URL", "https://openrouter.ai/api/v1")
	t.Setenv("IA_PROVIDER_HTTP_REFERER", "https://microservices-go.local")
	t.Setenv("IA_PROVIDER_APP_NAME", "microservices-go")

	cfg, err := Load()
	if err != nil {
		t.Fatalf("load config: %v", err)
	}
	if cfg.ProviderHTTPReferer != "https://microservices-go.local" {
		t.Fatalf("expected referer, got %q", cfg.ProviderHTTPReferer)
	}
	if cfg.ProviderAppName != "microservices-go" {
		t.Fatalf("expected app name, got %q", cfg.ProviderAppName)
	}
}
