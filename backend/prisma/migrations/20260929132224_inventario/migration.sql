-- CreateEnum
CREATE TYPE "TipoItemInventario" AS ENUM ('INSUMO', 'PI', 'PT');

-- CreateEnum
CREATE TYPE "TipoMovimientoInventario" AS ENUM ('ENTRADA', 'SALIDA', 'AJUSTE');

-- CreateTable
CREATE TABLE "item_inventario" (
    "id" TEXT NOT NULL,
    "tipo" "TipoItemInventario" NOT NULL,
    "codigo" TEXT,
    "descripcion" TEXT,
    "unidad_medida" TEXT NOT NULL,
    "producto_id" TEXT,
    "existencia" DECIMAL(14,3) NOT NULL DEFAULT 0,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "creado_en" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actualizado_en" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "item_inventario_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "movimiento_inventario" (
    "id" TEXT NOT NULL,
    "item_id" TEXT NOT NULL,
    "tipo" "TipoMovimientoInventario" NOT NULL,
    "cantidad" DECIMAL(14,3) NOT NULL,
    "saldo" DECIMAL(14,3) NOT NULL,
    "fecha_hora_registro" TIMESTAMPTZ(3) NOT NULL,
    "fecha_operativa" DATE NOT NULL,
    "turno_id" TEXT NOT NULL,
    "usuario_id" TEXT NOT NULL,
    "usuario_nombre" TEXT NOT NULL,
    "referencia" TEXT,
    "observacion" TEXT,
    "motivo" TEXT,

    CONSTRAINT "movimiento_inventario_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "item_inventario_codigo_key" ON "item_inventario"("codigo");

-- CreateIndex
CREATE UNIQUE INDEX "item_inventario_producto_id_key" ON "item_inventario"("producto_id");

-- CreateIndex
CREATE INDEX "item_inventario_tipo_idx" ON "item_inventario"("tipo");

-- CreateIndex
CREATE INDEX "movimiento_inventario_item_id_fecha_hora_registro_idx" ON "movimiento_inventario"("item_id", "fecha_hora_registro");

-- CreateIndex
CREATE INDEX "movimiento_inventario_fecha_operativa_idx" ON "movimiento_inventario"("fecha_operativa");

-- AddForeignKey
ALTER TABLE "item_inventario" ADD CONSTRAINT "item_inventario_producto_id_fkey" FOREIGN KEY ("producto_id") REFERENCES "producto"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "movimiento_inventario" ADD CONSTRAINT "movimiento_inventario_item_id_fkey" FOREIGN KEY ("item_id") REFERENCES "item_inventario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "movimiento_inventario" ADD CONSTRAINT "movimiento_inventario_turno_id_fkey" FOREIGN KEY ("turno_id") REFERENCES "turno"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "movimiento_inventario" ADD CONSTRAINT "movimiento_inventario_usuario_id_fkey" FOREIGN KEY ("usuario_id") REFERENCES "usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
