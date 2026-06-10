package grpctls

import (
	"crypto/tls"
	"crypto/x509"
	"fmt"
	"os"
	"strings"

	"google.golang.org/grpc"
	"google.golang.org/grpc/credentials"
	"google.golang.org/grpc/credentials/insecure"
)

type ClientConfig struct {
	AllowInsecure bool
	CAFile        string
	CertFile      string
	KeyFile       string
	ServerName    string
}

type ServerConfig struct {
	AllowInsecure     bool
	CertFile          string
	KeyFile           string
	ClientCAFile      string
	RequireClientCert bool
}

func ClientDialOptions(cfg ClientConfig) ([]grpc.DialOption, error) {
	if cfg.AllowInsecure {
		return []grpc.DialOption{grpc.WithTransportCredentials(insecure.NewCredentials())}, nil
	}

	tlsConfig, err := clientTLSConfig(cfg)
	if err != nil {
		return nil, err
	}
	return []grpc.DialOption{grpc.WithTransportCredentials(credentials.NewTLS(tlsConfig))}, nil
}

func ServerOptions(cfg ServerConfig) ([]grpc.ServerOption, error) {
	if cfg.AllowInsecure {
		return nil, nil
	}

	certFile := strings.TrimSpace(cfg.CertFile)
	keyFile := strings.TrimSpace(cfg.KeyFile)
	if certFile == "" || keyFile == "" {
		return nil, fmt.Errorf("grpc tls is enabled but GRPC_TLS_CERT_FILE/GRPC_TLS_KEY_FILE are missing")
	}

	cert, err := tls.LoadX509KeyPair(certFile, keyFile)
	if err != nil {
		return nil, fmt.Errorf("load grpc tls key pair: %w", err)
	}

	tlsConfig := &tls.Config{
		MinVersion:   tls.VersionTLS12,
		Certificates: []tls.Certificate{cert},
	}

	clientCAFile := strings.TrimSpace(cfg.ClientCAFile)
	if clientCAFile != "" {
		pool, err := certPoolFromPEMFile(clientCAFile)
		if err != nil {
			return nil, fmt.Errorf("load grpc client ca: %w", err)
		}
		tlsConfig.ClientCAs = pool
		if cfg.RequireClientCert {
			tlsConfig.ClientAuth = tls.RequireAndVerifyClientCert
		} else {
			tlsConfig.ClientAuth = tls.VerifyClientCertIfGiven
		}
	} else if cfg.RequireClientCert {
		return nil, fmt.Errorf("GRPC_TLS_REQUIRE_CLIENT_CERT=true requires GRPC_TLS_CLIENT_CA_FILE")
	}

	return []grpc.ServerOption{grpc.Creds(credentials.NewTLS(tlsConfig))}, nil
}

func clientTLSConfig(cfg ClientConfig) (*tls.Config, error) {
	tlsConfig := &tls.Config{MinVersion: tls.VersionTLS12}

	if serverName := strings.TrimSpace(cfg.ServerName); serverName != "" {
		tlsConfig.ServerName = serverName
	}

	if caFile := strings.TrimSpace(cfg.CAFile); caFile != "" {
		pool, err := certPoolFromPEMFile(caFile)
		if err != nil {
			return nil, fmt.Errorf("load grpc ca: %w", err)
		}
		tlsConfig.RootCAs = pool
	}

	certFile := strings.TrimSpace(cfg.CertFile)
	keyFile := strings.TrimSpace(cfg.KeyFile)
	if certFile == "" && keyFile == "" {
		return tlsConfig, nil
	}
	if certFile == "" || keyFile == "" {
		return nil, fmt.Errorf("both GRPC_TLS_CERT_FILE and GRPC_TLS_KEY_FILE are required for mTLS")
	}

	cert, err := tls.LoadX509KeyPair(certFile, keyFile)
	if err != nil {
		return nil, fmt.Errorf("load grpc client key pair: %w", err)
	}
	tlsConfig.Certificates = []tls.Certificate{cert}
	return tlsConfig, nil
}

func certPoolFromPEMFile(path string) (*x509.CertPool, error) {
	pemBytes, err := os.ReadFile(path)
	if err != nil {
		return nil, err
	}
	pool := x509.NewCertPool()
	if !pool.AppendCertsFromPEM(pemBytes) {
		return nil, fmt.Errorf("invalid pem data in %s", path)
	}
	return pool, nil
}
