# Go Microservices Architecture — Skill Reference
# Version: Go 1.26 (Février 2026)
# Objectif: Référence complète pour concevoir, développer et opérer une architecture microservices en Go.
# Sources: go.dev, CNCF, Effective Go, Go Blog 2024-2026, AsyncSquadLabs, kdpisda.in

---

## 1. PHILOSOPHIE & PROGRESSION

Ne jamais commencer directement par les microservices.

Convention de configuration (obligatoire) :
- Ne jamais définir de valeur par défaut pour une variable d'environnement, ni dans le code Go, ni dans les Dockerfiles.
- Toute variable d'environnement requise doit être fournie explicitement par l'environnement d'exécution, sinon l'application doit échouer au démarrage avec une erreur claire.

Progression recommandée :
1. Monolithe modulaire — packages bien séparés par domaine dans internal/
2. Extraction progressive — quand les besoins de scalabilité divergent
3. Microservices — uniquement quand les Bounded Contexts sont clairs et stables

Anti-patterns à éviter absolument :
- "Distributed Monolith" : services découpés par couche technique (UserService, DatabaseService)
  → crée du couplage réseau sans aucun bénéfice
- Base de données partagée entre services → couplage fort, impossible à évoluer indépendamment
- Appels synchrones en chaîne (A→B→C→D) sans circuit breaker → cascade failure garantie
- Trop de services trop tôt → overhead opérationnel ingérable

---

## 2. DDD — DÉCOUPAGE PAR BOUNDED CONTEXT

Découper par capacité métier, jamais par couche technique.

```
e-commerce/
├── order-service        → commandes, panier, lifecycle de commande
├── inventory-service    → stock, SKU, entrepôt, réservations
├── user-service         → authentification, profil, préférences
├── payment-service      → transactions, remboursements, fraude
└── notification-service → emails, SMS, push notifications
```

Règles DDD Go :
- Chaque service = sa propre base de données (pas de JOIN cross-service)
- Un concept peut avoir des modèles différents selon le service
  (Product en inventory ≠ Product en reviews — modèles distincts, pas partagés)
- Les événements métier guident le découpage :
  OrderPlaced, PaymentFailed, StockUpdated → identifie les frontières naturelles
- Préfère les événements asynchrones aux appels synchrones pour les workflows cross-service

---

## 3. STRUCTURE D'UN SERVICE — ARCHITECTURE HEXAGONALE

```
user-service/
├── cmd/
│   └── api/
│       └── main.go              # Wiring + démarrage + graceful shutdown
├── internal/
│   ├── domain/                  # NOYAU — aucune dépendance externe
│   │   ├── user.go              # Entité User + règles métier
│   │   ├── repository.go        # Interface UserRepository (PORT sortant)
│   │   ├── events.go            # Événements domaine (UserCreated...)
│   │   └── errors.go            # ErrNotFound, ErrEmailTaken...
│   ├── usecase/                 # LOGIQUE MÉTIER — dépend uniquement de domain/
│   │   └── user_service.go      # CreateUser, GetUser, UpdateUser...
│   ├── adapter/
│   │   ├── http/                # ADAPTATEUR entrant REST
│   │   │   ├── handler.go
│   │   │   ├── middleware.go
│   │   │   └── dto.go           # Request/Response structs (pas les entités domain)
│   │   ├── grpc/                # ADAPTATEUR entrant gRPC
│   │   │   └── server.go
│   │   ├── postgres/            # ADAPTATEUR sortant — implémente domain.UserRepository
│   │   │   └── user_repo.go
│   │   └── messaging/           # ADAPTATEUR sortant — publish/subscribe events
│   │       └── nats_publisher.go
│   └── config/
│       └── config.go            # Chargement des env vars
├── api/
│   └── proto/
│       └── user.proto           # Contrat gRPC versionné
├── go.mod
├── go.sum
└── Dockerfile
```

Règle absolue des dépendances :
  domain/ ← usecase/ ← adapter/
  domain/ ne connaît NI gin, NI sql, NI redis, NI grpc

---

