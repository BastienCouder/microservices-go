package http

import (
	"context"
	"encoding/json"
	"net"
	"net/http"
	"net/http/httptest"
	"strconv"
	"strings"
	"sync/atomic"
	"testing"

	permissionv1 "github.com/bastiencouder/microservices-go/contracts/gen/go/permission/v1"
	grpctls "github.com/bastiencouder/microservices-go/contracts/pkg/grpctls"
	"google.golang.org/grpc"
)

func TestGatewayHealth(t *testing.T) {
	upstream := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		w.WriteHeader(http.StatusOK)
	}))
	defer upstream.Close()

	h, err := NewHandler(upstream.URL, upstream.URL, upstream.URL, upstream.URL, upstream.URL, upstream.URL, 100, "test-secret", "api-gateway")
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

	h, err := NewHandler(userUpstream.URL, authUpstream.URL, userUpstream.URL, userUpstream.URL, userUpstream.URL, userUpstream.URL, 100, "test-secret", "api-gateway")
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

func TestGatewayPublicAPIRoutesWithAPIKeyAndOrganizationScope(t *testing.T) {
	const rawKey = "org_test_key"
	var projectPath string
	var projectOrg string
	var authCalls atomic.Int64

	authUpstream := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path == "/auth/validate" {
			authCalls.Add(1)
			w.WriteHeader(http.StatusUnauthorized)
			return
		}
		w.WriteHeader(http.StatusOK)
	}))
	defer authUpstream.Close()

	organizationsUpstream := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path != "/internal/api-keys/validate" || r.Method != http.MethodPost {
			t.Fatalf("unexpected organizations request: %s %s", r.Method, r.URL.Path)
		}
		var req map[string]string
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			t.Fatalf("decode validation request: %v", err)
		}
		if req["api_key"] != rawKey {
			t.Fatalf("expected raw key to be validated, got %q", req["api_key"])
		}
		w.Header().Set("Content-Type", "application/json")
		_, _ = w.Write([]byte(`{"id":11,"organizationId":7,"name":"Production","prefix":"org_test"}`))
	}))
	defer organizationsUpstream.Close()

	billingUpstream := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path != "/billing/quotas/7" || r.Method != http.MethodGet {
			t.Fatalf("unexpected billing request: %s %s", r.Method, r.URL.Path)
		}
		if got := r.Header.Get("X-Organization-ID"); got != "7" {
			t.Fatalf("expected organization scope on billing request, got %q", got)
		}
		w.Header().Set("Content-Type", "application/json")
		_, _ = w.Write([]byte(`{"organization_id":7,"plan":"developer","subscription_status":"active","is_paid":true}`))
	}))
	defer billingUpstream.Close()

	projectUpstream := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		projectPath = r.URL.Path
		projectOrg = r.Header.Get("X-Organization-ID")
		w.Header().Set("Content-Type", "application/json")
		_, _ = w.Write([]byte(`{"success":true,"data":[]}`))
	}))
	defer projectUpstream.Close()

	h, err := NewHandlerWithGRPCAndServices(
		projectUpstream.URL,
		authUpstream.URL,
		organizationsUpstream.URL,
		projectUpstream.URL,
		"",
		billingUpstream.URL,
		projectUpstream.URL,
		projectUpstream.URL,
		projectUpstream.URL,
		projectUpstream.URL,
		projectUpstream.URL,
		100,
		"test-secret",
		"api-gateway",
		nil,
		nil,
		grpctls.ClientConfig{AllowInsecure: true},
	)
	if err != nil {
		t.Fatalf("new handler: %v", err)
	}

	mux := http.NewServeMux()
	h.Register(mux)

	req := httptest.NewRequest(http.MethodGet, "/v1/projects", nil)
	req.Header.Set("Authorization", "Bearer "+rawKey)
	rec := httptest.NewRecorder()
	mux.ServeHTTP(rec, req)

	if rec.Code != http.StatusOK {
		t.Fatalf("unexpected status: %d body=%s", rec.Code, rec.Body.String())
	}
	if authCalls.Load() != 0 {
		t.Fatalf("expected public API key auth to bypass browser auth, got %d auth calls", authCalls.Load())
	}
	if projectPath != "/projects" {
		t.Fatalf("expected upstream project path /projects, got %q", projectPath)
	}
	if projectOrg != "7" {
		t.Fatalf("expected project organization scope 7, got %q", projectOrg)
	}
}

