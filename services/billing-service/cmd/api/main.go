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

	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/prometheus/client_golang/prometheus/promhttp"

	"github.com/bastiencouder/microservices-go/contracts/pkg/httpsrv"
	attributionclient "github.com/bastiencouder/microservices-go/services/billing-service/internal/adapter/client/attribution"
	projectclient "github.com/bastiencouder/microservices-go/services/billing-service/internal/adapter/client/project"
	httpadapter "github.com/bastiencouder/microservices-go/services/billing-service/internal/adapter/http"
	billingrepo "github.com/bastiencouder/microservices-go/services/billing-service/internal/adapter/repository/postgres"
	stripeadapter "github.com/bastiencouder/microservices-go/services/billing-service/internal/adapter/stripe"
	"github.com/bastiencouder/microservices-go/services/billing-service/internal/config"
	"github.com/bastiencouder/microservices-go/services/billing-service/internal/security"
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
	if cfg.Stripe.Enabled {
		svc.EnableStripe(
			stripeadapter.NewClient(cfg.Stripe.SecretKey, cfg.Stripe.WebhookSecret),
			usecase.StripeCatalog{
				StarterMonthlyPriceID:    cfg.Stripe.StarterMonthlyPriceID,
				StarterYearlyPriceID:     cfg.Stripe.StarterYearlyPriceID,
				GrowthMonthlyPriceID:     cfg.Stripe.GrowthMonthlyPriceID,
				GrowthYearlyPriceID:      cfg.Stripe.GrowthYearlyPriceID,
				ProMonthlyPriceID:        cfg.Stripe.ProMonthlyPriceID,
				ProYearlyPriceID:         cfg.Stripe.ProYearlyPriceID,
				CorrectionCreditsPriceID: cfg.Stripe.CorrectionCreditsPriceID,
			},
			cfg.Stripe.CheckoutSuccessURL,
			cfg.Stripe.CheckoutCancelURL,
			cfg.Stripe.CustomerPortalReturnURL,
		)
	}
	if cfg.AttributionServiceURL != "" && cfg.ProjectServiceURL != "" {
		attribution, err := attributionclient.NewClient(cfg.AttributionServiceURL, cfg.InternalJWTSecret, cfg.InternalJWTIssuer)
		if err != nil {
			log.Fatalf("init attribution client: %v", err)
		}
		projectResolver, err := projectclient.NewClient(cfg.ProjectServiceURL, cfg.InternalJWTSecret, cfg.InternalJWTIssuer)
		if err != nil {
			log.Fatalf("init project client: %v", err)
		}
		svc.EnableAttribution(attribution, projectResolver)
	}
	h := httpadapter.NewHandler(svc, readinessCheck(db))

	mux := http.NewServeMux()
	h.Register(mux)

	server := httpsrv.NewServer(cfg.HTTPAddr, security.NewInternalAuthMiddleware(cfg.InternalJWTSecret, cfg.InternalJWTIssuer, "billing-service")(mux))
	var metricsServer *http.Server
	if cfg.MetricsAddr != "" {
		metricsMux := http.NewServeMux()
		metricsMux.Handle("/metrics", promhttp.Handler())
		metricsServer = httpsrv.NewServer(cfg.MetricsAddr, metricsMux)
		go func() {
			log.Printf("billing-service metrics listening on %s", cfg.MetricsAddr)
			if err := metricsServer.ListenAndServe(); err != nil && !errors.Is(err, http.ErrServerClosed) {
				log.Fatalf("metrics listen error: %v", err)
			}
		}()
	}

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
	if metricsServer != nil {
		if err := metricsServer.Shutdown(ctx); err != nil {
			log.Printf("metrics shutdown error: %v", err)
		}
	}
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