## 4. DOMAIN — NOYAU DU SERVICE

```go
// internal/domain/user.go
package domain

import (
    "context"
    "errors"
    "fmt"
    "time"
)

// Erreurs sentinelles — préfixe Err obligatoire
var (
    ErrUserNotFound = errors.New("user not found")
    ErrEmailTaken   = errors.New("email already taken")
    ErrInvalidInput = errors.New("invalid input")
)

// Entité — contient les règles métier, pas de tags json/db ici
type User struct {
    ID        int
    Email     string
    Name      string
    CreatedAt time.Time
}

func (u *User) Validate() error {
    if u.Email == "" {
        return fmt.Errorf("%w: email is required", ErrInvalidInput)
    }
    if u.Name == "" {
        return fmt.Errorf("%w: name is required", ErrInvalidInput)
    }
    return nil
}

// PORT sortant — le domaine définit le contrat, postgres l'implémente
type UserRepository interface {
    FindByID(ctx context.Context, id int) (*User, error)
    FindByEmail(ctx context.Context, email string) (*User, error)
    Save(ctx context.Context, user *User) error
    Delete(ctx context.Context, id int) error
}

// PORT sortant — pour la publication d'événements
type EventPublisher interface {
    Publish(ctx context.Context, event any) error
}

// Événement domaine — immutable, contient toutes les données nécessaires
type UserCreatedEvent struct {
    UserID    int       `json:"user_id"`
    Email     string    `json:"email"`
    OccuredAt time.Time `json:"occurred_at"`
}
```

---

## 5. USE CASE — LOGIQUE MÉTIER

```go
// internal/usecase/user_service.go
package usecase

import (
    "context"
    "errors"
    "fmt"
    "log/slog"
    "time"

    "github.com/org/user-service/internal/domain"
)

type UserService struct {
    repo      domain.UserRepository  // injection par interface
    publisher domain.EventPublisher
    logger    *slog.Logger
}

func NewUserService(
    repo domain.UserRepository,
    publisher domain.EventPublisher,
    logger *slog.Logger,
) *UserService {
    return &UserService{repo: repo, publisher: publisher, logger: logger}
}

func (s *UserService) CreateUser(ctx context.Context, email, name string) (*domain.User, error) {
    // 1. Vérifier unicité de l'email
    _, err := s.repo.FindByEmail(ctx, email)
    if err == nil {
        return nil, domain.ErrEmailTaken
    }
    if !errors.Is(err, domain.ErrUserNotFound) {
        return nil, fmt.Errorf("createUser: check email: %w", err)
    }

    // 2. Créer et valider l'entité
    user := &domain.User{Email: email, Name: name, CreatedAt: time.Now()}
    if err := user.Validate(); err != nil {
        return nil, err
    }

    // 3. Persister
    if err := s.repo.Save(ctx, user); err != nil {
        return nil, fmt.Errorf("createUser: save: %w", err)
    }

    // 4. Publier l'événement domaine
    _ = s.publisher.Publish(ctx, domain.UserCreatedEvent{
        UserID: user.ID, Email: user.Email, OccuredAt: time.Now(),
    })

    s.logger.InfoContext(ctx, "user created", "user_id", user.ID)
    return user, nil
}
```

---

## 6. ADAPTATEUR HTTP

