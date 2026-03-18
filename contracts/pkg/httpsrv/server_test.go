package httpsrv

import (
	"net/http"
	"testing"
	"time"
)

func TestNewServerAppliesSecureDefaults(t *testing.T) {
	t.Helper()

	handler := http.NewServeMux()
	server := NewServer(":8080", handler)

	if server.Addr != ":8080" {
		t.Fatalf("expected addr %q, got %q", ":8080", server.Addr)
	}
	if server.Handler != handler {
		t.Fatal("expected provided handler to be attached to the server")
	}
	if server.ReadHeaderTimeout != 5*time.Second {
		t.Fatalf("expected ReadHeaderTimeout %s, got %s", 5*time.Second, server.ReadHeaderTimeout)
	}
	if server.ReadTimeout != 5*time.Second {
		t.Fatalf("expected ReadTimeout %s, got %s", 5*time.Second, server.ReadTimeout)
	}
	if server.WriteTimeout != 10*time.Second {
		t.Fatalf("expected WriteTimeout %s, got %s", 10*time.Second, server.WriteTimeout)
	}
	if server.IdleTimeout != 60*time.Second {
		t.Fatalf("expected IdleTimeout %s, got %s", 60*time.Second, server.IdleTimeout)
	}
	if server.MaxHeaderBytes != 64<<10 {
		t.Fatalf("expected MaxHeaderBytes %d, got %d", 64<<10, server.MaxHeaderBytes)
	}
}

func TestNewServerAppliesOverrides(t *testing.T) {
	t.Helper()

	server := NewServer(
		":9090",
		http.NewServeMux(),
		WithReadTimeout(10*time.Second),
		WithWriteTimeout(20*time.Second),
	)

	if server.ReadTimeout != 10*time.Second {
		t.Fatalf("expected ReadTimeout %s, got %s", 10*time.Second, server.ReadTimeout)
	}
	if server.WriteTimeout != 20*time.Second {
		t.Fatalf("expected WriteTimeout %s, got %s", 20*time.Second, server.WriteTimeout)
	}
}
