# 📊 SKILL: GEO Traffic Analytics (GA4 Integration)

> Version : 2.0 — Mise à jour avril 2026  
> Basé sur : Google Analytics Data API v1 (v1beta), documentation officielle Google Developers

***

## 🧠 Vue d'ensemble

Ce skill permet de récupérer, analyser et afficher le **trafic GEO (Generative Engine Optimization)** depuis Google Analytics 4 afin d'identifier les visites provenant des moteurs génératifs (ChatGPT, Gemini, Perplexity, Grok, Claude, DeepSeek, Copilot, etc.).

Il transforme les données GA4 brutes en insights actionnables pour le SEO nouvelle génération — avec les vraies dimensions et métriques officielles de l'API GA4 Data v1.

***

## 🎯 Objectifs

- Identifier le trafic issu des moteurs génératifs
- Segmenter sources GEO vs SEO classique vs direct
- Visualiser les performances GEO (sessions, engagement, conversions)
- Fournir des insights actionnables basés sur des données réelles

***

## 📊 État du trafic GEO en 2026 (données de marché)

| Plateforme IA | Part trafic referral IA (jan. 2026) | Évolution YoY |
|---|---|---|
| **ChatGPT** | ~64–80% | Dominant mais en recul |
| **Gemini** | ~20–22% | +115% en 2 mois (Q4 2025) |
| **DeepSeek** | ~3–4% | Montée rapide |
| **Grok** | ~3% | Stable |
| **Perplexity** | ~2% | Recul relatif |
| **Claude** | ~2% | En progression |
| **Copilot** | ~1% | Stable |

> Source : SimilarWeb + The Digital Bloom (Feb 2026). Trafic IA = ~0,24% du trafic mondial total (+60% vs 2025).

> ⚠️ **Mise en garde importante** : GA4 ne tague pas nativement le "trafic IA". La détection reste basée sur des heuristiques (source/referrer). 60–70% des visites IA passent en trafic direct car les navigateurs IA (ex: ChatGPT Atlas, Perplexity Comet) ne transmettent pas toujours de referrer header. Le chiffre réel est donc systématiquement sous-évalué.

***

## 🔌 Intégration GA4 — API officielle

### Authentification

Deux méthodes supportées par l'API :

**Option A — Service Account (recommandé pour apps serveur)**
```json
{
  "type": "service_account",
  "project_id": "YOUR_PROJECT_ID",
  "private_key_id": "...",
  "private_key": "-----BEGIN RSA PRIVATE KEY-----\n...",
  "client_email": "your-sa@project.iam.gserviceaccount.com"
}
```

**Option B — OAuth 2.0 (recommandé pour apps utilisateur)**
- Flow : Authorization Code (web) ou Device Code (CLI)

**Scope requis (unique scope nécessaire) :**
```
https://www.googleapis.com/auth/analytics.readonly
```

***

### Endpoint officiel

```
POST https://analyticsdata.googleapis.com/v1beta/properties/{PROPERTY_ID}:runReport
```

