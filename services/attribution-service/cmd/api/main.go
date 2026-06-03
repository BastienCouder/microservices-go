package main

import (
	"context"
	"log"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	grpctls "github.com/bastiencouder/microservices-go/contracts/pkg/grpctls"
	"github.com/bastiencouder/microservices-go/contracts/pkg/httpsrv"
	"github.com/bastiencouder/microservices-go/contracts/pkg/internalauth"
	"github.com/bastiencouder/microservices-go/contracts/pkg/serviceboot"
	ga4client "github.com/bastiencouder/microservices-go/services/attribution-service/internal/adapter/client/ga4"
	projectclient "github.com/bastiencouder/microservices-go/services/attribution-service/internal/adapter/client/project"
	projectapiclient "github.com/bastiencouder/microservices-go/services/attribution-service/internal/adapter/client/projectapi"
	httpadapter "github.com/bastiencouder/microservices-go/services/attribution-service/internal/adapter/http"
	attributionrepo "github.com/bastiencouder/microservices-go/services/attribution-service/internal/adapter/repository/postgres"
	"github.com/bastiencouder/microservices-go/services/attribution-service/internal/config"
	"github.com/bastiencouder/microservices-go/services/attribution-service/internal/usecase"
)

func main() {
	cfg, err := config.Load()
	if err != nil {
		log.Fatalf("load config: %v", err)
	}
	if code, ok := serviceboot.RunDatabaseHealthcheckMode(cfg.DatabaseURL); ok {
		os.Exit(code)
	}

	db, err := serviceboot.WaitForDatabase(context.Background(), cfg.DatabaseURL, "attribution-service")
	if err != nil {
		log.Fatalf("wait for attribution database: %v", err)
	}
	defer db.Close()

	projectVerifier, err := projectclient.NewClient(
		cfg.ProjectServiceGRPCAddr,
		cfg.InternalJWTSecret,
		cfg.InternalJWTIssuer,
		grpctls.ClientConfig{
			AllowInsecure: cfg.GRPCAllowInsecure,
			CAFile:        cfg.GRPCTLSCAFile,
			CertFile:      cfg.GRPCTLSCertFile,
			KeyFile:       cfg.GRPCTLSKeyFile,
			ServerName:    cfg.GRPCTLSServerName,
		},
	)
	if err != nil {
		log.Fatalf("init project grpc client: %v", err)
	}
	defer projectVerifier.Close()

	repo := attributionrepo.NewRepository(db)
	svc := usecase.NewService(repo, projectVerifier)
	if cfg.ProjectServiceURL != "" {
		projectResolver, err := projectapiclient.NewClient(cfg.ProjectServiceURL, cfg.InternalJWTSecret, cfg.InternalJWTIssuer)
		if err != nil {
			log.Fatalf("init project api client: %v", err)
		}
		visitProvider := ga4client.NewClientWithOAuth(cfg.GA4.OAuthClientID, cfg.GA4.OAuthClientSecret)
		visitProvider.SetFakeTrafficEnabled(cfg.GA4.FakeTrafficEnabled)
		svc.EnableVisitProvider(projectResolver, visitProvider)
		svc.EnableTrafficProvider(projectResolver, visitProvider)
	}
	h := httpadapter.NewHandler(svc, serviceboot.DatabaseReadiness(db))

	mux := http.NewServeMux()
	h.Register(mux)

	server := httpsrv.NewServer(
		cfg.HTTPAddr,
		internalauth.NewHTTPMiddleware(cfg.InternalJWTSecret, cfg.InternalJWTIssuer, "attribution-service")(mux),
		httpsrv.WithReadTimeout(10*time.Second),
		httpsrv.WithWriteTimeout(20*time.Second),
	)
	metricsServer := serviceboot.StartMetricsServer(cfg.MetricsAddr, "attribution-service")

	go func() {
		log.Printf("attribution-service listening on %s", cfg.HTTPAddr)
		if err := server.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			log.Fatalf("listen error: %v", err)
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
	if err := server.Shutdown(ctx); err != nil {
		log.Printf("shutdown error: %v", err)
	}
}
