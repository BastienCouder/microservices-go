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
	projectgrpcclient "github.com/bastiencouder/microservices-go/services/attribution-service/internal/adapter/client/projectgrpc"
	httpadapter "github.com/bastiencouder/microservices-go/services/attribution-service/internal/adapter/http"
	"github.com/bastiencouder/microservices-go/services/attribution-service/internal/config"
	"github.com/bastiencouder/microservices-go/services/attribution-service/internal/usecase"
)

func main() {
	cfg, err := config.Load()
	if err != nil {
		log.Fatalf("load config: %v", err)
	}

	grpcClientTLS := grpctls.ClientConfig{
		AllowInsecure: cfg.GRPCAllowInsecure,
		CAFile:        cfg.GRPCTLSCAFile,
		CertFile:      cfg.GRPCTLSCertFile,
		KeyFile:       cfg.GRPCTLSKeyFile,
		ServerName:    cfg.GRPCTLSServerName,
	}
	projectResolver, err := projectgrpcclient.NewClient(cfg.ProjectServiceGRPCAddr, cfg.InternalJWTSecret, cfg.InternalJWTIssuer, grpcClientTLS)
	if err != nil {
		log.Fatalf("init project grpc client: %v", err)
	}
	defer projectResolver.Close()
	trafficProvider := ga4client.NewClientWithOAuth(cfg.GA4.OAuthClientID, cfg.GA4.OAuthClientSecret)
	trafficProvider.SetFakeTrafficEnabled(cfg.GA4.FakeTrafficEnabled)
	svc := usecase.NewService(projectResolver, trafficProvider)

	mux := http.NewServeMux()
	httpadapter.NewHandler(svc, func(ctx context.Context) error {
		if err := projectResolver.Ready(ctx); err != nil {
			return err
		}
		return trafficProvider.Ready(ctx)
	}).Register(mux)

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
