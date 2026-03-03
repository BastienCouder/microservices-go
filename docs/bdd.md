# BDD (PostgreSQL) — schéma par service

Ce document recense les **tables et colonnes** utilisées par chaque service qui persiste des données en PostgreSQL.

Sources:
- Création des rôles + bases: `deployments/postgres/init-multiple-databases.sql`
- Migrations SQL: `services/*/internal/adapter/repository/postgres/migrations/sql/*.sql`

## api-gateway

- Pas de base de données (service de reverse-proxy + auth + permission checks).

## auth-service (Kratos)

- Base: `kratos` (provisionnée par `deployments/postgres/init-multiple-databases.sql`)
- Schéma: **géré par Ory Kratos** (tables Kratos créées via `kratos-migrate` et la config dans `deployments/kratos/`).
- Ce repo ne versionne pas directement les `CREATE TABLE ...` Kratos dans `services/auth-service/`.

## user-service

- Base: `usersvc`
- Migrations:
  - `services/user-service/internal/adapter/repository/postgres/migrations/sql/000001_init.up.sql`
  - `services/user-service/internal/adapter/repository/postgres/migrations/sql/000002_soft_delete_and_banned.up.sql`

### Table `users`

| Colonne | Type | Contraintes / notes |
| --- | --- | --- |
| `id` | `BIGSERIAL` | PK |
| `auth_identity_id` | `TEXT` | unique **(actifs uniquement)** via index partiel quand `deleted_at IS NULL` |
| `email` | `TEXT` | unique **(actifs uniquement)** via index partiel quand `deleted_at IS NULL` |
| `first_name` | `TEXT` | NOT NULL |
| `last_name` | `TEXT` | NOT NULL |
| `banned` | `BOOLEAN` | NOT NULL, DEFAULT `FALSE` |
| `banned_at` | `TIMESTAMPTZ` | nullable |
| `created_at` | `TIMESTAMPTZ` | NOT NULL |
| `deleted_at` | `TIMESTAMPTZ` | nullable (soft delete) |

Indexes:
- `idx_users_auth_identity_id_active` unique sur `auth_identity_id` WHERE `deleted_at IS NULL`
- `idx_users_email_active` unique sur `email` WHERE `deleted_at IS NULL`
- `idx_users_deleted_at` sur `deleted_at`

## organizations-service

- Base: `orgsvc`
- Migrations:
  - `services/organizations-service/internal/adapter/repository/postgres/migrations/sql/000001_init.up.sql`
  - `services/organizations-service/internal/adapter/repository/postgres/migrations/sql/000002_soft_delete.up.sql`

### Table `organizations`

| Colonne | Type | Contraintes / notes |
| --- | --- | --- |
| `id` | `BIGSERIAL` | PK |
| `name` | `TEXT` | NOT NULL |
| `owner_user_id` | `BIGINT` | NOT NULL |
| `created_at` | `TIMESTAMPTZ` | NOT NULL |
| `deleted_at` | `TIMESTAMPTZ` | nullable (soft delete) |

Index:
- `idx_organizations_deleted_at` sur `deleted_at`

### Table `teams`

| Colonne | Type | Contraintes / notes |
| --- | --- | --- |
| `id` | `BIGSERIAL` | PK |
| `organization_id` | `BIGINT` | NOT NULL, FK → `organizations(id)` ON DELETE CASCADE |
| `name` | `TEXT` | NOT NULL |
| `created_at` | `TIMESTAMPTZ` | NOT NULL |
| `deleted_at` | `TIMESTAMPTZ` | nullable (soft delete) |

Indexes:
- `idx_teams_organization_id` sur `organization_id`
- `idx_teams_deleted_at` sur `deleted_at`

### Table `organization_members`

| Colonne | Type | Contraintes / notes |
| --- | --- | --- |
| `organization_id` | `BIGINT` | NOT NULL, FK → `organizations(id)` ON DELETE CASCADE |
| `user_id` | `BIGINT` | NOT NULL |
| `team_id` | `BIGINT` | nullable, FK → `teams(id)` ON DELETE SET NULL |
| `added_at` | `TIMESTAMPTZ` | NOT NULL |
| `deleted_at` | `TIMESTAMPTZ` | nullable (soft delete) |

Clé primaire:
- (`organization_id`, `user_id`)

Indexes:
- `idx_members_organization_id` sur `organization_id`
- `idx_organization_members_deleted_at` sur `deleted_at`

### Table `member_roles`

| Colonne | Type | Contraintes / notes |
| --- | --- | --- |
| `organization_id` | `BIGINT` | NOT NULL |
| `user_id` | `BIGINT` | NOT NULL |
| `role` | `TEXT` | NOT NULL |

Clé primaire:
- (`organization_id`, `user_id`, `role`)

Contraintes:
- FK (`organization_id`, `user_id`) → `organization_members(organization_id, user_id)` ON DELETE CASCADE

Index:
- `idx_member_roles_org_user` sur (`organization_id`, `user_id`)

## permission-service

- Base: `permsvc`
- Migration:
  - `services/permission-service/internal/adapter/repository/postgres/migrations/sql/000001_init.up.sql`

### Table `permission_role_policies`

| Colonne | Type | Contraintes / notes |
| --- | --- | --- |
| `id` | `BIGSERIAL` | PK |
| `organization_id` | `BIGINT` | NOT NULL |
| `role` | `TEXT` | NOT NULL |
| `action` | `TEXT` | NOT NULL |
| `resource` | `TEXT` | NOT NULL |

Contraintes:
- UNIQUE (`organization_id`, `role`, `action`, `resource`)

Index:
- `idx_permission_lookup` sur (`organization_id`, `role`, `action`, `resource`)

Seed:
- `(0, 'member', 'read', '*')` inséré si absent.

## billing-service

- Base: `billsvc`
- Migration:
  - `services/billing-service/internal/adapter/repository/postgres/migrations/sql/000001_init.up.sql`

### Table `billing_subscriptions`

| Colonne | Type | Contraintes / notes |
| --- | --- | --- |
| `organization_id` | `BIGINT` | PK |
| `plan` | `TEXT` | NOT NULL |
| `seats` | `INTEGER` | NOT NULL |
| `monthly_quota` | `INTEGER` | NOT NULL |
| `updated_at` | `TIMESTAMPTZ` | NOT NULL |

## notification-service

- Base: `notifsvc`
- Migration:
  - `services/notification-service/internal/adapter/repository/postgres/migrations/sql/000001_init.up.sql`

### Table `notifications`

| Colonne | Type | Contraintes / notes |
| --- | --- | --- |
| `id` | `BIGSERIAL` | PK |
| `channel` | `TEXT` | NOT NULL |
| `recipient` | `TEXT` | NOT NULL |
| `subject` | `TEXT` | nullable |
| `message` | `TEXT` | NOT NULL |
| `created_at` | `TIMESTAMPTZ` | NOT NULL |

Index:
- `idx_notifications_created_at` sur (`created_at` DESC)

