-- La línea se quita de las averías (área, 2026-09-28): las cajas con averías
-- a veces llegan sin que nadie sepa de qué línea vienen. El usuario aprobó
-- perder los valores existentes (1 reporte de prueba y 1 de verificación).

-- DropForeignKey
ALTER TABLE "registro_averia" DROP CONSTRAINT "registro_averia_linea_id_fkey";

-- AlterTable
ALTER TABLE "registro_averia" DROP COLUMN "linea_id";
