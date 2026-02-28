package http

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"log"
	"net"
	"net/http"
	"net/http/httputil"
	"net/url"
	"strconv"
	"strings"
	"sync"
	"time"

	permissionv1 "github.com/bastiencouder/microservices-go/contracts/gen/go/permission/v1"
)

type Handler struct {
	userProxy          *httputil.ReverseProxy
	authProxy          *httputil.ReverseProxy
	organizationsProxy *httputil.ReverseProxy
	permissionProxy    *httputil.ReverseProxy
	billingProxy       *httputil.ReverseProxy
	notificationProxy  *httputil.ReverseProxy
	authURL            string
	userURL            string
	permissionGRPC     *permissionGRPCClient
	httpClient         *http.Client
	rateLimiter        *rateLimiter
}

type rateLimiter struct {
	mu         sync.Mutex
	windowFrom time.Time
	window     time.Duration
	limit      int
	hits       map[string]int
}

func newRateLimiter(limit int, window time.Duration) (*rateLimiter, error) {
	if limit <= 0 {
		return nil, fmt.Errorf("invalid rate limit: %d", limit)
	}
	return &rateLimiter{
		windowFrom: time.Now().UTC(),
		window:     window,
		limit:      limit,
		hits:       make(map[string]int),
	}, nil
}

func (l *rateLimiter) Allow(key string) bool {
	now := time.Now().UTC()

	l.mu.Lock()
	defer l.mu.Unlock()

	if now.Sub(l.windowFrom) >= l.window {
		l.windowFrom = now
		l.hits = make(map[string]int)
	}

	l.hits[key]++
	return l.hits[key] <= l.limit
}

func NewHandler(userServiceURL, authServiceURL, organizationsServiceURL, permissionServiceURL, billingServiceURL, notificationServiceURL string, rateLimitRPM int) (*Handler, error) {
	return NewHandlerWithGRPC(userServiceURL, authServiceURL, organizationsServiceURL, permissionServiceURL, "", billingServiceURL, notificationServiceURL, rateLimitRPM)
}

func NewHandlerWithGRPC(userServiceURL, authServiceURL, organizationsServiceURL, permissionServiceURL, permissionServiceGRPCAddr, billingServiceURL, notificationServiceURL string, rateLimitRPM int) (*Handler, error) {
	userProxy, err := newProxy(userServiceURL)
	if err != nil {
		return nil, err
	}
	authProxy, err := newProxy(authServiceURL)
	if err != nil {
		return nil, err
	}
	organizationsProxy, err := newProxy(organizationsServiceURL)
	if err != nil {
		return nil, err
	}
	permissionProxy, err := newProxy(permissionServiceURL)
	if err != nil {
		return nil, err
	}
	billingProxy, err := newProxy(billingServiceURL)
	if err != nil {
		return nil, err
	}
	notificationProxy, err := newProxy(notificationServiceURL)
	if err != nil {
		return nil, err
	}
	limiter, err := newRateLimiter(rateLimitRPM, time.Minute)
	if err != nil {
		return nil, err
	}
	permissionGRPC, err := newPermissionGRPCClient(permissionServiceGRPCAddr)
	if err != nil {
		return nil, err
	}

	return &Handler{
		userProxy:          userProxy,
		authProxy:          authProxy,
		organizationsProxy: organizationsProxy,
		permissionProxy:    permissionProxy,
		billingProxy:       billingProxy,
		notificationProxy:  notificationProxy,
		authURL:            strings.TrimRight(authServiceURL, "/"),
		userURL:            strings.TrimRight(userServiceURL, "/"),
		permissionGRPC:     permissionGRPC,
		httpClient:         &http.Client{},
		rateLimiter:        limiter,
	}, nil
}

func (h *Handler) Close() error {
	if h == nil || h.permissionGRPC == nil {
		return nil
	}
	return h.permissionGRPC.Close()
}

func (h *Handler) Register(mux *http.ServeMux) {
	mux.HandleFunc("/", h.route)
}