> **Note :** Le canal `v1beta` est stable en production (Google garantit l'absence de breaking changes). Il existe aussi `v1alpha` pour les fonctionnalités expérimentales (funnel reports, audience exports).

***

### Structure de la requête (RunReportRequest — spec officielle)

```typescript
interface RunReportRequest {
  property?: string;           // "properties/XXXXXXXXX"
  dimensions?: Dimension[];    // Max 9 dimensions par requête
  metrics?: Metric[];          // Max 10 métriques par requête
  dateRanges?: DateRange[];    // Max 4 plages de dates
  dimensionFilter?: FilterExpression;
  metricFilter?: FilterExpression;
  offset?: string;             // Pagination (ex: "0")
  limit?: string;              // Lignes par page (max 250 000)
  orderBys?: OrderBy[];
  currencyCode?: string;
  cohortSpec?: CohortSpec;
  keepEmptyRows?: boolean;
  returnPropertyQuota?: boolean;
}
```

***

## 📥 Requêtes GA4 pour le trafic GEO

### Requête principale — Trafic GEO avec filtre natif

```json
{
  "dateRanges": [
    { "startDate": "30daysAgo", "endDate": "today" }
  ],
  "dimensions": [
    { "name": "sessionSource" },
    { "name": "sessionMedium" },
    { "name": "sessionSourceMedium" },
    { "name": "landingPage" }
  ],
  "metrics": [
    { "name": "sessions" },
    { "name": "engagedSessions" },
    { "name": "bounceRate" },
    { "name": "averageSessionDuration" },
    { "name": "conversions" },
    { "name": "screenPageViews" }
  ],
  "dimensionFilter": {
    "orGroup": {
      "expressions": [
        {
          "filter": {
            "fieldName": "sessionSource",
            "stringFilter": {
              "matchType": "CONTAINS",
              "value": "openai",
              "caseSensitive": false
            }
          }
        },
        {
          "filter": {
            "fieldName": "sessionSource",
            "stringFilter": {
              "matchType": "CONTAINS",
              "value": "chatgpt",
              "caseSensitive": false
            }
          }
        },
        {
          "filter": {
            "fieldName": "sessionSource",
            "stringFilter": {
              "matchType": "CONTAINS",
              "value": "perplexity",
              "caseSensitive": false
            }
          }
        },
        {
          "filter": {
            "fieldName": "sessionSource",
            "stringFilter": {
              "matchType": "CONTAINS",
              "value": "gemini",
              "caseSensitive": false
            }
          }
        },
        {
          "filter": {
            "fieldName": "sessionSource",
            "stringFilter": {
              "matchType": "CONTAINS",
              "value": "copilot.microsoft",
              "caseSensitive": false
            }
          }
        },
        {
          "filter": {
            "fieldName": "sessionSource",
            "stringFilter": {
              "matchType": "CONTAINS",
              "value": "claude",
              "caseSensitive": false
            }
          }
        },
        {
          "filter": {
            "fieldName": "sessionSource",
            "stringFilter": {
              "matchType": "CONTAINS",
              "value": "grok",
              "caseSensitive": false
            }
          }
        },
        {
          "filter": {
            "fieldName": "sessionSource",
            "stringFilter": {
              "matchType": "CONTAINS",
              "value": "deepseek",
              "caseSensitive": false
            }
          }
        }
      ]
    }
  },
  "orderBys": [
    {
      "metric": { "metricName": "sessions" },
      "desc": true
    }
  ],
  "limit": "1000",
  "returnPropertyQuota": true
}
```

> ⚠️ **Alternative avec `pageReferrer`** : Si vous voulez capturer les sessions dont le referrer HTTP est une IA (plus précis pour les navigateurs IA comme Perplexity Comet), utilisez la dimension `pageReferrer` à la place ou en complément de `sessionSource`. Cette dimension capture l'URL complète de la page référente.

***

### Requête complémentaire — Top pages GEO

```json
{
  "dateRanges": [
    { "startDate": "30daysAgo", "endDate": "today" }
  ],
  "dimensions": [
    { "name": "pagePath" },
    { "name": "pageTitle" },
    { "name": "sessionSource" }
  ],
  "metrics": [
    { "name": "sessions" },
    { "name": "engagedSessions" },
    { "name": "conversions" },
    { "name": "screenPageViews" }
  ],
  "dimensionFilter": {
    "filter": {
      "fieldName": "sessionSource",
      "stringFilter": {
        "matchType": "FULL_REGEXP",
        "value": "openai|chatgpt|perplexity|gemini|copilot\\.microsoft|claude\\.ai|anthropic|grok|deepseek|you\\.com|phind",
        "caseSensitive": false
      }
    }
  },
  "orderBys": [
    {
      "metric": { "metricName": "sessions" },
      "desc": true
    }
  ],
  "limit": "50"
}
```

***

### Requête comparaison temporelle (30j vs 30j précédents)

```json
{
  "dateRanges": [
    { "startDate": "30daysAgo", "endDate": "today", "name": "current" },
    { "startDate": "60daysAgo", "endDate": "31daysAgo", "name": "previous" }
  ],
  "dimensions": [
    { "name": "sessionSource" }
  ],
  "metrics": [
    { "name": "sessions" },
    { "name": "engagedSessions" },
    { "name": "conversions" }
  ],
  "dimensionFilter": {
    "filter": {
      "fieldName": "sessionSource",
      "stringFilter": {
        "matchType": "FULL_REGEXP",
        "value": "openai|chatgpt|perplexity|gemini|copilot\\.microsoft|claude|grok|deepseek",
        "caseSensitive": false
      }
    }
  }
}
```

***

## 🤖 Détection du trafic GEO — Domaines à surveiller (2026)

### Sources référentes confirmées dans GA4

| Moteur IA | sessionSource attendu | Medium | Notes |
|---|---|---|---|
| **ChatGPT** | `chat.openai.com`, `chatgpt.com` | `referral` | Source principale de trafic IA |
| **Gemini** | `gemini.google.com`, `bard.google.com` | `referral` | En forte croissance Q4 2025 |
| **Perplexity** | `perplexity.ai` | `referral` | Passe le referrer header |
| **Microsoft Copilot** | `copilot.microsoft.com`, `bing.com` | `referral` ou `organic` | Parfois confondu avec Bing |
| **Claude** | `claude.ai` | `referral` | — |
| **Grok** | `grok.x.ai`, `x.com` | `referral` | Via X/Twitter |
| **DeepSeek** | `chat.deepseek.com` | `referral` | En progression rapide |
| **You.com** | `you.com` | `referral` | — |
| **Phind** | `phind.com` | `referral` | Orienté développeurs |
| **Mistral (Le Chat)** | `chat.mistral.ai` | `referral` | À surveiller |

### Fonction de classification TypeScript (mise à jour)

```typescript
// Domaines exacts confirmés par GA4 (avril 2026)
const GEO_SOURCES: Record<string, string> = {
  "chat.openai.com": "ChatGPT",
  "chatgpt.com": "ChatGPT",
  "gemini.google.com": "Gemini",
  "bard.google.com": "Gemini (legacy)",
  "perplexity.ai": "Perplexity",
  "copilot.microsoft.com": "Microsoft Copilot",
  "claude.ai": "Claude",
  "anthropic.com": "Claude",
  "grok.x.ai": "Grok",
  "chat.deepseek.com": "DeepSeek",
  "you.com": "You.com",
  "phind.com": "Phind",
  "chat.mistral.ai": "Mistral",
};

// Patterns partiels (pour les sous-domaines, variantes, etc.)
const GEO_PATTERNS: string[] = [
  "openai",
  "chatgpt",
  "perplexity",
  "gemini",
  "bard",
  "copilot.microsoft",
  "claude.ai",
  "anthropic",
  "grok",
  "deepseek",
  "you.com",
  "phind",
  "mistral",
];

function classifyGeoSource(source: string): { isGeo: boolean; engine: string | null } {
  const normalizedSource = source.toLowerCase().trim();
  
  // 1. Correspondance exacte (priorité)
  if (GEO_SOURCES[normalizedSource]) {
    return { isGeo: true, engine: GEO_SOURCES[normalizedSource] };
  }
  
  // 2. Correspondance partielle
  const matchedPattern = GEO_PATTERNS.find(p => normalizedSource.includes(p));
  if (matchedPattern) {
    return { isGeo: true, engine: matchedPattern };
  }
  
  return { isGeo: false, engine: null };
}
```

> ⚠️ **Dark traffic** : Les navigateurs IA comme **ChatGPT Atlas** et **Perplexity Comet** peuvent supprimer l'entête referrer, faisant apparaître ces visites comme `(direct) / (none)`. Vous pouvez tenter de les identifier par des patterns comportementaux (fort taux d'engagement, sessions longues, faible taux de rebond) mais il n'existe pas de solution technique fiable à ce jour.

