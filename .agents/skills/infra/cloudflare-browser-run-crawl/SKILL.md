---
name: cloudflare-browser-run-crawl
description: Use when integrating or operating Cloudflare Browser Run /crawl for website extraction, content indexing, RAG/content optimizer pipelines, crawl job polling, result pagination, robots.txt/content-signal handling, or troubleshooting crawl statuses and limits.
---

# Cloudflare Browser Run Crawl

Use Cloudflare Browser Run `/crawl` when a backend needs to scrape a starting URL, follow links across the same site, and return extracted HTML, Markdown, or JSON records without exposing Cloudflare credentials to the browser.

## Required Setup

- Cloudflare account ID.
- API token with `Browser Rendering - Edit`.
- Keep the token server-side. Prefer `CLOUDFLARE_API_TOKEN_FILE`; accept `CLOUDFLARE_API_TOKEN` only for local development.
- Endpoint: `https://api.cloudflare.com/client/v4/accounts/<account_id>/browser-rendering/crawl`.

## Backend Workflow

1. Validate the requested URL is absolute `http` or `https`.
2. Validate caller access to the project, organization, or tenant before calling Cloudflare.
3. Start a crawl job with `POST /crawl`; the response result is the job ID.
4. Persist or return the job ID.
5. Poll with `GET /crawl/<job_id>?limit=1` while status is `running`.
6. When terminal, fetch full records, usually with `status=completed`.
7. Support pagination with `cursor`, `limit`, and `status`.

## Request Defaults

```json
{
  "limit": 50,
  "depth": 2,
  "source": "all",
  "formats": ["markdown"],
  "render": false,
  "crawlPurposes": ["search", "ai-input"]
}
```

- Use `["markdown"]` for content optimizer and knowledge-base extraction.
- Use `render: false` for static sites; use `true` only when content depends on client-side JavaScript.
- Do not declare `ai-train` unless the product genuinely trains models on the crawled content.
- Keep UI defaults conservative and let operators raise `limit` and `depth` deliberately.

## Options

Use `options.includePatterns` and `options.excludePatterns` for scoped crawls. Exclude rules win over include rules.

Use `options.includeSubdomains` only when subdomains are part of the same content surface. Avoid `options.includeExternalLinks` unless the product explicitly wants off-site pages.

When `render` is `true`, Browser Run options such as `rejectResourceTypes`, `rejectRequestPattern`, `setExtraHTTPHeaders`, `cookies`, `gotoOptions`, and `waitForSelector` can be passed through.

## Status Handling

Job statuses:

- `running`
- `completed`
- `errored`
- `cancelled_due_to_timeout`
- `cancelled_due_to_limits`
- `cancelled_by_user`

Record statuses:

- `queued`
- `completed`
- `disallowed`
- `skipped`
- `errored`
- `cancelled`

Expose skipped and disallowed pages in diagnostics when debugging discovery, robots.txt, include/exclude patterns, or Content Signals.

## Compliance And Limits

- `/crawl` respects `robots.txt`, crawl-delay, bot protection, and Content Signals.
- Browser Run does not bypass CAPTCHAs, Turnstile, WAF, or bot-management blocks.
- User-Agent is fixed: `CloudflareBrowserRenderingCrawler/1.0`.
- Jobs can run up to seven days. Results are retained for 14 days after completion.
- If a site rejects `ai-train`, narrow `crawlPurposes` to the actual purpose, for example `["search"]` or `["search", "ai-input"]`.

## Troubleshooting

- Empty records or mostly `skipped`: remove include/exclude patterns, increase depth, or try `source: "sitemaps"`.
- `disallowed`: inspect the target site's `robots.txt`.
- 400 with Content Signals: reduce `crawlPurposes` to allowed purposes.
- Long-running jobs: use `render: false`, lower `limit`, block images/media/fonts, or crawl from sitemaps.
- `cancelled_due_to_limits`: reduce scope, increase cache `maxAge`, use `render: false`, or upgrade the Workers plan.
