DO
$$
BEGIN
   IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'kratos') THEN
      CREATE ROLE kratos LOGIN PASSWORD 'kratos';
   END IF;
   IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'usersvc') THEN
      CREATE ROLE usersvc LOGIN PASSWORD 'usersvc';
   END IF;
   IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'orgsvc') THEN
      CREATE ROLE orgsvc LOGIN PASSWORD 'orgsvc';
   END IF;
   IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'permsvc') THEN
      CREATE ROLE permsvc LOGIN PASSWORD 'permsvc';
   END IF;
   IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'billsvc') THEN
      CREATE ROLE billsvc LOGIN PASSWORD 'billsvc';
   END IF;
   IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'notifsvc') THEN
      CREATE ROLE notifsvc LOGIN PASSWORD 'notifsvc';
   END IF;
   IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'projectsvc') THEN
      CREATE ROLE projectsvc LOGIN PASSWORD 'projectsvc';
   END IF;
   IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'analysissvc') THEN
      CREATE ROLE analysissvc LOGIN PASSWORD 'analysissvc';
   END IF;
   IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'attrsvc') THEN
      CREATE ROLE attrsvc LOGIN PASSWORD 'attrsvc';
   END IF;
END
$$;

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

SELECT 'CREATE DATABASE projectsvc OWNER projectsvc'
WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = 'projectsvc')\gexec

SELECT 'CREATE DATABASE analysissvc OWNER analysissvc'
WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = 'analysissvc')\gexec

SELECT 'CREATE DATABASE attrsvc OWNER attrsvc'
WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = 'attrsvc')\gexec