func TestGatewayPublicAPIRejectsMissingAPIKey(t *testing.T) {
	upstream := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		w.WriteHeader(http.StatusOK)
	}))
	defer upstream.Close()

	h, err := NewHandler(upstream.URL, upstream.URL, upstream.URL, upstream.URL, upstream.URL, upstream.URL, 100, "test-secret", "api-gateway")
	if err != nil {
		t.Fatalf("new handler: %v", err)
	}

	mux := http.NewServeMux()
	h.Register(mux)

	req := httptest.NewRequest(http.MethodGet, "/v1/projects", nil)
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

	h, err := NewHandler(authUpstream.URL, authUpstream.URL, authUpstream.URL, authUpstream.URL, authUpstream.URL, authUpstream.URL, 100, "test-secret", "api-gateway")
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

func TestGatewayAppEntryRedirectsAccountsWithoutOrganization(t *testing.T) {
	authUpstream := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path != "/auth/validate" {
			t.Fatalf("unexpected auth path: %s", r.URL.Path)
		}
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusOK)
		_, _ = w.Write([]byte(`{"authenticated":true,"identity_id":"kratos-id"}`))
	}))
	defer authUpstream.Close()

	userUpstream := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path != "/users/by-auth/kratos-id" {
			t.Fatalf("unexpected user path: %s", r.URL.Path)
		}
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusOK)
		_, _ = w.Write([]byte(`{"id":42}`))
	}))
	defer userUpstream.Close()

	organizationsUpstream := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path != "/organizations/me" {
			t.Fatalf("unexpected organizations path: %s", r.URL.Path)
		}
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusOK)
		_, _ = w.Write([]byte(`[]`))
	}))
	defer organizationsUpstream.Close()

	h, err := NewHandler(userUpstream.URL, authUpstream.URL, organizationsUpstream.URL, userUpstream.URL, userUpstream.URL, userUpstream.URL, 100, "test-secret", "api-gateway")
	if err != nil {
		t.Fatalf("new handler: %v", err)
	}

	mux := http.NewServeMux()
	h.Register(mux)

	req := httptest.NewRequest(http.MethodGet, "/auth/app-entry", nil)
	req.Header.Set("X-Original-URI", "/monitoring")
	rec := httptest.NewRecorder()
	mux.ServeHTTP(rec, req)

	if rec.Code != http.StatusForbidden {
		t.Fatalf("unexpected status: %d body=%s", rec.Code, rec.Body.String())
	}
	if got := rec.Header().Get("X-App-Redirect"); got != "/onboarding?setup=account" {
		t.Fatalf("unexpected app redirect: %q", got)
	}
}

func TestGatewayAppEntryAllowsOnboardingRouteWithoutOrganizationCheck(t *testing.T) {
	authUpstream := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusOK)
		_, _ = w.Write([]byte(`{"authenticated":true,"identity_id":"kratos-id"}`))
	}))
	defer authUpstream.Close()

	userUpstream := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path != "/users/by-auth/kratos-id" {
			t.Fatalf("unexpected user path: %s", r.URL.Path)
		}
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusOK)
		_, _ = w.Write([]byte(`{"id":42}`))
	}))
	defer userUpstream.Close()

	var organizationCalls atomic.Int64
	organizationsUpstream := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		organizationCalls.Add(1)
		w.WriteHeader(http.StatusOK)
		_, _ = w.Write([]byte(`[]`))
	}))
	defer organizationsUpstream.Close()

	h, err := NewHandler(userUpstream.URL, authUpstream.URL, organizationsUpstream.URL, userUpstream.URL, userUpstream.URL, userUpstream.URL, 100, "test-secret", "api-gateway")
	if err != nil {
		t.Fatalf("new handler: %v", err)
	}

	mux := http.NewServeMux()
	h.Register(mux)

	req := httptest.NewRequest(http.MethodGet, "/auth/app-entry", nil)
	req.Header.Set("X-Original-URI", "/onboarding?setup=account")
	rec := httptest.NewRecorder()
	mux.ServeHTTP(rec, req)

	if rec.Code != http.StatusNoContent {
		t.Fatalf("unexpected status: %d body=%s", rec.Code, rec.Body.String())
	}
	if organizationCalls.Load() != 0 {
		t.Fatalf("expected onboarding bypass to skip organization checks, got %d calls", organizationCalls.Load())
	}
}

