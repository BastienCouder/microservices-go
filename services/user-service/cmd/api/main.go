package main

import (
	"context"
	"log"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"

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

	startupCtx, startupCancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer startupCancel()

	db, err := pgxpool.New(startupCtx, cfg.DatabaseURL)
	if err != nil {
		log.Fatalf("create user pgx pool: %v", err)
	}
	defer db.Close()

	if err := db.Ping(startupCtx); err != nil {
		log.Fatalf("ping user database: %v", err)
	}

	repo := postgres.NewRepository(db)
	svc := usecase.NewService(repo)
	h := httpadapter.NewHandler(svc)

	mux := http.NewServeMux()
	h.Register(mux)

	server := &http.Server{Addr: cfg.HTTPAddr, Handler: mux, ReadTimeout: 5 * time.Second, WriteTimeout: 10 * time.Second, IdleTimeout: 60 * time.Second}

	go func() {
		log.Printf("user-service listening on %s", cfg.HTTPAddr)
		if err := server.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			log.Fatalf("listen error: %v", err)
		}
	}()

	stop := make(chan os.Signal, 1)
	signal.Notify(stop, syscall.SIGINT, syscall.SIGTERM)
	<-stop

	shutdownCtx, shutdownCancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer shutdownCancel()
	if err := server.Shutdown(shutdownCtx); err != nil {
		log.Printf("shutdown error: %v", err)
	}
}
