# Skill: Cloudflare AI Crawl Control Integration

## Overview

This skill covers how to integrate **Cloudflare AI Crawl Control** into a SaaS product, allowing each organization/tenant to connect their own Cloudflare account and monitor AI crawler traffic on their domain — alongside existing analytics (e.g. GA4).

---

## Prerequisites (per organization)

- Domain proxied through Cloudflare (orange cloud enabled in DNS)
- Cloudflare account (any plan — Free plan gives 24h analytics window; paid plans give longer windows)
- A **Cloudflare API Token** scoped to their zone(s) — see "Token Setup" below

---

## 1. Token Setup (Organization-side)

The organization must create a **custom API token** with minimal required permissions:

| Permission type | Resource | Level |
|---|---|---|
| Account Analytics | Account | Read |
| Zone Analytics | Zone | Read |
| Zone | Zone | Read |

**Steps:**
1. Cloudflare Dashboard → **My Profile > API Tokens**
2. Click **Create Token** → **Custom token (Get started)**
3. Add permissions (table above)
4. Scope to specific zone(s) — do NOT use "All zones" unless needed
5. Optional: set TTL and IP restriction
6. Copy the token → paste into the SaaS integration form

---

## 2. Getting Zone ID

Each Cloudflare domain has a `zone_tag` (Zone ID). Your SaaS needs this to scope API queries.

```bash
# Retrieve zones for a given API token
curl -s https://api.cloudflare.com/client/v4/zones \
  -H "Authorization: Bearer <API_TOKEN>" \
  -H "Content-Type: application/json" \
  | jq '.result[] | {name, id}'
```

**Response:**
```json
{ "name": "example.com", "id": "abc123zonetagxxx" }
```

Store `zone_tag` per organization in your DB.

---

## 3. Cloudflare GraphQL Analytics API

All analytics data is accessed via a single GraphQL endpoint:

```
POST https://api.cloudflare.com/client/v4/graphql
Authorization: Bearer <API_TOKEN>
Content-Type: application/json
```

### 3a. AI Crawler Traffic (httpRequestsAdaptiveGroups)

Query bot/crawler requests by user agent over a date range:

```graphql
{
  viewer {
    zones(filter: { zoneTag: "<ZONE_ID>" }) {
      httpRequestsAdaptiveGroups(
        filter: {
          datetime_geq: "2026-05-01T00:00:00Z"
          datetime_leq: "2026-06-01T00:00:00Z"
          botScore_leq: 30
        }
        limit: 100
        orderBy: [count_DESC]
      ) {
        dimensions {
          userAgent
          clientRequestHTTPHost
          edgeResponseStatus
        }
        count
      }
    }
  }
}
```

**Key filters:**
- `botScore_leq: 30` → filters likely bot traffic (score 0-29 = bot)
- `datetime_geq` / `datetime_leq` → ISO8601 UTC range
- Free plan: max 24h window; paid plans: up to 30 days

### 3b. Zone-level Traffic Overview

```graphql
{
  viewer {
    zones(filter: { zoneTag: "<ZONE_ID>" }) {
      httpRequests1dGroups(
        limit: 30
        orderBy: [date_ASC]
        filter: { date_geq: "2026-05-01", date_leq: "2026-06-01" }
      ) {
        dimensions { date }
        sum {
          requests
          threats
          pageViews
          bytes
        }
        uniq { uniques }
      }
    }
  }
}
```

---

## 4. Known AI Crawler User Agents

Use this list to identify and label AI crawlers in your UI:

