package main

import (
	"context"
	"log"
	"net"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	"google.golang.org/grpc"

	analysisv1 "github.com/bastiencouder/microservices-go/contracts/gen/go/analysis/v1"
	grpctls "github.com/bastiencouder/microservices-go/contracts/pkg/grpctls"
	"github.com/bastiencouder/microservices-go/contracts/pkg/httpsrv"
	"github.com/bastiencouder/microservices-go/contracts/pkg/internalauth"
	"github.com/bastiencouder/microservices-go/contracts/pkg/serviceboot"
	rediscache "github.com/bastiencouder/microservices-go/services/analysis-service/internal/adapter/cache/redis"
	billingclient "github.com/bastiencouder/microservices-go/services/analysis-service/internal/adapter/client/billing"
	cloudflarecrawl "github.com/bastiencouder/microservices-go/services/analysis-service/internal/adapter/client/cloudflarecrawl"
	iaclient "github.com/bastiencouder/microservices-go/services/analysis-service/internal/adapter/client/ia"
	projectclient "github.com/bastiencouder/microservices-go/services/analysis-service/internal/adapter/client/project"
	grpcadapter "github.com/bastiencouder/microservices-go/services/analysis-service/internal/adapter/grpc"
	httpadapter "github.com/bastiencouder/microservices-go/services/analysis-service/internal/adapter/http"
	analysisstate "github.com/bastiencouder/microservices-go/services/analysis-service/internal/adapter/state/postgres"
	"github.com/bastiencouder/microservices-go/services/analysis-service/internal/config"
	"github.com/bastiencouder/microservices-go/services/analysis-service/internal/usecase"
)

