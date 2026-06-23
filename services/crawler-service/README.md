# crawler-service

Production crawler worker used by `analysis-service`.

It connects to Obscura over CDP, discovers URLs for a root domain, then crawls selected pages as Markdown only. Crawl data is persisted in the analysis database through `crawler_runs` and `crawler_pages`.

## HTTP contract

- `POST /internal/crawls`
- `GET /internal/crawls/:id`
- `GET /internal/crawls/latest`
- `GET /health`

The internal endpoints are protected by `CRAWLER_SERVICE_TOKEN` or `CRAWLER_SERVICE_TOKEN_FILE` when configured.

## Required environment

- `OBSCURA_WS`
- `ANALYSIS_DB_HOST`
- `ANALYSIS_DB_PORT`
- `ANALYSIS_DB_USER`
- `ANALYSIS_DB_NAME`
- `ANALYSIS_DB_PASSWORD` or `ANALYSIS_DB_PASSWORD_FILE`
- `CRAWLER_SERVICE_TOKEN` or `CRAWLER_SERVICE_TOKEN_FILE`

Optional:

- `PORT` defaults to `8094`
- `CRAWLER_CONCURRENCY` defaults to `3`
- `CRAWLER_NAVIGATION_TIMEOUT_MS` defaults to `45000`

## Local checks

```bash
bun install
bun run check
```
