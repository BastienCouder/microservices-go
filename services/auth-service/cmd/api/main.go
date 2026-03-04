package main

import (
	"context"
	"log"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	"github.com/prometheus/client_golang/prometheus/promhttp"

	kratosclient "github.com/bastiencouder/microservices-go/services/auth-service/internal/adapter/client/kratos"
	httpadapter "github.com/bastiencouder/microservices-go/services/auth-service/internal/adapter/http"
	"github.com/bastiencouder/microservices-go/services/auth-service/internal/config"
	"github.com/bastiencouder/microservices-go/services/auth-service/internal/security"
	"github.com/bastiencouder/microservices-go/services/auth-service/internal/usecase"
)

func main() {
	cfg, err := config.Load()
	if err != nil {
		log.Fatalf("load config: %v", err)
	}

	kratos := kratosclient.NewClient(cfg.KratosPublicURL, cfg.AppReturnURL)
	svc := usecase.NewService(kratos)
	h := httpadapter.NewHandler(svc, cfg.AllowedOrigin, cfg.KratosBrowserURL)

	mux := http.NewServeMux()
	mux.Handle("/metrics", promhttp.Handler())
	h.Register(mux)

	server := &http.Server{
		Addr:              cfg.HTTPAddr,
		Handler:           security.NewInternalAuthMiddleware(cfg.InternalJWTSecret, cfg.InternalJWTIssuer, "auth-service")(mux),
		ReadHeaderTimeout: 5 * time.Second,
		ReadTimeout:       5 * time.Second,
		WriteTimeout:      10 * time.Second,
		IdleTimeout:       60 * time.Second,
		MaxHeaderBytes:    64 << 10, // 64 KiB
	}

	go func() {
		log.Printf("auth-service listening on %s", cfg.HTTPAddr)
		if err := server.ListenAndServe(); err != nil && err != http.ErrServerClosed {
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
