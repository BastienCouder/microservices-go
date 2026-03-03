# Production overlay

## Apply

```bash
kubectl apply -k deployments/k8s/apps/overlays/prod
```

## Migration sequencing

Run in this order:

1. `kubectl -n msgo-infra apply -k deployments/k8s/infra/bootstrap`
2. `kubectl -n msgo-apps apply -f deployments/k8s/apps/overlays/prod/migrations-jobs.yaml`

## Dry-run validation

```bash
kubectl kustomize deployments/k8s/apps/overlays/prod | kubectl apply --dry-run=server -f -
```

## DNS Cloudflare

Cette overlay inclut des annotations `external-dns` sur l’Ingress.
Avant apply, remplacer les hosts `*.example.com` par vos domaines.
