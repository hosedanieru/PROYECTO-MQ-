-- =============================================================
-- USUARIO DE APLICACIÓN CON PERMISOS LIMITADOS
-- =============================================================
--
-- En desarrollo la API usa el superusuario `postgres`. En producción no:
-- si la API se ve comprometida, el atacante no debe poder borrar tablas,
-- crear extensiones ni tocar otras bases.
--
-- Este script lo ejecuta PostgreSQL al inicializar el volumen (Docker) o
-- se corre a mano una vez:
--
--   psql -U postgres -d mq -f database/crear-usuario-app.sql
--   psql -U postgres -d mq -c "ALTER ROLE mq_app PASSWORD 'clave-real'"
--
-- Después, la API se conecta con:
--   DATABASE_URL=postgresql://mq_app:<clave>@db:5432/mq?schema=public
--
-- Las MIGRACIONES y el SEED se siguen corriendo con el superusuario
-- (crean y alteran tablas). `mq_app` solo lee y escribe filas.
--
-- Es idempotente y puede correr ANTES de las migraciones: los permisos
-- sobre tablas futuras quedan cubiertos por ALTER DEFAULT PRIVILEGES, y
-- las restricciones sobre tablas concretas se aplican solo si existen.

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'mq_app') THEN
    -- Clave de reemplazo: cambiarla con ALTER ROLE antes de usar en producción.
    CREATE ROLE mq_app LOGIN PASSWORD 'CAMBIAR_ESTA_CLAVE';
    RAISE NOTICE 'Rol mq_app creado con clave de reemplazo. Ejecute: ALTER ROLE mq_app PASSWORD ''...''';
  END IF;

  -- Solo esta base y solo el esquema public.
  EXECUTE format('GRANT CONNECT ON DATABASE %I TO mq_app', current_database());
  GRANT USAGE ON SCHEMA public TO mq_app;

  -- Filas: leer y escribir. Nunca DROP, TRUNCATE ni ALTER.
  GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO mq_app;
  GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO mq_app;

  -- Las tablas que creen las migraciones (como superusuario) heredan lo mismo.
  ALTER DEFAULT PRIVILEGES IN SCHEMA public
    GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO mq_app;
  ALTER DEFAULT PRIVILEGES IN SCHEMA public
    GRANT USAGE, SELECT ON SEQUENCES TO mq_app;

  -- Las remisiones nunca se eliminan (regla de negocio). Se refuerza en la
  -- base: ni siquiera la API puede borrarlas por error. Solo si ya existen.
  IF to_regclass('public.remision') IS NOT NULL THEN
    REVOKE DELETE ON remision, remision_version, auditoria FROM mq_app;
  END IF;
END
$$;
