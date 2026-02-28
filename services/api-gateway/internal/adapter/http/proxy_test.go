package http

import (
	"context"
	"encoding/json"
	"net"
	"net/http"
	"net/http/httptest"
	"strings"
	"sync/atomic"
	"testing"

	permissionv1 "github.com/bastiencouder/microservices-go/contracts/gen/go/permission/v1"
	"google.golang.org/grpc"
)

func TestGatewayHealth(t *testing.T) {
	upstream := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		w.WriteHeader(http.StatusOK)
	}))
	defer upstream.Close()

	h, err := NewHandler(upstream.URL, upstream.URL, upstream.URL, upstream.URL, upstream.URL, upstream.URL, 100)
	if err != nil {
		t.Fatalf("new handler: %v", err)
	}

	mux := http.NewServeMux()
	h.Register(mux)

	req := httptest.NewRequest(http.MethodGet, "/health", nil)
	rec := httptest.NewRecorder()
	mux.ServeHTTP(rec, req)

	if rec.Code != http.StatusOK {
		t.Fatalf("unexpected status: %d", rec.Code)
	}

	var body map[string]string
	if err := json.Unmarshal(rec.Body.Bytes(), &body); err != nil {
		t.Fatalf("unmarshal body: %v", err)
	}
	if body["service"] != "api-gateway" {
		t.Fatalf("unexpected service value: %q", body["service"])
	}
}

func TestGatewayProtectsUsersWhenUnauthorized(t *testing.T) {
	userUpstream := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		w.WriteHeader(http.StatusOK)
	}))
	defer userUpstream.Close()

	authUpstream := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path == "/auth/validate" {
			w.WriteHeader(http.StatusUnauthorized)
			_, _ = w.Write([]byte(`{"error":"unauthorized"}`))
			return
		}
		w.WriteHeader(http.StatusOK)
	}))
	defer authUpstream.Close()

	h, err := NewHandler(userUpstream.URL, authUpstream.URL, userUpstream.URL, userUpstream.URL, userUpstream.URL, userUpstream.URL, 100)
	if err != nil {
		t.Fatalf("new handler: %v", err)
	}

	mux := http.NewServeMux()
	h.Register(mux)

	req := httptest.NewRequest(http.MethodGet, "/users/1", nil)
	rec := httptest.NewRecorder()
	mux.ServeHTTP(rec, req)

	if rec.Code != http.StatusUnauthorized {
		t.Fatalf("unexpected status: %d body=%s", rec.Code, rec.Body.String())
	}
}

func TestGatewayProxyAuth(t *testing.T) {
	authUpstream := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path != "/auth/validate" {
			t.Fatalf("unexpected path: %s", r.URL.Path)
		}
		if r.Method != http.MethodGet {
			t.Fatalf("unexpected method: %s", r.Method)
		}
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusOK)
		_, _ = w.Write([]byte(`{"authenticated":true,"identity_id":"kratos-id"}`))
	}))
	defer authUpstream.Close()

	h, err := NewHandler(authUpstream.URL, authUpstream.URL, authUpstream.URL, authUpstream.URL, authUpstream.URL, authUpstream.URL, 100)
	if err != nil {
		t.Fatalf("new handler: %v", err)
	}

	mux := http.NewServeMux()
	h.Register(mux)

	req := httptest.NewRequest(http.MethodGet, "/auth/validate", strings.NewReader(""))
	rec := httptest.NewRecorder()
	mux.ServeHTTP(rec, req)

	if rec.Code != http.StatusOK {
		t.Fatalf("unexpected status: %d, body=%s", rec.Code, rec.Body.String())
	}
}

