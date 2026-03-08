# Dashboard Audit Report

Date: 2026-03-08
Scope: `apps/app` dashboard / monitoring page

## Executive Summary

No critical XSS-style issue stood out in the dashboard frontend during this review. The main risks are in three areas:

1. security/robustness around how `projectId` and remote assets are consumed client-side
2. performance/availability due to avoidable refetch and full-page rerenders
3. maintainability/correctness because some business filters depend on presentation fields and heuristic parsing

The highest-value fixes are:

1. encode `projectId` before interpolating it into request paths
2. stop making `/projects` a mandatory prerequisite when `projectId` is already known
3. replace the faux-selector context store with a real selector-aware store or split contexts
4. use `createdAt` as the single source of truth for period filtering

## Medium Severity

### DASH-01: Raw `projectId` is interpolated into API paths without encoding

Impact: a crafted query string can alter the requested path shape and create path-confusion bugs or brittle access-control assumptions.

References:
- [dashboard-data.ts](/var/www/microservices-go/apps/app/src/lib/dashboard-data.ts#L394)
- [dashboard-data.ts](/var/www/microservices-go/apps/app/src/lib/dashboard-data.ts#L417)
- [dashboard-data.ts](/var/www/microservices-go/apps/app/src/lib/dashboard-data.ts#L433)
- [gateway.ts](/var/www/microservices-go/apps/app/src/shared/api/gateway.ts#L28)

Details:
- `projectId` is read directly from `routeSearch`.
- It is then concatenated into `/projects/${projectId}`, `/projects/${projectId}/models`, `/analysis/projects/${projectId}/dashboard`, etc.
- This should be `encodeURIComponent(projectId)` before path interpolation.

Recommendation:
- normalize and encode the ID once, close to `readProjectIdFromSearch`
- reject obviously invalid values early instead of letting them shape request URLs

### DASH-02: Dashboard boot always depends on `/projects`, even when `projectId` is already known

Impact: one unnecessary roundtrip is added to every dashboard load, and a failure on `/projects` blocks the page even if the target project is already in the URL.

References:
- [dashboard-data.ts](/var/www/microservices-go/apps/app/src/lib/dashboard-data.ts#L394)
- [dashboard-data.ts](/var/www/microservices-go/apps/app/src/lib/dashboard-data.ts#L396)
- [dashboard-data.ts](/var/www/microservices-go/apps/app/src/lib/dashboard-data.ts#L405)
- [use-dashboard-data.tsx](/var/www/microservices-go/apps/app/src/hooks/use-dashboard-data.tsx#L78)
- [query-keys.ts](/var/www/microservices-go/apps/app/src/lib/query-keys.ts#L3)

Details:
- `loadDashboardData` fetches `/projects` before checking whether it can proceed with the already-selected `projectId`.
- The query key also uses the full raw `routeSearch`, so unrelated search-param changes can invalidate the whole dashboard cache.
- In practice this widens the failure surface and slows the first render path.

Recommendation:
- if `projectId` is present, skip `/projects` entirely
- derive the query key from normalized inputs (`projectId`, runtime mode), not the entire raw query string

### DASH-03: The dashboard store is not selector-aware, so every filter change rerenders all consumers

Impact: filter interactions trigger avoidable rerenders across the whole dashboard tree, which will show up as jank as prompt volume and chart complexity grow.

References:
- [dashboard-store.tsx](/var/www/microservices-go/apps/app/src/lib/dashboard-store.tsx#L26)
- [dashboard-store.tsx](/var/www/microservices-go/apps/app/src/lib/dashboard-store.tsx#L73)
- [dashboard-store.tsx](/var/www/microservices-go/apps/app/src/lib/dashboard-store.tsx#L118)
- [analytics-panel.tsx](/var/www/microservices-go/apps/app/src/features/monitoring/_components/analytics-panel/analytics-panel.tsx#L48)
- [filters-panel.tsx](/var/www/microservices-go/apps/app/src/features/monitoring/_components/filters-panel/filters-panel.tsx#L40)

Details:
- `useDashboardStore` looks like a Zustand selector API, but it is only `useContext(...); return selector(state)`.
- Because the provider value object changes on each state update, all consumers rerender regardless of the selector or `useShallow`.
- This is especially expensive here because `AnalyticsPanel`, `ActivityPanel` and `FiltersPanel` all perform multiple array scans and memo chains.

Recommendation:
- use a real selector-aware store (`zustand` proper, `useSyncExternalStore`, or split contexts by concern)
- avoid using `useShallow` as a signal that rerenders are already under control

### DASH-04: Period filtering uses a display string (`2h`, `7d`) as business logic

Impact: filter results drift over time in long-lived sessions and business logic becomes coupled to a UI formatting choice.

References:
- [dashboard-data.ts](/var/www/microservices-go/apps/app/src/lib/dashboard-data.ts#L179)
- [dashboard-data.ts](/var/www/microservices-go/apps/app/src/lib/dashboard-data.ts#L539)
- [analytics-utils.ts](/var/www/microservices-go/apps/app/src/features/monitoring/_components/analytics-panel/analytics-utils.ts#L107)
- [analytics-utils.ts](/var/www/microservices-go/apps/app/src/features/monitoring/_components/analytics-panel/analytics-utils.ts#L127)

Details:
- `time` is derived once from `createdAt` through `toRelativeTime`.
- Non-custom filters then parse the human-readable `time` string instead of comparing `createdAt`.
- That means the logic is only correct relative to the fetch moment, not the current moment, and it depends on a presentation format staying machine-parseable.

Recommendation:
- always filter on `createdAt`
- keep `time` as pure presentation data

### DASH-05: Competitor attribution relies on naive substring matching over raw LLM output

Impact: co-mention filters and competitor trends can be wrong, and the detection cost scales with `responses × competitors`.

References:
- [dashboard-data.ts](/var/www/microservices-go/apps/app/src/lib/dashboard-data.ts#L515)
- [dashboard-data.ts](/var/www/microservices-go/apps/app/src/lib/dashboard-data.ts#L518)
- [analytics-utils.ts](/var/www/microservices-go/apps/app/src/features/monitoring/_components/analytics-panel/analytics-utils.ts#L48)
- [filters-panel.tsx](/var/www/microservices-go/apps/app/src/features/monitoring/_components/filters-panel/filters-panel.tsx#L169)

Details:
- `competitorsMentioned` is inferred with `rawResponse.toLowerCase().includes(name.toLowerCase())`.
- This can over-match or under-match, depending on punctuation, aliases, word boundaries and naming collisions.
- The rest of the dashboard then treats this derived array as trusted business data for filters, SOV and trends.

Recommendation:
- move competitor detection to backend enrichment where aliases and tokenization can be controlled
- if it must stay frontend-side, use normalized token/boundary matching instead of raw substring search

## Low Severity

### DASH-06: Backend-provided icon URLs are rendered directly in dashboard images

Impact: model catalog data can cause browser requests to arbitrary origins, which creates avoidable privacy leakage and weakens asset control.

References:
- [model-card.tsx](/var/www/microservices-go/apps/app/src/features/monitoring/_components/filters-panel/model-card.tsx#L43)
- [activity-prompts-stream.tsx](/var/www/microservices-go/apps/app/src/features/monitoring/_components/activity-panel/activity-prompts-stream.tsx#L60)
- [activity-detail-sheets.tsx](/var/www/microservices-go/apps/app/src/features/monitoring/_components/activity-panel/activity-detail-sheets.tsx#L352)

Details:
- `iconPath` / `modelIconPath` from API payloads is passed directly to `<img src>`.
- That is not an XSS issue by itself, but it does let backend data trigger third-party requests from the client.

Recommendation:
- restrict icons to known local asset paths or a trusted CDN allowlist
- reject `data:`, `javascript:` and unexpected remote origins before rendering

## Positive Notes

- I did not find any `dangerouslySetInnerHTML` usage in the dashboard path reviewed.
- User-provided text appears to be rendered as normal React text nodes, which is the right default.
- `react-query` global defaults are sane for this page: `staleTime` is non-zero and `refetchOnWindowFocus` is disabled.

## Review Limits

- This was a static code review of the frontend dashboard path only.
- I did not run a profiler, accessibility audit, browser memory trace or backend authorization test during this review.
