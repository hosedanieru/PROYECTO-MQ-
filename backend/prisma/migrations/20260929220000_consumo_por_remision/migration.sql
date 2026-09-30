-- Consumo de PI e insumos al aprobar una remisión (usuario, 2026-09-29):
-- cada salida automática queda enlazada a la remisión que la causó.
ALTER TABLE "movimiento_inventario" ADD COLUMN "remision_id" TEXT;

CREATE INDEX "movimiento_inventario_remision_id_idx" ON "movimiento_inventario"("remision_id");

ALTER TABLE "movimiento_inventario" ADD CONSTRAINT "movimiento_inventario_remision_id_fkey" FOREIGN KEY ("remision_id") REFERENCES "remision"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
