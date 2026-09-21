-- Decision del area (2026-09-21): "proveedor" pasa a llamarse "grupo".
-- Se RENOMBRA (tabla, columna, restricciones e indices) para conservar los datos.
ALTER TABLE "proveedor" RENAME TO "grupo";
ALTER TABLE "grupo" RENAME CONSTRAINT "proveedor_pkey" TO "grupo_pkey";
ALTER INDEX "proveedor_codigo_key" RENAME TO "grupo_codigo_key";
ALTER TABLE "grupo" ADD COLUMN "descripcion" TEXT, ADD COLUMN "personas_esperadas" INTEGER;

ALTER TABLE "remision" RENAME COLUMN "proveedor_id" TO "grupo_id";
ALTER TABLE "remision" RENAME CONSTRAINT "remision_proveedor_id_fkey" TO "remision_grupo_id_fkey";
ALTER INDEX "remision_proveedor_id_fecha_operativa_idx" RENAME TO "remision_grupo_id_fecha_operativa_idx";
