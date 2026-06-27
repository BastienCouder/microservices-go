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

	organizationsv1 "github.com/bastiencouder/microservices-go/contracts/gen/go/organizations/v1"
	grpctls "github.com/bastiencouder/microservices-go/contracts/pkg/grpctls"
	"github.com/bastiencouder/microservices-go/contracts/pkg/httpsrv"
	"github.com/bastiencouder/microservices-go/contracts/pkg/internalauth"
	"github.com/bastiencouder/microservices-go/contracts/pkg/serviceboot"
	permissionclient "github.com/bastiencouder/microservices-go/services/organizations-service/internal/adapter/client/permission"
	projectclient "github.com/bastiencouder/microservices-go/services/organizations-service/internal/adapter/client/project"
	userclient "github.com/bastiencouder/microservices-go/services/organizations-service/internal/adapter/client/user"
	grpcadapter "github.com/bastiencouder/microservices-go/services/organizations-service/internal/adapter/grpc"
	httpadapter "github.com/bastiencouder/microservices-go/services/organizations-service/internal/adapter/http"
	rabbitmqadapter "github.com/bastiencouder/microservices-go/services/organizations-service/internal/adapter/messaging/rabbitmq"
	"github.com/bastiencouder/microservices-go/services/organizations-service/internal/adapter/repository/postgres"
	"github.com/bastiencouder/microservices-go/services/organizations-service/internal/config"
	"github.com/bastiencouder/microservices-go/services/organizations-service/internal/usecase"
	"google.golang.org/grpc"
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
	if cfg.PermissionServiceURL != "" {
		membershipStore, err := permissionclient.NewClient(cfg.PermissionServiceURL, cfg.InternalJWTSecret, cfg.InternalJWTIssuer)
		if err != nil {
			log.Fatalf("init permission client: %v", err)
		}
		svc.EnablePermissionMemberships(membershipStore)
	}
	if cfg.ProjectServiceURL != "" {
		projectLister, err := projectclient.NewClient(cfg.ProjectServiceURL, cfg.InternalJWTSecret, cfg.InternalJWTIssuer)
		if err != nil {
			log.Fatalf("init project client: %v", err)
		}
		svc.EnableProjectHierarchy(projectLister)
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
	defer func() {
		if err := invitationNotifier.Close(); err != nil {
			log.Printf("close invitation notifier: %v", err)
		}
	}()
	svc.EnableInvitationNotifications(invitationNotifier, cfg.AppBaseURL, cfg.InvitationLoginURL)
	h := httpadapter.NewHandler(svc, serviceboot.DatabaseReadiness(db))
	g := grpcadapter.NewServer(svc)

	mux := http.NewServeMux()
	h.Register(mux)

	server := httpsrv.NewServer(cfg.HTTPAddr, internalauth.NewHTTPMiddleware(cfg.InternalJWTSecret, cfg.InternalJWTIssuer, "organizations-service")(mux))
	metricsServer := serviceboot.StartMetricsServer(cfg.MetricsAddr, "organizations-service")

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
	grpcServerOptions = append(grpcServerOptions, grpc.UnaryInterceptor(internalauth.NewUnaryAuthInterceptor(cfg.InternalJWTSecret, cfg.InternalJWTIssuer, "organizations-service")))
	grpcServer := grpc.NewServer(grpcServerOptions...)
	organizationsv1.RegisterOrganizationsServiceServer(grpcServer, g)

	grpcListener, err := net.Listen("tcp", cfg.GRPCAddr)
	if err != nil {
		log.Fatalf("listen grpc error: %v", err)
	}
	defer func() {
		if err := grpcListener.Close(); err != nil {
			log.Printf("close grpc listener: %v", err)
		}
	}()

	go func() {
		log.Printf("organizations-service listening on %s", cfg.HTTPAddr)
		if err := server.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			log.Fatalf("listen error: %v", err)
		}
	}()
	go func() {
		log.Printf("organizations-service grpc listening on %s", cfg.GRPCAddr)
		if err := grpcServer.Serve(grpcListener); err != nil {
			log.Fatalf("grpc listen error: %v", err)
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
	grpcServer.GracefulStop()
}
