-- CreateEnum
CREATE TYPE "EstadoReporteAveria" AS ENUM ('REGISTRADO', 'ANULADO');

-- CreateEnum
CREATE TYPE "UnidadMedidaAveria" AS ENUM ('UNIDAD', 'DOCENA', 'SIX', 'BOLSA');

-- CreateEnum
CREATE TYPE "TipoEvidenciaAveria" AS ENUM ('UNIDAD', 'LOTE_FECHA', 'CONJUNTO');

-- CreateTable
CREATE TABLE "reporte_averia" (
    "id" TEXT NOT NULL,
    "fecha_hora_registro" TIMESTAMPTZ(3) NOT NULL,
    "fecha_operativa" DATE NOT NULL,
    "turno_id" TEXT NOT NULL,
    "grupo_id" TEXT NOT NULL,
    "reportado_por_id" TEXT NOT NULL,
    "reportado_por_nombre" TEXT NOT NULL,
    "estado" "EstadoReporteAveria" NOT NULL DEFAULT 'REGISTRADO',
    "motivo_anulacion" TEXT,
    "anulado_por_id" TEXT,
    "fecha_anulacion" TIMESTAMPTZ(3),

    CONSTRAINT "reporte_averia_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "registro_averia" (
    "id" TEXT NOT NULL,
    "reporte_id" TEXT NOT NULL,
    "orden" INTEGER NOT NULL,
    "producto_id" TEXT NOT NULL,
    "producto_codigo" TEXT NOT NULL,
    "producto_descripcion" TEXT NOT NULL,
    "fecha_vencimiento" DATE NOT NULL,
    "lote" TEXT NOT NULL,
    "causal_id" TEXT NOT NULL,
    "linea_id" TEXT,
    "cantidad" INTEGER NOT NULL,
    "unidad_medida" "UnidadMedidaAveria" NOT NULL,

    CONSTRAINT "registro_averia_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "evidencia_averia" (
    "id" TEXT NOT NULL,
    "registro_id" TEXT NOT NULL,
    "tipo" "TipoEvidenciaAveria" NOT NULL,
    "ruta" TEXT NOT NULL,

    CONSTRAINT "evidencia_averia_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "reporte_averia_fecha_operativa_idx" ON "reporte_averia"("fecha_operativa");

-- CreateIndex
CREATE INDEX "registro_averia_reporte_id_idx" ON "registro_averia"("reporte_id");

-- CreateIndex
CREATE UNIQUE INDEX "evidencia_averia_registro_id_tipo_key" ON "evidencia_averia"("registro_id", "tipo");

-- AddForeignKey
ALTER TABLE "reporte_averia" ADD CONSTRAINT "reporte_averia_turno_id_fkey" FOREIGN KEY ("turno_id") REFERENCES "turno"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reporte_averia" ADD CONSTRAINT "reporte_averia_grupo_id_fkey" FOREIGN KEY ("grupo_id") REFERENCES "grupo"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reporte_averia" ADD CONSTRAINT "reporte_averia_reportado_por_id_fkey" FOREIGN KEY ("reportado_por_id") REFERENCES "usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reporte_averia" ADD CONSTRAINT "reporte_averia_anulado_por_id_fkey" FOREIGN KEY ("anulado_por_id") REFERENCES "usuario"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "registro_averia" ADD CONSTRAINT "registro_averia_reporte_id_fkey" FOREIGN KEY ("reporte_id") REFERENCES "reporte_averia"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "registro_averia" ADD CONSTRAINT "registro_averia_producto_id_fkey" FOREIGN KEY ("producto_id") REFERENCES "producto"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "registro_averia" ADD CONSTRAINT "registro_averia_causal_id_fkey" FOREIGN KEY ("causal_id") REFERENCES "causal_averia"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "registro_averia" ADD CONSTRAINT "registro_averia_linea_id_fkey" FOREIGN KEY ("linea_id") REFERENCES "linea_produccion"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "evidencia_averia" ADD CONSTRAINT "evidencia_averia_registro_id_fkey" FOREIGN KEY ("registro_id") REFERENCES "registro_averia"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
