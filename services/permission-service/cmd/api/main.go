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

	"github.com/prometheus/client_golang/prometheus/promhttp"
	"google.golang.org/grpc"

	permissionv1 "github.com/bastiencouder/microservices-go/contracts/gen/go/permission/v1"
	grpctls "github.com/bastiencouder/microservices-go/contracts/pkg/grpctls"
	"github.com/bastiencouder/microservices-go/contracts/pkg/httpsrv"
	"github.com/bastiencouder/microservices-go/contracts/pkg/internalauth"
	"github.com/bastiencouder/microservices-go/contracts/pkg/serviceboot"
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
	if code, ok := serviceboot.RunDatabaseHealthcheckMode(cfg.DatabaseURL); ok {
		os.Exit(code)
	}

	db, err := serviceboot.WaitForDatabase(context.Background(), cfg.DatabaseURL, "permission-service")
	if err != nil {
		log.Fatalf("wait for permission database: %v", err)
	}
	defer db.Close()

	repo := permissionrepo.NewRepository(db)
	roleResolver := organizationsclient.NewClient(cfg.OrganizationsServiceURL, cfg.InternalJWTSecret, cfg.InternalJWTIssuer)
	svc := usecase.NewService(repo, roleResolver)
	h := httpadapter.NewHandler(svc, serviceboot.DatabaseReadiness(db))
	g := grpcadapter.NewServer(svc)

	mux := http.NewServeMux()
	h.Register(mux)

	server := httpsrv.NewServer(cfg.HTTPAddr, internalauth.NewHTTPMiddleware(cfg.InternalJWTSecret, cfg.InternalJWTIssuer, "permission-service")(mux))
	metricsServer := serviceboot.StartMetricsServerWithHandler(cfg.MetricsAddr, "permission-service", promhttp.Handler())
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
	grpcServerOptions = append(grpcServerOptions, grpc.UnaryInterceptor(internalauth.NewUnaryAuthInterceptor(cfg.InternalJWTSecret, cfg.InternalJWTIssuer, "permission-service")))
	grpcServer := grpc.NewServer(grpcServerOptions...)
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
