# Base de datos

El aplicativo funciona con **dos almacenamientos**, seleccionables con `PERSISTENCIA` en el `.env` del backend:

| `PERSISTENCIA` | Tecnología | Cuándo |
|---|---|---|
| `postgres` (por defecto) | PostgreSQL 18 + Prisma 7 | Desarrollo local, Docker con servicio `db`, servidor propio |
| `firestore` | Firestore (Firebase) vía `firebase-admin` | Sin servidor de base de datos; plan gratuito de Firebase. Decisión del usuario (2026-09-17). |

El dominio, los casos de uso, la API y el frontend son idénticos en ambos. Las diferencias de Firestore (consecutivo optimista, filtros en memoria, sin búsqueda de texto, sin migraciones) están en `infrastructure/firebase/README.md`, junto con el mapa de colecciones.

El resto de este documento describe el esquema relacional; el de Firestore lo replica colección por colección.

PostgreSQL 18 con Prisma 7 (driver adapter `@prisma/adapter-pg`). Esquema en `backend/prisma/schema.prisma`; migraciones en `backend/prisma/migrations/`.

Convención: modelos en PascalCase, campos en camelCase, tablas y columnas en snake_case vía `@map`.

## Tablas

### Operación

| Tabla | Qué guarda |
|---|---|
| `remision` | Documento de entrega de PT. Un producto por remisión. Identidad de negocio `(anio, numero)` única. Snapshot de código y descripción del producto. Campos de cada etapa del flujo (entrega, aprobación del OPA, validación). `motivo_ultimo_rechazo`. |
| `remision_estiba` | Números de estiba de una remisión (uno por fila). Se reemplazan en bloque al editar. |
| `remision_version` | Snapshot completo (`datos_anteriores` JSON) de cada versión archivada al rectificar, con el motivo del rechazo y quién rectificó. |
| `consecutivo` | Último número asignado por `(tipo, anio)`. Se reserva con `SELECT ... FOR UPDATE`. |
| `auditoria` | Rastro de cada escritura: entidad, id, acción (`CREAR`, `ACTUALIZAR`, `CAMBIO_ESTADO`, `ELIMINAR`), valor anterior y nuevo (JSON), motivo, usuario, IP, fecha. |

### Catálogos

| Tabla | Qué guarda |
|---|---|
| `producto` | Ítem: código único, descripción, proceso (`MANUAL`/`AUTOMATICA`), unidades por caja, cajas por estiba, `personas_ideal` (LINEA IDEAL de la hoja TIEMPOS), `subdescripcion` (familia), estándares de producción (`cajas_por_hora`, `peso_neto_kg`), activo. |
| `turno` / `turno_horario` | T1, T2, T3 y sus horarios por día de la semana con vigencia. `cruza_medianoche` para T3. Desde el 2026-09-18 son los del DPP de PepsiCo, iguales todos los días. |
| `grupo` | Quien pone el personal del turno (LOGICMARD, MAXISERVICE, APOYOS MAXI, MIX). Antes `proveedor`; renombrada el 2026-09-21. Lleva `descripcion` (el proveedor real, a mano) y `personas_esperadas`. |
| `lugar` | MAQUILA PEPSICO SANTO DOMINGO. |

### MFR

| Tabla | Qué guarda |
|---|---|
| `linea_produccion` | Las 9 plataformas del DPP (L1–L5, MANUAL-1/2, REEMPAQU-2, REEMPAQUES): tipo (`MULTIPACK`/`MANUAL`), capacidad kg/h, orden, activo. |
| `bloque_programacion` | Un bloque del DPP: línea × franja horaria con producto, `cajas_por_hora`, `eficiencia_porcentaje`, `loop`, `personas_asignadas`, `origen` (`MANUAL`/`DPP`/`COPIA`). El turno se deriva de la hora de inicio. Se congela al cerrar el turno (`cerrado_en`). |
| `asistencia_turno` | Personas que llegaron de cada grupo, por fecha operativa y turno. Única por `(fecha, turno, grupo)`. |
| `asignacion_linea` | Qué grupo trabaja en qué línea y con cuántas personas, por fecha operativa y turno. Única por `(fecha, turno, línea, grupo)`. |

### Averías

| Tabla | Qué guarda |
|---|---|
| `causal_averia` | Lista desplegable de causales (12 sembradas). Se desactivan, no se borran. |
| `reporte_averia` | Encabezado: fecha operativa, turno y hora automáticos, grupo, quién reporta (con copia del nombre), estado `REGISTRADO`/`ANULADO` con motivo. |
| `registro_averia` | Una avería del reporte: PT (con copia de código y descripción), vencimiento, lote, causal, cantidad entera y unidad (`UNIDAD`/`DOCENA`/`SIX`/`BOLSA`). Sin línea. |
| `evidencia_averia` | Las 3 fotos de cada registro (`UNIDAD`, `LOTE_FECHA`, `CONJUNTO`): solo la ruta interna; el archivo vive en `EVIDENCIAS_DIR`. |

### Inventario

Una tabla por tipo (2026-09-29): el PT es `producto` (en pantalla se llama "PT"), y aparte `pi` e `insumo`. Cantidades de PI e insumos en `DECIMAL(14,3)` en su medida (METRO, UNIDAD…); el PT en cajas enteras (lo exige el dominio).