func main() {
	cfg, err := config.Load()
	if err != nil {
		log.Fatalf("load config: %v", err)
	}
	if code, ok := serviceboot.RunDatabaseHealthcheckMode(cfg.DatabaseURL); ok {
		os.Exit(code)
	}

	db, err := serviceboot.WaitForDatabase(context.Background(), cfg.DatabaseURL, "analysis-service")
	if err != nil {
		log.Fatalf("wait for analysis database: %v", err)
	}
	defer db.Close()

	grpcClientTLS := grpctls.ClientConfig{
		AllowInsecure: cfg.GRPCAllowInsecure,
		CAFile:        cfg.GRPCTLSCAFile,
		CertFile:      cfg.GRPCTLSCertFile,
		KeyFile:       cfg.GRPCTLSKeyFile,
		ServerName:    cfg.GRPCTLSServerName,
	}
	projectGRPCClient, err := projectclient.NewClient(cfg.ProjectServiceGRPCAddr, cfg.InternalJWTSecret, cfg.InternalJWTIssuer, grpcClientTLS)
	if err != nil {
		log.Fatalf("init project grpc client: %v", err)
	}
	defer projectGRPCClient.Close()
	billingHTTPClient, err := billingclient.NewClient(cfg.BillingServiceURL, cfg.InternalJWTSecret, cfg.InternalJWTIssuer)
	if err != nil {
		log.Fatalf("init billing http client: %v", err)
	}

	dashboardCache := rediscache.NewDashboardCache(cfg.RedisAddr, cfg.RedisPassword)
	var contentCrawler usecase.ContentCrawler
	if cfg.CloudflareAccountID != "" && cfg.CloudflareAPIToken != "" {
		contentCrawler, err = cloudflarecrawl.NewClient(cloudflarecrawl.Config{
			AccountID: cfg.CloudflareAccountID,
			APIToken:  cfg.CloudflareAPIToken,
		})
		if err != nil {
			log.Fatalf("init cloudflare crawl client: %v", err)
		}
	} else {
		log.Printf("content optimizer live crawl disabled: CLOUDFLARE_ACCOUNT_ID and CLOUDFLARE_API_TOKEN are both required")
	}

	var contentIssueAnalyzer usecase.ContentIssueAnalyzer
	var optimizeActionBriefGenerator usecase.OptimizeActionBriefGenerator
	var onboardingBrandProfileAnalyzer usecase.OnboardingBrandProfileAnalyzer
	if cfg.IAServiceURL != "" && cfg.ContentIssueAnalyzerModelID != "" {
		iaAnalyzer, err := iaclient.NewClient(iaclient.Config{
			BaseURL:                       cfg.IAServiceURL,
			JWTSecret:                     cfg.InternalJWTSecret,
			JWTIssuer:                     cfg.InternalJWTIssuer,
			ModelID:                       cfg.ContentIssueAnalyzerModelID,
			ProviderID:                    cfg.ContentIssueAnalyzerProviderID,
			OptimizeActionBriefModelID:    cfg.OptimizeActionBriefModelID,
			OptimizeActionBriefProviderID: cfg.OptimizeActionBriefProviderID,
		})
		if err != nil {
			log.Fatalf("init content issue analyzer: %v", err)
		}
		contentIssueAnalyzer = iaAnalyzer
		optimizeActionBriefGenerator = iaAnalyzer
		onboardingBrandProfileAnalyzer = iaAnalyzer
		log.Printf("content optimizer AI issue analyzer enabled with model %s", cfg.ContentIssueAnalyzerModelID)
	} else {
		log.Printf("content optimizer AI issue analyzer disabled: IA_SERVICE_URL and CONTENT_ISSUE_ANALYZER_MODEL_ID are required")
	}

	svc, err := usecase.NewServiceWithDependencies(context.Background(), usecase.Dependencies{
		Store:                          analysisstate.NewStateStore(db),
		DashboardCache:                 dashboardCache,
		DashboardCacheTTL:              cfg.DashboardCacheTTL,
		ProjectVerifier:                projectGRPCClient,
		ProjectCompetitors:             projectGRPCClient,
		ProjectModels:                  projectGRPCClient,
		BillingQuota:                   billingHTTPClient,
		ContentCrawler:                 contentCrawler,
		ContentIssueAnalyzer:           contentIssueAnalyzer,
		OptimizeActionBriefGenerator:   optimizeActionBriefGenerator,
		OnboardingBrandProfileAnalyzer: onboardingBrandProfileAnalyzer,
	})
	if err != nil {
		log.Fatalf("initialize analysis service: %v", err)
	}

	h := httpadapter.NewHandler(svc, serviceboot.DatabaseReadiness(db))
	g := grpcadapter.NewServer(svc)

	mux := http.NewServeMux()
	h.Register(mux)

	httpServer := httpsrv.NewServer(
		cfg.HTTPAddr,
		internalauth.NewHTTPMiddleware(cfg.InternalJWTSecret, cfg.InternalJWTIssuer, "analysis-service")(mux),
		httpsrv.WithReadTimeout(10*time.Second),
		httpsrv.WithWriteTimeout(20*time.Second),
	)
	metricsServer := serviceboot.StartMetricsServer(cfg.MetricsAddr, "analysis-service")

	grpcServerOptions, err := grpctls.ServerOptions(grpctls.ServerConfig{
		AllowInsecure:     cfg.GRPCAllowInsecure,
		CertFile:          cfg.GRPCTLSCertFile,
		KeyFile:           cfg.GRPCTLSKeyFile,
		ClientCAFile:      cfg.GRPCTLSClientCAFile,
		RequireClientCert: cfg.GRPCTLSRequireClientCert,
	})
	if err != nil {
		log.Fatalf("configure grpc tls: %v", err)
	}
	grpcServerOptions = append(grpcServerOptions, grpc.UnaryInterceptor(internalauth.NewUnaryAuthInterceptor(cfg.InternalJWTSecret, cfg.InternalJWTIssuer, "analysis-service")))
	grpcServer := grpc.NewServer(grpcServerOptions...)
	analysisv1.RegisterAnalysisServiceServer(grpcServer, g)

	grpcListener, err := net.Listen("tcp", cfg.GRPCAddr)
	if err != nil {
		log.Fatalf("listen grpc error: %v", err)
	}
	defer grpcListener.Close()

	go func() {
		log.Printf("analysis-service listening on %s", cfg.HTTPAddr)
		if err := httpServer.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			log.Fatalf("listen error: %v", err)
		}
	}()
	go func() {
		log.Printf("analysis-service grpc listening on %s", cfg.GRPCAddr)
		if err := grpcServer.Serve(grpcListener); err != nil {
			log.Fatalf("grpc listen error: %v", err)
		}
	}()

	stop := make(chan os.Signal, 1)
	signal.Notify(stop, syscall.SIGINT, syscall.SIGTERM)
	<-stop

	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()
	if metricsServer != nil {
		if err := metricsServer.Shutdown(ctx); err != nil {
			log.Printf("metrics shutdown error: %v", err)
		}
	}
	if err := httpServer.Shutdown(ctx); err != nil {
		log.Printf("shutdown error: %v", err)
	}
	grpcServer.GracefulStop()
}
