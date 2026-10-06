-- CreateTable
CREATE TABLE "firma_remision" (
    "id" TEXT NOT NULL,
    "remision_id" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "tipo" TEXT NOT NULL,
    "usuario_id" TEXT NOT NULL,
    "usuario_nombre" TEXT NOT NULL,
    "usuario_documento" TEXT NOT NULL,
    "usuario_rol" TEXT NOT NULL,
    "declaracion" TEXT NOT NULL,
    "huella" TEXT NOT NULL,
    "trazo" TEXT NOT NULL,
    "dispositivo" TEXT,
    "ip" TEXT,
    "fecha_hora" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "firma_remision_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "firma_remision_remision_id_idx" ON "firma_remision"("remision_id");

-- CreateIndex
CREATE UNIQUE INDEX "firma_remision_remision_id_version_tipo_key" ON "firma_remision"("remision_id", "version", "tipo");

-- AddForeignKey
ALTER TABLE "firma_remision" ADD CONSTRAINT "firma_remision_remision_id_fkey" FOREIGN KEY ("remision_id") REFERENCES "remision"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "firma_remision" ADD CONSTRAINT "firma_remision_usuario_id_fkey" FOREIGN KEY ("usuario_id") REFERENCES "usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