func (h *Handler) route(w http.ResponseWriter, r *http.Request) {
	if !(r.Method == http.MethodGet && r.URL.Path == "/health") {
		if !h.rateLimiter.Allow(clientIP(r)) {
			w.Header().Set("Content-Type", "application/json")
			w.WriteHeader(http.StatusTooManyRequests)
			_ = json.NewEncoder(w).Encode(map[string]string{"error": "rate limit exceeded"})
			return
		}
	}

	switch {
	case r.Method == http.MethodGet && r.URL.Path == "/health":
		h.health(w, r)
		return
	case r.URL.Path == "/auth" || strings.HasPrefix(r.URL.Path, "/auth/"):
		h.authProxy.ServeHTTP(w, r)
		return
	case r.URL.Path == "/users" || strings.HasPrefix(r.URL.Path, "/users/"):
		h.withAuth(h.userProxy).ServeHTTP(w, r)
		return
	case r.URL.Path == "/admin/users" || strings.HasPrefix(r.URL.Path, "/admin/users/"):
		h.withAuth(h.userProxy).ServeHTTP(w, r)
		return
	case r.URL.Path == "/organizations" || strings.HasPrefix(r.URL.Path, "/organizations/"):
		h.withAuth(h.organizationsProxy).ServeHTTP(w, r)
		return
	case r.URL.Path == "/permissions" || strings.HasPrefix(r.URL.Path, "/permissions/"):
		h.withAuth(h.permissionProxy).ServeHTTP(w, r)
		return
	case r.URL.Path == "/billing" || strings.HasPrefix(r.URL.Path, "/billing/"):
		h.withAuth(h.billingProxy).ServeHTTP(w, r)
		return
	case r.URL.Path == "/notifications" || strings.HasPrefix(r.URL.Path, "/notifications/"):
		h.withAuth(h.notificationProxy).ServeHTTP(w, r)
		return
	default:
		http.NotFound(w, r)
		return
	}
}

func (h *Handler) health(w http.ResponseWriter, _ *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusOK)
	_ = json.NewEncoder(w).Encode(map[string]string{
		"status":  "ok",
		"service": "api-gateway",
	})
}

func newProxy(target string) (*httputil.ReverseProxy, error) {
	targetURL, err := url.Parse(target)
	if err != nil {
		return nil, err
	}

	proxy := httputil.NewSingleHostReverseProxy(targetURL)
	proxy.ErrorHandler = func(w http.ResponseWriter, r *http.Request, err error) {
		log.Printf("proxy error for %s: %v", r.URL.Path, err)
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusBadGateway)
		_ = json.NewEncoder(w).Encode(map[string]string{"error": "upstream unavailable"})
	}
	return proxy, nil
}

func (h *Handler) withAuth(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if strings.HasSuffix(r.URL.Path, "/health") || r.URL.Path == "/health" {
			next.ServeHTTP(w, r)
			return
		}

		identityID, err := h.validateAuth(r.Context(), r.Header.Get("Cookie"), r.Header.Get("X-Session-Token"))
		if err != nil {
			w.Header().Set("Content-Type", "application/json")
			w.WriteHeader(http.StatusUnauthorized)
			_ = json.NewEncoder(w).Encode(map[string]string{"error": "unauthorized"})
			return
		}

		r2 := r.Clone(r.Context())
		r2.Header = r.Header.Clone()
		r2.Header.Set("X-Authenticated-Identity-ID", identityID)

		if userID, err := h.resolveUserID(r.Context(), identityID); err == nil {
			r2.Header.Set("X-Authenticated-User-ID", strconv.FormatInt(userID, 10))
		} else if requiresResolvedUserID(r) {
			w.Header().Set("Content-Type", "application/json")
			w.WriteHeader(http.StatusUnauthorized)
			_ = json.NewEncoder(w).Encode(map[string]string{"error": "user profile required"})
			return
		}

		if isAdminUsersRoute(r2) {
			orgID, err := organizationIDFromHeader(r2.Header.Get("X-Organization-ID"))
			if err != nil {
				w.Header().Set("Content-Type", "application/json")
				w.WriteHeader(http.StatusBadRequest)
				_ = json.NewEncoder(w).Encode(map[string]string{"error": err.Error()})
				return
			}

			userID, err := strconv.ParseInt(r2.Header.Get("X-Authenticated-User-ID"), 10, 64)
			if err != nil || userID <= 0 {
				w.Header().Set("Content-Type", "application/json")
				w.WriteHeader(http.StatusUnauthorized)
				_ = json.NewEncoder(w).Encode(map[string]string{"error": "missing authenticated user"})
				return
			}

			allowed, err := h.checkPermission(r.Context(), userID, orgID, "admin", "users")
			if err != nil {
				w.Header().Set("Content-Type", "application/json")
				w.WriteHeader(http.StatusBadGateway)
				_ = json.NewEncoder(w).Encode(map[string]string{"error": "permission service unavailable"})
				return
			}
			if !allowed {
				w.Header().Set("Content-Type", "application/json")
				w.WriteHeader(http.StatusForbidden)
				_ = json.NewEncoder(w).Encode(map[string]string{"error": "forbidden"})
				return
			}
		}

		next.ServeHTTP(w, r2)
	})
}

