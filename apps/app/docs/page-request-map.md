# Cartographie Des Requetes Par Page

Ce document compte les requetes API declenchees par chaque page de `apps/app`.

## Hypotheses

- Le total indique les requetes specifiques a la page, hors shell global `AppLayout`, auth guard et sidebar.
- Le comptage correspond a un chargement initial avec cache React Query froid.
- Les requetes en `Promise.all` comptent chacune pour 1 requete, meme si elles partent en parallele.
- Les actions utilisateur sont listees a part.
- Variables utilisees:
  - `O`: nombre d'organisations de l'utilisateur.
  - `M`: nombre d'organisations administrables.
  - `P`: nombre de projets dans l'organisation chargee.
  - `C`: nombre de pages du catalogue de prompts.
  - `K`: nombre de polls avant fin de job.

## Requetes Globales Communes

Ces requetes peuvent se declencher sur presque toutes les pages et ne sont pas additionnees dans le tableau principal.

| Zone | Requetes |
| --- | ---: |
| Session utilisateur | `1` (`GET /users/me`) |
| Guard organisations | `1 + O` (`GET /organizations/me`, puis `GET /organizations/{id}` par organisation) |
| Guard billing | `1` (`GET /billing/quotas/{organizationId}`) si une organisation existe |
| Guard projets | `1` (`GET /projects`) si l'organisation est payee et hors onboarding/billing/invitation |
| Resolution du projet dans l'URL | jusqu'a `O` (`GET /organizations/{id}/hierarchy`) si l'URL contient un project token |
| Sidebar desktop | `1 + O` pour les organisations, `1` hierarchy selected org, `1` quota prompts, et parfois jusqu'a `O` hierarchies pour retrouver l'organisation du projet |

Note: React Query peut dedupliquer certaines requetes si les `queryKey` sont identiques. Les totaux ci-dessus sont donc des maximums de demarrage a froid.

## Tableau Par Page

| Route | Requetes initiales page | Total courant | Variantes |
| --- | --- | ---: | --- |
| `/monitoring` | Projet, modeles, concurrents, dashboard monitoring, alertes | `5` | Sans projet dans l'URL: `6`. Si slug public non resolu cote page: `7`. |
| `/prompts` | Donnees monitoring, catalogue prompts, quota prompts | `6 + C` | Monitoring vaut `5` avec project id. Le catalogue vaut `C`. Sans projet: `7 + C`. Slug public fallback: `8 + C`. |
| `/pages` | Meme loader que monitoring | `5` | Sans projet: `6`. Slug public fallback: `7`. |
| `/traffic` | Liste projets, projet, integration GA4 | `3` | Si GA4 connecte: `4` avec le rapport traffic. |
| `/models` | Liste projets, catalogue modeles, quota billing, modeles du projet | `4` | Plan developer: `5` avec credentials LLM. Sans organisation: `0`. |
| `/perception` | Projet, modeles, concurrents, perception avec dashboard inclus | `4` | Sans projet: `5`. Slug public fallback: `6` si le shell n'a pas encore resolu l'ID projet. |
| `/crawler` | Resume projet, dernier crawl content optimizer | `2` | Slug public fallback possible jusqu'a `6`. Les jobs ajoutent des requetes de polling. |
| `/content-optimizer` | Aucune requete API | `0` | Page placeholder actuelle. |
| `/ai-agent-ready` | Resume projet | `1` | Slug public fallback: `3`. Scan manuel: `1 + K`, max actuel `21` (`POST /analysis/agent-ready/scans` + 20 polls). |
| `/error-hub` | Board erreurs, concurrents, modeles, actions optimisees | `4` | Sans projet: `5`. Slug public fallback: `6`. |
| `/optimize/actions` | Meme page que `/error-hub` | `4` | Alias route vers `ErrorHubPage`. Memes variantes. |
| `/brands` | Meme loader que perception | `4` | Sans projet: `5`. Slug public fallback: `6` si le shell n'a pas encore resolu l'ID projet. |
| `/brand-canon` | Meme loader que perception | `4` | Sauvegarde: `2 + U + D + A`, voir actions ci-dessous. |
| `/organizations` | Organisations, ressources organisation | `4 + O + P` membre, `6 + O + P` manager | `P` correspond aux requetes membres par projet. |
| `/billing` | Organisations, quota billing | `2 + O` | Si aucune organisation: `1`. Checkout cree parfois une organisation puis une session Stripe. |
| `/invitations/:token` | Aucune requete page au chargement | `0` | Confirmation: `1` (`POST /invitations/{token}/accept`). |
| `/account` | Aucune requete page au chargement | `0` | Utilise la session globale. Update profil: `1`; suppression: `1`, puis logout global. |
| `/admin/models` | Catalogue modeles complet | `1` | Necessite une organisation selectionnee. |
| `/admin/organizations` | Organisations, plans, quotas/hierarchy/members par org admin | `2 + O + 3M` | `M` = organisations administrables. |
| `/admin/pricing` | Organisations, plans billing, pricing tiers | `3 + O` | Les plans/tiers utilisent la premiere organisation administrable. |
| `/onboarding` | Aucune requete sur le premier step | `0` | Step modeles: `1` catalogue + `1` quota si org existante. Preview marque: `1`. Finalisation: `1`. |