***

## 🗂️ Dimensions & Métriques GA4 officielles

### Dimensions utiles pour GEO (source : API Schema officiel)

| Dimension name | Nom affiché | Description |
|---|---|---|
| `sessionSource` | Source de session | Source de la session (ex: `perplexity.ai`) |
| `sessionMedium` | Support de session | Medium (ex: `referral`) |
| `sessionSourceMedium` | Source/support session | Combinaison source + medium |
| `firstUserSource` | Première source utilisateur | Source d'acquisition initiale |
| `firstUserMedium` | Premier support utilisateur | Medium d'acquisition initiale |
| `pageReferrer` | Référent de la page | URL complète du référent HTTP |
| `landingPage` | Page de destination | Chemin + query string de la page d'entrée |
| `pagePath` | Chemin de page | Chemin de l'URL |
| `pageTitle` | Titre de page | Titre HTML de la page |
| `deviceCategory` | Catégorie d'appareil | `desktop`, `mobile`, `tablet` |
| `country` | Pays | Pays de l'utilisateur |
| `date` | Date | Format `YYYYMMDD` |
| `week` | Semaine | Format `YYYYWW` |

### Métriques utiles pour GEO (source : API Schema officiel)

| Metric name | Nom affiché | Description |
|---|---|---|
| `sessions` | Sessions | Nombre total de sessions |
| `engagedSessions` | Sessions engagées | Sessions avec engagement ≥ 10s ou 2 pages |
| `engagementRate` | Taux d'engagement | `engagedSessions / sessions` |
| `bounceRate` | Taux de rebond | Inverse du taux d'engagement |
| `averageSessionDuration` | Durée moy. de session | En secondes |
| `screenPageViews` | Pages vues | Nombre de pages / écrans vus |
| `conversions` | Conversions | Nombre d'événements de conversion |
| `totalRevenue` | Revenu total | En devise configurée dans GA4 |
| `newUsers` | Nouveaux utilisateurs | — |
| `activeUsers` | Utilisateurs actifs | — |
| `userEngagementDuration` | Durée d'engagement | En millisecondes |
| `eventCount` | Nombre d'événements | Tous les événements GA4 |