```go
// internal/adapter/http/handler.go
package http

// DTOs séparés des entités domain
type CreateUserRequest struct {
    Name  string `json:"name"  binding:"required"`
    Email string `json:"email" binding:"required,email"`
}

type UserResponse struct {
    ID        int       `json:"id"`
    Email     string    `json:"email"`
    Name      string    `json:"name"`
    CreatedAt time.Time `json:"created_at,omitzero"` // Go 1.24+ omitzero
}

type UserHandler struct {
    svc    *usecase.UserService
    logger *slog.Logger
}

func NewUserHandler(svc *usecase.UserService, logger *slog.Logger) *UserHandler {
    return &UserHandler{svc: svc, logger: logger}
}

func (h *UserHandler) CreateUser(w http.ResponseWriter, r *http.Request) {
    var req CreateUserRequest
    if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
        writeError(w, http.StatusBadRequest, "invalid request body")
        return
    }
    defer r.Body.Close()

    user, err := h.svc.CreateUser(r.Context(), req.Email, req.Name)
    if err != nil {
        switch {
        case errors.Is(err, domain.ErrEmailTaken):
            writeError(w, http.StatusConflict, "email already taken")
        case errors.Is(err, domain.ErrInvalidInput):
            writeError(w, http.StatusBadRequest, err.Error())
        default:
            h.logger.ErrorContext(r.Context(), "createUser failed", "error", err)
            writeError(w, http.StatusInternalServerError, "internal error")
        }
        return
    }

    writeJSON(w, http.StatusCreated, toUserResponse(user))
}

// Routing Go 1.22+ natif avec méthode HTTP
func SetupRoutes(h *UserHandler) *http.ServeMux {
    mux := http.NewServeMux()
    mux.HandleFunc("GET /users/{id}",  h.GetUser)
    mux.HandleFunc("POST /users",      h.CreateUser)
    mux.HandleFunc("DELETE /users/{id}", h.DeleteUser)
    return mux
}

func writeJSON(w http.ResponseWriter, status int, v any) {
    w.Header().Set("Content-Type", "application/json")
    w.WriteHeader(status)
    json.NewEncoder(w).Encode(v)
}

func writeError(w http.ResponseWriter, status int, msg string) {
    writeJSON(w, status, map[string]string{"error": msg})
}
```

---

## 7. ADAPTATEUR gRPC

```protobuf
// api/proto/user.proto
syntax = "proto3";
package user.v1;
option go_package = "github.com/org/user-service/api/proto";

service UserService {
    rpc GetUser(GetUserRequest)       returns (UserResponse);
    rpc CreateUser(CreateUserRequest) returns (UserResponse);
    rpc ListUsers(ListUsersRequest)   returns (stream UserResponse); // streaming
}

message GetUserRequest    { int32 id = 1; }
message CreateUserRequest { string email = 1; string name = 2; }
message ListUsersRequest  {}
message UserResponse      { int32 id = 1; string email = 2; string name = 3; }
```

```bash
# Générer le code Go
protoc --go_out=. --go-grpc_out=. api/proto/user.proto
```

```go
// internal/adapter/grpc/server.go
type grpcServer struct {
    proto.UnimplementedUserServiceServer
    svc    *usecase.UserService
    logger *slog.Logger
}

func (s *grpcServer) GetUser(ctx context.Context, req *proto.GetUserRequest) (*proto.UserResponse, error) {
    user, err := s.svc.GetUser(ctx, int(req.Id))
    if err != nil {
        if errors.Is(err, domain.ErrUserNotFound) {
            return nil, status.Error(codes.NotFound, "user not found")
        }
        s.logger.ErrorContext(ctx, "getUser failed", "error", err)
        return nil, status.Error(codes.Internal, "internal error")
    }
    return &proto.UserResponse{Id: int32(user.ID), Email: user.Email, Name: user.Name}, nil
}

// Middleware gRPC : logging + recovery + tracing
func grpcMiddleware(logger *slog.Logger) []grpc.ServerOption {
    return []grpc.ServerOption{
        grpc.ChainUnaryInterceptor(
            otelgrpc.UnaryServerInterceptor(),       // tracing OpenTelemetry
            grpclogging.UnaryServerInterceptor(),    // logging structuré
            grpcrecovery.UnaryServerInterceptor(),   // recover panics
        ),
    }
}
```

---

## 8. COMMUNICATION ASYNCHRONE (EVENTS)

