-- AlterTable
ALTER TABLE "envio_correo" ADD COLUMN     "resumen_ids" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "texto" TEXT;
