-- Decision del area (2026-09-19): el ritmo se maneja en cajas por hora, no en bolsas por minuto.
-- Se renombra la columna (los datos de bloques son de prueba; el valor semantico cambia).
ALTER TABLE "producto" RENAME COLUMN "bpm" TO "cajas_por_hora";
ALTER TABLE "bloque_programacion" RENAME COLUMN "bpm" TO "cajas_por_hora";