## Requetes Backend Exactes Par Page

Les endpoints ci-dessous sont les requetes de page. Les requetes globales communes sont dans la section precedente.

### `/monitoring`

Chargement avec `projectId` connu:

- `GET /projects/{projectId}`
- `GET /projects/{projectId}/models`
- `GET /projects/{projectId}/competitors`
- `GET /analysis/projects/{projectId}/dashboard`
- `GET /analysis/projects/{projectId}/alerts`

Variantes:

- Sans projet dans l'URL: `GET /projects`, puis les requetes ci-dessus.
- Slug public non resolu par le premier appel: `GET /projects/{slug}`, `GET /projects`, `GET /projects/{resolvedProjectId}`, puis les 4 requetes projet.

### `/prompts`

Reutilise le loader monitoring:

- `GET /projects/{projectId}`
- `GET /projects/{projectId}/models`
- `GET /projects/{projectId}/competitors`
- `GET /analysis/projects/{projectId}/dashboard`
- `GET /analysis/projects/{projectId}/alerts`

Ajoute:

- `GET /projects/{projectId}/prompts?page=1&page_size=100&search={search}`
- `GET /projects/{projectId}/prompts?page={n}&page_size=100&search={search}` pour chaque page restante du catalogue
- `GET /analysis/projects/{projectId}/quota`

Actions:

- `POST /analysis/projects/{projectId}/run`
- `POST /projects/{projectId}/prompts`
- `POST /projects/{projectId}/prompts/generate`
- `PATCH /prompts/{promptId}`
- `DELETE /prompts/{promptId}` si suppression serveur supportee par le flux courant

### `/pages`

Reutilise le loader monitoring:

- `GET /projects/{projectId}`
- `GET /projects/{projectId}/models`
- `GET /projects/{projectId}/competitors`
- `GET /analysis/projects/{projectId}/dashboard`
- `GET /analysis/projects/{projectId}/alerts`

### `/traffic`

Chargement initial:

- `GET /projects`
- `GET /projects/{projectId}`
- `GET /projects/{projectId}/impact-integrations`

Si GA4 est connecte:

- `GET /attribution/projects/{projectId}/traffic?from={from}&to={to}&search={search}&engine={engine}`

Actions GA4:

- `PATCH /projects/{projectId}/impact-integrations`
- `POST /projects/{projectId}/impact-integrations/ga4/oauth/start`
- `POST /projects/{projectId}/impact-integrations/ga4/oauth/callback`
- `GET /projects/{projectId}/impact-integrations/ga4/oauth/properties`
- `PATCH /projects/{projectId}/impact-integrations/ga4/oauth/property`

### `/models`

Chargement initial:

- `GET /projects`
- `GET /ai-models?active_only=true`
- `GET /billing/quotas/{organizationId}`
- `GET /projects/{projectId}/models`

Plan developer uniquement:

- `GET /projects/{projectId}/llm-provider-credentials`

Actions:

- `PATCH /projects/{projectId}/models`
- `PUT /projects/{projectId}/llm-provider-credentials/{provider}`
- `DELETE /projects/{projectId}/llm-provider-credentials/{provider}`

### `/perception`

Chargement avec `projectId` connu:

- `GET /projects/{projectId}`
- `GET /projects/{projectId}/models`
- `GET /projects/{projectId}/competitors`
- `GET /analysis/projects/{projectId}/perception?includeDashboard=1`

Variantes:

- Sans projet dans l'URL: `GET /projects`, puis les requetes ci-dessus.
- Slug public non resolu par le shell: `GET /projects/{slug}`, `GET /projects`, `GET /projects/{resolvedProjectId}`, puis les 3 requetes projet.

### `/crawler`

Chargement initial:

- `GET /projects/{projectId}`
- `GET /analysis/projects/{projectId}/content-optimizer/crawl`

Variantes:

