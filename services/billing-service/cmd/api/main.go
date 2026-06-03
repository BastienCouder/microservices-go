package main

import (
	"context"
	"log"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	"github.com/prometheus/client_golang/prometheus/promhttp"

	"github.com/bastiencouder/microservices-go/contracts/pkg/httpsrv"
	"github.com/bastiencouder/microservices-go/contracts/pkg/internalauth"
	"github.com/bastiencouder/microservices-go/contracts/pkg/serviceboot"
	attributionclient "github.com/bastiencouder/microservices-go/services/billing-service/internal/adapter/client/attribution"
	projectclient "github.com/bastiencouder/microservices-go/services/billing-service/internal/adapter/client/project"
	httpadapter "github.com/bastiencouder/microservices-go/services/billing-service/internal/adapter/http"
	billingrepo "github.com/bastiencouder/microservices-go/services/billing-service/internal/adapter/repository/postgres"
	stripeadapter "github.com/bastiencouder/microservices-go/services/billing-service/internal/adapter/stripe"
	"github.com/bastiencouder/microservices-go/services/billing-service/internal/config"
	"github.com/bastiencouder/microservices-go/services/billing-service/internal/usecase"
)

func main() {
	cfg, err := config.Load()
	if err != nil {
		log.Fatalf("load config: %v", err)
	}
	if code, ok := serviceboot.RunDatabaseHealthcheckMode(cfg.DatabaseURL); ok {
		os.Exit(code)
	}

	db, err := serviceboot.WaitForDatabase(context.Background(), cfg.DatabaseURL, "billing-service")
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
	h := httpadapter.NewHandler(svc, serviceboot.DatabaseReadiness(db))

	mux := http.NewServeMux()
	h.Register(mux)

	server := httpsrv.NewServer(cfg.HTTPAddr, internalauth.NewHTTPMiddleware(cfg.InternalJWTSecret, cfg.InternalJWTIssuer, "billing-service")(mux))
	metricsServer := serviceboot.StartMetricsServerWithHandler(cfg.MetricsAddr, "billing-service", promhttp.Handler())

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
