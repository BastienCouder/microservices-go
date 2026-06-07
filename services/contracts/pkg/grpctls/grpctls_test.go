package grpctls

import "testing"

func TestServerOptionsRejectsMissingCertWhenInsecureDisabled(t *testing.T) {
	_, err := ServerOptions(ServerConfig{
		AllowInsecure: false,
	})
	if err == nil {
		t.Fatal("expected error when TLS cert/key are missing and insecure mode is disabled")
	}
}

func TestServerOptionsAllowsExplicitInsecureMode(t *testing.T) {
	opts, err := ServerOptions(ServerConfig{
		AllowInsecure: true,
	})
	if err != nil {
		t.Fatalf("server options: %v", err)
	}
	if len(opts) != 0 {
		t.Fatalf("expected no server options in explicit insecure mode, got %d", len(opts))
	}
}

func TestClientDialOptionsAllowsExplicitInsecureMode(t *testing.T) {
	opts, err := ClientDialOptions(ClientConfig{
		AllowInsecure: true,
	})
	if err != nil {
		t.Fatalf("client dial options: %v", err)
	}
	if len(opts) == 0 {
		t.Fatal("expected at least one dial option in explicit insecure mode")
	}
}
