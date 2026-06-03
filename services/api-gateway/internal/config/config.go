package config

import "github.com/bastiencouder/microservices-go/contracts/pkg/envcfg"

type Config struct {
	HTTPAddr                    string
	MetricsAddr                 string
	UserServiceURL              string
	AuthServiceURL              string
	OrganizationsServiceURL     string
	PermissionServiceURL        string
	PermissionServiceGRPC       string
	BillingServiceURL           string
	NotificationServiceURL      string
	ProjectServiceURL           string
	AnalysisServiceURL          string
	IAServiceURL                string
	AttributionServiceURL       string
	RateLimitRPM                int
	PublicAPIEnabled            bool
	PublicAPIRateLimitRPM       int
	PublicAPIBurst              int
	PublicAPIAllowedPlans       []string
	PublicAPIKeyHeader          string
	PublicAPIKeyPrefix          string
	PublicAPIDefaultKeyScopes   []string
	InternalJWTSecret           string
	InternalJWTIssuer           string
	CORSAllowedOrigins          []string
	TrustedProxyCIDRs           []string
	PermissionGRPCAllowInsecure bool
	PermissionGRPCTLSCAFile     string
	PermissionGRPCTLSCertFile   string
	PermissionGRPCTLSKeyFile    string
	PermissionGRPCTLSServerName string
}

func Load() (Config, error) {
	httpAddr, err := envcfg.RequiredEnv("HTTP_ADDR")
	if err != nil {
		return Config{}, err
	}
	userServiceURL, err := envcfg.RequiredEnv("USER_SERVICE_URL")
	if err != nil {
		return Config{}, err
	}
	authServiceURL, err := envcfg.RequiredEnv("AUTH_SERVICE_URL")
	if err != nil {
		return Config{}, err
	}
	organizationsServiceURL, err := envcfg.RequiredEnv("ORGANIZATIONS_SERVICE_URL")
	if err != nil {
		return Config{}, err
	}
	permissionServiceURL, err := envcfg.RequiredEnv("PERMISSION_SERVICE_URL")
	if err != nil {
		return Config{}, err
	}
	permissionServiceGRPC, err := envcfg.RequiredEnv("PERMISSION_SERVICE_GRPC_ADDR")
	if err != nil {
		return Config{}, err
	}
	billingServiceURL, err := envcfg.RequiredEnv("BILLING_SERVICE_URL")
	if err != nil {
		return Config{}, err
	}
	notificationServiceURL, err := envcfg.RequiredEnv("NOTIFICATION_SERVICE_URL")
	if err != nil {
		return Config{}, err
	}
	projectServiceURL, err := envcfg.RequiredEnv("PROJECT_SERVICE_URL")
	if err != nil {
		return Config{}, err
	}
	analysisServiceURL, err := envcfg.RequiredEnv("ANALYSIS_SERVICE_URL")
	if err != nil {
		return Config{}, err
	}
	iaServiceURL, err := envcfg.RequiredEnv("IA_SERVICE_URL")
	if err != nil {
		return Config{}, err
	}
	attributionServiceURL, err := envcfg.RequiredEnv("ATTRIBUTION_SERVICE_URL")
	if err != nil {
		return Config{}, err
	}
	rateLimitRPM, err := envcfg.RequiredPositiveIntEnv("RATE_LIMIT_RPM")
	if err != nil {
		return Config{}, err
	}
	publicAPIEnabled, err := envcfg.OptionalBoolEnv("PUBLIC_API_ENABLED", false)
	if err != nil {
		return Config{}, err
	}
	publicAPIRateLimitRPM, err := envcfg.OptionalPositiveIntEnv("PUBLIC_API_RATE_LIMIT_RPM", 0)
	if err != nil {
		return Config{}, err
	}
	publicAPIBurst, err := envcfg.OptionalPositiveIntEnv("PUBLIC_API_BURST", 0)
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
	corsAllowedOrigins, err := envcfg.RequiredCSVEnv("CORS_ALLOWED_ORIGINS")
	if err != nil {
		return Config{}, err
	}
	permissionGRPCAllowInsecure, err := envcfg.OptionalBoolEnv("PERMISSION_GRPC_ALLOW_INSECURE", false)
	if err != nil {
		return Config{}, err
	}

	return Config{
		HTTPAddr:                    httpAddr,
		MetricsAddr:                 envcfg.OptionalEnv("METRICS_ADDR"),
		UserServiceURL:              userServiceURL,
		AuthServiceURL:              authServiceURL,
		OrganizationsServiceURL:     organizationsServiceURL,
		PermissionServiceURL:        permissionServiceURL,
		PermissionServiceGRPC:       permissionServiceGRPC,
		BillingServiceURL:           billingServiceURL,
		NotificationServiceURL:      notificationServiceURL,
		ProjectServiceURL:           projectServiceURL,
		AnalysisServiceURL:          analysisServiceURL,
		IAServiceURL:                iaServiceURL,
		AttributionServiceURL:       attributionServiceURL,
		RateLimitRPM:                rateLimitRPM,
		PublicAPIEnabled:            publicAPIEnabled,
		PublicAPIRateLimitRPM:       publicAPIRateLimitRPM,
		PublicAPIBurst:              publicAPIBurst,
		PublicAPIAllowedPlans:       envcfg.OptionalCSVEnv("PUBLIC_API_ALLOWED_PLANS"),
		PublicAPIKeyHeader:          envcfg.OptionalEnv("PUBLIC_API_KEY_HEADER"),
		PublicAPIKeyPrefix:          envcfg.OptionalEnv("PUBLIC_API_KEY_PREFIX"),
		PublicAPIDefaultKeyScopes:   envcfg.OptionalCSVEnv("PUBLIC_API_DEFAULT_KEY_SCOPES"),
		InternalJWTSecret:           internalJWTSecret,
		InternalJWTIssuer:           internalJWTIssuer,
		CORSAllowedOrigins:          corsAllowedOrigins,
		TrustedProxyCIDRs:           envcfg.OptionalCSVEnv("TRUSTED_PROXY_CIDRS"),
		PermissionGRPCAllowInsecure: permissionGRPCAllowInsecure,
		PermissionGRPCTLSCAFile:     envcfg.OptionalEnv("PERMISSION_GRPC_TLS_CA_FILE"),
		PermissionGRPCTLSCertFile:   envcfg.OptionalEnv("PERMISSION_GRPC_TLS_CERT_FILE"),
		PermissionGRPCTLSKeyFile:    envcfg.OptionalEnv("PERMISSION_GRPC_TLS_KEY_FILE"),
		PermissionGRPCTLSServerName: envcfg.OptionalEnv("PERMISSION_GRPC_TLS_SERVER_NAME"),
	}, nil
}
