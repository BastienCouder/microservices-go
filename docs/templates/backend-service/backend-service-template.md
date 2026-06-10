# Backend Service Template Guide

Ce guide explique comment utiliser le template de service backend.

Template source:

- [templates/backend-service](../templates/backend-service)

Reference architecture:

- [docs/backend-standard.md](./backend-standard.md)

## Quand utiliser ce template

Utilise ce template quand tu crées:

- un nouveau microservice HTTP
- un service interne protege par JWT interne
- un service avec PostgreSQL

Ne l'utilise pas tel quel pour:

- un gateway/BFF
- un worker sans API HTTP
- un service gRPC-first

## Etapes

### 1. Copier le template

```bash
mkdir -p services/my-service
cp -R templates/backend-service/. services/my-service/
```

### 2. Renommer les fichiers

```bash
find services/my-service -name '*.tmpl'
```

Puis retirer le suffixe `.tmpl`.

### 3. Remplacer les placeholders

Remplace:

- `__SERVICE_SLUG__`
- `__SERVICE_NAME__`
- `__DB_PREFIX__`
- `__RESOURCE_NAME__`

Exemple:

- `__SERVICE_SLUG__` -> `reports-service`
- `__SERVICE_NAME__` -> `reports-service`
- `__DB_PREFIX__` -> `REPORTS`
- `__RESOURCE_NAME__` -> `reports`

### 4. Completer le usecase

Point de depart:

- [templates/backend-service/internal/usecase/service.go.tmpl](../templates/backend-service/internal/usecase/service.go.tmpl)

A faire:

- remplacer le faux stockage en memoire
- introduire les interfaces de repository
- ajouter les invariants metier

### 5. Completer l'adapter HTTP

Point de depart:

- [templates/backend-service/internal/adapter/http/handler.go.tmpl](../templates/backend-service/internal/adapter/http/handler.go.tmpl)

A faire:

- ajouter les endpoints reels
- mapper les erreurs usecase
- garder les handlers minces

### 6. Completer la config

Point de depart:

- [templates/backend-service/internal/config/config.go.tmpl](../templates/backend-service/internal/config/config.go.tmpl)

A faire:

- ajuster les noms de variables d'env
- ajouter les options specifiques au service
- ne jamais mettre de default cache pour une variable obligatoire

### 7. Completer le bootstrap

Point de depart:

- [templates/backend-service/cmd/api/main.go.tmpl](../templates/backend-service/cmd/api/main.go.tmpl)

A faire:

- brancher le vrai repository
- brancher RabbitMQ si necessaire
- brancher gRPC si necessaire

## Check rapide avant merge

- `config.Load()` echoue clairement si une variable obligatoire manque
- `main.go` utilise `serviceboot`
- les erreurs HTTP passent par `httpjson`
- pas de metier lourd dans les handlers
- pas de `err.Error()` utilise comme contrat
- auth interne via `internalauth`
- tests minimes sur `/health` et les routes critiques

## Variantes

### Service avec orchestration multi-services

Si le service expose une orchestration complexe:

- garder `adapter/http` mince
- creer une couche `internal/app/<feature>` si l'orchestration est distincte du metier principal

### Service avec gRPC

Ajouter:

- `internal/adapter/grpc`
- wiring TLS/ interceptor via `grpctls` et `internalauth`

### Worker sans HTTP

Ne pas partir de ce template. Creer un template dedie worker plus minimal.
