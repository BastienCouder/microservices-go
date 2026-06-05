---
name: geo-saas-pricing
description: Use when working on GEO/AI Search Visibility SaaS pricing, billing plan defaults, pricing tiers, Stripe catalog sync, credit quotas, or pricing copy. Keeps the final fixed-plan pricing strategy aligned with the June 2026 pricing document.
---

# GEO SaaS Pricing

## Final Direction

- Use fixed plans with included monthly credits.
- Do not expose free credit selection or launch standalone credit packs.
- Do not make Developer a public pricing plan.
- Keep Growth as the highlighted/default commercial plan.
- Treat the technical `pro` plan as the public Agency offer until plan identifiers are refactored.
- Enterprise is sales-led/sur devis and should not get a low fixed public price.

## Final Grid

| Public plan | Technical plan | Monthly | Annual monthly equivalent | Credits/month | Projects | Models | Seats |
| --- | --- | ---: | ---: | ---: | ---: | ---: | ---: |
| Starter | `starter` | 59 EUR | 49 EUR | 100 | 1 | 2 | 1 |
| Growth | `growth` | 199 EUR | 159 EUR | 750 | 5 | 6 | 3 |
| Agency | `pro` | 499 EUR | 399 EUR | 3000 | 20 | 15 | 5 |
| Enterprise | sales-led | Custom | Custom | Custom | Custom | Custom | Custom |

## Implementation Notes

- Billing default plan settings live in `services/billing-service/internal/usecase/plan_settings.go`.
- Default public/admin price tiers live in `services/billing-service/internal/usecase/pricing_tiers.go`.
- Stripe fallback quotas live in `services/billing-service/internal/usecase/service_stripe.go`.
- UI labels for known plan codes live in `apps/app/src/shared/billing-plan.ts`.
- Stripe catalog product names live in `services/billing-service/internal/usecase/service_stripe_catalog.go`.

## Credit Usage Model

Core principle: credits should charge actions that consume AI, crawl, or heavier analysis. Dashboards, saved history, simple exports, and integrations setup should stay free.

### Base Rules

| Usage | Recommended cost |
| --- | ---: |
| 1 monitoring prompt on 1 standard model | 1 credit |
| 1 premium-model response | 2-4 credits, based on model cost |
| Monitoring run | `prompt_count * sum(model_credit_costs)` |
| Manual re-run | Same cost as the original run |

### Monitoring

| Action | Credits |
| --- | ---: |
| 1 prompt x 1 model | 1 |
| 1 prompt x 3 models | 3 |
| 10 prompts x 3 models | 30 |
| Dashboard/history read | 0 |

### Perception

| Action | Credits |
| --- | ---: |
| Brand canon extraction from site | 5 |
| Simple brand perception analysis | 10 |
| Full perception with competitors | 25 |
| Perception recalculation by model | 5 per model |
| Dashboard read | 0 |

Default app perception analysis uses the simple perception base: `10 + 5 * sum(model_credit_costs)`.

### Crawler And Content Audit

| Action | Credits |
| --- | ---: |
| Homepage and key pages crawl, up to 10 pages | 10 |
| Medium crawl, up to 50 pages | 35 |
| Large crawl, up to 200 pages | 100 |
| Extra pages after included limit | 1 per 5 pages |
| Robots/sitemap/headers-only check | 2 |

### AI Agent Ready Audit

| Action | Credits |
| --- | ---: |
| Quick URL audit | 5 |
| Full domain audit | 20 |
| Full domain audit with prioritized recommendations | 30 |
| Re-scan after fixes | 50% of initial cost |

### Recommendations And Correction

| Action | Credits |
| --- | ---: |
| Simple recommendations | 5 |
| Full prioritized action plan | 15 |
| Generate FAQ or short content section | 10 |
| Generate comparison page or long draft | 25 |
| Markdown/PDF export | 0-2 |

### Attribution And GA4

| Action | Credits |
| --- | ---: |
| GA4 connection/setup | 0 |
| Daily AI traffic sync | 0 |
| Monthly attribution report | 10 |
| AI traffic to leads/revenue funnel analysis | 15 |
| Dashboard read | 0 |

### Plan Fit

| Plan | Credits/month | Natural usage |
| --- | ---: | --- |
| Starter | 100 | Small monitoring plus a few audits |
| Growth | 750 | Monitoring, perception, crawler, and recommendations loop |
| Agency | 3000 | Multi-client monitoring, crawls, reports, and recommendations |
| Enterprise | Custom | High volume, premium models, custom SLA, security, and support |

## Guardrails

- For pricing-only changes, update numeric prices, quotas, limits, and labels only.
- Avoid adding UI controls, checkout flows, entitlement types, or credit-pack features unless explicitly requested.
- If adding Enterprise later, prefer a dedicated plan identifier and sales/contact flow instead of mapping it to unlimited credits.
- Do not charge passive reading, dashboards, setup screens, or basic saved history.
