package config

import "testing"

func TestLoadGA4ConfigDefaultsFakeTrafficEnabled(t *testing.T) {
	t.Setenv("GA4_OAUTH_CLIENT_ID", "client-id")
	t.Setenv("GA4_OAUTH_CLIENT_SECRET", "client-secret")

	cfg, err := loadGA4Config()
	if err != nil {
		t.Fatalf("load ga4 config: %v", err)
	}

	if !cfg.FakeTrafficEnabled {
		t.Fatalf("expected fake traffic fallback to be enabled by default")
	}
}

func TestLoadGA4ConfigCanDisableFakeTrafficWithEnv(t *testing.T) {
	t.Setenv("GA4_OAUTH_CLIENT_ID", "client-id")
	t.Setenv("GA4_OAUTH_CLIENT_SECRET", "client-secret")
	t.Setenv("ATTRIBUTION_ENABLE_FAKE_TRAFFIC", "false")

	cfg, err := loadGA4Config()
	if err != nil {
		t.Fatalf("load ga4 config: %v", err)
	}

	if cfg.FakeTrafficEnabled {
		t.Fatalf("expected fake traffic fallback to be disabled")
	}
}
