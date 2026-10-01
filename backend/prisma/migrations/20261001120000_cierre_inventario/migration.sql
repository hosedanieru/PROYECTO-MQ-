-- Cierre del dia (usuario, 2026-10-01): conteo fisico de los materiales de las recetas y su merma.
-- AlterTable
ALTER TABLE "movimiento_inventario" ADD COLUMN     "cierre_id" TEXT;

-- CreateTable
CREATE TABLE "cierre_inventario" (
    "id" TEXT NOT NULL,
    "fecha_operativa" DATE NOT NULL,
    "fecha_hora_registro" TIMESTAMPTZ(3) NOT NULL,
    "usuario_id" TEXT NOT NULL,
    "usuario_nombre" TEXT NOT NULL,
    "observacion" TEXT,

    CONSTRAINT "cierre_inventario_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cierre_inventario_linea" (
    "id" TEXT NOT NULL,
    "cierre_id" TEXT NOT NULL,
    "item_id" TEXT NOT NULL,
    "codigo" TEXT NOT NULL,
    "descripcion" TEXT NOT NULL,
    "unidad" TEXT NOT NULL,
    "existencia_sistema" DECIMAL(14,3) NOT NULL,
    "en_transito" DECIMAL(14,3) NOT NULL,
    "esperado" DECIMAL(14,3) NOT NULL,
    "contado" DECIMAL(14,3) NOT NULL,
    "merma" DECIMAL(14,3) NOT NULL,
    "consumo_teorico" DECIMAL(14,3) NOT NULL,
    "merma_porcentaje" DECIMAL(8,1),
    "conteo_texto" TEXT,

    CONSTRAINT "cierre_inventario_linea_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "cierre_inventario_fecha_operativa_key" ON "cierre_inventario"("fecha_operativa");

-- CreateIndex
CREATE UNIQUE INDEX "cierre_inventario_linea_cierre_id_item_id_key" ON "cierre_inventario_linea"("cierre_id", "item_id");

-- CreateIndex
CREATE INDEX "movimiento_inventario_cierre_id_idx" ON "movimiento_inventario"("cierre_id");

-- AddForeignKey
ALTER TABLE "movimiento_inventario" ADD CONSTRAINT "movimiento_inventario_cierre_id_fkey" FOREIGN KEY ("cierre_id") REFERENCES "cierre_inventario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cierre_inventario" ADD CONSTRAINT "cierre_inventario_usuario_id_fkey" FOREIGN KEY ("usuario_id") REFERENCES "usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cierre_inventario_linea" ADD CONSTRAINT "cierre_inventario_linea_cierre_id_fkey" FOREIGN KEY ("cierre_id") REFERENCES "cierre_inventario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cierre_inventario_linea" ADD CONSTRAINT "cierre_inventario_linea_item_id_fkey" FOREIGN KEY ("item_id") REFERENCES "item_inventario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

