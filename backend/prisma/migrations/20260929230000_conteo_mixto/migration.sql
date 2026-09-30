-- Fase B del inventario (usuario, 2026-09-29): lo que llega o se cuenta se
-- digita como viene (rollos, cajas, estibas) y se convierte a la medida.
-- El kardex guarda el texto de lo digitado junto al total.
ALTER TABLE "movimiento_inventario" ADD COLUMN "conteo_texto" TEXT;