| Tabla | Qué guarda |
|---|---|
| `unidad_medida` | Lista desplegable de unidades base (sembrada: `UNIDAD`). Código único. |
| `pi` / `insumo` | Catálogo de cada tipo: código (único también entre las dos tablas, lo controla el caso de uso), descripción, unidad base (la medida), `presentacion_id` + `contenido_presentacion` (ROLLO con 50 METRO; juntos o ninguno, CHECK `*_presentacion_completa`), escalones opcionales `unidades_por_caja` y `cajas_por_estiba`, activo. |
| `item_inventario` | Eje de existencias: apunta a **exactamente uno** de `producto_id` / `pi_id` / `insumo_id` (CHECK `item_inventario_una_referencia`, cada uno único) y guarda `existencia`. Código, descripción, unidad y activo se leen del catálogo. Se bloquea con `SELECT … FOR UPDATE` en cada movimiento. |
| `movimiento_inventario` | Kardex: `ENTRADA`/`SALIDA`/`AJUSTE`, cantidad con signo, saldo que dejó, fecha operativa, turno, usuario, referencia, motivo (obligatorio en ajustes), `entrada_id` si viene de una entrada de mercancía, `remision_id` si es el consumo por receta al aprobar esa remisión, `conteo_texto` con lo digitado si fue un conteo mixto ("10 ROLLO (1 ROLLO = 50 METRO)"). Nunca se borra. |
| `receta` | Una **versión** de la receta de un PT: `version` (única por PT, > 0), `vigente_desde`, quién la creó (con copia del nombre). Nunca se edita: guardar crea la siguiente; la vigente es la de número más alto. |
| `receta_componente` | Un PI o insumo de esa versión: `item_id` (su ítem de inventario, único por receta), `cantidad` que gasta UNA caja de PT, en la medida del componente (`DECIMAL(14,3)` > 0, CHECK `receta_componente_cantidad_positiva`). |
| `entrada_mercancia` | Encabezado de lo que llega en un documento (documento de soporte, quién entrega, observación, quién recibe). Sus líneas son los movimientos con su `entrada_id`. |

### Seguridad

| Tabla | Qué guarda |
|---|---|
| `usuario` | Documento único, nombre, correo opcional, `password_hash` (bcrypt), activo, rol. |
| `rol` | ADMINISTRADOR, COORDINADOR_MQ, PATINADOR, CONSULTA. |
| `permiso` | 23 permisos con módulo (`remision.*`, `catalogo.*`, `admin.*`, `mfr.*`, `averia.*`, `inventario.*`). |
| `rol_permiso` | Relación N:N. El seed la reemplaza en cada corrida: el seed es la fuente de verdad. |

## Reglas que viven en la base o cerca de ella

- **Fecha operativa** (`remision.fecha_operativa`, tipo `DATE`): día productivo con corte 06:00–06:00 en hora de Bogotá. Se calcula en el dominio (`calcularFechaOperativa`) y se guarda como fecha a medianoche UTC. **Al mostrarla se formatea en UTC**, nunca en zona Bogotá (retrocedería un día). Los instantes reales (`fecha_hora_registro`, `fecha_entrega`, …) son `timestamptz` y sí se muestran en hora de Colombia.
- **Zona de la sesión: UTC.** La aplicación fija `TimeZone=UTC` en cada conexión (`crearAdaptadorPostgres()`), porque el adaptador de Prisma envía las fechas sin zona y, con la sesión en Bogotá, se guardaban 5 horas corridas (corregido el 2026-09-28, migración `20260928200000_instantes_a_utc`). Para consultar a mano en hora de Colombia: `SELECT fecha_hora_registro AT TIME ZONE 'America/Bogota' FROM …`.
- **Consecutivo anual**: el año sale de la fecha operativa. Una remisión del 1 de enero a las 02:00 lleva consecutivo del año anterior.
- **Nunca se borran remisiones**: no hay endpoint DELETE, y `database/crear-usuario-app.sql` revoca `DELETE` sobre `remision`, `remision_version` y `auditoria` al usuario de aplicación.
- **Snapshot de producto**: `codigo_snapshot` y `descripcion_snapshot` se copian al crear o al cambiar el producto en una edición; el catálogo puede cambiar después sin alterar el documento.

## Comandos

```powershell
npx prisma migrate dev --name <nombre>    # nueva migración en desarrollo
npx prisma migrate deploy                 # aplicar pendientes (producción, CI, Docker)
npx prisma generate                       # regenerar el cliente tras cambiar el schema
npx prisma db seed                        # catálogos + admin inicial (idempotente)
npx prisma studio --config ./prisma.config.ts
```

**Importante:** después de cambiar `schema.prisma` hay que correr `prisma generate`; si el cliente generado queda desactualizado, TypeScript falla con "Property X does not exist" (ocurrió con `motivoUltimoRechazo`).

## Prisma 7 — diferencias con versiones anteriores

1. La `url` no va en `schema.prisma`; se configura en `prisma.config.ts`.
2. `prisma.config.ts` necesita `import 'dotenv/config'` en la primera línea.
3. `PrismaClient` requiere un driver adapter (`PrismaPg`). El cliente se genera en `src/generated/prisma` (ignorado por Git).

## Usuario de aplicación (producción)

`database/crear-usuario-app.sql` crea el rol `mq_app` con `SELECT/INSERT/UPDATE/DELETE` sobre filas, sin `DROP`/`ALTER`/`TRUNCATE`, y sin `DELETE` en remisiones. Las migraciones y el seed siguen corriendo con el superusuario. En Docker se ejecuta solo al inicializar el volumen; cambiar la clave de reemplazo con `ALTER ROLE mq_app PASSWORD '...'`.

## Bases

| Base | Uso |
|---|---|
| la de `backend/.env` | desarrollo |
| `mq_test` (`backend/.env.test`) | pruebas de integración; se vacía entre casos; el setup exige sufijo `_test` |
| `mq` (Docker) | producción; volumen `mq_postgres` |
