---
name: frontend-feature-structure
description: Use when creating, refactoring, reviewing, or moving frontend feature folders under apps/app/src/features. Follow the monitoring feature structure with index.tsx/layout.tsx, _components grouped by panel, and _lib grouped by panel/shared.
---

# Frontend Feature Structure

Use `apps/app/src/features/monitoring` as the reference structure for frontend features.

## Target Shape

```text
features/<feature>/
  index.tsx
  layout.tsx
  _components/
    <panel>/
      index.tsx
      template.tsx
      *.tsx
  _lib/
    <panel>/
      use-<panel>-panel-view-model.ts
      *.ts
      types.ts
    shared/
      *.ts
```

For a small feature, keep only the folders and files that are useful. Do not create empty folders.

## Responsibilities

- `index.tsx`: public feature entry. Compose feature-level providers and render the feature layout.
- `layout.tsx`: page or feature shell. Compose the major panels/regions only.
- `_components/<panel>/index.tsx`: panel container. Call the panel view-model hook, handle loading with `Template`, and compose presentational components.
- `_components/<panel>/template.tsx`: loading skeleton for that panel. Keep it colocated with the panel it represents.
- `_components/<panel>/*.tsx`: focused presentational components for that panel.
- `_lib/<panel>/use-<panel>-panel-view-model.ts`: UI orchestration hook for the panel. Read stores/data hooks, derive view data, expose callbacks.
- `_lib/<panel>/*.ts`: pure helpers, mappers, constants, panel-local types.
- `_lib/shared/*.ts`: logic shared by multiple panels inside the same feature.

## Rules

1. Prefer this monitoring-style shape for new frontend features and migrated features.
2. Do not introduce `view/`, `views/`, `components/`, `hooks/`, or `core/` folders for features that are following this pattern.
3. Keep feature-private files under underscored folders: `_components` and `_lib`.
4. Use kebab-case file names for components and helpers.
5. Name the main panel export `<PanelName>Panel` when the folder is a page region, for example `FiltersPanel` or `AnalyticsPanel`.
6. Keep `layout.tsx` thin. It should not own business logic, data mapping, or large local state.
7. Keep panel `index.tsx` files readable: load the view model, branch on loading/error/empty states, then render child components.
8. Put derived data and callbacks in `_lib/<panel>/use-*-view-model.ts`, not in deeply nested presentational components.
9. Put cross-feature UI in `apps/app/src/components/shared` or `features/shared`; do not leak one feature's `_components` into another feature.
10. Use `@/` imports for shared app modules and relative imports inside the feature.

## Migration Workflow

1. Identify the feature's main route/page entry and turn it into `index.tsx`.
2. Move shell composition into `layout.tsx`.
3. Split page regions into `_components/<panel>/index.tsx`.
4. Colocate each panel loading state in `_components/<panel>/template.tsx`.
5. Move panel-specific hooks, helpers, and types into `_lib/<panel>`.
6. Move logic used by several panels into `_lib/shared`.
7. Update external imports to use the feature public entry where possible.
8. Run the smallest useful validation after each migration slice.

## Validation

Use targeted validation first:

```bash
docker run --rm -v /home/bastiencdr/dev/microservices-go/apps/app:/app -w /app oven/bun:alpine bun x tsc --noEmit
```

For changed tests:

```bash
docker run --rm -v /home/bastiencdr/dev/microservices-go/apps/app:/app -w /app oven/bun:alpine bun test <test-file>
```