> **Quotas API** : 200 000 tokens de requête / jour par propriété. Chaque dimension = 1 token, chaque métrique = 1 token. Utiliser `returnPropertyQuota: true` dans la requête pour monitorer la consommation.

***

## 📊 KPIs GEO recommandés

```typescript
type GeoKPIs = {
  // Volume
  totalGeoSessions: number;
  geoShareOfTotal: number;         // % du trafic total
  geoSessionsGrowth: number;       // % vs période précédente
  
  // Engagement
  geoEngagementRate: number;       // engagedSessions / sessions
  geoAvgSessionDuration: number;   // en secondes
  geoBounceRate: number;
  
  // Conversion
  geoConversions: number;
  geoConversionRate: number;
  geoRevenue?: number;             // si e-commerce
  
  // Contenu
  topGeoPages: Array<{
    path: string;
    title: string;
    sessions: number;
    engagementRate: number;
  }>;
  
  // Sources
  geoSourceBreakdown: Array<{
    engine: string;
    sessions: number;
    share: number;
  }>;
};
```

***

## 🧩 Data Model complet

```typescript
type GeoTrafficReport = {
  // Métadonnées
  propertyId: string;
  dateRange: { startDate: string; endDate: string };
  generatedAt: string;              // ISO 8601
  
  // Résumé
  summary: GeoKPIs;
  
  // Données brutes par source
  bySource: Array<{
    source: string;                 // ex: "perplexity.ai"
    medium: string;                 // ex: "referral"
    engine: string;                 // ex: "Perplexity"
    sessions: number;
    engagedSessions: number;
    engagementRate: number;
    bounceRate: number;
    avgSessionDuration: number;
    conversions: number;
    pageViews: number;
  }>;
  
  // Top pages GEO
  topPages: Array<{
    path: string;
    title: string;
    source: string;
    sessions: number;
    engagedSessions: number;
    conversions: number;
  }>;
  
  // Quota API consommé
  propertyQuota?: {
    tokensPerDay: { consumed: number; remaining: number };
    serverErrorsPerProjectPerHour: { consumed: number; remaining: number };
  };
};
```

