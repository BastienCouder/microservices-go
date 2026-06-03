package serviceboot

import (
	"context"
	"errors"
	"fmt"
	"log"
	"net/http"
	"os"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"
	amqp "github.com/rabbitmq/amqp091-go"

	"github.com/bastiencouder/microservices-go/contracts/pkg/httpsrv"
)

func RunHealthcheckMode() (int, bool) {
	if len(os.Args) < 2 || os.Args[1] != "healthcheck" {
		return 0, false
	}
	return 0, true
}

func RunDatabaseHealthcheckMode(databaseURL string) (int, bool) {
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

func WaitForDatabase(ctx context.Context, dsn, serviceName string) (*pgxpool.Pool, error) {
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

func WaitForRabbitMQ(ctx context.Context, amqpURL, serviceName string) error {
	backoff := time.Second
	const maxBackoff = 30 * time.Second

	for {
		conn, err := amqp.DialConfig(amqpURL, amqp.Config{
			Heartbeat: 10 * time.Second,
			Dial:      amqp.DefaultDial(10 * time.Second),
		})
		if err == nil {
			_ = conn.Close()
		}

		if err == nil {
			return nil
		}

		log.Printf("%s rabbitmq unavailable: %v; retrying in %s", serviceName, err, backoff)
		select {
		case <-ctx.Done():
			return ctx.Err()
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

func MetricsHandler(w http.ResponseWriter, _ *http.Request) {
	w.Header().Set("Content-Type", "text/plain; version=0.0.4; charset=utf-8")
	_, _ = fmt.Fprintln(w, "# HELP service_up Service health indicator.")
	_, _ = fmt.Fprintln(w, "# TYPE service_up gauge")
	_, _ = fmt.Fprintln(w, "service_up 1")
}

func StartMetricsServer(addr, serviceName string) *http.Server {
	return StartMetricsServerWithHandler(addr, serviceName, http.HandlerFunc(MetricsHandler))
}

func StartMetricsServerWithHandler(addr, serviceName string, handler http.Handler) *http.Server {
	if addr == "" {
		return nil
	}

	metricsMux := http.NewServeMux()
	metricsMux.Handle("GET /metrics", handler)
	server := httpsrv.NewServer(addr, metricsMux)
	go func() {
		log.Printf("%s metrics listening on %s", serviceName, addr)
		if err := server.ListenAndServe(); err != nil && !errors.Is(err, http.ErrServerClosed) {
			log.Fatalf("metrics listen error: %v", err)
		}
	}()
	return server
}

func DatabaseReadiness(db *pgxpool.Pool) func(context.Context) error {
	return func(ctx context.Context) error {
		pingCtx, cancel := context.WithTimeout(ctx, 2*time.Second)
		defer cancel()
		return db.Ping(pingCtx)
	}
}