```go
// Règles pour les événements :
// 1. Immutables — jamais de modification après publication
// 2. Auto-suffisants — contiennent toutes les données nécessaires
// 3. Versionnés — UserCreatedV1, UserCreatedV2
// 4. Jamais de callback vers le service émetteur

// Publier avec NATS
type NATSPublisher struct {
    conn *nats.Conn
}

func (p *NATSPublisher) Publish(ctx context.Context, event any) error {
    subject := eventSubject(event)  // ex: "user.created"
    data, err := json.Marshal(event)
    if err != nil {
        return fmt.Errorf("publish marshal: %w", err)
    }
    msg := &nats.Msg{
        Subject: subject,
        Data:    data,
        Header:  nats.Header{},
    }
    // Propager le trace context dans les headers
    otel.GetTextMapPropagator().Inject(ctx, propagation.HeaderCarrier(msg.Header))
    return p.conn.PublishMsg(msg)
}

// Consommer avec NATS JetStream (at-least-once delivery)
func (c *NATSConsumer) Subscribe(subject string, handler func(ctx context.Context, data []byte) error) error {
    _, err := c.js.Subscribe(subject, func(msg *nats.Msg) {
        // Extraire le trace context
        ctx := otel.GetTextMapPropagator().Extract(
            context.Background(),
            propagation.HeaderCarrier(msg.Header),
        )
        if err := handler(ctx, msg.Data); err != nil {
            slog.ErrorContext(ctx, "event handler failed", "error", err, "subject", subject)
            msg.Nak()  // redelivery
            return
        }
        msg.Ack()
    }, nats.Durable("user-service"))
    return err
}
```

Choix du broker :
- NATS JetStream : ultra léger, at-least-once, idéal Go-native
- Kafka : event streaming haute volumétrie, replay, audit log
- RabbitMQ : routing complexe, dead letter queues intégrées

---

## 9. API GATEWAY

```
Client (HTTP/HTTPS)
        │
        ▼
  API Gateway ←── JWT/OAuth2 validation
        │      ←── Rate Limiting (par IP, par user)
        │      ←── SSL Termination
        │      ←── Correlation ID injection
        │      ←── Request logging
        │
        ├──gRPC──→ user-service
        ├──gRPC──→ order-service
        └──gRPC──→ payment-service
```

```go
// Gateway middleware : injection Correlation ID
func correlationIDMiddleware(next http.Handler) http.Handler {
    return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
        id := r.Header.Get("X-Correlation-ID")
        if id == "" {
            id = uuid.New().String()
        }
        ctx := context.WithValue(r.Context(), correlationIDKey, id)
        w.Header().Set("X-Correlation-ID", id)
        next.ServeHTTP(w, r.WithContext(ctx))
    })
}

// Rate limiter avec token bucket
func rateLimitMiddleware(limiter *rate.Limiter) func(http.Handler) http.Handler {
    return func(next http.Handler) http.Handler {
        return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
            if !limiter.Allow() {
                http.Error(w, "too many requests", http.StatusTooManyRequests)
                return
            }
            next.ServeHTTP(w, r)
        })
    }
}
```

Options gateway :
- Traefik : cloud-native, auto-découverte Kubernetes, config déclarative
- Kong : feature-rich, ecosystem de plugins
- Custom net/http : pour les cas simples, stdlib suffisante

---

## 10. RÉSILIENCE

### Circuit Breaker
```go
import "github.com/sony/gobreaker/v2"

cb := gobreaker.NewCircuitBreaker[*UserResponse](gobreaker.Settings{
    Name:        "user-service",
    MaxRequests: 3,                 // requêtes autorisées en Half-Open
    Interval:    60 * time.Second,  // reset compteurs
    Timeout:     10 * time.Second,  // durée état Open
    ReadyToTrip: func(counts gobreaker.Counts) bool {
        failureRatio := float64(counts.TotalFailures) / float64(counts.Requests)
        return counts.Requests >= 5 && failureRatio >= 0.6
    },
    OnStateChange: func(name string, from, to gobreaker.State) {
        slog.Warn("circuit breaker state changed",
            "service", name, "from", from.String(), "to", to.String())
    },
})

// Usage
result, err := cb.Execute(func() (*UserResponse, error) {
    return userClient.GetUser(ctx, req)
})
```

États : Closed (normal) → Open (rejette tout) → Half-Open (test de récupération)

