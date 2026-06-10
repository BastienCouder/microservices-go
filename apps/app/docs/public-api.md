# Public API avec API key

Cette page documente la surface publique `/v1` exposee par `api-gateway` pour les clients backend qui appellent le produit avec une API key d'organisation.

Le but de cette doc est de decrire la surface stable et supportee. Certaines routes `/v1/projects/*` sont actuellement proxifiees par le gateway mais ne font pas encore partie du contrat public a long terme. Elles ne sont donc pas toutes documentees ici.

## Authentification

Toutes les requetes publiques passent par:

```http
Authorization: Bearer <API_KEY>
```

Points importants:

- L'API key est une API key d'organisation.
- La cle resolve automatiquement `organization_id`.
- Les routes `/v1/*` n'utilisent pas de session navigateur, de cookie ou de session Kratos.
- L'acces est refuse si le plan de l'organisation n'est pas autorise ou si l'abonnement n'est pas actif.

## Base URL

En local:

```text
http://localhost:50000
```

Exemple:

```bash
curl http://localhost:50000/v1/me \
  -H "Authorization: Bearer $API_KEY"
```

## Formats de reponse

La surface publique actuelle n'est pas encore completement unifiee:

- Les endpoints directs du gateway comme `/v1/me`, `/v1/usage`, `/v1/billing/entitlements` et `/v1/agent-ready/scans` renvoient du JSON brut.
- Les endpoints proxifies vers `project-service` et `analysis-service` renvoient en general:

```json
{
  "success": true,
  "data": {}
}
```

- Les endpoints `/v1/api-keys` renvoient des objets ou tableaux JSON bruts depuis `organizations-service`.

## Endpoints supportes avec API key seule

### 1. Identite et plan

| Methode | Route | Description |
| --- | --- | --- |
| `GET` | `/v1/me` | Retourne l'organisation resolue, la metadata de la cle et les entitlements. |
| `GET` | `/v1/usage` | Retourne les entitlements et le statut billing de l'organisation. |
| `GET` | `/v1/billing/entitlements` | Meme charge utile que `/v1/usage`. |

Exemple:

```bash
curl http://localhost:50000/v1/me \
  -H "Authorization: Bearer $API_KEY"
```

Exemple de reponse:

```json
{
  "organization_id": 7,
  "api_key": {
    "id": 11,
    "name": "Production",
    "prefix": "org_test"
  },
  "entitlements": {
    "organization_id": 7,
    "plan": "developer",
    "subscription_status": "active",
    "is_paid": true
  }
}
```

### 2. Gestion des API keys

Ces routes sont supportees aujourd'hui:

| Methode | Route | Description |
| --- | --- | --- |
| `GET` | `/v1/api-keys` | Liste les API keys de l'organisation. |
| `POST` | `/v1/api-keys` | Cree une nouvelle API key. Le secret brut n'est retourne qu'une seule fois. |
| `DELETE` | `/v1/api-keys/{apiKeyId}` | Revoque une API key. |

Routes non disponibles aujourd'hui:

- `GET /v1/api-keys/{apiKeyId}` n'est pas implemente.
- `PATCH /v1/api-keys/{apiKeyId}` n'est pas implemente.

Creer une API key:

```bash
curl -X POST http://localhost:50000/v1/api-keys \
  -H "Authorization: Bearer $API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Automation"
  }'
```

Exemple de reponse:

```json
{
  "id": 21,
  "organizationId": 7,
  "name": "Automation",
  "prefix": "org_live",
  "key": "org_live_xxxxxxxxxxxxxxxxx",
  "createdAt": "2026-06-01T10:00:00Z"
}
```

Lister les API keys:

```bash
curl http://localhost:50000/v1/api-keys \
  -H "Authorization: Bearer $API_KEY"
```

Exemple de reponse:

```json
[
  {
    "id": 11,
    "organizationId": 7,
    "name": "Production",
    "prefix": "org_live",
    "createdAt": "2026-06-01T09:00:00Z",
    "lastUsedAt": "2026-06-01T09:42:00Z"
  }
]
```

### 3. Projets, prompts, concurrents et modeles

Ces endpoints sont utilisables avec l'API key seule car ils ne dependent que du scope organisation/projet:

| Methode | Route | Description |
| --- | --- | --- |
| `GET` | `/v1/projects` | Liste les projets de l'organisation. |
| `GET` | `/v1/projects/{projectId}` | Charge un projet. |
| `PATCH` | `/v1/projects/{projectId}` | Met a jour un projet. |
| `DELETE` | `/v1/projects/{projectId}` | Supprime un projet. |
| `GET` | `/v1/projects/{projectId}/models` | Liste les modeles affectes au projet. |
| `PATCH` | `/v1/projects/{projectId}/models` | Remplace la selection de modeles. |
| `GET` | `/v1/projects/{projectId}/prompts` | Liste les prompts. |
| `POST` | `/v1/projects/{projectId}/prompts` | Ajoute des prompts. |
| `POST` | `/v1/projects/{projectId}/prompts/generate` | Genere des prompts de monitoring. |
| `PATCH` | `/v1/prompts/{promptId}` | Met a jour un prompt. |
| `DELETE` | `/v1/prompts/{promptId}` | Supprime un prompt. |
| `GET` | `/v1/projects/{projectId}/competitors` | Liste les concurrents. |
| `POST` | `/v1/projects/{projectId}/competitors` | Ajoute des concurrents. |
| `PATCH` | `/v1/competitors/{competitorId}` | Met a jour un concurrent. |
| `DELETE` | `/v1/competitors/{competitorId}` | Supprime un concurrent. |

Exemple:

```bash
curl http://localhost:50000/v1/projects \
  -H "Authorization: Bearer $API_KEY"
```

Exemple de reponse:

```json
{
  "success": true,
  "data": []
}
```

### 4. Lecture analytics et contenus

Ces endpoints sont egalement compatibles avec une simple API key:

| Methode | Route | Description |
| --- | --- | --- |
| `GET` | `/v1/projects/{projectId}/analysis/runs` | Liste les runs d'analyse d'un projet. |
| `GET` | `/v1/analysis/runs/{runId}` | Charge le detail d'un run. |
| `GET` | `/v1/projects/{projectId}/analysis/quota` | Retourne l'usage quota des prompts. |
| `GET` | `/v1/projects/{projectId}/analytics/summary` | Retourne le dashboard analytics du projet. |
| `GET` | `/v1/projects/{projectId}/perception` | Retourne la perception de marque. |
| `GET` | `/v1/projects/{projectId}/brand-canon` | Retourne le brand canon. |
| `PATCH` | `/v1/projects/{projectId}/brand-canon` | Met a jour le brand canon. |
| `GET` | `/v1/projects/{projectId}/optimization-errors` | Retourne le board d'erreurs d'optimisation. |
| `GET` | `/v1/projects/{projectId}/optimize-actions` | Liste les actions d'optimisation. |
| `POST` | `/v1/projects/{projectId}/optimize-actions` | Cree une action d'optimisation. |
| `PATCH` | `/v1/projects/{projectId}/optimize-actions/{actionId}` | Met a jour le statut d'une action. |
| `DELETE` | `/v1/projects/{projectId}/optimize-actions/{actionId}` | Supprime une action. |
| `POST` | `/v1/projects/{projectId}/content/crawls` | Demarre un crawl content optimizer. |
| `GET` | `/v1/projects/{projectId}/content/crawls` | Retourne le dernier crawl. |
| `GET` | `/v1/projects/{projectId}/content/crawls/latest` | Alias du dernier crawl. |
| `GET` | `/v1/projects/{projectId}/content/crawls/{crawlId}` | Charge un crawl par identifiant. |
| `POST` | `/v1/projects/{projectId}/content/analyze` | Lance une analyse sur des records de crawl. |

### 5. Agent Ready scans

Ces endpoints sont geres directement par `api-gateway`.

| Methode | Route | Description |
| --- | --- | --- |
| `POST` | `/v1/agent-ready/scans` | Demarre un scan asynchrone. |
| `GET` | `/v1/agent-ready/scans` | Liste les scans, avec filtres simples. |
| `GET` | `/v1/agent-ready/scans/{scanId}` | Recupere le resultat d'un scan. |

Creer un scan:

```bash
curl -X POST http://localhost:50000/v1/agent-ready/scans \
  -H "Authorization: Bearer $API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "url": "https://example.com",
    "mode": "content-site",
    "checks": ["robots_txt", "sitemap", "markdown_negotiation"]
  }'
```

Exemple de reponse:

```json
{
  "scan_id": "7ff6c8f1a9d042fa94d0c44f1f0b4a76",
  "status": "queued",
  "url": "/v1/agent-ready/scans/7ff6c8f1a9d042fa94d0c44f1f0b4a76"
}
```

Lister les scans:

```bash
curl "http://localhost:50000/v1/agent-ready/scans?status=done&url=https://example.com" \
  -H "Authorization: Bearer $API_KEY"
```

Payload de creation:

| Champ | Type | Requis | Notes |
| --- | --- | --- | --- |
| `url` | `string` | Oui | URL absolue en `http` ou `https`. |
| `mode` | `string` | Non | Valeur supportee: `content-site`. Defaut: `content-site`. |
| `checks` | `string[]` | Non | Defaut: tous les checks supportes. |

Checks supportes actuellement:

- `robots_txt`
- `sitemap`
- `link_headers`
- `markdown_negotiation`
- `ai_bot_rules`
- `content_signals`

Filtres de listing supportes actuellement:

- `status`
- `url`

## Routes exposees mais non encore compatibles avec API key seule

Les routes suivantes sont routees sous `/v1`, mais le backend attend encore une `user identity`. Avec une simple API key, elles retournent actuellement `401`.

| Methode | Route | Raison actuelle |
| --- | --- | --- |
| `POST` | `/v1/projects` | `project-service` exige `authenticated user`. |
| `POST` | `/v1/projects/{projectId}/analysis/runs` | Creation de run manuelle dependante d'un user. |
| `POST` | `/v1/projects/{projectId}/perception/runs` | Creation de run perception dependante d'un user. |

## Erreurs courantes

| Code | Cause typique |
| --- | --- |
| `401` | API key absente, invalide, ou route qui attend encore un `user identity`. |
| `403` | Plan non autorise pour la public API. |
| `404` | Route inexistante ou non documentee. |
| `503` | Dependency `organizations-service` ou `billing-service` indisponible pendant l'auth publique. |

Exemples d'erreurs:

```json
{
  "error": "missing api key"
}
```

```json
{
  "error": "invalid api key"
}
```

```json
{
  "error": "public api is not available for this plan"
}
```

## Notes d'implementation

- L'API key est validee par `organizations-service` via `/internal/api-keys/validate`.
- Le gateway injecte ensuite:
  - `X-Organization-ID`
  - `X-Public-API-Key-ID`
  - `X-Public-API-Key-Name`
- Les checks billing sont charges via `billing-service`.
- La surface publique actuelle est une combinaison d'endpoints directs et d'endpoints proxifies. Une harmonisation des payloads est encore souhaitable si l'API doit etre consommee comme produit externe de long terme.
