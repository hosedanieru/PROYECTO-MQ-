-- CreateTable
CREATE TABLE "programacion" (
    "id" TEXT NOT NULL,
    "fecha_operativa" DATE NOT NULL,
    "producto_id" TEXT NOT NULL,
    "cantidad_programada_cajas" INTEGER NOT NULL,
    "cargada_por_id" TEXT NOT NULL,
    "fecha_carga" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "archivo_origen" TEXT,

    CONSTRAINT "programacion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "linea_produccion" (
    "id" TEXT NOT NULL,
    "codigo" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "activo" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "linea_produccion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "config_turno" (
    "id" TEXT NOT NULL,
    "fecha_operativa" DATE NOT NULL,
    "turno_id" TEXT NOT NULL,
    "linea_id" TEXT NOT NULL,
    "producto_id" TEXT NOT NULL,
    "porcentaje_rendimiento" DECIMAL(6,2) NOT NULL,
    "personas_asignadas" INTEGER NOT NULL,
    "configurada_por_id" TEXT NOT NULL,
    "fecha_configuracion" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "cerrada_en" TIMESTAMPTZ(3),
    "cerrada_por_id" TEXT,

    CONSTRAINT "config_turno_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "programacion_fecha_operativa_idx" ON "programacion"("fecha_operativa");

-- CreateIndex
CREATE UNIQUE INDEX "programacion_fecha_operativa_producto_id_key" ON "programacion"("fecha_operativa", "producto_id");

-- CreateIndex
CREATE UNIQUE INDEX "linea_produccion_codigo_key" ON "linea_produccion"("codigo");

-- CreateIndex
CREATE INDEX "config_turno_fecha_operativa_turno_id_idx" ON "config_turno"("fecha_operativa", "turno_id");

-- CreateIndex
CREATE UNIQUE INDEX "config_turno_fecha_operativa_turno_id_linea_id_key" ON "config_turno"("fecha_operativa", "turno_id", "linea_id");

-- AddForeignKey
ALTER TABLE "programacion" ADD CONSTRAINT "programacion_producto_id_fkey" FOREIGN KEY ("producto_id") REFERENCES "producto"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "programacion" ADD CONSTRAINT "programacion_cargada_por_id_fkey" FOREIGN KEY ("cargada_por_id") REFERENCES "usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "config_turno" ADD CONSTRAINT "config_turno_turno_id_fkey" FOREIGN KEY ("turno_id") REFERENCES "turno"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "config_turno" ADD CONSTRAINT "config_turno_linea_id_fkey" FOREIGN KEY ("linea_id") REFERENCES "linea_produccion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "config_turno" ADD CONSTRAINT "config_turno_producto_id_fkey" FOREIGN KEY ("producto_id") REFERENCES "producto"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "config_turno" ADD CONSTRAINT "config_turno_configurada_por_id_fkey" FOREIGN KEY ("configurada_por_id") REFERENCES "usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "config_turno" ADD CONSTRAINT "config_turno_cerrada_por_id_fkey" FOREIGN KEY ("cerrada_por_id") REFERENCES "usuario"("id") ON DELETE SET NULL ON UPDATE CASCADE;
