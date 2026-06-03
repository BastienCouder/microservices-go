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

	"github.com/bastiencouder/microservices-go/contracts/pkg/httpsrv"
	"github.com/bastiencouder/microservices-go/contracts/pkg/internalauth"
	"github.com/bastiencouder/microservices-go/contracts/pkg/serviceboot"
	httpadapter "github.com/bastiencouder/microservices-go/services/user-service/internal/adapter/http"
	"github.com/bastiencouder/microservices-go/services/user-service/internal/adapter/repository/postgres"
	"github.com/bastiencouder/microservices-go/services/user-service/internal/config"
	"github.com/bastiencouder/microservices-go/services/user-service/internal/usecase"
)

func main() {
	cfg, err := config.Load()
	if err != nil {
		log.Fatalf("load config: %v", err)
	}
	if code, ok := serviceboot.RunDatabaseHealthcheckMode(cfg.DatabaseURL); ok {
		os.Exit(code)
	}

	db, err := serviceboot.WaitForDatabase(context.Background(), cfg.DatabaseURL, "user-service")
	if err != nil {
		log.Fatalf("wait for user database: %v", err)
	}
	defer db.Close()

	repo := postgres.NewRepository(db)
	svc := usecase.NewService(repo)
	h := httpadapter.NewHandler(svc, serviceboot.DatabaseReadiness(db))

	mux := http.NewServeMux()
	h.Register(mux)

	handler := internalauth.NewHTTPMiddleware(cfg.InternalJWTSecret, cfg.InternalJWTIssuer, "user-service")(mux)
	server := httpsrv.NewServer(cfg.HTTPAddr, handler)
	metricsServer := serviceboot.StartMetricsServer(cfg.MetricsAddr, "user-service")

	go func() {
		log.Printf("user-service listening on %s", cfg.HTTPAddr)
		if err := server.ListenAndServe(); err != nil && !errors.Is(err, http.ErrServerClosed) {
			log.Fatalf("listen error: %v", err)
		}
	}()

	stop := make(chan os.Signal, 1)
	signal.Notify(stop, syscall.SIGINT, syscall.SIGTERM)
	<-stop

	shutdownCtx, shutdownCancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer shutdownCancel()
	if metricsServer != nil {
		if err := metricsServer.Shutdown(shutdownCtx); err != nil {
			log.Printf("metrics shutdown error: %v", err)
		}
	}
	if err := server.Shutdown(shutdownCtx); err != nil {
		log.Printf("shutdown error: %v", err)
	}
}