func TestGatewayRateLimit(t *testing.T) {
	upstream := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		w.WriteHeader(http.StatusOK)
		_, _ = w.Write([]byte(`{"status":"ok"}`))
	}))
	defer upstream.Close()

	h, err := NewHandler(upstream.URL, upstream.URL, upstream.URL, upstream.URL, upstream.URL, upstream.URL, 1)
	if err != nil {
		t.Fatalf("new handler: %v", err)
	}

	mux := http.NewServeMux()
	h.Register(mux)

	req1 := httptest.NewRequest(http.MethodGet, "/auth/validate", nil)
	rec1 := httptest.NewRecorder()
	mux.ServeHTTP(rec1, req1)
	if rec1.Code != http.StatusOK {
		t.Fatalf("first request should pass, got %d", rec1.Code)
	}

	req2 := httptest.NewRequest(http.MethodGet, "/auth/validate", nil)
	rec2 := httptest.NewRecorder()
	mux.ServeHTTP(rec2, req2)
	if rec2.Code != http.StatusTooManyRequests {
		t.Fatalf("second request should be rate limited, got %d", rec2.Code)
	}
}

func TestGatewayAdminUsersForbiddenWithoutAdminRole(t *testing.T) {
	var adminUpstreamCalls int32

	userUpstream := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		switch {
		case strings.HasPrefix(r.URL.Path, "/users/by-auth/"):
			w.Header().Set("Content-Type", "application/json")
			w.WriteHeader(http.StatusOK)
			_, _ = w.Write([]byte(`{"id":42}`))
		case strings.HasPrefix(r.URL.Path, "/admin/users/"):
			atomic.AddInt32(&adminUpstreamCalls, 1)
			w.WriteHeader(http.StatusNoContent)
		default:
			w.WriteHeader(http.StatusNotFound)
		}
	}))
	defer userUpstream.Close()

	authUpstream := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path != "/auth/validate" {
			w.WriteHeader(http.StatusNotFound)
			return
		}
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusOK)
		_, _ = w.Write([]byte(`{"identity_id":"kratos-id-42"}`))
	}))
	defer authUpstream.Close()

	grpcListener, err := net.Listen("tcp", "127.0.0.1:0")
	if err != nil {
		t.Fatalf("listen grpc: %v", err)
	}
	defer grpcListener.Close()
	grpcServer := grpc.NewServer()
	permissionv1.RegisterPermissionServiceServer(grpcServer, &permissionGRPCDenyService{t: t})
	defer grpcServer.GracefulStop()
	go func() {
		if serveErr := grpcServer.Serve(grpcListener); serveErr != nil {
			t.Logf("grpc server stopped: %v", serveErr)
		}
	}()

	h, err := NewHandlerWithGRPC(
		userUpstream.URL,
		authUpstream.URL,
		userUpstream.URL,
		userUpstream.URL,
		grpcListener.Addr().String(),
		userUpstream.URL,
		userUpstream.URL,
		100,
	)
	if err != nil {
		t.Fatalf("new handler: %v", err)
	}

	mux := http.NewServeMux()
	h.Register(mux)

	req := httptest.NewRequest(http.MethodPost, "/admin/users/42/ban", nil)
	req.Header.Set("X-Organization-ID", "7")
	rec := httptest.NewRecorder()
	mux.ServeHTTP(rec, req)

	if rec.Code != http.StatusForbidden {
		t.Fatalf("unexpected status: %d body=%s", rec.Code, rec.Body.String())
	}
	if got := atomic.LoadInt32(&adminUpstreamCalls); got != 0 {
		t.Fatalf("admin upstream should not be called when forbidden, got %d calls", got)
	}
}

type permissionGRPCDenyService struct {
	permissionv1.UnimplementedPermissionServiceServer
	t *testing.T
}

func (s *permissionGRPCDenyService) Check(_ context.Context, req *permissionv1.CheckRequest) (*permissionv1.CheckResponse, error) {
	s.t.Helper()
	if req.GetOrganizationId() != 7 || req.GetUserId() != 42 || req.GetAction() != "admin" || req.GetResource() != "users" {
		s.t.Fatalf("unexpected permission check request: %+v", req)
	}
	return &permissionv1.CheckResponse{Allowed: false, Reason: "missing required role"}, nil
}
