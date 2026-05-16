package http

import (
	"log"
	"net"
	"net/http"
	"net/http/httputil"
	"net/url"
	"strings"
	"time"

	grpctls "github.com/bastiencouder/microservices-go/contracts/pkg/grpctls"
)

type Handler struct {
	userProxy            *httputil.ReverseProxy
	authProxy            *httputil.ReverseProxy
	organizationsProxy   *httputil.ReverseProxy
	permissionProxy      *httputil.ReverseProxy
	billingProxy         *httputil.ReverseProxy
	notificationProxy    *httputil.ReverseProxy
	projectProxy         *httputil.ReverseProxy
	analysisProxy        *httputil.ReverseProxy
	iaProxy              *httputil.ReverseProxy
	attributionProxy     *httputil.ReverseProxy
	routes               []routeEntry
	authURL              string
	userURL              string
	organizationsURL     string
	permissionGRPC       *permissionGRPCClient
	httpClient           *http.Client
	scanStore            *agentReadyScanStore
	rateLimiter          *rateLimiter
	authBreaker          *circuitBreaker
	authBulkhead         *bulkhead
	userBreaker          *circuitBreaker
	userBulkhead         *bulkhead
	organizationBreaker  *circuitBreaker
	organizationBulkhead *bulkhead
	permissionBreaker    *circuitBreaker
	permissionBulkhead   *bulkhead
	internalJWTSecret    string
	internalJWTIssuer    string
	corsAllowedOrigins   map[string]struct{}
	trustedProxyNets     []*net.IPNet
}

func NewHandler(userServiceURL, authServiceURL, organizationsServiceURL, permissionServiceURL, billingServiceURL, notificationServiceURL string, rateLimitRPM int, internalJWTSecret, internalJWTIssuer string) (*Handler, error) {
	return NewHandlerWithGRPC(
		userServiceURL,
		authServiceURL,
		organizationsServiceURL,
		permissionServiceURL,
		"",
		billingServiceURL,
		notificationServiceURL,
		rateLimitRPM,
		internalJWTSecret,
		internalJWTIssuer,
		nil,
		nil,
		grpctls.ClientConfig{AllowInsecure: true},
	)
}

func NewHandlerWithGRPC(userServiceURL, authServiceURL, organizationsServiceURL, permissionServiceURL, permissionServiceGRPCAddr, billingServiceURL, notificationServiceURL string, rateLimitRPM int, internalJWTSecret, internalJWTIssuer string, corsAllowedOrigins, trustedProxyCIDRs []string, permissionGRPCTLS grpctls.ClientConfig) (*Handler, error) {
	return NewHandlerWithGRPCAndServices(
		userServiceURL,
		authServiceURL,
		organizationsServiceURL,
		permissionServiceURL,
		permissionServiceGRPCAddr,
		billingServiceURL,
		notificationServiceURL,
		permissionServiceURL,
		permissionServiceURL,
		permissionServiceURL,
		permissionServiceURL,
		rateLimitRPM,
		internalJWTSecret,
		internalJWTIssuer,
		corsAllowedOrigins,
		trustedProxyCIDRs,
		permissionGRPCTLS,
	)
}

func NewHandlerWithGRPCAndServices(
	userServiceURL, authServiceURL, organizationsServiceURL, permissionServiceURL, permissionServiceGRPCAddr, billingServiceURL, notificationServiceURL, projectServiceURL, analysisServiceURL, iaServiceURL, attributionServiceURL string,
	rateLimitRPM int,
	internalJWTSecret, internalJWTIssuer string,
	corsAllowedOrigins, trustedProxyCIDRs []string,
	permissionGRPCTLS grpctls.ClientConfig,
) (*Handler, error) {
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
	projectProxy, err := newProxy(projectServiceURL)
	if err != nil {
		return nil, err
	}
	analysisProxy, err := newProxy(analysisServiceURL)
	if err != nil {
		return nil, err
	}
	iaProxy, err := newProxy(iaServiceURL)
	if err != nil {
		return nil, err
	}
	attributionProxy, err := newProxy(attributionServiceURL)
	if err != nil {
		return nil, err
	}
	limiter, err := newRateLimiter(rateLimitRPM, time.Minute)
	if err != nil {
		return nil, err
	}
	permissionGRPC, err := newPermissionGRPCClient(permissionServiceGRPCAddr, permissionGRPCTLS)
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
	organizationBreaker, err := newCircuitBreaker(5, 30*time.Second)
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
	organizationBulkhead, err := newBulkhead(128)
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
	trustedProxyNets, err := parseTrustedProxyCIDRs(trustedProxyCIDRs)
	if err != nil {
		return nil, err
	}

	h := &Handler{
		userProxy:          userProxy,
		authProxy:          authProxy,
		organizationsProxy: organizationsProxy,
		permissionProxy:    permissionProxy,
		billingProxy:       billingProxy,
		notificationProxy:  notificationProxy,
		projectProxy:       projectProxy,
		analysisProxy:      analysisProxy,
		iaProxy:            iaProxy,
		attributionProxy:   attributionProxy,
		authURL:            strings.TrimRight(authServiceURL, "/"),
		userURL:            strings.TrimRight(userServiceURL, "/"),
		organizationsURL:   strings.TrimRight(organizationsServiceURL, "/"),
		permissionGRPC:     permissionGRPC,
		httpClient: &http.Client{
			Transport: transport,
			Timeout:   3 * time.Second,
		},
		scanStore:            newAgentReadyScanStore(),
		rateLimiter:          limiter,
		authBreaker:          authBreaker,
		authBulkhead:         authBulkhead,
		userBreaker:          userBreaker,
		userBulkhead:         userBulkhead,
		organizationBreaker:  organizationBreaker,
		organizationBulkhead: organizationBulkhead,
		permissionBreaker:    permissionBreaker,
		permissionBulkhead:   permissionBulkhead,
		internalJWTSecret:    internalJWTSecret,
		internalJWTIssuer:    internalJWTIssuer,
		corsAllowedOrigins:   allowedOriginSet,
		trustedProxyNets:     trustedProxyNets,
	}
	h.routes = h.buildRoutes()
	return h, nil
}

func parseTrustedProxyCIDRs(cidrs []string) ([]*net.IPNet, error) {
	if len(cidrs) == 0 {
		return nil, nil
	}
	nets := make([]*net.IPNet, 0, len(cidrs))
	for _, cidr := range cidrs {
		value := strings.TrimSpace(cidr)
		if value == "" {
			continue
		}
		_, network, err := net.ParseCIDR(value)
		if err != nil {
			return nil, err
		}
		nets = append(nets, network)
	}
	return nets, nil
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
