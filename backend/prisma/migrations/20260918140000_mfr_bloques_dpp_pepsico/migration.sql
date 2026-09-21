-- CreateEnum
CREATE TYPE "TipoLinea" AS ENUM ('MULTIPACK', 'MANUAL');

-- CreateEnum
CREATE TYPE "OrigenBloque" AS ENUM ('MANUAL', 'DPP', 'COPIA');

-- DropForeignKey
ALTER TABLE "config_turno" DROP CONSTRAINT "config_turno_cerrada_por_id_fkey";

-- DropForeignKey
ALTER TABLE "config_turno" DROP CONSTRAINT "config_turno_configurada_por_id_fkey";

-- DropForeignKey
ALTER TABLE "config_turno" DROP CONSTRAINT "config_turno_linea_id_fkey";

-- DropForeignKey
ALTER TABLE "config_turno" DROP CONSTRAINT "config_turno_producto_id_fkey";

-- DropForeignKey
ALTER TABLE "config_turno" DROP CONSTRAINT "config_turno_turno_id_fkey";

-- DropForeignKey
ALTER TABLE "programacion" DROP CONSTRAINT "programacion_cargada_por_id_fkey";

-- DropForeignKey
ALTER TABLE "programacion" DROP CONSTRAINT "programacion_producto_id_fkey";

-- AlterTable
ALTER TABLE "linea_produccion" ADD COLUMN     "capacidad_kg_hora" DECIMAL(8,2),
ADD COLUMN     "orden" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "tipo" "TipoLinea" NOT NULL DEFAULT 'MANUAL';

-- AlterTable
ALTER TABLE "producto" DROP COLUMN "cajas_por_hora",
DROP COLUMN "unidades_por_hora",
ADD COLUMN     "bpm" DECIMAL(8,2),
ADD COLUMN     "peso_neto_kg" DECIMAL(8,3);

-- DropTable
DROP TABLE "config_turno";

-- DropTable
DROP TABLE "programacion";

-- CreateTable
CREATE TABLE "bloque_programacion" (
    "id" TEXT NOT NULL,
    "fecha_operativa" DATE NOT NULL,
    "linea_id" TEXT NOT NULL,
    "turno_id" TEXT NOT NULL,
    "producto_id" TEXT NOT NULL,
    "hora_inicio" TEXT NOT NULL,
    "hora_fin" TEXT NOT NULL,
    "bpm" DECIMAL(8,2) NOT NULL,
    "eficiencia_porcentaje" DECIMAL(5,2) NOT NULL,
    "loop" TEXT,
    "personas_asignadas" INTEGER,
    "origen" "OrigenBloque" NOT NULL DEFAULT 'MANUAL',
    "creado_por_id" TEXT NOT NULL,
    "fecha_creacion" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "cerrado_en" TIMESTAMPTZ(3),
    "cerrado_por_id" TEXT,

    CONSTRAINT "bloque_programacion_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "bloque_programacion_fecha_operativa_idx" ON "bloque_programacion"("fecha_operativa");

-- CreateIndex
CREATE INDEX "bloque_programacion_fecha_operativa_linea_id_idx" ON "bloque_programacion"("fecha_operativa", "linea_id");

-- AddForeignKey
ALTER TABLE "bloque_programacion" ADD CONSTRAINT "bloque_programacion_linea_id_fkey" FOREIGN KEY ("linea_id") REFERENCES "linea_produccion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bloque_programacion" ADD CONSTRAINT "bloque_programacion_turno_id_fkey" FOREIGN KEY ("turno_id") REFERENCES "turno"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bloque_programacion" ADD CONSTRAINT "bloque_programacion_producto_id_fkey" FOREIGN KEY ("producto_id") REFERENCES "producto"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bloque_programacion" ADD CONSTRAINT "bloque_programacion_creado_por_id_fkey" FOREIGN KEY ("creado_por_id") REFERENCES "usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bloque_programacion" ADD CONSTRAINT "bloque_programacion_cerrado_por_id_fkey" FOREIGN KEY ("cerrado_por_id") REFERENCES "usuario"("id") ON DELETE SET NULL ON UPDATE CASCADE;
