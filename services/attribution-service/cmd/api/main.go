package main

import (
	"context"
	"fmt"
	"log"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"

	grpctls "github.com/bastiencouder/microservices-go/contracts/pkg/grpctls"
	ga4client "github.com/bastiencouder/microservices-go/services/attribution-service/internal/adapter/client/ga4"
	projectclient "github.com/bastiencouder/microservices-go/services/attribution-service/internal/adapter/client/project"
	projectapiclient "github.com/bastiencouder/microservices-go/services/attribution-service/internal/adapter/client/projectapi"
	httpadapter "github.com/bastiencouder/microservices-go/services/attribution-service/internal/adapter/http"
	attributionrepo "github.com/bastiencouder/microservices-go/services/attribution-service/internal/adapter/repository/postgres"
	"github.com/bastiencouder/microservices-go/services/attribution-service/internal/config"
	"github.com/bastiencouder/microservices-go/services/attribution-service/internal/security"
	"github.com/bastiencouder/microservices-go/services/attribution-service/internal/usecase"
)

func main() {
	cfg, err := config.Load()
	if err != nil {
		log.Fatalf("load config: %v", err)
	}
	if code, ok := runHealthcheckMode(cfg.DatabaseURL); ok {
		os.Exit(code)
	}

	db, err := waitForDatabase(context.Background(), cfg.DatabaseURL, "attribution-service")
	if err != nil {
		log.Fatalf("wait for attribution database: %v", err)
	}
	defer db.Close()

	projectVerifier, err := projectclient.NewClient(
		cfg.ProjectServiceGRPCAddr,
		cfg.InternalJWTSecret,
		cfg.InternalJWTIssuer,
		grpctls.ClientConfig{
			AllowInsecure: cfg.GRPCAllowInsecure,
			CAFile:        cfg.GRPCTLSCAFile,
			CertFile:      cfg.GRPCTLSCertFile,
			KeyFile:       cfg.GRPCTLSKeyFile,
			ServerName:    cfg.GRPCTLSServerName,
		},
	)
	if err != nil {
		log.Fatalf("init project grpc client: %v", err)
	}
	defer projectVerifier.Close()

	repo := attributionrepo.NewRepository(db)
	svc := usecase.NewService(repo, projectVerifier)
	if cfg.ProjectServiceURL != "" {
		projectResolver, err := projectapiclient.NewClient(cfg.ProjectServiceURL, cfg.InternalJWTSecret, cfg.InternalJWTIssuer)
		if err != nil {
			log.Fatalf("init project api client: %v", err)
		}
		visitProvider := ga4client.NewClient()
		svc.EnableVisitProvider(projectResolver, visitProvider)
	}
	h := httpadapter.NewHandler(svc)

	mux := http.NewServeMux()
	mux.HandleFunc("GET /metrics", metricsHandler)
	h.Register(mux)

	server := &http.Server{
		Addr:              cfg.HTTPAddr,
		Handler:           security.NewInternalAuthMiddleware(cfg.InternalJWTSecret, cfg.InternalJWTIssuer, "attribution-service")(mux),
		ReadHeaderTimeout: 5 * time.Second,
		ReadTimeout:       10 * time.Second,
		WriteTimeout:      20 * time.Second,
		IdleTimeout:       60 * time.Second,
		MaxHeaderBytes:    64 << 10,
	}

	go func() {
		log.Printf("attribution-service listening on %s", cfg.HTTPAddr)
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

func metricsHandler(w http.ResponseWriter, _ *http.Request) {
	w.Header().Set("Content-Type", "text/plain; version=0.0.4; charset=utf-8")
	_, _ = fmt.Fprintln(w, "# HELP service_up Service health indicator.")
	_, _ = fmt.Fprintln(w, "# TYPE service_up gauge")
	_, _ = fmt.Fprintln(w, "service_up 1")
}
