-- ============================================================
-- Una tabla por tipo: PT (producto), PI e insumo + unidades de medida
-- ============================================================
--
-- Usuario, 2026-09-29: "hay que hacer una tabla por cada tipo". El PT ya
-- tenía la suya (`producto`). Aquí nacen `pi` e `insumo`, con su unidad
-- base (catálogo `unidad_medida`, la lista desplegable) y sus
-- equivalencias (unidades por caja, cajas por estiba).
--
-- `item_inventario` queda como la existencia de UNO de los tres: sus
-- datos (código, descripción, unidad, activo) se leen del catálogo.
-- Existencias y movimientos pasan a enteros (unidades cerradas).
--
-- Orden: crear tablas → copiar datos → borrar columnas viejas. Así no se
-- pierde el código ni la descripción de lo que ya existía.

-- 1. Tablas nuevas ------------------------------------------------------

CREATE TABLE "unidad_medida" (
    "id" TEXT NOT NULL,
    "codigo" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    CONSTRAINT "unidad_medida_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "unidad_medida_codigo_key" ON "unidad_medida"("codigo");

CREATE TABLE "pi" (
    "id" TEXT NOT NULL,
    "codigo" TEXT NOT NULL,
    "descripcion" TEXT NOT NULL,
    "unidad_base_id" TEXT NOT NULL,
    "unidades_por_caja" INTEGER,
    "cajas_por_estiba" INTEGER,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "creado_en" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actualizado_en" TIMESTAMPTZ(3) NOT NULL,
    CONSTRAINT "pi_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "pi_codigo_key" ON "pi"("codigo");

CREATE TABLE "insumo" (
    "id" TEXT NOT NULL,
    "codigo" TEXT NOT NULL,
    "descripcion" TEXT NOT NULL,
    "unidad_base_id" TEXT NOT NULL,
    "unidades_por_caja" INTEGER,
    "cajas_por_estiba" INTEGER,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "creado_en" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actualizado_en" TIMESTAMPTZ(3) NOT NULL,
    CONSTRAINT "insumo_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "insumo_codigo_key" ON "insumo"("codigo");

ALTER TABLE "pi" ADD CONSTRAINT "pi_unidad_base_id_fkey" FOREIGN KEY ("unidad_base_id") REFERENCES "unidad_medida"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "insumo" ADD CONSTRAINT "insumo_unidad_base_id_fkey" FOREIGN KEY ("unidad_base_id") REFERENCES "unidad_medida"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- 2. Datos existentes -----------------------------------------------------

-- Unidades: UNIDAD siempre, más las que ya se hubieran escrito en PI/insumos.
INSERT INTO "unidad_medida" ("id", "codigo", "nombre")
SELECT gen_random_uuid(), u.codigo, initcap(lower(u.codigo))
FROM (
    SELECT 'UNIDAD' AS codigo
    UNION
    SELECT DISTINCT upper(trim("unidad_medida")) FROM "item_inventario" WHERE "tipo" <> 'PT'
) u;

-- PI e insumos: conservan el id del ítem para enlazarlos sin ambigüedad.
INSERT INTO "pi" ("id", "codigo", "descripcion", "unidad_base_id", "activo", "creado_en", "actualizado_en")
SELECT i."id", i."codigo", i."descripcion", u."id", i."activo", i."creado_en", now()
FROM "item_inventario" i JOIN "unidad_medida" u ON u."codigo" = upper(trim(i."unidad_medida"))
WHERE i."tipo" = 'PI';

INSERT INTO "insumo" ("id", "codigo", "descripcion", "unidad_base_id", "activo", "creado_en", "actualizado_en")
SELECT i."id", i."codigo", i."descripcion", u."id", i."activo", i."creado_en", now()
FROM "item_inventario" i JOIN "unidad_medida" u ON u."codigo" = upper(trim(i."unidad_medida"))
WHERE i."tipo" = 'INSUMO';

ALTER TABLE "item_inventario" ADD COLUMN "pi_id" TEXT, ADD COLUMN "insumo_id" TEXT;
UPDATE "item_inventario" SET "pi_id" = "id" WHERE "tipo" = 'PI';
UPDATE "item_inventario" SET "insumo_id" = "id" WHERE "tipo" = 'INSUMO';

-- 3. Enteros: no debe haber cantidades con decimales (si las hay, se detiene).
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM "item_inventario" WHERE "existencia" <> trunc("existencia"))
     OR EXISTS (SELECT 1 FROM "movimiento_inventario" WHERE "cantidad" <> trunc("cantidad") OR "saldo" <> trunc("saldo")) THEN
    RAISE EXCEPTION 'Hay existencias o movimientos con decimales: revisarlos antes de pasar a unidades cerradas.';
  END IF;
END $$;

ALTER TABLE "item_inventario" ALTER COLUMN "existencia" SET DATA TYPE INTEGER USING "existencia"::integer,
    ALTER COLUMN "existencia" SET DEFAULT 0;
ALTER TABLE "movimiento_inventario" ALTER COLUMN "cantidad" SET DATA TYPE INTEGER USING "cantidad"::integer,
    ALTER COLUMN "saldo" SET DATA TYPE INTEGER USING "saldo"::integer;

-- 4. Columnas viejas (sus datos ya se copiaron) -----------------------------

DROP INDEX "item_inventario_codigo_key";
ALTER TABLE "item_inventario" DROP COLUMN "activo", DROP COLUMN "codigo", DROP COLUMN "descripcion", DROP COLUMN "unidad_medida";

-- 5. Enlaces y regla: cada ítem apunta a exactamente uno, según su tipo -----

CREATE UNIQUE INDEX "item_inventario_pi_id_key" ON "item_inventario"("pi_id");
CREATE UNIQUE INDEX "item_inventario_insumo_id_key" ON "item_inventario"("insumo_id");
ALTER TABLE "item_inventario" ADD CONSTRAINT "item_inventario_pi_id_fkey" FOREIGN KEY ("pi_id") REFERENCES "pi"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "item_inventario" ADD CONSTRAINT "item_inventario_insumo_id_fkey" FOREIGN KEY ("insumo_id") REFERENCES "insumo"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "item_inventario" ADD CONSTRAINT "item_inventario_una_referencia" CHECK (
    ("tipo" = 'PT'     AND "producto_id" IS NOT NULL AND "pi_id" IS NULL     AND "insumo_id" IS NULL) OR
    ("tipo" = 'PI'     AND "producto_id" IS NULL     AND "pi_id" IS NOT NULL AND "insumo_id" IS NULL) OR
    ("tipo" = 'INSUMO' AND "producto_id" IS NULL     AND "pi_id" IS NULL     AND "insumo_id" IS NOT NULL)
);