***

## 🖥️ UI / Dashboard

### Widgets recommandés (ordre de priorité)

1. **KPI row** — Sessions GEO / Taux d'engagement / Conversions GEO / Part du trafic total
2. **📈 Courbe trafic GEO dans le temps** — Série temporelle sur 7 / 30 / 90 jours (dimension `date`)
3. **🧠 Répartition GEO vs SEO vs Direct** — Donut chart
4. **🌍 Sources GEO** — Bar chart horizontal par moteur IA (ChatGPT, Gemini, Perplexity, etc.)
5. **🔝 Top pages GEO** — Tableau avec `pagePath`, sessions, engagement rate, conversions
6. **⚡ Comparaison d'engagement** — GEO vs SEO organique vs Direct (bar chart groupé)

### Architecture recommandée

```
Frontend (React / Vue / Svelte)
  ↓ (HTTPS + OAuth token)
Backend API (Node.js / Python FastAPI)
  ↓ (Service Account JWT)
GA4 Data API v1beta
  ↑ (cache en mémoire Redis / TTL 1h)
```

***

## ⚙️ Implémentation Python officielle

```python
from google.analytics.data_v1beta import BetaAnalyticsDataClient
from google.analytics.data_v1beta.types import (
    DateRange,
    Dimension,
    Filter,
    FilterExpression,
    FilterExpressionList,
    Metric,
    OrderBy,
    RunReportRequest,
)

# Moteurs IA à détecter
GEO_ENGINES = [
    "openai", "chatgpt", "perplexity", "gemini", "bard",
    "copilot.microsoft", "claude", "anthropic", "grok",
    "deepseek", "you.com", "phind", "mistral",
]

def build_geo_filter() -> FilterExpression:
    """Construit un filtre OR sur sessionSource pour tous les moteurs IA."""
    expressions = [
        FilterExpression(
            filter=Filter(
                field_name="sessionSource",
                string_filter=Filter.StringFilter(
                    match_type=Filter.StringFilter.MatchType.CONTAINS,
                    value=engine,
                    case_sensitive=False,
                )
            )
        )
        for engine in GEO_ENGINES
    ]
    return FilterExpression(
        or_group=FilterExpressionList(expressions=expressions)
    )

def run_geo_report(property_id: str, start_date: str = "30daysAgo", end_date: str = "today"):
    """Exécute le rapport GEO via l'API GA4 Data v1beta."""
    client = BetaAnalyticsDataClient()  # Auth via GOOGLE_APPLICATION_CREDENTIALS
    
    request = RunReportRequest(
        property=f"properties/{property_id}",
        dimensions=[
            Dimension(name="sessionSource"),
            Dimension(name="sessionMedium"),
            Dimension(name="landingPage"),
        ],
        metrics=[
            Metric(name="sessions"),
            Metric(name="engagedSessions"),
            Metric(name="bounceRate"),
            Metric(name="averageSessionDuration"),
            Metric(name="conversions"),
            Metric(name="screenPageViews"),
        ],
        date_ranges=[DateRange(start_date=start_date, end_date=end_date)],
        dimension_filter=build_geo_filter(),
        order_bys=[
            OrderBy(metric=OrderBy.MetricOrderBy(metric_name="sessions"), desc=True)
        ],
        limit=1000,
        return_property_quota=True,
    )
    
    response = client.run_report(request)
    return response
```

***

## 🔄 Fréquence de mise à jour

