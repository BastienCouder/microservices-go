# Backend Service Template

Template de depart pour un nouveau service backend Go dans ce monorepo.

Cas cible:

- service HTTP
- auth interne via `internalauth`
- config via `envcfg`
- bootstrap via `serviceboot`
- persistence PostgreSQL

## Placeholders a remplacer

- `__SERVICE_SLUG__`: nom dossier / nom logique du service
- `__SERVICE_NAME__`: audience / nom d'affichage du service
- `__DB_PREFIX__`: prefixe des variables DB
- `__RESOURCE_NAME__`: ressource principale exposee par le service

Exemple:

- `__SERVICE_SLUG__` -> `reports-service`
- `__SERVICE_NAME__` -> `reports-service`
- `__DB_PREFIX__` -> `REPORTS`
- `__RESOURCE_NAME__` -> `reports`

## Fichiers inclus

- `go.mod.tmpl`
- `cmd/api/main.go.tmpl`
- `internal/config/config.go.tmpl`
- `internal/adapter/http/handler.go.tmpl`
- `internal/adapter/http/handler_test.go.tmpl`
- `internal/domain/errors.go.tmpl`
- `internal/usecase/service.go.tmpl`

## Usage recommande

1. Copier ce dossier vers `services/<nouveau-service>`.
2. Renommer les fichiers `*.tmpl`.
3. Remplacer les placeholders.
4. Brancher le repository concret.
5. Ajouter les tests usecase/repository.
6. Ajouter le service au `docker-compose` et aux pipelines si necessaire.

## Regles a garder

- pas de logique metier lourde dans `adapter/http`
- pas de defaults silencieux dans `config`
- pas de comparaison sur `err.Error()`
- bootstrap commun via `contracts/pkg/serviceboot`
- erreurs HTTP via `contracts/pkg/httpjson`
