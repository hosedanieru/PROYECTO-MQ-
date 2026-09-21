-- CreateTable
CREATE TABLE "asignacion_linea" (
    "id" TEXT NOT NULL,
    "fecha_operativa" DATE NOT NULL,
    "turno_id" TEXT NOT NULL,
    "linea_id" TEXT NOT NULL,
    "grupo_id" TEXT NOT NULL,
    "personas" INTEGER NOT NULL,
    "registrada_por_id" TEXT NOT NULL,
    "fecha_registro" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "asignacion_linea_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "asignacion_linea_fecha_operativa_idx" ON "asignacion_linea"("fecha_operativa");

-- CreateIndex
CREATE UNIQUE INDEX "asignacion_linea_fecha_operativa_turno_id_linea_id_grupo_id_key" ON "asignacion_linea"("fecha_operativa", "turno_id", "linea_id", "grupo_id");

-- AddForeignKey
ALTER TABLE "asignacion_linea" ADD CONSTRAINT "asignacion_linea_turno_id_fkey" FOREIGN KEY ("turno_id") REFERENCES "turno"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "asignacion_linea" ADD CONSTRAINT "asignacion_linea_linea_id_fkey" FOREIGN KEY ("linea_id") REFERENCES "linea_produccion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "asignacion_linea" ADD CONSTRAINT "asignacion_linea_grupo_id_fkey" FOREIGN KEY ("grupo_id") REFERENCES "grupo"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "asignacion_linea" ADD CONSTRAINT "asignacion_linea_registrada_por_id_fkey" FOREIGN KEY ("registrada_por_id") REFERENCES "usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