func TestGatewayBillingStripeWebhookIsPublic(t *testing.T) {
	var upstreamAuthz string

	billingUpstream := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path != "/billing/stripe/webhook" {
			t.Fatalf("unexpected path: %s", r.URL.Path)
		}
		upstreamAuthz = r.Header.Get("Authorization")
		w.WriteHeader(http.StatusOK)
		_, _ = w.Write([]byte(`{"status":"ok"}`))
	}))
	defer billingUpstream.Close()

	authUpstream := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path == "/auth/validate" {
			w.WriteHeader(http.StatusUnauthorized)
			_, _ = w.Write([]byte(`{"error":"unauthorized"}`))
			return
		}
		w.WriteHeader(http.StatusOK)
	}))
	defer authUpstream.Close()

	h, err := NewHandler(
		billingUpstream.URL,
		authUpstream.URL,
		billingUpstream.URL,
		billingUpstream.URL,
		billingUpstream.URL,
		billingUpstream.URL,
		100,
		"test-secret",
		"api-gateway",
	)
	if err != nil {
		t.Fatalf("new handler: %v", err)
	}

	mux := http.NewServeMux()
	h.Register(mux)

	req := httptest.NewRequest(http.MethodPost, "/billing/stripe/webhook", strings.NewReader(`{"id":"evt_1"}`))
	rec := httptest.NewRecorder()
	mux.ServeHTTP(rec, req)

	if rec.Code != http.StatusOK {
		t.Fatalf("unexpected status: %d body=%s", rec.Code, rec.Body.String())
	}
	if !strings.HasPrefix(upstreamAuthz, "Bearer ") {
		t.Fatalf("expected internal bearer token, got %q", upstreamAuthz)
	}
}

func TestGatewayBillingStripeWebhookRateLimited(t *testing.T) {
	billingUpstream := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		w.WriteHeader(http.StatusOK)
		_, _ = w.Write([]byte(`{"status":"ok"}`))
	}))
	defer billingUpstream.Close()

	authUpstream := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		w.WriteHeader(http.StatusUnauthorized)
		_, _ = w.Write([]byte(`{"error":"unauthorized"}`))
	}))
	defer authUpstream.Close()

	h, err := NewHandler(
		billingUpstream.URL,
		authUpstream.URL,
		billingUpstream.URL,
		billingUpstream.URL,
		billingUpstream.URL,
		billingUpstream.URL,
		1,
		"test-secret",
		"api-gateway",
	)
	if err != nil {
		t.Fatalf("new handler: %v", err)
	}

	mux := http.NewServeMux()
	h.Register(mux)

	req1 := httptest.NewRequest(http.MethodPost, "/billing/stripe/webhook", strings.NewReader(`{"id":"evt_1"}`))
	rec1 := httptest.NewRecorder()
	mux.ServeHTTP(rec1, req1)
	if rec1.Code != http.StatusOK {
		t.Fatalf("first webhook should pass, got %d body=%s", rec1.Code, rec1.Body.String())
	}

	req2 := httptest.NewRequest(http.MethodPost, "/billing/stripe/webhook", strings.NewReader(`{"id":"evt_2"}`))
	rec2 := httptest.NewRecorder()
	mux.ServeHTTP(rec2, req2)
	if rec2.Code != http.StatusTooManyRequests {
		t.Fatalf("second webhook should be rate limited, got %d body=%s", rec2.Code, rec2.Body.String())
	}
}

func TestGatewayRateLimit(t *testing.T) {
	upstream := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		w.WriteHeader(http.StatusOK)
		_, _ = w.Write([]byte(`{"status":"ok"}`))
	}))
	defer upstream.Close()

	h, err := NewHandler(upstream.URL, upstream.URL, upstream.URL, upstream.URL, upstream.URL, upstream.URL, 1, "test-secret", "api-gateway")
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

