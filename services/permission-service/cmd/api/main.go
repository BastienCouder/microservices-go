package main

import (
	"context"
	"log"
	"net"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/prometheus/client_golang/prometheus/promhttp"
	"google.golang.org/grpc"

	permissionv1 "github.com/bastiencouder/microservices-go/contracts/gen/go/permission/v1"
	organizationsclient "github.com/bastiencouder/microservices-go/services/permission-service/internal/adapter/client/organizations"
	grpcadapter "github.com/bastiencouder/microservices-go/services/permission-service/internal/adapter/grpc"
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
	if code, ok := runHealthcheckMode(cfg.DatabaseURL); ok {
		os.Exit(code)
	}

	db, err := waitForDatabase(context.Background(), cfg.DatabaseURL, "permission-service")
	if err != nil {
		log.Fatalf("wait for permission database: %v", err)
	}
	defer db.Close()

	repo := permissionrepo.NewRepository(db)
	roleResolver := organizationsclient.NewClient(cfg.OrganizationsServiceURL)
	svc := usecase.NewService(repo, roleResolver)
	h := httpadapter.NewHandler(svc, readinessCheck(db))
	g := grpcadapter.NewServer(svc)

	mux := http.NewServeMux()
	mux.Handle("/metrics", promhttp.Handler())
	h.Register(mux)

	server := &http.Server{Addr: cfg.HTTPAddr, Handler: mux, ReadTimeout: 5 * time.Second, WriteTimeout: 10 * time.Second, IdleTimeout: 60 * time.Second}
	grpcServer := grpc.NewServer()
	permissionv1.RegisterPermissionServiceServer(grpcServer, g)

	grpcListener, err := net.Listen("tcp", cfg.GRPCAddr)
	if err != nil {
		log.Fatalf("listen grpc error: %v", err)
	}
	defer grpcListener.Close()

	go func() {
		log.Printf("permission-service listening on %s", cfg.HTTPAddr)
		if err := server.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			log.Fatalf("listen error: %v", err)
		}
	}()
	go func() {
		log.Printf("permission-service grpc listening on %s", cfg.GRPCAddr)
		if err := grpcServer.Serve(grpcListener); err != nil {
			log.Fatalf("grpc listen error: %v", err)
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
	grpcServer.GracefulStop()
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