| Mode | Délai | Recommandé pour |
|---|---|---|
| **Temps réel** | ❌ Non supporté en GA4 Data API | — |
| **Intraday** | ~1–4h de délai dans GA4 | Monitoring actif |
| **Batch quotidien** | Données stables après 24–48h | Reporting régulier |
| **Batch horaire** | Acceptable mais consomme du quota | Dashboards opérationnels |

> Le délai de traitement des données GA4 est **24 à 48 heures** pour les données complètes. Les données intraday sont disponibles mais partielles.

***

## 🔐 Sécurité & RGPD

- ✅ **Aucune donnée personnelle (PII)** — toutes les dimensions sont agrégées
- ✅ **Données agrégées uniquement** — pas d'identifiants individuels
- ✅ **Respect du consentement** — GA4 Data API respecte les paramètres de consentement de la propriété (Consent Mode v2)
- ✅ **Service Account** — scope read-only, jamais d'accès en écriture
- ⚠️ **Ne jamais exposer** la clé Service Account côté client
- ⚠️ **Anonymisation IP** — activée par défaut dans GA4 (RGPD compliant)

***

## 🚀 Extensions possibles

| Extension | Description |
|---|---|
| **Alertes GEO** | Webhook Slack/Teams si hausse/baisse > X% sur 7j |
| **Corrélation GEO × business** | Croiser sessions GEO avec événements de conversion spécifiques |
| **Dark traffic estimation** | Modèle statistique pour estimer le % caché en (direct) |
| **Content scoring GEO** | Score de performance de chaque page pour les sources IA |
| **Custom Channel Group** | Configurer dans GA4 UI un groupe de canaux "Generative AI" |
| **Looker Studio connector** | Tableau de bord partageable via GA4 Looker Studio |

***

## 🧪 Limitations connues (2026)

1. **GA4 ne tague pas le trafic IA nativement** — détection heuristique uniquement
2. **Dark traffic : 60–70% non capturé** — navigateurs IA sans referrer header
3. **Certains navigateurs bloquent le referrer** — paramètre de confidentialité
4. **Copilot confondu avec Bing** — les sources `bing.com / organic` peuvent inclure des suggestions Copilot
5. **Délai de données GA4** — 24–48h pour données stables
6. **Quotas API** — 200 000 tokens/jour/propriété (surveiller via `returnPropertyQuota`)
7. **Sessions vs utilisateurs** — GA4 mesure des sessions, pas des "citings" dans les réponses IA

***

## ✅ Checklist d'implémentation

- [ ] Service Account créé dans Google Cloud Console
- [ ] Compte de service ajouté comme "Viewer" dans GA4 > Gestion > Accès
- [ ] Variable d'environnement `GOOGLE_APPLICATION_CREDENTIALS` configurée
- [ ] `propertyId` GA4 récupéré (format : `XXXXXXXXX`, sans "properties/")
- [ ] Requête de test exécutée avec `returnPropertyQuota: true`
- [ ] Filtre GEO validé (vérifier que les sources IA remontent bien)
- [ ] Custom Channel Group "Generative AI" configuré dans GA4 UI (optionnel mais recommandé)
- [ ] Cache Redis / in-memory implémenté (TTL 1h minimum)
- [ ] Monitoring quota API en place
- [ ] Dashboard connecté et validé sur 30 jours de données historiques

***

## 📚 Références officielles

- [GA4 Data API v1 Overview](https://developers.google.com/analytics/devguides/reporting/data/v1)
- [RunReport Reference](https://developers.google.com/analytics/devguides/reporting/data/v1/rest/v1beta/properties/runReport)
- [API Dimensions & Metrics Schema](https://developers.google.com/analytics/devguides/reporting/data/v1/api-schema)
- [Python Client Library](https://googleapis.dev/python/analyticsdata/latest/)
- [Dimension Filters Guide](https://developers.google.com/analytics/devguides/reporting/data/v1/basics#dimension_filters)
- [Quotas & Limits](https://developers.google.com/analytics/devguides/reporting/data/v1/quotas)