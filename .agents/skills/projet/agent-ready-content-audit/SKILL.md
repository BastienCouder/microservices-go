---
name: agent-ready-content-audit
description: Use when building, extending, or reviewing the AI Agent Ready / Content Analysis audit feature. Covers content-site scan UX, beige/orange premium UI, reusable React components, /api/scan contract, scoring weights, and backend checks for robots.txt, sitemap, Link headers, Markdown negotiation, AI bot rules, and Content Signals.
---

# Agent Ready Content Audit

Use this skill when implementing or modifying the embedded AI Agent Ready audit experience.

## Product Scope

Start with `content-site` mode only. Keep the code open for future modes such as API/Application, auth, MCP, and commerce, but do not add those checks until requested.

Core content-site categories:

- Discoverability: `robots_txt`, `sitemap`, `link_headers`
- Content Accessibility: `markdown_negotiation`
- Bot Access Control: `ai_bot_rules`, `content_signals`

## UX Pattern

Build the flow as: URL input, scan CTA, collapsible Customize scan block, mode tabs, check cards, result score card, then detailed accordions.

Required reusable components:

- `ScanHero`
- `UrlInput`
- `ScanModeTabs`
- `CheckGroupCard`
- `CheckToggle`
- `ScoreGauge`
- `ScoreSummaryCard`
- `CategoryScorePill`
- `AuditSection`
- `AuditCheckAccordion`
- `StatusBadge`
- `CopyPromptButton`

Default behavior:

- Empty state before scan
- Loading state during analysis
- Strict http/https URL validation
- First failing accordion opens by default
- Copy prompt feedback changes to `Copied`
- Network errors surface inline
- User can run another scan from the same page

## Visual Direction

Use a premium, calm B2B audit style with warm neutrals and orange emphasis.

Tokens:

- background: `#f7f3ee`
- surface: `#fffaf5`
- surface-2: `#fffdf9`
- border: `#eadfd3`
- text: `#3a2418`
- text-muted: `#866d5d`
- accent: `#f26a21`
- accent-hover: `#dd5d19`
- success: `#1fa35b`
- warning: `#f3a43b`
- error: `#df4c4c`
- neutral: `#d8d1ca`

Radius:

- cards: `18px`
- buttons: `14px`
- pills: `999px`

Keep layouts airy, max width around `1100px`, with a 3-column check-card grid on desktop and one column on mobile.

## API Contract

`POST /api/scan`

```json
{
  "url": "https://example.com",
  "mode": "content-site",
  "checks": [
    "robots_txt",
    "sitemap",
    "link_headers",
    "markdown_negotiation",
    "ai_bot_rules",
    "content_signals"
  ]
}
```

Response:

```json
{ "scan_id": "uuid", "status": "queued" }
```

`GET /api/scan/:id` returns `queued`, `running`, `done`, or `failed`. Done results include `score`, `level`, `summary`, `categories`, and detailed `checks` with `goal`, `issue`, `how_to_implement`, `resources`, and `prompt`.

## Scoring

Global score is normalized to 100.

Default weights:

- Discoverability: 35
- Content Accessibility: 35
- Bot Access Control: 30

Check weights:

- `robots_txt`: 10
- `sitemap`: 10
- `link_headers`: 15
- `markdown_negotiation`: 35
- `ai_bot_rules`: 10
- `content_signals`: 20

Status scoring:

- `pass`: full weight
- `warning`: half weight
- `fail`: zero
- `skipped`: excluded only when explicitly optional
- `not_applicable`: excluded from denominator

Levels:

- `Ready`: score >= 80
- `Partially Ready`: score >= 50
- `Not Ready`: below 50

## Backend Checks

Implement checks server-side and keep each check independently testable.

- `robots_txt`: GET `/robots.txt`, verify presence, parse User-agent and Allow/Disallow, detect AI directives.
- `sitemap`: prefer robots.txt `Sitemap:` directive, otherwise GET `/sitemap.xml`, verify HTTP 200 and root XML element `urlset` or `sitemapindex`.
- `link_headers`: HEAD home, fallback GET if needed, inspect `Link` headers for useful agent discovery targets.
- `markdown_negotiation`: GET home with `Accept: text/markdown`, compare with standard HTML path, require usable Markdown or `text/markdown` content type.
- `ai_bot_rules`: inspect robots.txt for known AI crawler User-agent groups.
- `content_signals`: inspect headers for `Content-Signal` or equivalent policy links.

## Validation

For the React app:

```bash
docker run --rm -v /home/bastiencdr/dev/microservices-go/apps/app:/app -w /app oven/bun:alpine bun x tsc --noEmit
```

For the gateway:

```bash
env GOCACHE=/tmp/go-build-cache GOMODCACHE=/tmp/go-mod-cache go test ./services/api-gateway/internal/adapter/http
```
