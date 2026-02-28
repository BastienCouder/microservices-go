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

	httpadapter "github.com/bastiencouder/microservices-go/services/billing-service/internal/adapter/http"
	billingrepo "github.com/bastiencouder/microservices-go/services/billing-service/internal/adapter/repository/postgres"
	"github.com/bastiencouder/microservices-go/services/billing-service/internal/config"
	"github.com/bastiencouder/microservices-go/services/billing-service/internal/usecase"
)

func main() {
	cfg, err := config.Load()
	if err != nil {
		log.Fatalf("load config: %v", err)
	}
	if code, ok := runHealthcheckMode(cfg.DatabaseURL); ok {
		os.Exit(code)
	}

	db, err := waitForDatabase(context.Background(), cfg.DatabaseURL, "billing-service")
	if err != nil {
		log.Fatalf("wait for billing database: %v", err)
	}
	defer db.Close()

	repo := billingrepo.NewRepository(db)
	svc := usecase.NewService(repo)
	h := httpadapter.NewHandler(svc, readinessCheck(db))

	mux := http.NewServeMux()
	h.Register(mux)

	server := &http.Server{Addr: cfg.HTTPAddr, Handler: mux, ReadTimeout: 5 * time.Second, WriteTimeout: 10 * time.Second, IdleTimeout: 60 * time.Second}

	go func() {
		log.Printf("billing-service listening on %s", cfg.HTTPAddr)
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

func runHealthcheckMode(databaseURL string) (int, bool) {
	if len(os.Args) < 2 || os.Args[1] != "healthcheck" {
		return 0, false
	}
	ctx, cancel := context.WithTimeout(context.Background(), 2*time.Second)
	defer cancel()

	db, err := pgxpool.New(ctx, databaseURL)
	if err != nil {
		return 1, true
	}
	defer db.Close()
	if err := db.Ping(ctx); err != nil {
		return 1, true
	}
	return 0, true
}

func readinessCheck(db *pgxpool.Pool) func(context.Context) error {
	return func(ctx context.Context) error {
		pingCtx, cancel := context.WithTimeout(ctx, 2*time.Second)
		defer cancel()
		return db.Ping(pingCtx)
	}
}

func waitForDatabase(ctx context.Context, dsn, serviceName string) (*pgxpool.Pool, error) {
	backoff := time.Second
	const maxBackoff = 30 * time.Second

	for {
		attemptCtx, cancel := context.WithTimeout(ctx, 10*time.Second)
		db, err := pgxpool.New(attemptCtx, dsn)
		if err == nil {
			err = db.Ping(attemptCtx)
		}
		cancel()

		if err == nil {
			return db, nil
		}
		if db != nil {
			db.Close()
		}

		log.Printf("%s database unavailable: %v; retrying in %s", serviceName, err, backoff)
		select {
		case <-ctx.Done():
			return nil, ctx.Err()
		case <-time.After(backoff):
		}

		if backoff < maxBackoff {
			backoff *= 2
			if backoff > maxBackoff {
				backoff = maxBackoff
			}
		}
	}
}
