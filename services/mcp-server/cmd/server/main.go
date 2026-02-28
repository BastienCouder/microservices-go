package main

import (
	"context"
	"flag"
	"fmt"
	"log"
	"net/http"

	"github.com/modelcontextprotocol/go-sdk/mcp"

	"github.com/bastiencouder/microservices-go/services/mcp-server/internal/tools"
)

func main() {
	server := mcp.NewServer(&mcp.Implementation{
		Name:    "microservices-mcp-server",
		Version: "0.1.0",
	}, nil)

	mcp.AddTool(server, &mcp.Tool{
		Name:        "backend_health_check",
		Description: "Check health endpoint of gateway, auth-service, user-service, organizations-service, permission-service, billing-service, or notification-service",
		Annotations: &mcp.ToolAnnotations{
			ReadOnlyHint:    true,
			DestructiveHint: boolPtr(false),
			IdempotentHint:  true,
			OpenWorldHint:   boolPtr(true),
		},
	}, tools.HealthCheck)

	mcp.AddTool(server, &mcp.Tool{
		Name:        "backend_list_endpoints",
		Description: "List public HTTP endpoints exposed by gateway and services",
		Annotations: &mcp.ToolAnnotations{
			ReadOnlyHint:    true,
			DestructiveHint: boolPtr(false),
			IdempotentHint:  true,
			OpenWorldHint:   boolPtr(false),
		},
	}, tools.ListEndpoints)

	transport := flag.String("transport", "", "transport mode: stdio or http")
	httpAddr := flag.String("http-addr", "", "http listen address, required when --transport=http")
	flag.Parse()

	if err := run(server, *transport, *httpAddr); err != nil {
		log.Fatalf("run mcp server: %v", err)
	}
}

func run(server *mcp.Server, transport, httpAddr string) error {
	switch transport {
	case "stdio":
		return server.Run(context.Background(), &mcp.StdioTransport{})
	case "http":
		if httpAddr == "" {
			return fmt.Errorf("--http-addr is required when --transport=http")
		}
		handler := mcp.NewStreamableHTTPHandler(func(*http.Request) *mcp.Server {
			return server
		}, nil)
		mux := http.NewServeMux()
		mux.Handle("/mcp", handler)
		log.Printf("mcp server listening on %s (path /mcp)", httpAddr)
		return http.ListenAndServe(httpAddr, mux)
	default:
		return fmt.Errorf("--transport must be stdio or http")
	}
}

func boolPtr(b bool) *bool { return &b }