- Slug public non resolu: chaque appel peut ajouter `GET /projects` puis relancer avec `{resolvedProjectId}`.

Actions:

- `POST /analysis/projects/{projectId}/content-optimizer/crawl`
- `GET /analysis/projects/{projectId}/content-optimizer/crawl/{jobId}?limit={limit}&status={status}&cursor={cursor}&analyze=false`
- `GET /analysis/projects/{projectId}/content-optimizer/crawl/{jobId}?limit={limit}&status={status}&cursor={cursor}`

### `/content-optimizer`

Aucune requete backend dans l'implementation actuelle.

### `/ai-agent-ready`

Chargement initial:

- `GET /projects/{projectId}`

Variante slug public:

- `GET /projects/{slug}`
- `GET /projects`
- `GET /projects/{resolvedProjectId}`

Actions:

- `POST /analysis/agent-ready/scans`
- `GET /analysis/agent-ready/scans/{scanId}` repete jusqu'a statut `done` ou `failed`

### `/error-hub`

Chargement avec `projectId` connu:

- `GET /analysis/projects/{projectId}/optimization-errors`
- `GET /projects/{projectId}/competitors`
- `GET /projects/{projectId}/models`
- `GET /analysis/projects/{projectId}/optimize-actions`

Variantes:

- Sans projet dans l'URL: `GET /projects`, puis les requetes ci-dessus.
- Slug public non resolu: `GET /analysis/projects/{slug}/optimization-errors`, `GET /projects`, `GET /analysis/projects/{resolvedProjectId}/optimization-errors`, puis competitors, models et optimize actions.

Actions:

- `POST /analysis/projects/{projectId}/optimize-actions`
- `PATCH /analysis/projects/{projectId}/optimize-actions/{actionId}`

### `/optimize/actions`

Alias de `/error-hub`; memes requetes backend exactes.

### `/brands`

Reutilise le loader perception:

- `GET /projects/{projectId}`
- `GET /projects/{projectId}/models`
- `GET /projects/{projectId}/competitors`
- `GET /analysis/projects/{projectId}/perception?includeDashboard=1`

### `/brand-canon`

Reutilise le loader perception:

- `GET /projects/{projectId}`
- `GET /projects/{projectId}/models`
- `GET /projects/{projectId}/competitors`
- `GET /analysis/projects/{projectId}/perception?includeDashboard=1`

Actions:

- `PATCH /projects/{projectId}`
- `PATCH /analysis/projects/{projectId}/brand-canon`
- `PATCH /competitors/{competitorId}` pour chaque concurrent modifie
- `DELETE /competitors/{competitorId}` pour chaque concurrent supprime
- `POST /projects/{projectId}/competitors` si au moins un concurrent est cree

### `/organizations`

Chargement des organisations:

- `GET /organizations/me`
- `GET /organizations/{organizationId}` pour chaque organisation retournee par `/organizations/me`

Chargement de l'organisation selectionnee:

- `GET /organizations/{organizationId}`
- `GET /organizations/{organizationId}/hierarchy`
- `GET /organizations/{organizationId}/members`
- `GET /projects/{projectId}/members` pour chaque projet de l'organisation

Manager uniquement:

- `GET /organizations/{organizationId}/invitations`
- `GET /organizations/{organizationId}/api-keys`

Actions:

- `PATCH /organizations/{organizationId}`
- `DELETE /organizations/{organizationId}`
- `PATCH /projects/{projectId}`
- `DELETE /projects/{projectId}`
- `POST /organizations/{organizationId}/api-keys`
- `DELETE /organizations/{organizationId}/api-keys/{keyId}`
- `POST /projects`
- `POST /organizations/{organizationId}/invitations`
- `DELETE /organizations/{organizationId}/invitations/{invitationId}`
- `POST /projects/{projectId}/members`
- `DELETE /projects/{projectId}/members/{userId}`
- `PATCH /organizations/{organizationId}/members/{userId}`
- `DELETE /organizations/{organizationId}/members/{userId}`

### `/billing`

Chargement:

- `GET /organizations/me`
- `GET /organizations/{organizationId}` pour chaque organisation retournee
- `GET /billing/quotas/{organizationId}` si une organisation active existe

Actions:

- `POST /organizations` si l'utilisateur cree une organisation depuis le checkout
- `POST /billing/stripe/checkout-session`

### `/invitations/:token`

Chargement initial:

- Aucune requete backend.

Action confirmation:

- `POST /invitations/{token}/accept`

### `/account`

Chargement initial:

- Aucune requete propre a la page. La page utilise `GET /users/me` du shell global.