func TestGatewayInvitationsAcceptDoesNotRequireOrganizationHeader(t *testing.T) {
	var invitationCalls int32

	organizationsUpstream := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path != "/invitations/token-123/accept" {
			t.Fatalf("unexpected path: %s", r.URL.Path)
		}
		atomic.AddInt32(&invitationCalls, 1)
		w.WriteHeader(http.StatusOK)
		_, _ = w.Write([]byte(`{"status":"accepted"}`))
	}))
	defer organizationsUpstream.Close()

	userUpstream := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if !strings.HasPrefix(r.URL.Path, "/users/by-auth/") {
			w.WriteHeader(http.StatusNotFound)
			return
		}
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusOK)
		_, _ = w.Write([]byte(`{"id":42}`))
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

	h, err := NewHandler(
		userUpstream.URL,
		authUpstream.URL,
		organizationsUpstream.URL,
		organizationsUpstream.URL,
		organizationsUpstream.URL,
		organizationsUpstream.URL,
		100,
		"test-secret",
		"api-gateway",
	)
	if err != nil {
		t.Fatalf("new handler: %v", err)
	}

	mux := http.NewServeMux()
	h.Register(mux)

	req := httptest.NewRequest(http.MethodPost, "/invitations/token-123/accept", nil)
	rec := httptest.NewRecorder()
	mux.ServeHTTP(rec, req)

	if rec.Code != http.StatusOK {
		t.Fatalf("unexpected status: %d body=%s", rec.Code, rec.Body.String())
	}
	if atomic.LoadInt32(&invitationCalls) != 1 {
		t.Fatalf("expected organizations upstream to be called once")
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
	defer func() {
		_ = grpcListener.Close()
	}()
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
		"test-secret",
		"api-gateway",
		nil,
		nil,
		grpctls.ClientConfig{AllowInsecure: true},
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

func TestGatewayDeleteOrganizationCancelsBillingFirst(t *testing.T) {
	callOrder := make([]string, 0, 3)

	organizationsUpstream := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		switch {
		case r.URL.Path == "/organizations/me":
			w.Header().Set("Content-Type", "application/json")
			w.WriteHeader(http.StatusOK)
			_, _ = w.Write([]byte(`[{"organizationId":"org_123","internalId":"7","publicId":"org_123","role":"editor"}]`))
		case r.URL.Path == "/organizations/org_123" && r.Method == http.MethodDelete:
			callOrder = append(callOrder, "organization-delete")
			if got := r.Header.Get("X-Organization-ID"); got != "7" {
				t.Fatalf("expected organization delete scoped to 7, got %q", got)
			}
			w.WriteHeader(http.StatusNoContent)
		default:
			t.Fatalf("unexpected organizations request: %s %s", r.Method, r.URL.Path)
		}
	}))
	defer organizationsUpstream.Close()

	billingUpstream := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path != "/billing/subscriptions/cancel" || r.Method != http.MethodPost {
			t.Fatalf("unexpected billing request: %s %s", r.Method, r.URL.Path)
		}
		callOrder = append(callOrder, "billing-cancel")
		if got := r.Header.Get("X-Organization-ID"); got != "7" {
			t.Fatalf("expected billing cancel scoped to 7, got %q", got)
		}
		w.WriteHeader(http.StatusNoContent)
	}))
	defer billingUpstream.Close()

	userUpstream := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if !strings.HasPrefix(r.URL.Path, "/users/by-auth/") {
			w.WriteHeader(http.StatusNotFound)
			return
		}
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusOK)
		_, _ = w.Write([]byte(`{"id":42}`))
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
	defer func() {
		_ = grpcListener.Close()
	}()
	grpcServer := grpc.NewServer()
	permissionv1.RegisterPermissionServiceServer(grpcServer, &permissionGRPCAllowService{})
	defer grpcServer.GracefulStop()
	go func() {
		if serveErr := grpcServer.Serve(grpcListener); serveErr != nil {
			t.Logf("grpc server stopped: %v", serveErr)
		}
	}()

	h, err := NewHandlerWithGRPC(
		userUpstream.URL,
		authUpstream.URL,
		organizationsUpstream.URL,
		organizationsUpstream.URL,
		grpcListener.Addr().String(),
		billingUpstream.URL,
		organizationsUpstream.URL,
		100,
		"test-secret",
		"api-gateway",
		nil,
		nil,
		grpctls.ClientConfig{AllowInsecure: true},
	)
	if err != nil {
		t.Fatalf("new handler: %v", err)
	}

	mux := http.NewServeMux()
	h.Register(mux)

	req := httptest.NewRequest(http.MethodDelete, "/organizations/org_123", nil)
	req.Header.Set("X-Organization-ID", "org_123")
	rec := httptest.NewRecorder()
	mux.ServeHTTP(rec, req)

	if rec.Code != http.StatusNoContent {
		t.Fatalf("unexpected status: %d body=%s", rec.Code, rec.Body.String())
	}
	if len(callOrder) != 2 {
		t.Fatalf("expected two downstream calls, got %#v", callOrder)
	}
	if callOrder[0] != "billing-cancel" || callOrder[1] != "organization-delete" {
		t.Fatalf("unexpected downstream order: %#v", callOrder)
	}
}