### Retry avec backoff exponentiel
```go
func withRetry(ctx context.Context, maxAttempts int, fn func() error) error {
    var lastErr error
    for attempt := range maxAttempts {
        if err := fn(); err == nil {
            return nil
        } else {
            lastErr = err
        }
        wait := time.Duration(100*math.Pow(2, float64(attempt))) * time.Millisecond
        select {
        case <-time.After(wait):   // 100ms, 200ms, 400ms, 800ms...
        case <-ctx.Done():
            return ctx.Err()
        }
    }
    return fmt.Errorf("after %d attempts: %w", maxAttempts, lastErr)
}
```

Ne jamais retry sans circuit breaker : les deux sont complémentaires.

---

## 11. OBSERVABILITÉ

### Logs structurés (log/slog — Go 1.21+)
```go
// Setup en main.go
logger := slog.New(slog.NewJSONHandler(os.Stdout, &slog.HandlerOptions{
    Level: slog.LevelInfo,
}))
slog.SetDefault(logger)

// Middleware HTTP logging
func loggingMiddleware(next http.Handler) http.Handler {
    return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
        start := time.Now()
        ww := &wrappedWriter{ResponseWriter: w, status: 200}
        next.ServeHTTP(ww, r)
        slog.InfoContext(r.Context(), "http request",
            "method",         r.Method,
            "path",           r.URL.Path,
            "status",         ww.status,
            "duration_ms",    time.Since(start).Milliseconds(),
            "correlation_id", r.Header.Get("X-Correlation-ID"),
        )
    })
}
```

### Métriques (Prometheus)
```go
import (
    "github.com/prometheus/client_golang/prometheus"
    "github.com/prometheus/client_golang/prometheus/promhttp"
)

var (
    httpRequestDuration = prometheus.NewHistogramVec(
        prometheus.HistogramOpts{
            Name:    "http_request_duration_seconds",
            Buckets: prometheus.DefBuckets,
        },
        []string{"method", "path", "status"},
    )
    activeConnections = prometheus.NewGauge(prometheus.GaugeOpts{
        Name: "http_active_connections",
    })
)

func init() {
    prometheus.MustRegister(httpRequestDuration, activeConnections)
}

// Exposer
mux.Handle("GET /metrics", promhttp.Handler())
```

### Tracing distribué (OpenTelemetry)
```go
import (
    "go.opentelemetry.io/otel"
    "go.opentelemetry.io/otel/propagation"
    "go.opentelemetry.io/otel/attribute"
)

// Initialiser le tracer provider en main.go
func initTracer(serviceName, collectorAddr string) func() {
    exporter, _ := otlptracegrpc.New(ctx,
        otlptracegrpc.WithEndpoint(collectorAddr),
        otlptracegrpc.WithInsecure(),
    )
    tp := tracesdk.NewTracerProvider(
        tracesdk.WithBatcher(exporter),
        tracesdk.WithResource(resource.NewWithAttributes(
            semconv.SchemaURL,
            semconv.ServiceNameKey.String(serviceName),
        )),
    )
    otel.SetTracerProvider(tp)
    otel.SetTextMapPropagator(propagation.TraceContext{})
    return func() { tp.Shutdown(context.Background()) }
}

// Usage dans un use case
func (s *UserService) GetUser(ctx context.Context, id int) (*domain.User, error) {
    ctx, span := otel.Tracer("user-service").Start(ctx, "UserService.GetUser")
    defer span.End()
    span.SetAttributes(attribute.Int("user.id", id))

    user, err := s.repo.FindByID(ctx, id)
    if err != nil {
        span.RecordError(err)
        return nil, err
    }
    return user, nil
}
```

Stack recommandée :
- Prometheus + Grafana   : métriques et dashboards
- Jaeger ou Tempo        : tracing distribué
- Loki                   : agrégation de logs
- OpenTelemetry Collector: pipeline unifié (logs + metrics + traces)

---

## 12. HEALTH CHECKS

