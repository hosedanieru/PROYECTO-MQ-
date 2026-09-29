-- ============================================================
-- Productos e inventario, un solo módulo (usuario, 2026-09-29)
-- ============================================================
--
-- Desde ahora crear un producto crea su ítem de PT en el inventario. Los
-- productos que ya existían no lo tenían: se les crea aquí, con
-- existencia 0 (el inventario de PT arranca desde cero; no hay datos
-- previos que migrar).
--
-- Solo inserta. Salta los productos que ya tienen su ítem, así que es
-- seguro en cualquier base. Código, descripción y "activo" del PT se
-- leen del producto: aquí van en null / true.

INSERT INTO "item_inventario" ("id", "tipo", "codigo", "descripcion", "unidad_medida", "producto_id", "existencia", "activo", "creado_en", "actualizado_en")
SELECT gen_random_uuid(), 'PT', NULL, NULL, 'CAJA', p."id", 0, true, now(), now()
FROM "producto" p
WHERE NOT EXISTS (SELECT 1 FROM "item_inventario" i WHERE i."producto_id" = p."id");