func TestGatewayUsersReadForbidsOtherUserID(t *testing.T) {
	var getUserCalls int32

	userUpstream := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		switch {
		case strings.HasPrefix(r.URL.Path, "/users/by-auth/"):
			w.Header().Set("Content-Type", "application/json")
			w.WriteHeader(http.StatusOK)
			_, _ = w.Write([]byte(`{"id":42}`))
		case strings.HasPrefix(r.URL.Path, "/users/"):
			atomic.AddInt32(&getUserCalls, 1)
			w.Header().Set("Content-Type", "application/json")
			w.WriteHeader(http.StatusOK)
			_, _ = w.Write([]byte(`{"id":99}`))
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

	h, err := NewHandler(userUpstream.URL, authUpstream.URL, userUpstream.URL, userUpstream.URL, userUpstream.URL, userUpstream.URL, 100, "test-secret", "api-gateway")
	if err != nil {
		t.Fatalf("new handler: %v", err)
	}

	mux := http.NewServeMux()
	h.Register(mux)

	req := httptest.NewRequest(http.MethodGet, "/users/99", nil)
	rec := httptest.NewRecorder()
	mux.ServeHTTP(rec, req)

	if rec.Code != http.StatusForbidden {
		t.Fatalf("unexpected status: %d body=%s", rec.Code, rec.Body.String())
	}
	if got := atomic.LoadInt32(&getUserCalls); got != 0 {
		t.Fatalf("users upstream should not be called, got %d calls", got)
	}
}

func TestGatewayDeleteMeProxiesAuthenticatedUser(t *testing.T) {
	var deleteCalls int32
	var forwardedClaims internalTokenClaims

	userUpstream := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		switch {
		case strings.HasPrefix(r.URL.Path, "/users/by-auth/"):
			w.Header().Set("Content-Type", "application/json")
			w.WriteHeader(http.StatusOK)
			_, _ = w.Write([]byte(`{"id":42}`))
		case r.URL.Path == "/users/me" && r.Method == http.MethodDelete:
			atomic.AddInt32(&deleteCalls, 1)
			token := strings.TrimSpace(strings.TrimPrefix(r.Header.Get("Authorization"), "Bearer "))
			claims, err := verifyInternalJWT(token, "test-secret", "api-gateway", "user-service")
			if err != nil {
				t.Fatalf("verify internal jwt: %v", err)
			}
			forwardedClaims = claims
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

	h, err := NewHandler(userUpstream.URL, authUpstream.URL, userUpstream.URL, userUpstream.URL, userUpstream.URL, userUpstream.URL, 100, "test-secret", "api-gateway")
	if err != nil {
		t.Fatalf("new handler: %v", err)
	}

	mux := http.NewServeMux()
	h.Register(mux)

	req := httptest.NewRequest(http.MethodDelete, "/users/me", nil)
	rec := httptest.NewRecorder()
	mux.ServeHTTP(rec, req)

	if rec.Code != http.StatusNoContent {
		t.Fatalf("unexpected status: %d body=%s", rec.Code, rec.Body.String())
	}
	if got := atomic.LoadInt32(&deleteCalls); got != 1 {
		t.Fatalf("expected delete upstream to be called once, got %d", got)
	}
	if forwardedClaims.IdentityID != "kratos-id-42" {
		t.Fatalf("unexpected forwarded identity: %q", forwardedClaims.IdentityID)
	}
	if forwardedClaims.UserID != 42 {
		t.Fatalf("unexpected forwarded user id: %d", forwardedClaims.UserID)
	}
}

func TestGatewayUsersByAuthForbidsDifferentIdentity(t *testing.T) {
	var byAuthCalls int32

	userUpstream := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		switch {
		case strings.HasPrefix(r.URL.Path, "/users/by-auth/"):
			pathIdentity := strings.TrimPrefix(r.URL.Path, "/users/by-auth/")
			if pathIdentity == "kratos-id-42" {
				w.Header().Set("Content-Type", "application/json")
				w.WriteHeader(http.StatusOK)
				_, _ = w.Write([]byte(`{"id":42}`))
				return
			}
			atomic.AddInt32(&byAuthCalls, 1)
			w.Header().Set("Content-Type", "application/json")
			w.WriteHeader(http.StatusOK)
			_, _ = w.Write([]byte(`{"id":9001}`))
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

	h, err := NewHandler(userUpstream.URL, authUpstream.URL, userUpstream.URL, userUpstream.URL, userUpstream.URL, userUpstream.URL, 100, "test-secret", "api-gateway")
	if err != nil {
		t.Fatalf("new handler: %v", err)
	}

	mux := http.NewServeMux()
	h.Register(mux)

	req := httptest.NewRequest(http.MethodGet, "/users/by-auth/not-your-id", nil)
	rec := httptest.NewRecorder()
	mux.ServeHTTP(rec, req)

	if rec.Code != http.StatusForbidden {
		t.Fatalf("unexpected status: %d body=%s", rec.Code, rec.Body.String())
	}
	if got := atomic.LoadInt32(&byAuthCalls); got != 0 {
		t.Fatalf("users by-auth upstream should not be called for different identity, got %d calls", got)
	}
}

func TestGatewayStripsSpoofedIdentityHeadersBeforeProxy(t *testing.T) {
	var seenSpoofedHeader string

	authUpstream := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path != "/auth/validate" {
			w.WriteHeader(http.StatusNotFound)
			return
		}
		seenSpoofedHeader = strings.TrimSpace(r.Header.Get("X-Authenticated-User-ID"))
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusOK)
		_, _ = w.Write([]byte(`{"authenticated":true,"identity_id":"kratos-id-42"}`))
	}))
	defer authUpstream.Close()

	h, err := NewHandler(authUpstream.URL, authUpstream.URL, authUpstream.URL, authUpstream.URL, authUpstream.URL, authUpstream.URL, 100, "test-secret", "api-gateway")
	if err != nil {
		t.Fatalf("new handler: %v", err)
	}

	mux := http.NewServeMux()
	h.Register(mux)

	req := httptest.NewRequest(http.MethodGet, "/auth/validate", nil)
	req.Header.Set("X-Authenticated-User-ID", "999")
	rec := httptest.NewRecorder()
	mux.ServeHTTP(rec, req)

	if rec.Code != http.StatusOK {
		t.Fatalf("unexpected status: %d body=%s", rec.Code, rec.Body.String())
	}
	if seenSpoofedHeader != "" {
		t.Fatalf("spoofed identity header should be stripped before proxying, got %q", seenSpoofedHeader)
	}
}

