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

	"github.com/bastiencouder/microservices-go/contracts/pkg/httpsrv"
	kratosclient "github.com/bastiencouder/microservices-go/services/auth-service/internal/adapter/client/kratos"
	userclient "github.com/bastiencouder/microservices-go/services/auth-service/internal/adapter/client/user"
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
	users := userclient.NewClient(cfg.UserServiceURL, cfg.InternalJWTSecret, cfg.InternalJWTIssuer)
	svc := usecase.NewService(kratos, users)
	h := httpadapter.NewHandler(svc, cfg.AllowedOrigin, cfg.KratosBrowserURL)

	mux := http.NewServeMux()
	h.Register(mux)

	server := httpsrv.NewServer(cfg.HTTPAddr, security.NewInternalAuthMiddleware(cfg.InternalJWTSecret, cfg.InternalJWTIssuer, "auth-service")(mux))
	var metricsServer *http.Server
	if cfg.MetricsAddr != "" {
		metricsMux := http.NewServeMux()
		metricsMux.Handle("/metrics", promhttp.Handler())
		metricsServer = httpsrv.NewServer(cfg.MetricsAddr, metricsMux)
		go func() {
			log.Printf("auth-service metrics listening on %s", cfg.MetricsAddr)
			if err := metricsServer.ListenAndServe(); err != nil && !errors.Is(err, http.ErrServerClosed) {
				log.Fatalf("metrics listen error: %v", err)
			}
		}()
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
	if metricsServer != nil {
		if err := metricsServer.Shutdown(ctx); err != nil {
			log.Printf("metrics shutdown error: %v", err)
		}
	}
	if err := server.Shutdown(ctx); err != nil {
		log.Printf("shutdown error: %v", err)
	}
}
