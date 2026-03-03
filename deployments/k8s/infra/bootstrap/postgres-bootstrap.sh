#!/usr/bin/env bash
set -euo pipefail

export PGPASSWORD="$(cat /run/secrets/postgres_superuser_password)"

psql "host=postgresql user=postgres dbname=postgres sslmode=disable" <<SQL
DO
\$\$
BEGIN
   IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'kratos') THEN
      CREATE ROLE kratos LOGIN PASSWORD '$(cat /run/secrets/kratos_db_password)';
   END IF;
   IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'usersvc') THEN
      CREATE ROLE usersvc LOGIN PASSWORD '$(cat /run/secrets/usersvc_db_password)';
   END IF;
   IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'orgsvc') THEN
      CREATE ROLE orgsvc LOGIN PASSWORD '$(cat /run/secrets/orgsvc_db_password)';
   END IF;
   IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'permsvc') THEN
      CREATE ROLE permsvc LOGIN PASSWORD '$(cat /run/secrets/permsvc_db_password)';
   END IF;
   IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'billsvc') THEN
      CREATE ROLE billsvc LOGIN PASSWORD '$(cat /run/secrets/billsvc_db_password)';
   END IF;
   IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'notifsvc') THEN
      CREATE ROLE notifsvc LOGIN PASSWORD '$(cat /run/secrets/notifsvc_db_password)';
   END IF;
END
\$\$;

SELECT 'CREATE DATABASE kratos OWNER kratos'
WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = 'kratos')\gexec

SELECT 'CREATE DATABASE usersvc OWNER usersvc'
WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = 'usersvc')\gexec

SELECT 'CREATE DATABASE orgsvc OWNER orgsvc'
WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = 'orgsvc')\gexec

SELECT 'CREATE DATABASE permsvc OWNER permsvc'
WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = 'permsvc')\gexec

SELECT 'CREATE DATABASE billsvc OWNER billsvc'
WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = 'billsvc')\gexec

SELECT 'CREATE DATABASE notifsvc OWNER notifsvc'
WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = 'notifsvc')\gexec
SQL
