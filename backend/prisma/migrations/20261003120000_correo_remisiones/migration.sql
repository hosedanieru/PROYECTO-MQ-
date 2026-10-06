-- Envio de remisiones por correo (usuario, 2026-10-03): listas de distribucion y registro de envios.
-- CreateTable
CREATE TABLE "lista_distribucion" (
    "id" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "turno_id" TEXT,
    "incluir_en_cierres" BOOLEAN NOT NULL DEFAULT false,
    "correos" TEXT[],
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "creado_en" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actualizado_en" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "lista_distribucion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "envio_correo" (
    "id" TEXT NOT NULL,
    "origen" TEXT NOT NULL,
    "fecha_hora" TIMESTAMPTZ(3) NOT NULL,
    "fecha_operativa" DATE NOT NULL,
    "turno_id" TEXT,
    "destinatarios" TEXT[],
    "remision_ids" TEXT[],
    "asunto" TEXT NOT NULL,
    "estado" TEXT NOT NULL,
    "error" TEXT,
    "usuario_id" TEXT NOT NULL,
    "usuario_nombre" TEXT NOT NULL,

    CONSTRAINT "envio_correo_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "envio_correo_fecha_operativa_idx" ON "envio_correo"("fecha_operativa");

-- AddForeignKey
ALTER TABLE "lista_distribucion" ADD CONSTRAINT "lista_distribucion_turno_id_fkey" FOREIGN KEY ("turno_id") REFERENCES "turno"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "envio_correo" ADD CONSTRAINT "envio_correo_usuario_id_fkey" FOREIGN KEY ("usuario_id") REFERENCES "usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

