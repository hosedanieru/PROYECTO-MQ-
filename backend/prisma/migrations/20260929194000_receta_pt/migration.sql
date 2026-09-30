-- CreateTable
CREATE TABLE "receta" (
    "id" TEXT NOT NULL,
    "producto_id" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "vigente_desde" TIMESTAMPTZ(3) NOT NULL,
    "creada_por_id" TEXT NOT NULL,
    "creada_por_nombre" TEXT NOT NULL,

    CONSTRAINT "receta_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "receta_componente" (
    "id" TEXT NOT NULL,
    "receta_id" TEXT NOT NULL,
    "item_id" TEXT NOT NULL,
    "cantidad" INTEGER NOT NULL,
    "por_cajas" INTEGER NOT NULL,

    CONSTRAINT "receta_componente_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "receta_producto_id_version_key" ON "receta"("producto_id", "version");

-- CreateIndex
CREATE UNIQUE INDEX "receta_componente_receta_id_item_id_key" ON "receta_componente"("receta_id", "item_id");

-- AddForeignKey
ALTER TABLE "receta" ADD CONSTRAINT "receta_producto_id_fkey" FOREIGN KEY ("producto_id") REFERENCES "producto"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "receta" ADD CONSTRAINT "receta_creada_por_id_fkey" FOREIGN KEY ("creada_por_id") REFERENCES "usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "receta_componente" ADD CONSTRAINT "receta_componente_receta_id_fkey" FOREIGN KEY ("receta_id") REFERENCES "receta"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "receta_componente" ADD CONSTRAINT "receta_componente_item_id_fkey" FOREIGN KEY ("item_id") REFERENCES "item_inventario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Escrito a mano: segunda defensa de las reglas del dominio (enteros positivos).
ALTER TABLE "receta" ADD CONSTRAINT "receta_version_positiva" CHECK ("version" > 0);
ALTER TABLE "receta_componente" ADD CONSTRAINT "receta_componente_cantidades_positivas" CHECK ("cantidad" > 0 AND "por_cajas" > 0);
