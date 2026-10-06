-- AlterTable
ALTER TABLE "lista_distribucion" ADD COLUMN     "recibe" TEXT NOT NULL DEFAULT 'REMISIONES';

-- CreateTable
CREATE TABLE "resumen_turno" (
    "id" TEXT NOT NULL,
    "tipo" TEXT NOT NULL,
    "anio" INTEGER NOT NULL,
    "numero" INTEGER NOT NULL,
    "fecha_operativa" DATE NOT NULL,
    "turno_id" TEXT,
    "formato_codigo" TEXT,
    "formato_version" TEXT,
    "formato_vigencia" TEXT,
    "datos" JSONB NOT NULL,
    "cerrado_por_id" TEXT NOT NULL,
    "cerrado_por_nombre" TEXT NOT NULL,
    "fecha_hora" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "resumen_turno_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "resumen_turno_fecha_operativa_idx" ON "resumen_turno"("fecha_operativa");

-- CreateIndex
CREATE UNIQUE INDEX "resumen_turno_tipo_anio_numero_key" ON "resumen_turno"("tipo", "anio", "numero");

-- AddForeignKey
ALTER TABLE "resumen_turno" ADD CONSTRAINT "resumen_turno_turno_id_fkey" FOREIGN KEY ("turno_id") REFERENCES "turno"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "resumen_turno" ADD CONSTRAINT "resumen_turno_cerrado_por_id_fkey" FOREIGN KEY ("cerrado_por_id") REFERENCES "usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

