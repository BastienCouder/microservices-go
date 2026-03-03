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
	mux.Handle("/metrics", promhttp.Handler())
	h.Register(mux)

	server := &http.Server{
		Addr:              cfg.HTTPAddr,
		Handler:           mux,
		ReadHeaderTimeout: 5 * time.Second,
		ReadTimeout:       5 * time.Second,
		WriteTimeout:      10 * time.Second,
		IdleTimeout:       60 * time.Second,
		MaxHeaderBytes:    64 << 10, // 64 KiB
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
	if err := server.Shutdown(ctx); err != nil {
		log.Printf("shutdown error: %v", err)
	}
}