Actions:

- `PATCH /users/me`
- `DELETE /users/me`
- `POST /auth/logout` via l'action logout globale

### `/admin/models`

Chargement:

- `GET /ai-models?active_only=false`

Actions:

- `POST /ai-models`
- `PATCH /ai-models/{modelId}`
- `POST /ai-models/sync/openrouter`

### `/admin/organizations`

Chargement des organisations:

- `GET /organizations/me`
- `GET /organizations/{organizationId}` pour chaque organisation retournee

Chargement admin:

- `GET /billing/plans`
- Pour chaque organisation administrable:
  - `GET /billing/quotas/{organizationId}`
  - `GET /organizations/{organizationId}/hierarchy`
  - `GET /organizations/{organizationId}/members`

Actions:

- `POST /billing/subscriptions`

### `/admin/pricing`

Chargement:

- `GET /organizations/me`
- `GET /organizations/{organizationId}` pour chaque organisation retournee
- `GET /billing/plans`
- `GET /billing/pricing-tiers`

Actions:

- `POST /billing/plans`
- `POST /billing/pricing-tiers`

### `/onboarding`

Premier affichage:

- Aucune requete backend.

Step modeles:

- `GET /onboarding/ai-models?active_only=true`
- `GET /billing/quotas/{organizationId}` si une organisation est deja selectionnee

Preview marque:

- `POST /onboarding/brand-profile`

Finalisation:

- `POST /onboarding/bootstrap`

## Detail Des Actions Principales

| Page | Action | Requetes |
| --- | --- | ---: |
| `/prompts` | Lancer un prompt | `1` (`POST /analysis/projects/{id}/run`) puis polling monitoring toutes les 4s tant que le run est pending |
| `/prompts` | Creer/generer/patch/delete prompt | `1` par mutation |
| `/models` | Sauvegarder les modeles du projet | `1` (`PATCH /projects/{id}/models`) |
| `/models` | Sauvegarder/supprimer une cle LLM | `1` par provider |
| `/crawler` | Decouverte initiale | `1` start job + `K` polls |
| `/crawler` | Crawl selectionne | `1` start job + `K` polls |
| `/ai-agent-ready` | Lancer un scan | `1 + K`, max `21` avec les constantes actuelles |
| `/brand-canon` | Sauvegarder le canon | `2` (`PATCH /projects/{id}`, puis `PATCH /analysis/projects/{id}/brand-canon`) |
| `/brand-canon` | Synchroniser concurrents | `U + D + A`, avec `U` updates, `D` deletes, `A = 1` si au moins une creation |
| `/traffic` | OAuth GA4 / property / setup | `1` par etape appelee |
| `/billing` | Checkout Stripe | `1`; si aucune organisation existe, `+1` creation organisation |

## Observations

- Les pages perception, brands et brand-canon recuperent maintenant le dashboard via `GET /analysis/projects/{projectId}/perception?includeDashboard=1`, ce qui supprime une requete frontend et evite un calcul dashboard concurrent cote backend.
- `/prompts` peut devenir la page la plus couteuse si le catalogue prompts est pagine sur plusieurs pages (`C`).
- `/organizations` et `/admin/organizations` ont un cout variable selon le nombre d'organisations et de projets.
- Le shell ajoute maintenant `projectId={id canonique}` au `routeSearch` interne apres resolution d'un slug public, ce qui evite aux pages de retenter `GET /projects/{slug}`.
- La sidebar ajoute des requetes communes qui peuvent masquer le cout reel d'une page si on mesure uniquement dans l'onglet Network.

## Sources Code

- Routes: `src/app/router.tsx`
- Shell global: `src/app/App.tsx`, `src/components/sidebar/sidebar.tsx`
- Gateway: `src/shared/api/gateway.ts`
- Monitoring/pages: `src/lib/monitoring-data.ts`
- Perception/brands: `src/lib/perception-data.ts`
- Prompts: `src/features/prompts/_lib/prompt-api.ts`, `src/features/prompts/_lib/prompt-quota.ts`
- Traffic: `src/features/traffic/_lib/report/traffic-report-api.ts`
- Models: `src/features/models/_lib/catalog/catalog-api.ts`
- Organizations: `src/features/organizations/_lib/shared/organization-page-api.ts`
- Crawler: `src/features/crawler/_lib/content-optimizer-api.ts`
- AI Agent Ready: `src/features/ai-agent-ready/_lib/audit/audit-api.ts`
- Error hub: `src/lib/optimization-errors-data.ts`, `src/features/perception/core/use-optimization-errors.ts`
