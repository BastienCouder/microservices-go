package main

import (
	"context"
	"errors"
	"log"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	"github.com/prometheus/client_golang/prometheus/promhttp"

	grpctls "github.com/bastiencouder/microservices-go/contracts/pkg/grpctls"
	"github.com/bastiencouder/microservices-go/contracts/pkg/httpsrv"
	httpadapter "github.com/bastiencouder/microservices-go/services/api-gateway/internal/adapter/http"
	"github.com/bastiencouder/microservices-go/services/api-gateway/internal/config"
)

func main() {
	cfg, err := config.Load()
	if err != nil {
		log.Fatalf("load config: %v", err)
	}

	h, err := httpadapter.NewHandlerWithGRPCAndServices(
		cfg.UserServiceURL,
		cfg.AuthServiceURL,
		cfg.OrganizationsServiceURL,
		cfg.PermissionServiceURL,
		cfg.PermissionServiceGRPC,
		cfg.BillingServiceURL,
		cfg.NotificationServiceURL,
		cfg.ProjectServiceURL,
		cfg.AnalysisServiceURL,
		cfg.IAServiceURL,
		cfg.AttributionServiceURL,
		cfg.RateLimitRPM,
		cfg.InternalJWTSecret,
		cfg.InternalJWTIssuer,
		cfg.CORSAllowedOrigins,
		cfg.TrustedProxyCIDRs,
		grpctls.ClientConfig{
			AllowInsecure: cfg.PermissionGRPCAllowInsecure,
			CAFile:        cfg.PermissionGRPCTLSCAFile,
			CertFile:      cfg.PermissionGRPCTLSCertFile,
			KeyFile:       cfg.PermissionGRPCTLSKeyFile,
			ServerName:    cfg.PermissionGRPCTLSServerName,
		},
	)
	if err != nil {
		log.Fatalf("create gateway handler: %v", err)
	}
	defer func() {
		if err := h.Close(); err != nil {
			log.Printf("close gateway dependencies: %v", err)
		}
	}()

	mux := http.NewServeMux()
	h.Register(mux)

	server := httpsrv.NewServer(cfg.HTTPAddr, mux)
	var metricsServer *http.Server
	if cfg.MetricsAddr != "" {
		metricsMux := http.NewServeMux()
		metricsMux.Handle("/metrics", promhttp.Handler())
		metricsServer = httpsrv.NewServer(cfg.MetricsAddr, metricsMux)
		go func() {
			log.Printf("api-gateway metrics listening on %s", cfg.MetricsAddr)
			if err := metricsServer.ListenAndServe(); err != nil && !errors.Is(err, http.ErrServerClosed) {
				log.Fatalf("metrics listen error: %v", err)
			}
		}()
	}

	go func() {
		log.Printf("api-gateway listening on %s", cfg.HTTPAddr)
		if err := server.ListenAndServe(); err != nil && !errors.Is(err, http.ErrServerClosed) {
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
