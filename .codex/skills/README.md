# Codex Skills Layout

Ce dossier est organisé par domaine pour que Codex retrouve rapidement les `SKILL.md`.

## Structure

```text
.codex/skills/
  backend/
    architecture/
    golang-patterns/
    golang-pro/
    golang-testing/
    sqlc-pgx-squirrel-migrate/
    stripe-integration/
    test-driven-development/
  documentation/
    code-documenter/
    docusaurus/
    fumadocs-builder/
    technical-writer/
  frontend/
    frontend-patterns/
    nextjs-best-practices/
    tailwind-design-system/
    typescript-review/
    typescript-write/
    ui-ux-pro-max/
  infra/
    docker/
    kratos/
    langchain-architecture/
    rabbitmq-queue-setup/
  mcp-builder/
  projet/
    context/
```

## Règles d'organisation

- Un skill = un dossier contenant `SKILL.md` à sa racine.
- Les ressources annexes restent dans des sous-dossiers standards:
  - `references/`
  - `scripts/`
  - `assets/`
- Éviter les doubles imbrications du type `skill/skill/`.
- Les chemins documentés dans les skills doivent pointer vers `.codex/skills/...` ou des chemins relatifs valides.

## Migration effectuée

Les dossiers suivants ont été aplatis:

- `backend/test-driven-development/test-driven-development` -> `backend/test-driven-development`
- `documentation/code-documenter/code-documenter` -> `documentation/code-documenter`
- `mcp-builder/mcp-builder` -> `mcp-builder`
