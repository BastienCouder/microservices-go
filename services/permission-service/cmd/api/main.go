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

	organizationsclient "github.com/bastiencouder/microservices-go/services/permission-service/internal/adapter/client/organizations"
	httpadapter "github.com/bastiencouder/microservices-go/services/permission-service/internal/adapter/http"
	permissionrepo "github.com/bastiencouder/microservices-go/services/permission-service/internal/adapter/repository/postgres"
	"github.com/bastiencouder/microservices-go/services/permission-service/internal/config"
	"github.com/bastiencouder/microservices-go/services/permission-service/internal/usecase"
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
		log.Fatalf("create permission pgx pool: %v", err)
	}
	defer db.Close()

	if err := db.Ping(startupCtx); err != nil {
		log.Fatalf("ping permission database: %v", err)
	}

	repo := permissionrepo.NewRepository(db)
	roleResolver := organizationsclient.NewClient(cfg.OrganizationsServiceURL)
	svc := usecase.NewService(repo, roleResolver)
	h := httpadapter.NewHandler(svc)

	mux := http.NewServeMux()
	h.Register(mux)

	server := &http.Server{Addr: cfg.HTTPAddr, Handler: mux, ReadTimeout: 5 * time.Second, WriteTimeout: 10 * time.Second, IdleTimeout: 60 * time.Second}

	go func() {
		log.Printf("permission-service listening on %s", cfg.HTTPAddr)
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
