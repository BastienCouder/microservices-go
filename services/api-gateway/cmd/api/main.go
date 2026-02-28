package main

import (
	"context"
	"log"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	httpadapter "github.com/bastiencouder/microservices-go/services/api-gateway/internal/adapter/http"
	"github.com/bastiencouder/microservices-go/services/api-gateway/internal/config"
)

func main() {
	cfg, err := config.Load()
	if err != nil {
		log.Fatalf("load config: %v", err)
	}

	h, err := httpadapter.NewHandler(
		cfg.UserServiceURL,
		cfg.AuthServiceURL,
		cfg.OrganizationsServiceURL,
		cfg.PermissionServiceURL,
		cfg.BillingServiceURL,
		cfg.NotificationServiceURL,
		cfg.RateLimitRPM,
	)
	if err != nil {
		log.Fatalf("create gateway handler: %v", err)
	}

	mux := http.NewServeMux()
	h.Register(mux)

	server := &http.Server{
		Addr:         cfg.HTTPAddr,
		Handler:      mux,
		ReadTimeout:  5 * time.Second,
		WriteTimeout: 10 * time.Second,
		IdleTimeout:  60 * time.Second,
	}

	go func() {
		log.Printf("api-gateway listening on %s", cfg.HTTPAddr)
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
