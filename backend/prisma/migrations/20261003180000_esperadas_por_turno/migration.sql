-- Personas esperadas POR TURNO (usuario, 2026-10-03). Antes era un solo
-- número por grupo (grupo.personas_esperadas) que valía para todos los
-- turnos. Para no perder lo cargado, ese número se copia a cada turno
-- (mismo comportamiento que hoy) y después se borra la columna.

-- CreateTable
CREATE TABLE "grupo_esperadas_turno" (
    "grupo_id" TEXT NOT NULL,
    "turno_id" TEXT NOT NULL,
    "personas" INTEGER NOT NULL,

    CONSTRAINT "grupo_esperadas_turno_pkey" PRIMARY KEY ("grupo_id","turno_id")
);

-- AddForeignKey
ALTER TABLE "grupo_esperadas_turno" ADD CONSTRAINT "grupo_esperadas_turno_grupo_id_fkey" FOREIGN KEY ("grupo_id") REFERENCES "grupo"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "grupo_esperadas_turno" ADD CONSTRAINT "grupo_esperadas_turno_turno_id_fkey" FOREIGN KEY ("turno_id") REFERENCES "turno"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Copia: el número de cada grupo a cada turno.
INSERT INTO "grupo_esperadas_turno" ("grupo_id", "turno_id", "personas")
SELECT g."id", t."id", g."personas_esperadas"
FROM "grupo" g CROSS JOIN "turno" t
WHERE g."personas_esperadas" IS NOT NULL AND g."personas_esperadas" > 0;

-- AlterTable
ALTER TABLE "grupo" DROP COLUMN "personas_esperadas";

-- CreateTable
CREATE TABLE "ajuste_esperadas" (
    "id" TEXT NOT NULL,
    "fecha_operativa" DATE NOT NULL,
    "turno_id" TEXT NOT NULL,
    "grupo_id" TEXT NOT NULL,
    "personas" INTEGER NOT NULL,
    "motivo" TEXT NOT NULL,
    "usuario_id" TEXT NOT NULL,
    "fecha_registro" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "ajuste_esperadas_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ajuste_esperadas_fecha_operativa_idx" ON "ajuste_esperadas"("fecha_operativa");
CREATE UNIQUE INDEX "ajuste_esperadas_fecha_operativa_turno_id_grupo_id_key" ON "ajuste_esperadas"("fecha_operativa", "turno_id", "grupo_id");

-- AddForeignKey
ALTER TABLE "ajuste_esperadas" ADD CONSTRAINT "ajuste_esperadas_turno_id_fkey" FOREIGN KEY ("turno_id") REFERENCES "turno"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ajuste_esperadas" ADD CONSTRAINT "ajuste_esperadas_grupo_id_fkey" FOREIGN KEY ("grupo_id") REFERENCES "grupo"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ajuste_esperadas" ADD CONSTRAINT "ajuste_esperadas_usuario_id_fkey" FOREIGN KEY ("usuario_id") REFERENCES "usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
