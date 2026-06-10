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

	"github.com/prometheus/client_golang/prometheus/promhttp"

	"github.com/bastiencouder/microservices-go/contracts/pkg/httpsrv"
	"github.com/bastiencouder/microservices-go/contracts/pkg/internalauth"
	"github.com/bastiencouder/microservices-go/contracts/pkg/serviceboot"
	emailrenderer "github.com/bastiencouder/microservices-go/services/notification-service/internal/adapter/client/emailrenderer"
	resendemail "github.com/bastiencouder/microservices-go/services/notification-service/internal/adapter/email/resend"
	httpadapter "github.com/bastiencouder/microservices-go/services/notification-service/internal/adapter/http"
	rabbitmqadapter "github.com/bastiencouder/microservices-go/services/notification-service/internal/adapter/messaging/rabbitmq"
	notificationrepo "github.com/bastiencouder/microservices-go/services/notification-service/internal/adapter/repository/postgres"
	"github.com/bastiencouder/microservices-go/services/notification-service/internal/config"
	"github.com/bastiencouder/microservices-go/services/notification-service/internal/usecase"
)

func main() {
	cfg, err := config.Load()
	if err != nil {
		log.Fatalf("load config: %v", err)
	}
	if code, ok := serviceboot.RunDatabaseHealthcheckMode(cfg.DatabaseURL); ok {
		os.Exit(code)
	}

	db, err := serviceboot.WaitForDatabase(context.Background(), cfg.DatabaseURL, "notification-service")
	if err != nil {
		log.Fatalf("wait for notification database: %v", err)
	}
	defer db.Close()
	if err := serviceboot.WaitForRabbitMQ(context.Background(), cfg.RabbitMQURL, "notification-service"); err != nil {
		log.Fatalf("wait for rabbitmq: %v", err)
	}

	repo := notificationrepo.NewRepository(db)
	templateClient := emailrenderer.NewClient(cfg.EmailRendererURL)
	emailClient := resendemail.NewClient(cfg.ResendAPIKey, cfg.ResendFromEmail)
	svc := usecase.NewService(repo, emailClient, templateClient)
	appCtx, cancelApp := context.WithCancel(context.Background())
	defer cancelApp()
	go runEmailNotificationConsumerLoop(appCtx, cfg, svc)
	h := httpadapter.NewHandler(svc, serviceboot.DatabaseReadiness(db))

	mux := http.NewServeMux()
	h.Register(mux)

	server := httpsrv.NewServer(cfg.HTTPAddr, internalauth.NewHTTPMiddleware(cfg.InternalJWTSecret, cfg.InternalJWTIssuer, "notification-service")(mux))
	metricsServer := serviceboot.StartMetricsServerWithHandler(cfg.MetricsAddr, "notification-service", promhttp.Handler())

	go func() {
		log.Printf("notification-service listening on %s", cfg.HTTPAddr)
		if err := server.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			log.Fatalf("listen error: %v", err)
		}
	}()

	stop := make(chan os.Signal, 1)
	signal.Notify(stop, syscall.SIGINT, syscall.SIGTERM)
	<-stop
	cancelApp()

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

func runEmailNotificationConsumerLoop(ctx context.Context, cfg config.Config, svc *usecase.Service) {
	for {
		if ctx.Err() != nil {
			return
		}

		client, err := rabbitmqadapter.NewClient(
			cfg.RabbitMQURL,
			cfg.RabbitMQExchange,
			cfg.RabbitMQEmailQueue,
			cfg.RabbitMQEmailRoute,
			"notification-service-email",
		)
		if err != nil {
			log.Printf("email notification consumer dial failed: %v", err)
			if sleepErr := sleepWithContext(ctx, time.Second); sleepErr != nil {
				return
			}
			continue
		}

		err = client.ConsumeNotifications(ctx, func(loopCtx context.Context, message rabbitmqadapter.NotificationMessage) error {
			processCtx, cancel := context.WithTimeout(loopCtx, 30*time.Second)
			defer cancel()
			_, err := svc.Send(processCtx, message.Channel, message.Recipient, message.Subject, message.Message)
			if err != nil {
				log.Printf("email notification delivery failed: recipient=%s subject=%q error=%v", message.Recipient, message.Subject, err)
				_ = sleepWithContext(loopCtx, 10*time.Second)
			} else {
				log.Printf("email notification delivered: recipient=%s subject=%q", message.Recipient, message.Subject)
			}
			return err
		})
		_ = client.Close()
		if err != nil && !errors.Is(err, context.Canceled) {
			log.Printf("email notification consumer loop restart: %v", err)
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
