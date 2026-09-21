-- CreateTable
CREATE TABLE "asistencia_turno" (
    "id" TEXT NOT NULL,
    "fecha_operativa" DATE NOT NULL,
    "turno_id" TEXT NOT NULL,
    "grupo_id" TEXT NOT NULL,
    "personas_llegaron" INTEGER NOT NULL,
    "observacion" TEXT,
    "registrada_por_id" TEXT NOT NULL,
    "fecha_registro" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "asistencia_turno_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "asistencia_turno_fecha_operativa_idx" ON "asistencia_turno"("fecha_operativa");

-- CreateIndex
CREATE UNIQUE INDEX "asistencia_turno_fecha_operativa_turno_id_grupo_id_key" ON "asistencia_turno"("fecha_operativa", "turno_id", "grupo_id");

-- AddForeignKey
ALTER TABLE "asistencia_turno" ADD CONSTRAINT "asistencia_turno_turno_id_fkey" FOREIGN KEY ("turno_id") REFERENCES "turno"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "asistencia_turno" ADD CONSTRAINT "asistencia_turno_grupo_id_fkey" FOREIGN KEY ("grupo_id") REFERENCES "grupo"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "asistencia_turno" ADD CONSTRAINT "asistencia_turno_registrada_por_id_fkey" FOREIGN KEY ("registrada_por_id") REFERENCES "usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
