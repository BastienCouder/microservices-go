package main

import (
	"context"
	"errors"
	"fmt"
	"log"
	"net"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"
	amqp "github.com/rabbitmq/amqp091-go"
	"google.golang.org/grpc"

	projectv1 "github.com/bastiencouder/microservices-go/contracts/gen/go/project/v1"
	grpctls "github.com/bastiencouder/microservices-go/contracts/pkg/grpctls"
	"github.com/bastiencouder/microservices-go/contracts/pkg/httpsrv"
	analysisclient "github.com/bastiencouder/microservices-go/services/project-service/internal/adapter/client/analysis"
	attributionclient "github.com/bastiencouder/microservices-go/services/project-service/internal/adapter/client/attribution"
	iaclient "github.com/bastiencouder/microservices-go/services/project-service/internal/adapter/client/ia"
	grpcadapter "github.com/bastiencouder/microservices-go/services/project-service/internal/adapter/grpc"
	httpadapter "github.com/bastiencouder/microservices-go/services/project-service/internal/adapter/http"
	rabbitmqadapter "github.com/bastiencouder/microservices-go/services/project-service/internal/adapter/messaging/rabbitmq"
	projectstate "github.com/bastiencouder/microservices-go/services/project-service/internal/adapter/state/postgres"
	"github.com/bastiencouder/microservices-go/services/project-service/internal/config"
	"github.com/bastiencouder/microservices-go/services/project-service/internal/security"
	"github.com/bastiencouder/microservices-go/services/project-service/internal/usecase"
)