```js
const AI_CRAWLERS = {
  "GPTBot": { operator: "OpenAI", purpose: "ChatGPT training" },
  "ChatGPT-User": { operator: "OpenAI", purpose: "ChatGPT browsing" },
  "ClaudeBot": { operator: "Anthropic", purpose: "Claude training" },
  "Claude-Web": { operator: "Anthropic", purpose: "Claude browsing" },
  "PerplexityBot": { operator: "Perplexity AI", purpose: "Perplexity search" },
  "cohere-ai": { operator: "Cohere", purpose: "Cohere training" },
  "CCBot": { operator: "Common Crawl", purpose: "Open dataset" },
  "Bytespider": { operator: "ByteDance", purpose: "TikTok AI" },
  "meta-externalagent": { operator: "Meta", purpose: "Meta AI training" },
  "Amazonbot": { operator: "Amazon", purpose: "Alexa/AWS AI" },
  "anthropic-ai": { operator: "Anthropic", purpose: "Claude training" },
  "omgili": { operator: "Webz.io", purpose: "Data scraping" },
  "Diffbot": { operator: "Diffbot", purpose: "AI data extraction" },
};

function identifyAICrawler(userAgent) {
  for (const [key, info] of Object.entries(AI_CRAWLERS)) {
    if (userAgent.toLowerCase().includes(key.toLowerCase())) return { bot: key, ...info };
  }
  return null;
}
```

---

## 5. SaaS Integration Flow

### Backend (Node.js / any server)

```js
// cloudflare-service.js

const CF_GRAPHQL = "https://api.cloudflare.com/client/v4/graphql";

/**
 * Fetch AI crawler stats for a given org's zone
 */
async function getAICrawlerStats(apiToken, zoneId, { from, to } = {}) {
  const dateFrom = from ?? new Date(Date.now() - 86400000).toISOString(); // last 24h
  const dateTo   = to   ?? new Date().toISOString();

  const query = `{
    viewer {
      zones(filter: { zoneTag: "${zoneId}" }) {
        httpRequestsAdaptiveGroups(
          filter: {
            datetime_geq: "${dateFrom}"
            datetime_leq: "${dateTo}"
            botScore_leq: 30
          }
          limit: 100
          orderBy: [count_DESC]
        ) {
          dimensions { userAgent clientRequestHTTPHost edgeResponseStatus }
          count
        }
      }
    }
  }`;

  const res = await fetch(CF_GRAPHQL, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${apiToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ query }),
  });

  const json = await res.json();
  if (json.errors) throw new Error(json.errors[0].message);

  const groups = json.data.viewer.zones[0]?.httpRequestsAdaptiveGroups ?? [];
  return groups.map(g => ({
    userAgent: g.dimensions.userAgent,
    host: g.dimensions.clientRequestHTTPHost,
    status: g.dimensions.edgeResponseStatus,
    count: g.count,
    crawler: identifyAICrawler(g.dimensions.userAgent),
  }));
}

/**
 * Fetch all zones accessible by the API token
 */
async function getZones(apiToken) {
  const res = await fetch("https://api.cloudflare.com/client/v4/zones", {
    headers: { "Authorization": `Bearer ${apiToken}` }
  });
  const json = await res.json();
  return json.result.map(z => ({ id: z.id, name: z.name, plan: z.plan.name }));
}
```

### Frontend — Integration form (React example)

```jsx
// CloudflareIntegrationForm.jsx

export function CloudflareIntegrationForm({ onSave }) {
  const [token, setToken] = useState("");
  const [zones, setZones] = useState([]);
  const [selectedZone, setSelectedZone] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  async function handleVerifyToken() {
    setLoading(true);
    setError(null);
    try {
      // Call YOUR backend, which calls Cloudflare API
      const res = await fetch("/api/integrations/cloudflare/zones", {
        method: "POST",
        body: JSON.stringify({ token }),
      });
      if (!res.ok) throw new Error("Token invalide ou permissions insuffisantes");
      setZones(await res.json());
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={e => { e.preventDefault(); onSave({ token, zoneId: selectedZone }); }}>
      <label>API Token Cloudflare</label>
      <input
        type="password"
        value={token}
        onChange={e => setToken(e.target.value)}
        placeholder="Collez votre token Cloudflare..."
      />
      <button type="button" onClick={handleVerifyToken} disabled={loading}>
        {loading ? "Vérification..." : "Vérifier le token"}
      </button>

      {error && <p className="error">{error}</p>}

      {zones.length > 0 && (
        <>
          <label>Sélectionner le domaine à suivre</label>
          <select onChange={e => setSelectedZone(e.target.value)}>
            <option value="">-- Choisir un domaine --</option>
            {zones.map(z => (
              <option key={z.id} value={z.id}>{z.name} ({z.plan})</option>
            ))}
          </select>
          <button type="submit" disabled={!selectedZone}>Enregistrer l'intégration</button>
        </>
      )}
    </form>
  );
}
```