func (h *Handler) validateAuth(ctx context.Context, cookieHeader, sessionToken string) (string, error) {
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, h.authURL+"/auth/validate", nil)
	if err != nil {
		return "", err
	}
	if cookieHeader != "" {
		req.Header.Set("Cookie", cookieHeader)
	}
	if sessionToken != "" {
		req.Header.Set("X-Session-Token", sessionToken)
	}

	resp, err := h.httpClient.Do(req)
	if err != nil {
		return "", err
	}
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusOK {
		return "", errors.New("unauthorized")
	}

	var payload struct {
		IdentityID string `json:"identity_id"`
	}
	if err := json.NewDecoder(resp.Body).Decode(&payload); err != nil {
		return "", err
	}
	if payload.IdentityID == "" {
		return "", errors.New("missing identity id")
	}
	return payload.IdentityID, nil
}

func (h *Handler) resolveUserID(ctx context.Context, identityID string) (int64, error) {
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, h.userURL+"/users/by-auth/"+url.PathEscape(identityID), nil)
	if err != nil {
		return 0, err
	}
	resp, err := h.httpClient.Do(req)
	if err != nil {
		return 0, err
	}
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusOK {
		return 0, errors.New("user not found")
	}

	var payload struct {
		ID int64 `json:"id"`
	}
	if err := json.NewDecoder(resp.Body).Decode(&payload); err != nil {
		return 0, err
	}
	if payload.ID <= 0 {
		return 0, errors.New("invalid user id")
	}
	return payload.ID, nil
}

func requiresResolvedUserID(r *http.Request) bool {
	if r.URL.Path == "/users" && r.Method == http.MethodPost {
		return false
	}
	if r.URL.Path == "/auth" || strings.HasPrefix(r.URL.Path, "/auth/") {
		return false
	}
	return true
}

func isAdminUsersRoute(r *http.Request) bool {
	return r.URL.Path == "/admin/users" || strings.HasPrefix(r.URL.Path, "/admin/users/")
}

func organizationIDFromHeader(raw string) (int64, error) {
	value := strings.TrimSpace(raw)
	if value == "" {
		return 0, errors.New("missing X-Organization-ID header")
	}
	id, err := strconv.ParseInt(value, 10, 64)
	if err != nil || id <= 0 {
		return 0, errors.New("invalid X-Organization-ID header")
	}
	return id, nil
}

func (h *Handler) checkPermission(ctx context.Context, userID, organizationID int64, action, resource string) (bool, error) {
	if h.permissionGRPC == nil {
		return false, errors.New("permission grpc client is not configured")
	}
	resp, err := h.permissionGRPC.Check(ctx, &permissionv1.CheckRequest{
		OrganizationId: organizationID,
		UserId:         userID,
		Action:         action,
		Resource:       resource,
	})
	if err != nil {
		return false, err
	}
	return resp.GetAllowed(), nil
}

func clientIP(r *http.Request) string {
	if xff := strings.TrimSpace(r.Header.Get("X-Forwarded-For")); xff != "" {
		parts := strings.Split(xff, ",")
		if len(parts) > 0 {
			return strings.TrimSpace(parts[0])
		}
	}
	host, _, err := net.SplitHostPort(r.RemoteAddr)
	if err == nil && host != "" {
		return host
	}
	if r.RemoteAddr != "" {
		return r.RemoteAddr
	}
	return "unknown"
}
