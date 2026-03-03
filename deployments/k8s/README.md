# Kubernetes deployment layout (prod)

This directory contains production-oriented Kubernetes assets for `microservices-go`:

- `infra/helm`: Helm values and install scripts for cluster add-ons and stateful infrastructure.
- `infra/bootstrap`: one-shot bootstrap for PostgreSQL roles/databases.
- `apps/base`: base manifests for app workloads.
- `apps/overlays/prod`: production overlay (Ingress, secrets generators, jobs, policies).

## Deployment order

1. `kubectl apply -f deployments/k8s/apps/base/namespaces.yaml`
2. `deployments/k8s/infra/helm/install-infra.sh`
3. `kubectl apply -f deployments/k8s/infra/helm/cert-manager/cluster-issuer.yaml`
4. `kubectl apply -k deployments/k8s/infra/bootstrap`
5. `kubectl apply -f deployments/k8s/apps/overlays/prod/migrations-jobs.yaml`
6. `kubectl apply -k deployments/k8s/apps/overlays/prod`
7. `deployments/k8s/infra/helm/install-observability.sh`

## Secrets

Populate local files in `deployments/k8s/apps/overlays/prod/secrets/` before rendering/applying the overlay.

Required files:

- `postgres_superuser_password`
- `usersvc_db_password`
- `orgsvc_db_password`
- `permsvc_db_password`
- `billsvc_db_password`
- `notifsvc_db_password`
- `kratos_db_password`
- `google_oidc_client_id`
- `google_oidc_client_secret`
- `resend_api_key`
- `resend_smtp_connection_uri`
- `internal_jwt_secret`
- `kratos_cookie_secret`
- `kratos_cipher_secret`
- `rabbitmq_password`
- `redis_password`
- `cloudflare_api_token`

Do not commit these files.