---

## 6. Security — Token Storage

**Never store API tokens in plaintext.**

```js
// Recommended: encrypt at rest using AES-256-GCM
import { createCipheriv, createDecipheriv, randomBytes } from "crypto";

const ENCRYPTION_KEY = Buffer.from(process.env.TOKEN_ENCRYPTION_KEY, "hex"); // 32 bytes

function encryptToken(token) {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", ENCRYPTION_KEY, iv);
  const encrypted = Buffer.concat([cipher.update(token, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([iv, tag, encrypted]).toString("base64");
}

function decryptToken(encryptedBase64) {
  const buf = Buffer.from(encryptedBase64, "base64");
  const iv = buf.slice(0, 12);
  const tag = buf.slice(12, 28);
  const encrypted = buf.slice(28);
  const decipher = createDecipheriv("aes-256-gcm", ENCRYPTION_KEY, iv);
  decipher.setAuthTag(tag);
  return decipher.update(encrypted) + decipher.final("utf8");
}
```

---

## 7. Plan Limitations

| Feature | Free | Pro/Business | Enterprise + Bot Mgmt |
|---|---|---|---|
| AI crawler detection | User-agent based | User-agent based | Bot Management ID (advanced) |
| Analytics window | 24h max | 7 days | 30+ days configurable |
| Allow/Block controls | ✅ | ✅ | ✅ |
| Pay Per Crawl | ❌ | ❌ (bêta privée) | ✅ (bêta privée) |
| robots.txt tracking | ✅ | ✅ | ✅ |

---

## 8. Polling & Caching Strategy

Cloudflare analytics data has a latency of ~5-10 minutes. Recommended strategy for your SaaS:

```
- Cache results per (org, zoneId) for 15 minutes
- Refresh on dashboard load if cache is stale
- Never call Cloudflare API directly from frontend (CORS issues + token exposure)
- All Cloudflare calls go through YOUR backend
```

---

## 9. Displaying Alongside GA4

In your unified dashboard, map the data sources:

| Dimension | GA4 | Cloudflare AI Crawl Control |
|---|---|---|
| Visiteurs uniques | ✅ sessions/users | ❌ (bots, pas des users) |
| Pages vues | ✅ pageviews | ✅ httpRequests (total) |
| Bots IA détectés | ❌ filtrés | ✅ botScore ≤ 30 |
| User-agents IA | ❌ | ✅ GPTBot, ClaudeBot... |
| Géolocalisation | ✅ | ✅ (edgeColoCity) |
| Statuts HTTP | ❌ | ✅ edgeResponseStatus |

---

## References

- [Cloudflare AI Crawl Control - Get Started](https://developers.cloudflare.com/ai-crawl-control/get-started/)
- [Cloudflare GraphQL Analytics API](https://developers.cloudflare.com/analytics/graphql-api/)
- [Create API Token](https://developers.cloudflare.com/fundamentals/api/get-started/create-token/)
- [Manage AI Crawlers](https://developers.cloudflare.com/ai-crawl-control/features/manage-ai-crawlers/)
- [Zone Analytics](https://developers.cloudflare.com/analytics/account-and-zone-analytics/zone-analytics/)
