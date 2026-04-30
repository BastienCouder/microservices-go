package main

import (
	"context"
	"errors"
	"fmt"
	"log"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"
	amqp "github.com/rabbitmq/amqp091-go"

	"github.com/bastiencouder/microservices-go/contracts/pkg/httpsrv"
	projectclient "github.com/bastiencouder/microservices-go/services/organizations-service/internal/adapter/client/project"
	userclient "github.com/bastiencouder/microservices-go/services/organizations-service/internal/adapter/client/user"
	httpadapter "github.com/bastiencouder/microservices-go/services/organizations-service/internal/adapter/http"
	rabbitmqadapter "github.com/bastiencouder/microservices-go/services/organizations-service/internal/adapter/messaging/rabbitmq"
	"github.com/bastiencouder/microservices-go/services/organizations-service/internal/adapter/repository/postgres"
	"github.com/bastiencouder/microservices-go/services/organizations-service/internal/config"
	"github.com/bastiencouder/microservices-go/services/organizations-service/internal/security"
	"github.com/bastiencouder/microservices-go/services/organizations-service/internal/usecase"
)

func main() {
	cfg, err := config.Load()
	if err != nil {
		log.Fatalf("load config: %v", err)
	}
	if code, ok := runHealthcheckMode(cfg.DatabaseURL); ok {
		os.Exit(code)
	}

	db, err := waitForDatabase(context.Background(), cfg.DatabaseURL, "organizations-service")
	if err != nil {
		log.Fatalf("wait for organizations database: %v", err)
	}
	defer db.Close()
	if err := waitForRabbitMQ(context.Background(), cfg.RabbitMQURL, "organizations-service"); err != nil {
		log.Fatalf("wait for rabbitmq: %v", err)
	}

	repo := postgres.NewRepository(db)
	svc := usecase.NewService(repo)
	if cfg.ProjectServiceURL != "" {
		projectLister, err := projectclient.NewClient(cfg.ProjectServiceURL, cfg.InternalJWTSecret, cfg.InternalJWTIssuer)
		if err != nil {
			log.Fatalf("init project client: %v", err)
		}
		svc.EnableProjectHierarchy(projectLister)
		svc.EnableProjectMemberAssignments(projectLister)
	}
	if cfg.UserServiceURL != "" {
		userResolver, err := userclient.NewClient(cfg.UserServiceURL, cfg.InternalJWTSecret, cfg.InternalJWTIssuer)
		if err != nil {
			log.Fatalf("init user client: %v", err)
		}
		svc.EnableInvitationUserEmailValidation(userResolver)
	}
	invitationNotifier, err := rabbitmqadapter.NewClient(
		cfg.RabbitMQURL,
		cfg.RabbitMQExchange,
		cfg.RabbitMQEmailQueue,
		cfg.RabbitMQEmailRoute,
	)
	if err != nil {
		log.Fatalf("init invitation notification publisher: %v", err)
	}
	defer invitationNotifier.Close()
	svc.EnableInvitationNotifications(invitationNotifier, cfg.AppBaseURL, cfg.InvitationLoginURL)
	h := httpadapter.NewHandler(svc, readinessCheck(db))

	mux := http.NewServeMux()
	h.Register(mux)

	server := httpsrv.NewServer(cfg.HTTPAddr, security.NewInternalAuthMiddleware(cfg.InternalJWTSecret, cfg.InternalJWTIssuer, "organizations-service")(mux))
	var metricsServer *http.Server
	if cfg.MetricsAddr != "" {
		metricsMux := http.NewServeMux()
		metricsMux.HandleFunc("GET /metrics", metricsHandler)
		metricsServer = httpsrv.NewServer(cfg.MetricsAddr, metricsMux)
		go func() {
			log.Printf("organizations-service metrics listening on %s", cfg.MetricsAddr)
			if err := metricsServer.ListenAndServe(); err != nil && !errors.Is(err, http.ErrServerClosed) {
				log.Fatalf("metrics listen error: %v", err)
			}
		}()
	}

	go func() {
		log.Printf("organizations-service listening on %s", cfg.HTTPAddr)
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

func metricsHandler(w http.ResponseWriter, _ *http.Request) {
	w.Header().Set("Content-Type", "text/plain; version=0.0.4; charset=utf-8")
	_, _ = fmt.Fprintln(w, "# HELP service_up Service health indicator.")
	_, _ = fmt.Fprintln(w, "# TYPE service_up gauge")
	_, _ = fmt.Fprintln(w, "service_up 1")
}

func waitForRabbitMQ(ctx context.Context, amqpURL, serviceName string) error {
	backoff := time.Second
	const maxBackoff = 30 * time.Second

	for {
		conn, err := amqp.Dial(amqpURL)
		if err == nil {
			_ = conn.Close()
			return nil
		}

		log.Printf("%s rabbitmq unavailable: %v; retrying in %s", serviceName, err, backoff)
		select {
		case <-ctx.Done():
			return ctx.Err()
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
