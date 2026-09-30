-- Inventario con decimales (usuario, 2026-09-29): los insumos se llevan en
-- su medida exacta (metros de cinta…) y el PT los descuenta con decimales.
-- Escrita a mano: `migrate dev` pide confirmación al quitar `por_cajas`.

-- 1. Existencias y kardex: enteros → 3 decimales (conversión sin pérdida).
ALTER TABLE "item_inventario" ALTER COLUMN "existencia" SET DATA TYPE DECIMAL(14,3);
ALTER TABLE "item_inventario" ALTER COLUMN "existencia" SET DEFAULT 0;
ALTER TABLE "movimiento_inventario" ALTER COLUMN "cantidad" SET DATA TYPE DECIMAL(14,3);
ALTER TABLE "movimiento_inventario" ALTER COLUMN "saldo" SET DATA TYPE DECIMAL(14,3);

-- 2. Receta: cantidad por UNA caja. Una fila "N por X cajas" pasa a su
--    equivalente exacto N / X (redondeado a 3 decimales) antes de quitar la columna.
ALTER TABLE "receta_componente" DROP CONSTRAINT "receta_componente_cantidades_positivas";
ALTER TABLE "receta_componente" ALTER COLUMN "cantidad" SET DATA TYPE DECIMAL(14,3);
UPDATE "receta_componente" SET "cantidad" = ROUND("cantidad" / "por_cajas", 3) WHERE "por_cajas" <> 1;
ALTER TABLE "receta_componente" DROP COLUMN "por_cajas";
ALTER TABLE "receta_componente" ADD CONSTRAINT "receta_componente_cantidad_positiva" CHECK ("cantidad" > 0);

-- 3. PI e insumo: presentación (ROLLO…) con su contenido en la medida (50 METRO).
ALTER TABLE "pi" ADD COLUMN "presentacion_id" TEXT, ADD COLUMN "contenido_presentacion" DECIMAL(14,3);
ALTER TABLE "insumo" ADD COLUMN "presentacion_id" TEXT, ADD COLUMN "contenido_presentacion" DECIMAL(14,3);

ALTER TABLE "pi" ADD CONSTRAINT "pi_presentacion_id_fkey" FOREIGN KEY ("presentacion_id") REFERENCES "unidad_medida"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "insumo" ADD CONSTRAINT "insumo_presentacion_id_fkey" FOREIGN KEY ("presentacion_id") REFERENCES "unidad_medida"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Segunda defensa de la regla del dominio: presentación y contenido van juntos.
ALTER TABLE "pi" ADD CONSTRAINT "pi_presentacion_completa"
  CHECK (("presentacion_id" IS NULL) = ("contenido_presentacion" IS NULL) AND ("contenido_presentacion" IS NULL OR "contenido_presentacion" > 0));
ALTER TABLE "insumo" ADD CONSTRAINT "insumo_presentacion_completa"
  CHECK (("presentacion_id" IS NULL) = ("contenido_presentacion" IS NULL) AND ("contenido_presentacion" IS NULL OR "contenido_presentacion" > 0));