```go
// 3 endpoints distincts pour Kubernetes
// GET /health/live    → le service tourne-t-il ? (liveness probe)
// GET /health/ready   → peut-il recevoir du trafic ? (readiness probe)
// GET /health/startup → a-t-il fini de démarrer ? (startup probe)

func (h *HealthHandler) Readiness(w http.ResponseWriter, r *http.Request) {
    ctx, cancel := context.WithTimeout(r.Context(), 2*time.Second)
    defer cancel()

    checks := map[string]string{}
    httpStatus := http.StatusOK

    // Vérifier DB
    if err := h.db.PingContext(ctx); err != nil {
        checks["database"] = "unhealthy: " + err.Error()
        httpStatus = http.StatusServiceUnavailable
    } else {
        checks["database"] = "healthy"
    }

    // Vérifier Redis/Cache
    if err := h.redis.Ping(ctx).Err(); err != nil {
        checks["cache"] = "unhealthy: " + err.Error()
        httpStatus = http.StatusServiceUnavailable
    } else {
        checks["cache"] = "healthy"
    }

    w.Header().Set("Content-Type", "application/json")
    w.WriteHeader(httpStatus)
    json.NewEncoder(w).Encode(map[string]any{
        "status": checks,
        "time":   time.Now().UTC(),
    })
}
```

---

## 13. GRACEFUL SHUTDOWN

```go
func main() {
    // ... setup ...

    srv := &http.Server{
        Addr:         ":" + cfg.Port,
        Handler:      setupRoutes(),
        ReadTimeout:  5 * time.Second,
        WriteTimeout: 10 * time.Second,
        IdleTimeout:  120 * time.Second,
    }

    // Démarrer en goroutine
    go func() {
        slog.Info("server starting", "addr", srv.Addr)
        if err := srv.ListenAndServe(); err != nil && !errors.Is(err, http.ErrServerClosed) {
            slog.Error("server error", "error", err)
            os.Exit(1)
        }
    }()

    // Attendre SIGTERM (Kubernetes) ou SIGINT (Ctrl+C)
    quit := make(chan os.Signal, 1)
    signal.Notify(quit, syscall.SIGINT, syscall.SIGTERM)
    sig := <-quit
    slog.Info("shutdown signal received", "signal", sig)

    // 30s pour terminer les requêtes en cours
    ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
    defer cancel()

    if err := srv.Shutdown(ctx); err != nil {
        slog.Error("forced shutdown", "error", err)
    }

    // Cleanup des ressources dans l'ordre inverse de l'init
    natsConn.Drain()  // vider la queue NATS avant fermeture
    db.Close()
    shutdownTracer()  // flush les spans OpenTelemetry

    slog.Info("server exited cleanly")
}
```

---

## 14. CONFIGURATION

```go
// internal/config/config.go
// Utiliser : github.com/caarlos0/env/v11

type Config struct {
    // Serveur
    Port         string `env:"PORT"          envDefault:"8080"`
    LogLevel     string `env:"LOG_LEVEL"     envDefault:"info"`
    Environment  string `env:"ENVIRONMENT"   envDefault:"production"`

    // Base de données
    DatabaseURL  string `env:"DATABASE_URL"  required:"true"`
    DBMaxConns   int    `env:"DB_MAX_CONNS"  envDefault:"25"`
    DBMaxIdle    int    `env:"DB_MAX_IDLE"   envDefault:"5"`

    // Services internes (adresses gRPC)
    OrderServiceAddr string `env:"ORDER_SERVICE_ADDR" required:"true"`
    NATSAddr         string `env:"NATS_ADDR"           required:"true"`

    // Observabilité
    OTELEndpoint    string `env:"OTEL_ENDPOINT"    envDefault:""`
    PrometheusPort  string `env:"PROMETHEUS_PORT"  envDefault:"9090"`

    // Sécurité — ne JAMAIS logger ces valeurs
    JWTSecret       string `env:"JWT_SECRET"    required:"true"`
    DBPassword      string `env:"DB_PASSWORD"   required:"true"`
}

func Load() (*Config, error) {
    cfg := &Config{}
    if err := env.Parse(cfg); err != nil {
        return nil, fmt.Errorf("config: %w", err)
    }
    return cfg, nil
}
```

