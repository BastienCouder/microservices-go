package httpsrv

import (
	"net/http"
	"time"
)

const defaultMaxHeaderBytes = 64 << 10

type config struct {
	readHeaderTimeout time.Duration
	readTimeout       time.Duration
	writeTimeout      time.Duration
	idleTimeout       time.Duration
	maxHeaderBytes    int
}

type Option func(*config)

func WithReadHeaderTimeout(value time.Duration) Option {
	return func(cfg *config) {
		cfg.readHeaderTimeout = value
	}
}

func WithReadTimeout(value time.Duration) Option {
	return func(cfg *config) {
		cfg.readTimeout = value
	}
}

func WithWriteTimeout(value time.Duration) Option {
	return func(cfg *config) {
		cfg.writeTimeout = value
	}
}

func WithIdleTimeout(value time.Duration) Option {
	return func(cfg *config) {
		cfg.idleTimeout = value
	}
}

func WithMaxHeaderBytes(value int) Option {
	return func(cfg *config) {
		cfg.maxHeaderBytes = value
	}
}

func NewServer(addr string, handler http.Handler, options ...Option) *http.Server {
	cfg := config{
		readHeaderTimeout: 5 * time.Second,
		readTimeout:       5 * time.Second,
		writeTimeout:      10 * time.Second,
		idleTimeout:       60 * time.Second,
		maxHeaderBytes:    defaultMaxHeaderBytes,
	}
	for _, option := range options {
		option(&cfg)
	}

	return &http.Server{
		Addr:              addr,
		Handler:           handler,
		ReadHeaderTimeout: cfg.readHeaderTimeout,
		ReadTimeout:       cfg.readTimeout,
		WriteTimeout:      cfg.writeTimeout,
		IdleTimeout:       cfg.idleTimeout,
		MaxHeaderBytes:    cfg.maxHeaderBytes,
	}
}