func TestGatewayRateLimitIgnoresXForwardedForFromUntrustedRemote(t *testing.T) {
	upstream := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		w.WriteHeader(http.StatusOK)
	}))
	defer upstream.Close()

	h, err := NewHandler(upstream.URL, upstream.URL, upstream.URL, upstream.URL, upstream.URL, upstream.URL, 1, "test-secret", "api-gateway")
	if err != nil {
		t.Fatalf("new handler: %v", err)
	}

	mux := http.NewServeMux()
	h.Register(mux)

	req1 := httptest.NewRequest(http.MethodGet, "/auth/validate", nil)
	req1.Header.Set("X-Forwarded-For", "1.1.1.1")
	req1.RemoteAddr = net.JoinHostPort("203.0.113.9", strconv.Itoa(50001))
	rec1 := httptest.NewRecorder()
	mux.ServeHTTP(rec1, req1)
	if rec1.Code != http.StatusOK {
		t.Fatalf("first request should pass, got %d", rec1.Code)
	}

	req2 := httptest.NewRequest(http.MethodGet, "/auth/validate", nil)
	req2.Header.Set("X-Forwarded-For", "8.8.8.8")
	req2.RemoteAddr = net.JoinHostPort("203.0.113.9", strconv.Itoa(50002))
	rec2 := httptest.NewRecorder()
	mux.ServeHTTP(rec2, req2)
	if rec2.Code != http.StatusTooManyRequests {
		t.Fatalf("second request should be rate limited when remote peer is unchanged, got %d", rec2.Code)
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

type permissionGRPCAllowService struct {
	permissionv1.UnimplementedPermissionServiceServer
}

func (s *permissionGRPCAllowService) Check(_ context.Context, _ *permissionv1.CheckRequest) (*permissionv1.CheckResponse, error) {
	return &permissionv1.CheckResponse{Allowed: true, Reason: "role grants full access"}, nil
}