Règles :
- Toutes les configs via variables d'environnement (12-factor app)
- Valider au démarrage — fail fast si une variable requise manque
- Jamais de secrets dans le code ou les fichiers de config commités
- Jamais logger les valeurs de secrets

---

## 15. DOCKERFILE MULTI-STAGE

```dockerfile
# Stage 1 : Build
FROM golang:1.26-alpine AS builder
WORKDIR /app

# Dépendances en premier (cache Docker optimisé)
COPY go.mod go.sum ./
RUN go mod download

COPY . .

# Binaire statique optimisé
RUN CGO_ENABLED=0 GOOS=linux GOARCH=amd64 \
    go build \
    -ldflags="-s -w -X main.version=${VERSION} -X main.buildTime=${BUILD_TIME}" \
    -o /bin/api ./cmd/api/

# Stage 2 : Image minimale
FROM scratch
# Certificats TLS pour les appels HTTPS sortants
COPY --from=builder /etc/ssl/certs/ca-certificates.crt /etc/ssl/certs/
# Timezone data (si besoin)
COPY --from=builder /usr/share/zoneinfo /usr/share/zoneinfo
COPY --from=builder /bin/api /api

EXPOSE 8080 9090
ENTRYPOINT ["/api"]
```

Résultat : image finale ~15MB contre ~800MB pour une image Node.js classique.

---

## 16. KUBERNETES MANIFEST

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: user-service
  labels:
    app: user-service
    version: v1.2.3
spec:
  replicas: 3
  selector:
    matchLabels:
      app: user-service
  strategy:
    type: RollingUpdate
    rollingUpdate:
      maxSurge: 1
      maxUnavailable: 0          # zéro downtime
  template:
    metadata:
      labels:
        app: user-service
        version: v1.2.3
      annotations:
        prometheus.io/scrape: "true"
        prometheus.io/port: "9090"
    spec:
      terminationGracePeriodSeconds: 35   # > 30s du graceful shutdown
      containers:
      - name: user-service
        image: org/user-service:v1.2.3    # jamais de tag "latest" en prod
        ports:
        - containerPort: 8080
          name: http
        - containerPort: 9090
          name: metrics
        env:
        - name: DATABASE_URL
          valueFrom:
            secretKeyRef:
              name: user-service-secrets
              key: database-url
        - name: PORT
          value: "8080"
        resources:
          requests:
            memory: "64Mi"
            cpu: "100m"
          limits:
            memory: "256Mi"
            cpu: "500m"
        livenessProbe:
          httpGet:
            path: /health/live
            port: 8080
          initialDelaySeconds: 10
          periodSeconds: 10
          failureThreshold: 3
        readinessProbe:
          httpGet:
            path: /health/ready
            port: 8080
          initialDelaySeconds: 5
          periodSeconds: 5
          failureThreshold: 3
        startupProbe:
          httpGet:
            path: /health/startup
            port: 8080
          failureThreshold: 30
          periodSeconds: 2
