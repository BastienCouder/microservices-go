package main

import (
	"context"
	"log"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	kratosclient "github.com/bastiencouder/microservices-go/services/auth-service/internal/adapter/client/kratos"
	httpadapter "github.com/bastiencouder/microservices-go/services/auth-service/internal/adapter/http"
	"github.com/bastiencouder/microservices-go/services/auth-service/internal/config"
	"github.com/bastiencouder/microservices-go/services/auth-service/internal/usecase"
)

func main() {
	cfg, err := config.Load()
	if err != nil {
		log.Fatalf("load config: %v", err)
	}

	kratos := kratosclient.NewClient(cfg.KratosPublicURL)
	svc := usecase.NewService(kratos)
	h := httpadapter.NewHandler(svc, cfg.AllowedOrigin)

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
