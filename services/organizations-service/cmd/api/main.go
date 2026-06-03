package main

import (
	"context"
	"log"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	"github.com/bastiencouder/microservices-go/contracts/pkg/httpsrv"
	"github.com/bastiencouder/microservices-go/contracts/pkg/internalauth"
	"github.com/bastiencouder/microservices-go/contracts/pkg/serviceboot"
	projectclient "github.com/bastiencouder/microservices-go/services/organizations-service/internal/adapter/client/project"
	userclient "github.com/bastiencouder/microservices-go/services/organizations-service/internal/adapter/client/user"
	httpadapter "github.com/bastiencouder/microservices-go/services/organizations-service/internal/adapter/http"
	rabbitmqadapter "github.com/bastiencouder/microservices-go/services/organizations-service/internal/adapter/messaging/rabbitmq"
	"github.com/bastiencouder/microservices-go/services/organizations-service/internal/adapter/repository/postgres"
	"github.com/bastiencouder/microservices-go/services/organizations-service/internal/config"
	"github.com/bastiencouder/microservices-go/services/organizations-service/internal/usecase"
)

func main() {
	cfg, err := config.Load()
	if err != nil {
		log.Fatalf("load config: %v", err)
	}
	if code, ok := serviceboot.RunDatabaseHealthcheckMode(cfg.DatabaseURL); ok {
		os.Exit(code)
	}

	db, err := serviceboot.WaitForDatabase(context.Background(), cfg.DatabaseURL, "organizations-service")
	if err != nil {
		log.Fatalf("wait for organizations database: %v", err)
	}
	defer db.Close()
	if err := serviceboot.WaitForRabbitMQ(context.Background(), cfg.RabbitMQURL, "organizations-service"); err != nil {
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
	h := httpadapter.NewHandler(svc, serviceboot.DatabaseReadiness(db))

	mux := http.NewServeMux()
	h.Register(mux)

	server := httpsrv.NewServer(cfg.HTTPAddr, internalauth.NewHTTPMiddleware(cfg.InternalJWTSecret, cfg.InternalJWTIssuer, "organizations-service")(mux))
	metricsServer := serviceboot.StartMetricsServer(cfg.MetricsAddr, "organizations-service")

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
