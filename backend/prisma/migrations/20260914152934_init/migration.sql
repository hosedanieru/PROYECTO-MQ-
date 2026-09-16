-- CreateEnum
CREATE TYPE "DiaSemana" AS ENUM ('LUNES', 'MARTES', 'MIERCOLES', 'JUEVES', 'VIERNES', 'SABADO', 'DOMINGO');

-- CreateEnum
CREATE TYPE "EstadoRemision" AS ENUM ('BORRADOR', 'ENTREGADA', 'APROBADA', 'RECHAZADA', 'EN_RECTIFICACION', 'VALIDADA');

-- CreateEnum
CREATE TYPE "ProcesoProducto" AS ENUM ('MANUAL', 'AUTOMATICA');

-- CreateEnum
CREATE TYPE "AccionAuditoria" AS ENUM ('CREAR', 'ACTUALIZAR', 'CAMBIO_ESTADO', 'ELIMINAR');

-- CreateTable
CREATE TABLE "usuario" (
    "id" TEXT NOT NULL,
    "documento" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "email" TEXT,
    "password_hash" TEXT NOT NULL,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "rol_id" TEXT NOT NULL,
    "creado_en" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actualizado_en" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "usuario_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "rol" (
    "id" TEXT NOT NULL,
    "codigo" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "descripcion" TEXT,
    "activo" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "rol_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "permiso" (
    "id" TEXT NOT NULL,
    "codigo" TEXT NOT NULL,
    "modulo" TEXT NOT NULL,
    "descripcion" TEXT,

    CONSTRAINT "permiso_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "rol_permiso" (
    "rol_id" TEXT NOT NULL,
    "permiso_id" TEXT NOT NULL,

    CONSTRAINT "rol_permiso_pkey" PRIMARY KEY ("rol_id","permiso_id")
);

-- CreateTable
CREATE TABLE "lugar" (
    "id" TEXT NOT NULL,
    "codigo" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "activo" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "lugar_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "proveedor" (
    "id" TEXT NOT NULL,
    "codigo" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "activo" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "proveedor_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "producto" (
    "id" TEXT NOT NULL,
    "codigo" TEXT NOT NULL,
    "descripcion" TEXT NOT NULL,
    "proceso" "ProcesoProducto",
    "unidades_por_caja" INTEGER,
    "cajas_por_estiba" INTEGER,
    "unidades_por_hora" DECIMAL(12,2),
    "cajas_por_hora" DECIMAL(12,2),
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "creado_en" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actualizado_en" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "producto_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "turno" (
    "id" TEXT NOT NULL,
    "codigo" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "activo" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "turno_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "turno_horario" (
    "id" TEXT NOT NULL,
    "turno_id" TEXT NOT NULL,
    "dia_semana" "DiaSemana" NOT NULL,
    "hora_inicio" TEXT NOT NULL,
    "hora_fin" TEXT NOT NULL,
    "cruza_medianoche" BOOLEAN NOT NULL DEFAULT false,
    "vigente_desde" DATE NOT NULL,
    "vigente_hasta" DATE,

    CONSTRAINT "turno_horario_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "remision" (
    "id" TEXT NOT NULL,
    "anio" INTEGER NOT NULL,
    "numero" INTEGER NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "fecha_operativa" DATE NOT NULL,
    "fecha_hora_registro" TIMESTAMPTZ(3) NOT NULL,
    "turno_id" TEXT NOT NULL,
    "proveedor_id" TEXT NOT NULL,
    "lugar_id" TEXT NOT NULL,
    "producto_id" TEXT NOT NULL,
    "codigo_snapshot" TEXT NOT NULL,
    "descripcion_snapshot" TEXT NOT NULL,
    "fecha_vencimiento" DATE NOT NULL,
    "cantidad_cajas" INTEGER NOT NULL,
    "cantidad_unidades" INTEGER NOT NULL,
    "estibas_completas" INTEGER NOT NULL DEFAULT 0,
    "cajas_sueltas" INTEGER NOT NULL DEFAULT 0,
    "observaciones" TEXT,
    "estado" "EstadoRemision" NOT NULL DEFAULT 'BORRADOR',
    "creada_por_id" TEXT NOT NULL,
    "entregada_por_id" TEXT,
    "fecha_entrega" TIMESTAMPTZ(3),
    "opa_nombre" TEXT,
    "opa_cargo" TEXT,
    "fecha_aprobacion" TIMESTAMPTZ(3),
    "validada_por_id" TEXT,
    "fecha_validacion" TIMESTAMPTZ(3),
    "conciliado_con" TEXT,
    "creado_en" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actualizado_en" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "remision_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "remision_estiba" (
    "id" TEXT NOT NULL,
    "remision_id" TEXT NOT NULL,
    "numero_estiba" INTEGER NOT NULL,

    CONSTRAINT "remision_estiba_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "remision_version" (
    "id" TEXT NOT NULL,
    "remision_id" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "motivo_rechazo" TEXT,
    "datos_anteriores" JSONB NOT NULL,
    "rectificada_por_id" TEXT NOT NULL,
    "fecha_rectificacion" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "remision_version_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "auditoria" (
    "id" TEXT NOT NULL,
    "entidad" TEXT NOT NULL,
    "entidad_id" TEXT NOT NULL,
    "accion" "AccionAuditoria" NOT NULL,
    "valor_anterior" JSONB,
    "valor_nuevo" JSONB,
    "motivo" TEXT,
    "usuario_id" TEXT NOT NULL,
    "ip" TEXT,
    "creado_en" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "auditoria_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "consecutivo" (
    "id" TEXT NOT NULL,
    "tipo" TEXT NOT NULL,
    "anio" INTEGER NOT NULL,
    "ultimo" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "consecutivo_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "usuario_documento_key" ON "usuario"("documento");

-- CreateIndex
CREATE UNIQUE INDEX "usuario_email_key" ON "usuario"("email");

-- CreateIndex
CREATE UNIQUE INDEX "rol_codigo_key" ON "rol"("codigo");

-- CreateIndex
CREATE UNIQUE INDEX "permiso_codigo_key" ON "permiso"("codigo");

-- CreateIndex
CREATE INDEX "permiso_modulo_idx" ON "permiso"("modulo");

-- CreateIndex
CREATE UNIQUE INDEX "lugar_codigo_key" ON "lugar"("codigo");

-- CreateIndex
CREATE UNIQUE INDEX "proveedor_codigo_key" ON "proveedor"("codigo");

-- CreateIndex
CREATE UNIQUE INDEX "producto_codigo_key" ON "producto"("codigo");

-- CreateIndex
CREATE INDEX "producto_activo_idx" ON "producto"("activo");

-- CreateIndex
CREATE UNIQUE INDEX "turno_codigo_key" ON "turno"("codigo");

-- CreateIndex
CREATE UNIQUE INDEX "turno_horario_turno_id_dia_semana_vigente_desde_key" ON "turno_horario"("turno_id", "dia_semana", "vigente_desde");

-- CreateIndex
CREATE INDEX "remision_fecha_operativa_turno_id_idx" ON "remision"("fecha_operativa", "turno_id");

-- CreateIndex
CREATE INDEX "remision_estado_idx" ON "remision"("estado");

-- CreateIndex
CREATE INDEX "remision_producto_id_fecha_operativa_idx" ON "remision"("producto_id", "fecha_operativa");

-- CreateIndex
CREATE INDEX "remision_proveedor_id_fecha_operativa_idx" ON "remision"("proveedor_id", "fecha_operativa");

-- CreateIndex
CREATE UNIQUE INDEX "remision_anio_numero_key" ON "remision"("anio", "numero");

-- CreateIndex
CREATE INDEX "remision_estiba_numero_estiba_idx" ON "remision_estiba"("numero_estiba");

-- CreateIndex
CREATE UNIQUE INDEX "remision_estiba_remision_id_numero_estiba_key" ON "remision_estiba"("remision_id", "numero_estiba");

-- CreateIndex
CREATE UNIQUE INDEX "remision_version_remision_id_version_key" ON "remision_version"("remision_id", "version");

-- CreateIndex
CREATE INDEX "auditoria_entidad_entidad_id_idx" ON "auditoria"("entidad", "entidad_id");

-- CreateIndex
CREATE INDEX "auditoria_usuario_id_creado_en_idx" ON "auditoria"("usuario_id", "creado_en");

-- CreateIndex
CREATE UNIQUE INDEX "consecutivo_tipo_anio_key" ON "consecutivo"("tipo", "anio");

-- AddForeignKey
ALTER TABLE "usuario" ADD CONSTRAINT "usuario_rol_id_fkey" FOREIGN KEY ("rol_id") REFERENCES "rol"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rol_permiso" ADD CONSTRAINT "rol_permiso_rol_id_fkey" FOREIGN KEY ("rol_id") REFERENCES "rol"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rol_permiso" ADD CONSTRAINT "rol_permiso_permiso_id_fkey" FOREIGN KEY ("permiso_id") REFERENCES "permiso"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "turno_horario" ADD CONSTRAINT "turno_horario_turno_id_fkey" FOREIGN KEY ("turno_id") REFERENCES "turno"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "remision" ADD CONSTRAINT "remision_turno_id_fkey" FOREIGN KEY ("turno_id") REFERENCES "turno"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "remision" ADD CONSTRAINT "remision_proveedor_id_fkey" FOREIGN KEY ("proveedor_id") REFERENCES "proveedor"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "remision" ADD CONSTRAINT "remision_lugar_id_fkey" FOREIGN KEY ("lugar_id") REFERENCES "lugar"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "remision" ADD CONSTRAINT "remision_producto_id_fkey" FOREIGN KEY ("producto_id") REFERENCES "producto"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "remision" ADD CONSTRAINT "remision_creada_por_id_fkey" FOREIGN KEY ("creada_por_id") REFERENCES "usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "remision" ADD CONSTRAINT "remision_entregada_por_id_fkey" FOREIGN KEY ("entregada_por_id") REFERENCES "usuario"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "remision" ADD CONSTRAINT "remision_validada_por_id_fkey" FOREIGN KEY ("validada_por_id") REFERENCES "usuario"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "remision_estiba" ADD CONSTRAINT "remision_estiba_remision_id_fkey" FOREIGN KEY ("remision_id") REFERENCES "remision"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "remision_version" ADD CONSTRAINT "remision_version_remision_id_fkey" FOREIGN KEY ("remision_id") REFERENCES "remision"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "remision_version" ADD CONSTRAINT "remision_version_rectificada_por_id_fkey" FOREIGN KEY ("rectificada_por_id") REFERENCES "usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "auditoria" ADD CONSTRAINT "auditoria_usuario_id_fkey" FOREIGN KEY ("usuario_id") REFERENCES "usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
