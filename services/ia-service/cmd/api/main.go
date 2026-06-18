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

	"google.golang.org/grpc"

	iav1 "github.com/bastiencouder/microservices-go/contracts/gen/go/ia/v1"
	grpctls "github.com/bastiencouder/microservices-go/contracts/pkg/grpctls"
	"github.com/bastiencouder/microservices-go/contracts/pkg/httpsrv"
	"github.com/bastiencouder/microservices-go/contracts/pkg/internalauth"
	"github.com/bastiencouder/microservices-go/contracts/pkg/serviceboot"
	grpcadapter "github.com/bastiencouder/microservices-go/services/ia-service/internal/adapter/grpc"
	httpadapter "github.com/bastiencouder/microservices-go/services/ia-service/internal/adapter/http"
	openai "github.com/bastiencouder/microservices-go/services/ia-service/internal/adapter/provider/openai"
	openrouter "github.com/bastiencouder/microservices-go/services/ia-service/internal/adapter/provider/openrouter"
	providerrouter "github.com/bastiencouder/microservices-go/services/ia-service/internal/adapter/provider/router"
	iastate "github.com/bastiencouder/microservices-go/services/ia-service/internal/adapter/state/postgres"
	"github.com/bastiencouder/microservices-go/services/ia-service/internal/config"
	"github.com/bastiencouder/microservices-go/services/ia-service/internal/usecase"
)

func main() {
	cfg, err := config.Load()
	if err != nil {
		log.Fatalf("load config: %v", err)
	}
	if code, ok := serviceboot.RunHealthcheckMode(); ok {
		os.Exit(code)
	}
	if code, ok := serviceboot.RunDatabaseHealthcheckMode(cfg.DatabaseURL); ok {
		os.Exit(code)
	}

	db, err := serviceboot.WaitForDatabase(context.Background(), cfg.DatabaseURL, "ia-service")
	if err != nil {
		log.Fatalf("wait for ia database: %v", err)
	}
	defer db.Close()

	httpClient := &http.Client{
		Transport: &http.Transport{
			Proxy:                 http.ProxyFromEnvironment,
			DialContext:           (&net.Dialer{Timeout: 2 * time.Second, KeepAlive: 30 * time.Second}).DialContext,
			ForceAttemptHTTP2:     true,
			MaxIdleConns:          100,
			MaxIdleConnsPerHost:   30,
			IdleConnTimeout:       90 * time.Second,
			TLSHandshakeTimeout:   2 * time.Second,
			ExpectContinueTimeout: 1 * time.Second,
			ResponseHeaderTimeout: time.Duration(cfg.ProviderTimeoutMS) * time.Millisecond,
		},
		Timeout: time.Duration(cfg.ProviderTimeoutMS) * time.Millisecond,
	}

	var provider usecase.PromptProvider
	if cfg.ExecutionMode == string(usecase.ExecutionModeProvider) {
		openRouterClient := openrouter.NewClient(
			cfg.ProviderBaseURL,
			cfg.ProviderAPIKey,
			cfg.ProviderHTTPReferer,
			cfg.ProviderAppName,
			httpClient,
		)
		provider = providerrouter.New(map[string]usecase.PromptProvider{
			"openai":     openai.NewClient("https://api.openai.com/v1", "", httpClient),
			"google":     openai.NewClient("https://generativelanguage.googleapis.com/v1beta/openai", "", httpClient),
			"deepseek":   openai.NewClient("https://api.deepseek.com", "", httpClient),
			"groq":       openai.NewClient("https://api.groq.com/openai/v1", "", httpClient),
			"mistral":    openai.NewClient("https://api.mistral.ai/v1", "", httpClient),
			"perplexity": openai.NewClient("https://api.perplexity.ai", "", httpClient),
			"qwen":       openai.NewClient("https://dashscope-intl.aliyuncs.com/compatible-mode/v1", "", httpClient),
			"xai":        openai.NewClient("https://api.x.ai/v1", "", httpClient),
			"zai":        openai.NewClient("https://open.bigmodel.cn/api/paas/v4", "", httpClient),
		}, openRouterClient)
	}

	svc, err := usecase.NewServiceWithDependencies(usecase.Dependencies{
		Mode:         usecase.ExecutionMode(cfg.ExecutionMode),
		Provider:     provider,
		CatalogStore: iastate.NewCatalogStore(db),
	})
	if err != nil {
		log.Fatalf("initialize ia service: %v", err)
	}

	h := httpadapter.NewHandler(svc)
	g := grpcadapter.NewServer(svc)

	mux := http.NewServeMux()
	h.Register(mux)

	httpServer := httpsrv.NewServer(
		cfg.HTTPAddr,
		internalauth.NewHTTPMiddleware(cfg.InternalJWTSecret, cfg.InternalJWTIssuer, "ia-service")(mux),
		httpsrv.WithReadTimeout(10*time.Second),
		httpsrv.WithWriteTimeout(0),
	)
	metricsServer := serviceboot.StartMetricsServer(cfg.MetricsAddr, "ia-service")

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
	grpcServerOptions = append(grpcServerOptions, grpc.UnaryInterceptor(internalauth.NewUnaryAuthInterceptor(cfg.InternalJWTSecret, cfg.InternalJWTIssuer, "ia-service")))
	grpcServer := grpc.NewServer(grpcServerOptions...)
	iav1.RegisterIAServiceServer(grpcServer, g)

	grpcListener, err := net.Listen("tcp", cfg.GRPCAddr)
	if err != nil {
		log.Fatalf("listen grpc error: %v", err)
	}
	defer grpcListener.Close()

	go func() {
		log.Printf("ia-service listening on %s", cfg.HTTPAddr)
		if err := httpServer.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			log.Fatalf("listen error: %v", err)
		}
	}()
	go func() {
		log.Printf("ia-service grpc listening on %s", cfg.GRPCAddr)
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
	if err := httpServer.Shutdown(ctx); err != nil {
		log.Printf("shutdown error: %v", err)
	}
	grpcServer.GracefulStop()
}
