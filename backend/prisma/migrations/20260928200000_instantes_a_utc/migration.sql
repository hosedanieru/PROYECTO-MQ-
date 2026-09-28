-- ============================================================
-- Corrige los instantes guardados corridos por la zona de la sesión
-- ============================================================
--
-- Hasta el 2026-09-28, la aplicación se conectaba con la zona por
-- defecto del servidor (America/Bogota) y @prisma/adapter-pg enviaba las
-- fechas como hora UTC sin zona: la base las interpretaba como hora de
-- Bogotá y guardaba cada instante 5 horas adelantado. Desde ahora la
-- conexión fija la sesión en UTC (src/infrastructure/database/prisma/
-- adaptador-postgres.ts).
--
-- Todos los datos existentes los escribió la aplicación (Prisma calcula
-- también los @default(now()) y los @updatedAt), así que TODAS las
-- columnas timestamptz tienen el mismo desfase. Ninguna migración anterior
-- rellenó filas con now() del servidor.
--
-- El desfase se toma de la zona de ESTA sesión (la de la base por
-- defecto, la misma con la que se escribieron los datos):
--
--   Bogotá (−05:00): se restan 5 horas.
--   UTC (p. ej. PostgreSQL en Docker): desfase 0 → no cambia nada.
--
-- Por eso la migración es segura en cualquier base, incluida una nueva.
-- Las columnas DATE (fecha operativa, vencimiento) no tienen zona y no
-- se tocan.

DO $$
DECLARE
  desfase interval := make_interval(secs => extract(timezone FROM now()));
  columna record;
  filas bigint;
BEGIN
  IF desfase = interval '0' THEN
    RAISE NOTICE 'La sesión ya está en UTC: no hay nada que corregir.';
    RETURN;
  END IF;

  RAISE NOTICE 'Zona de la sesión: %, desfase a aplicar: %', current_setting('TimeZone'), desfase;

  FOR columna IN
    SELECT table_name, column_name
    FROM information_schema.columns
    WHERE table_schema = current_schema()
      AND data_type = 'timestamp with time zone'
      AND table_name <> '_prisma_migrations'
    ORDER BY table_name, column_name
  LOOP
    EXECUTE format(
      'UPDATE %I SET %I = %I + $1 WHERE %I IS NOT NULL',
      columna.table_name, columna.column_name, columna.column_name, columna.column_name
    ) USING desfase;
    GET DIAGNOSTICS filas = ROW_COUNT;
    RAISE NOTICE '  %.%: % filas', columna.table_name, columna.column_name, filas;
  END LOOP;
END $$;