```

---

## 17. WIRING — MAIN.GO

```go
// cmd/api/main.go
func main() {
    // 1. Config
    cfg, err := config.Load()
    if err != nil {
        slog.Error("config error", "error", err)
        os.Exit(1)
    }

    // 2. Logger
    level := slog.LevelInfo
    logger := slog.New(slog.NewJSONHandler(os.Stdout, &slog.HandlerOptions{Level: level}))
    slog.SetDefault(logger)

    // 3. Tracing
    shutdownTracer := initTracer("user-service", cfg.OTELEndpoint)
    defer shutdownTracer()

    // 4. Infrastructure
    db, err := postgres.Connect(cfg.DatabaseURL, cfg.DBMaxConns)
    if err != nil {
        slog.Error("db connect failed", "error", err)
        os.Exit(1)
    }

    natsConn, err := nats.Connect(cfg.NATSAddr)
    if err != nil {
        slog.Error("nats connect failed", "error", err)
        os.Exit(1)
    }

    // 5. Layers (dependency injection manuelle — pas de framework DI)
    userRepo      := postgres.NewUserRepository(db)
    eventPublisher := messaging.NewNATSPublisher(natsConn)
    userService   := usecase.NewUserService(userRepo, eventPublisher, logger)
    userHandler   := httpAdapter.NewUserHandler(userService, logger)
    healthHandler := httpAdapter.NewHealthHandler(db, natsConn)

    // 6. Routing
    mux := http.NewServeMux()
    httpAdapter.SetupRoutes(mux, userHandler, healthHandler)
    mux.Handle("GET /metrics", promhttp.Handler())

    // 7. Middlewares
    handler := correlationIDMiddleware(
        loggingMiddleware(
            rateLimitMiddleware(rate.NewLimiter(1000, 100))(mux),
        ),
    )

    // 8. Serveur + graceful shutdown
    runServer(handler, cfg.Port)
}
```

---

## 18. BEST PRACTICES — SYNTHÈSE MICROSERVICES

### Architecture
- Un service = un domaine métier = une base de données
- Architecture hexagonale dans chaque service — domain/ sans dépendances externes
- DTOs séparés des entités domain pour les adaptateurs HTTP/gRPC
- Jamais de base de données partagée entre services
- Jamais d'appels synchrones en chaîne sans circuit breaker

### Communication
- gRPC pour les appels synchrones inter-services (performances + contrats forts)
- REST/JSON pour les APIs exposées aux clients externes
- Événements asynchrones pour les workflows cross-service
- Événements : immutables, auto-suffisants, versionnés

### Résilience
- Circuit Breaker sur chaque appel sortant (github.com/sony/gobreaker/v2)
- Retry avec backoff exponentiel + jitter
- Context.WithTimeout sur TOUTES les opérations I/O
- Graceful shutdown avec terminationGracePeriodSeconds > timeout applicatif

### Observabilité (les 3 piliers)
- Logs : log/slog JSON + correlation ID dans chaque log
- Métriques : Prometheus avec histograms pour les latences
- Traces : OpenTelemetry propagé sur tous les appels HTTP et gRPC

### Déploiement
- Docker multi-stage → binaire statique ~15MB (FROM scratch)
- Image taguée avec version sémantique — jamais "latest" en prod
- 3 health checks Kubernetes : liveness, readiness, startup
- Secrets via variables d'environnement + Kubernetes Secrets
- Resources requests/limits obligatoires dans les manifests K8s

---

## 19. LIBRAIRIES RECOMMANDÉES

| Besoin                  | Librairie                                  | Version |
|-------------------------|--------------------------------------------|---------|
| HTTP framework léger    | net/http (stdlib) ou gin-gonic/gin         | stdlib / v1 |
| gRPC                    | google.golang.org/grpc                     | v1.68+ |
| Protobuf                | google.golang.org/protobuf                 | v1.35+ |
| Message broker          | nats-io/nats.go                            | v1.37+ |
| Circuit breaker         | sony/gobreaker/v2                          | v2 |
| Errgroup                | golang.org/x/sync/errgroup                 | latest |
| Config env              | caarlos0/env/v11                           | v11 |
| UUID                    | google/uuid                                | v1 |
| Tracing                 | go.opentelemetry.io/otel                   | v1.32+ |
| Métriques               | prometheus/client_golang                   | v1.20+ |
| Tests assertions        | testify/assert + testify/require           | v1.9+ |
| DB SQL                  | jackc/pgx/v5 (postgres) ou database/sql    | v5 |
| Rate limiting           | golang.org/x/time/rate                     | latest |
---

## 20. RESSOURCES

- Effective Go : https://go.dev/doc/effective_go
- Go Blog (2025-2026) : https://go.dev/blog
- gRPC Go : https://grpc.io/docs/languages/go/
- OpenTelemetry Go : https://opentelemetry.io/docs/languages/go/
- go-zero framework : https://github.com/zeromicro/go-zero
- Wild Workouts DDD Example : https://github.com/ThreeDotsLabs/wild-workouts-go-ddd-example
- Awesome Go : https://github.com/avelino/awesome-go
- Go Concurrency Patterns : https://go.dev/talks/2012/concurrency.slide
- Pipelines & Cancellation : https://go.dev/blog/pipelines