func main() {
	cfg, err := config.Load()
	if err != nil {
		log.Fatalf("load config: %v", err)
	}
	if code, ok := runHealthcheckMode(cfg.DatabaseURL); ok {
		os.Exit(code)
	}

	db, err := waitForDatabase(context.Background(), cfg.DatabaseURL, "project-service")
	if err != nil {
		log.Fatalf("wait for project database: %v", err)
	}
	defer db.Close()
	if err := waitForRabbitMQ(context.Background(), cfg.RabbitMQURL, "project-service"); err != nil {
		log.Fatalf("wait for rabbitmq: %v", err)
	}
	grpcClientTLS := grpctls.ClientConfig{
		AllowInsecure: cfg.GRPCAllowInsecure,
		CAFile:        cfg.GRPCTLSCAFile,
		CertFile:      cfg.GRPCTLSCertFile,
		KeyFile:       cfg.GRPCTLSKeyFile,
		ServerName:    cfg.GRPCTLSServerName,
	}

	analysisGRPCClient, err := analysisclient.NewClient(cfg.AnalysisServiceGRPCAddr, cfg.InternalJWTSecret, cfg.InternalJWTIssuer, grpcClientTLS)
	if err != nil {
		log.Fatalf("init analysis grpc client: %v", err)
	}
	defer analysisGRPCClient.Close()

	iaGRPCClient, err := iaclient.NewClient(cfg.IAServiceGRPCAddr, cfg.InternalJWTSecret, cfg.InternalJWTIssuer, grpcClientTLS)
	if err != nil {
		log.Fatalf("init ia grpc client: %v", err)
	}
	defer iaGRPCClient.Close()

	var attributionHTTPClient usecase.AttributionClient
	if cfg.AttributionServiceURL != "" {
		client, err := attributionclient.NewClient(cfg.AttributionServiceURL, cfg.InternalJWTSecret, cfg.InternalJWTIssuer)
		if err != nil {
			log.Fatalf("init attribution http client: %v", err)
		}
		attributionHTTPClient = client
	}

	store, err := projectstate.NewStateStore(db, cfg.SecretEncryptionKey)
	if err != nil {
		log.Fatalf("init project state store: %v", err)
	}

	svc, err := usecase.NewServiceWithDependencies(context.Background(), usecase.Dependencies{
		Store:             store,
		AnalysisClient:    analysisGRPCClient,
		IAClient:          iaGRPCClient,
		AttributionClient: attributionHTTPClient,
	})
	if err != nil {
		log.Fatalf("initialize project service: %v", err)
	}

	backgroundCtx, stopBackground := context.WithCancel(context.Background())
	defer stopBackground()
	go runOutboxPublisherLoop(backgroundCtx, cfg, svc)
	go runOutboxConsumerLoop(backgroundCtx, cfg, svc)

	h := httpadapter.NewHandler(svc)
	g := grpcadapter.NewServer(svc)

	mux := http.NewServeMux()
	h.Register(mux)

	httpServer := httpsrv.NewServer(
		cfg.HTTPAddr,
		security.NewInternalAuthMiddleware(cfg.InternalJWTSecret, cfg.InternalJWTIssuer, "project-service")(mux),
		httpsrv.WithReadTimeout(10*time.Second),
		httpsrv.WithWriteTimeout(20*time.Second),
	)
	var metricsServer *http.Server
	if cfg.MetricsAddr != "" {
		metricsMux := http.NewServeMux()
		metricsMux.HandleFunc("GET /metrics", metricsHandler)
		metricsServer = httpsrv.NewServer(cfg.MetricsAddr, metricsMux)
		go func() {
			log.Printf("project-service metrics listening on %s", cfg.MetricsAddr)
			if err := metricsServer.ListenAndServe(); err != nil && !errors.Is(err, http.ErrServerClosed) {
				log.Fatalf("metrics listen error: %v", err)
			}
		}()
	}

	grpcServerOptions, err := grpctls.ServerOptions(grpctls.ServerConfig{
		AllowInsecure:     cfg.GRPCAllowInsecure,
		CertFile:          cfg.GRPCTLSCertFile,
		KeyFile:           cfg.GRPCTLSKeyFile,
		ClientCAFile:      cfg.GRPCTLSClientCAFile,
		RequireClientCert: cfg.GRPCTLSRequireClientCert,
	})
	if err != nil {
		log.Fatalf("configure grpc tls: %v", err)
	}
	grpcServerOptions = append(grpcServerOptions, grpc.UnaryInterceptor(security.NewUnaryAuthInterceptor(cfg.InternalJWTSecret, cfg.InternalJWTIssuer, "project-service")))
	grpcServer := grpc.NewServer(grpcServerOptions...)
	projectv1.RegisterProjectServiceServer(grpcServer, g)

	grpcListener, err := net.Listen("tcp", cfg.GRPCAddr)
	if err != nil {
		log.Fatalf("listen grpc error: %v", err)
	}
	defer grpcListener.Close()

	go func() {
		log.Printf("project-service listening on %s", cfg.HTTPAddr)
		if err := httpServer.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			log.Fatalf("listen error: %v", err)
		}
	}()
	go func() {
		log.Printf("project-service grpc listening on %s", cfg.GRPCAddr)
		if err := grpcServer.Serve(grpcListener); err != nil {
			log.Fatalf("grpc listen error: %v", err)
		}
	}()

	stop := make(chan os.Signal, 1)
	signal.Notify(stop, syscall.SIGINT, syscall.SIGTERM)
	<-stop
	stopBackground()

	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()
	if metricsServer != nil {
		if err := metricsServer.Shutdown(ctx); err != nil {
			log.Printf("metrics shutdown error: %v", err)
		}
	}
	if err := httpServer.Shutdown(ctx); err != nil {
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

func runOutboxPublisherLoop(ctx context.Context, cfg config.Config, svc *usecase.Service) {
	for {
		if ctx.Err() != nil {
			return
		}

		client, err := rabbitmqadapter.NewClient(
			cfg.RabbitMQURL,
			cfg.RabbitMQExchange,
			cfg.RabbitMQFinalizeQueue,
			cfg.RabbitMQFinalizeRouteKey,
			"project-service-publisher",
		)
		if err != nil {
			log.Printf("outbox publisher dial failed: %v", err)
			if sleepErr := sleepWithContext(ctx, time.Second); sleepErr != nil {
				return
			}
			continue
		}

		err = publishPendingOutbox(ctx, svc, client)
		_ = client.Close()
		if err != nil && !errors.Is(err, context.Canceled) {
			log.Printf("outbox publisher loop restart: %v", err)
		}
		if sleepErr := sleepWithContext(ctx, time.Second); sleepErr != nil {
			return
		}
	}
}

func publishPendingOutbox(ctx context.Context, svc *usecase.Service, client *rabbitmqadapter.Client) error {
	ticker := time.NewTicker(time.Second)
	defer ticker.Stop()

	for {
		select {
		case <-ctx.Done():
			return ctx.Err()
		case <-ticker.C:
			events, err := svc.ListOutboxEventsToPublish(ctx, 100)
			if err != nil {
				return err
			}
			for _, event := range events {
				publishCtx, cancelPublish := context.WithTimeout(ctx, 5*time.Second)
				err := client.PublishProjectFinalized(publishCtx, event.ID)
				cancelPublish()
				if err != nil {
					return err
				}

				markCtx, cancelMark := context.WithTimeout(ctx, 5*time.Second)
				err = svc.MarkOutboxEventPublished(markCtx, event.ID)
				cancelMark()
				if err != nil {
					return err
				}
			}
		}
	}
}

func runOutboxConsumerLoop(ctx context.Context, cfg config.Config, svc *usecase.Service) {
	for {
		if ctx.Err() != nil {
			return
		}

		client, err := rabbitmqadapter.NewClient(
			cfg.RabbitMQURL,
			cfg.RabbitMQExchange,
			cfg.RabbitMQFinalizeQueue,
			cfg.RabbitMQFinalizeRouteKey,
			"project-service-consumer",
		)
		if err != nil {
			log.Printf("outbox consumer dial failed: %v", err)
			if sleepErr := sleepWithContext(ctx, time.Second); sleepErr != nil {
				return
			}
			continue
		}

		err = client.ConsumeProjectFinalized(ctx, func(loopCtx context.Context, eventID string) error {
			processCtx, cancel := context.WithTimeout(loopCtx, 30*time.Second)
			defer cancel()
			return svc.ProcessFinalizedProjectOutboxEvent(processCtx, eventID)
		})
		_ = client.Close()
		if err != nil && !errors.Is(err, context.Canceled) {
			log.Printf("outbox consumer loop restart: %v", err)
		}
		if sleepErr := sleepWithContext(ctx, time.Second); sleepErr != nil {
			return
		}
	}
}

func sleepWithContext(ctx context.Context, d time.Duration) error {
	timer := time.NewTimer(d)
	defer timer.Stop()
	select {
	case <-timer.C:
		return nil
	case <-ctx.Done():
		return ctx.Err()
	}
}
