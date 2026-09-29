-- AlterTable
ALTER TABLE "movimiento_inventario" ADD COLUMN     "entrada_id" TEXT;

-- CreateTable
CREATE TABLE "entrada_mercancia" (
    "id" TEXT NOT NULL,
    "documento" TEXT NOT NULL,
    "remitente" TEXT,
    "observacion" TEXT,
    "fecha_hora_registro" TIMESTAMPTZ(3) NOT NULL,
    "fecha_operativa" DATE NOT NULL,
    "turno_id" TEXT NOT NULL,
    "usuario_id" TEXT NOT NULL,
    "usuario_nombre" TEXT NOT NULL,

    CONSTRAINT "entrada_mercancia_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "entrada_mercancia_fecha_operativa_idx" ON "entrada_mercancia"("fecha_operativa");

-- CreateIndex
CREATE INDEX "movimiento_inventario_entrada_id_idx" ON "movimiento_inventario"("entrada_id");

-- AddForeignKey
ALTER TABLE "movimiento_inventario" ADD CONSTRAINT "movimiento_inventario_entrada_id_fkey" FOREIGN KEY ("entrada_id") REFERENCES "entrada_mercancia"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "entrada_mercancia" ADD CONSTRAINT "entrada_mercancia_turno_id_fkey" FOREIGN KEY ("turno_id") REFERENCES "turno"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "entrada_mercancia" ADD CONSTRAINT "entrada_mercancia_usuario_id_fkey" FOREIGN KEY ("usuario_id") REFERENCES "usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
