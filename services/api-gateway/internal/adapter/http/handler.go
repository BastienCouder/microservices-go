package http

import (
	"log"
	"net"
	"net/http"
	"net/http/httputil"
	"net/url"
	"strings"
	"time"
)

type Handler struct {
	userProxy          *httputil.ReverseProxy
	authProxy          *httputil.ReverseProxy
	organizationsProxy *httputil.ReverseProxy
	permissionProxy    *httputil.ReverseProxy
	billingProxy       *httputil.ReverseProxy
	notificationProxy  *httputil.ReverseProxy
	routes             []routeEntry
	authURL            string
	userURL            string
	permissionGRPC     *permissionGRPCClient
	httpClient         *http.Client
	rateLimiter        *rateLimiter
	authBreaker        *circuitBreaker
	authBulkhead       *bulkhead
	userBreaker        *circuitBreaker
	userBulkhead       *bulkhead
	permissionBreaker  *circuitBreaker
	permissionBulkhead *bulkhead
	internalJWTSecret  string
	internalJWTIssuer  string
	corsAllowedOrigins map[string]struct{}
}

func NewHandler(userServiceURL, authServiceURL, organizationsServiceURL, permissionServiceURL, billingServiceURL, notificationServiceURL string, rateLimitRPM int, internalJWTSecret, internalJWTIssuer string) (*Handler, error) {
	return NewHandlerWithGRPC(userServiceURL, authServiceURL, organizationsServiceURL, permissionServiceURL, "", billingServiceURL, notificationServiceURL, rateLimitRPM, internalJWTSecret, internalJWTIssuer, nil)
}

func NewHandlerWithGRPC(userServiceURL, authServiceURL, organizationsServiceURL, permissionServiceURL, permissionServiceGRPCAddr, billingServiceURL, notificationServiceURL string, rateLimitRPM int, internalJWTSecret, internalJWTIssuer string, corsAllowedOrigins []string) (*Handler, error) {
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
	authBreaker, err := newCircuitBreaker(5, 30*time.Second)
	if err != nil {
		return nil, err
	}
	userBreaker, err := newCircuitBreaker(5, 30*time.Second)
	if err != nil {
		return nil, err
	}
	permissionBreaker, err := newCircuitBreaker(5, 30*time.Second)
	if err != nil {
		return nil, err
	}
	authBulkhead, err := newBulkhead(128)
	if err != nil {
		return nil, err
	}
	userBulkhead, err := newBulkhead(128)
	if err != nil {
		return nil, err
	}
	permissionBulkhead, err := newBulkhead(64)
	if err != nil {
		return nil, err
	}
	transport := &http.Transport{
		Proxy:                 http.ProxyFromEnvironment,
		DialContext:           (&net.Dialer{Timeout: 2 * time.Second, KeepAlive: 30 * time.Second}).DialContext,
		ForceAttemptHTTP2:     true,
		MaxIdleConns:          200,
		MaxIdleConnsPerHost:   50,
		IdleConnTimeout:       90 * time.Second,
		TLSHandshakeTimeout:   2 * time.Second,
		ExpectContinueTimeout: 1 * time.Second,
		ResponseHeaderTimeout: 2 * time.Second,
	}

	allowedOriginSet := make(map[string]struct{}, len(corsAllowedOrigins))
	for _, origin := range corsAllowedOrigins {
		trimmed := strings.TrimSpace(origin)
		if trimmed == "" {
			continue
		}
		allowedOriginSet[trimmed] = struct{}{}
	}

	h := &Handler{
		userProxy:          userProxy,
		authProxy:          authProxy,
		organizationsProxy: organizationsProxy,
		permissionProxy:    permissionProxy,
		billingProxy:       billingProxy,
		notificationProxy:  notificationProxy,
		authURL:            strings.TrimRight(authServiceURL, "/"),
		userURL:            strings.TrimRight(userServiceURL, "/"),
		permissionGRPC:     permissionGRPC,
		httpClient: &http.Client{
			Transport: transport,
			Timeout:   3 * time.Second,
		},
		rateLimiter:        limiter,
		authBreaker:        authBreaker,
		authBulkhead:       authBulkhead,
		userBreaker:        userBreaker,
		userBulkhead:       userBulkhead,
		permissionBreaker:  permissionBreaker,
		permissionBulkhead: permissionBulkhead,
		internalJWTSecret:  internalJWTSecret,
		internalJWTIssuer:  internalJWTIssuer,
		corsAllowedOrigins: allowedOriginSet,
	}
	h.routes = h.buildRoutes()
	return h, nil
}

func (h *Handler) Close() error {
	if h == nil || h.permissionGRPC == nil {
		return nil
	}
	return h.permissionGRPC.Close()
}

func newProxy(target string) (*httputil.ReverseProxy, error) {
	targetURL, err := url.Parse(target)
	if err != nil {
		return nil, err
	}

	proxy := httputil.NewSingleHostReverseProxy(targetURL)
	proxy.ModifyResponse = func(resp *http.Response) error {
		// The gateway is the only component that should emit CORS headers to browsers.
		resp.Header.Del("Access-Control-Allow-Origin")
		resp.Header.Del("Access-Control-Allow-Credentials")
		resp.Header.Del("Access-Control-Allow-Methods")
		resp.Header.Del("Access-Control-Allow-Headers")
		resp.Header.Del("Access-Control-Expose-Headers")
		resp.Header.Del("Access-Control-Max-Age")
		return nil
	}
	proxy.ErrorHandler = func(w http.ResponseWriter, r *http.Request, err error) {
		log.Printf("proxy error for %s: %v", r.URL.Path, err)
		writeJSONError(w, http.StatusBadGateway, "upstream unavailable")
	}
	return proxy, nil
}
