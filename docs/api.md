# API HTTP

Prefijo `/api`. Todas las rutas exigen `Authorization: Bearer <token>` salvo las marcadas **público**. Errores de dominio responden `{ codigo, mensaje }`; errores de validación de forma responden el formato de NestJS `{ statusCode, message[], error }`.

## Comprobación de vida

| Método | Ruta | Permiso | Notas |
|---|---|---|---|
| GET | `/` | público | `{ estado: "ok", servicio: "mq-backend" }`. Es el healthcheck del contenedor en `infrastructure/docker-compose.yml`: el frontend solo arranca cuando responde. No consulta la base de datos a propósito. |

## Autenticación

| Método | Ruta | Permiso | Cuerpo / respuesta |
|---|---|---|---|
| POST | `/auth/login` | público | `{ documento, contrasena }` → `{ token, usuario }` · 401 `AUTH_CREDENCIALES_INVALIDAS` · 403 `AUTH_USUARIO_INACTIVO` |
| GET | `/auth/perfil` | autenticado | perfil con `permisos[]` |

## Usuarios

| Método | Ruta | Permiso | Notas |
|---|---|---|---|
| GET | `/usuarios` | `admin.usuarios` | todos, activos e inactivos |
| GET | `/usuarios/:id` | `admin.usuarios` | |
| POST | `/usuarios` | `admin.usuarios` | `{ documento, nombre, email?, contrasena, rolId }` · 409 `USUARIO_DOCUMENTO_DUPLICADO` |
| PATCH | `/usuarios/:id` | `admin.usuarios` | `{ nombre?, email?, rolId?, activo?, contrasena? }` · 400 si intenta desactivarse a sí mismo |

Sin DELETE: se desactiva.

## Catálogos de referencia

| Método | Ruta | Permiso |
|---|---|---|
| GET | `/catalogos/turnos` | `catalogo.consultar` |
| GET | `/catalogos/lugares` | `catalogo.consultar` |
| GET | `/catalogos/roles` | `admin.usuarios` |

Cada ítem: `{ id, codigo, nombre, activo }`.

## Grupos

Antes "proveedores" (renombrados el 2026-09-21). Quien pone el personal del turno.

| Método | Ruta | Permiso | Notas |
|---|---|---|---|
| GET | `/grupos` | `catalogo.consultar` | activos e inactivos; el cliente decide qué muestra |
| POST | `/grupos` | `catalogo.editar` | `{ codigo, nombre, descripcion?, personasEsperadas? }` · 409 `GRUPO_CODIGO_DUPLICADO` |
| PATCH | `/grupos/:id` | `catalogo.editar` | parcial; `activo` para desactivar |

`descripcion` es texto libre donde se escribe el proveedor real; `personasEsperadas` es lo que se compara contra la asistencia del turno.

## Productos

| Método | Ruta | Permiso | Notas |
|---|---|---|---|
| GET | `/productos?texto=&soloActivos=true` | `catalogo.consultar` | búsqueda por código o descripción |
| GET | `/productos/:id` | `catalogo.consultar` | |
| POST | `/productos` | `catalogo.editar` | `{ codigo, descripcion, proceso?, unidadesPorCaja?, cajasPorEstiba?, personasIdeal?, subdescripcion?, cajasPorHora?, pesoNetoKg? }` · 409 `PRODUCTO_CODIGO_DUPLICADO` |
| PATCH | `/productos/:id` | `catalogo.editar` | parcial; `activo` para desactivar. **No** edita estándares: `cajasPorHora` y `pesoNetoKg` solo se dan al crear; después se cambian con motivo en `PUT /mfr/estandares/:productoId`. |

## Remisiones

| Método | Ruta | Permiso | Notas |
|---|---|---|---|
| POST | `/remisiones` | `remision.crear` | ver cuerpo abajo → 201 |
| PATCH | `/remisiones/:id` | `remision.editar` | parcial; 409 `REMISION_NO_EDITABLE` si no está en BORRADOR/EN_RECTIFICACION |
| POST | `/remisiones/:id/entregar` | `remision.entregar` | sin cuerpo |
| POST | `/remisiones/:id/aprobar` | `remision.registrar_aprobacion` | `{ opaNombre, opaCargo? }`; vuelve a verificar el tope del DPP antes de aprobar |
| POST | `/remisiones/:id/rechazar` | `remision.registrar_aprobacion` | `{ motivo }` (5–500) |
| POST | `/remisiones/:id/rectificar` | `remision.rectificar` | sin cuerpo; versión +1, mismo consecutivo |
| POST | `/remisiones/:id/validar` | `remision.validar` | `{ conciliadoCon }` |
| GET | `/remisiones?anio=&turnoId=&grupoId=&productoId=&estado=&desde=&hasta=&pagina=&porPagina=` | `remision.consultar` | `desde`/`hasta` son fechas operativas `YYYY-MM-DD`; máximo 100 por página |
| GET | `/remisiones/resumen?desde=&hasta=&anio=&turnoId=&grupoId=&productoId=` | `remision.consultar` | `{ porEstado, total }`: cuenta en la base, no devuelve documentos. Para el tablero de inicio |
| GET | `/remisiones/pdf?ids=a,b,c` | `remision.consultar` | PDF, dos por hoja |
| GET | `/remisiones/exportar?…` | `remision.exportar` | `.xlsx` con los filtros del listado |
| GET | `/remisiones/:id/pdf` | `remision.consultar` | PDF de una |
| GET | `/remisiones/consecutivo/:anio/:numero` | `remision.consultar` | |
| GET | `/remisiones/:id/versiones` | `remision.consultar` | versiones archivadas con motivo y snapshot |
| GET | `/remisiones/:id/auditoria` | `remision.consultar` + `admin.auditoria` | |
| GET | `/remisiones/:id` | `remision.consultar` | va al final del controlador (después de `consecutivo/` y `pdf`) |

Cuerpo de creación:

```json
{
  "turnoId": "uuid", "grupoId": "uuid", "lugarId": "uuid", "productoId": "uuid",
  "fechaVencimiento": "2027-03-01",
  "cantidadCajas": 36, "cantidadUnidades": 144,
  "estibasCompletas": 1, "cajasSueltas": 0,
  "numerosEstiba": [31],
  "observaciones": "opcional",
  "extraoficial": false,
  "motivoExtraoficial": null
}
```

`extraoficial: true` marca un pedido de emergencia fuera del DPP: exige `motivoExtraoficial` (mínimo 5 caracteres), no entra en el tope de lo programado ni en el MFR.

Quién ejecuta cada acción sale del token: enviar `creadaPorId` u otro `*PorId` en el cuerpo responde 400.

Respuesta de una remisión (`presentar()`): `id, consecutivo, anio, numero, version, estado, fechaOperativa, fechaHoraRegistro, turnoId, grupoId, lugarId, producto{id,codigo,descripcion}, fechaVencimiento, cantidadCajas, cantidadUnidades, estibasCompletas, cajasSueltas, descripcionEstibas, numerosEstiba, observaciones, extraoficial, motivoExtraoficial, entrega{}, aprobacion{}, validacion{}, motivoUltimoRechazo, esEditable, estaPendienteDeConciliar`.

### Tope contra el DPP

Al **crear**, **editar** y **aprobar** se verifica que lo remisionado de ese SKU en el día no supere lo programado (solo cuentan APROBADAS y VALIDADAS). Ver [modules/mfr.md](modules/mfr.md).

| Situación | Error | HTTP |
|---|---|---|
| Se pasa de lo programado | `REMISION_EXCEDE_PROGRAMACION` (informa programado, aprobadas y sobrante) | 409 |
| El día no tiene DPP cargado | `REMISION_SIN_PROGRAMACION` | 409 |
| El SKU no está en el DPP del día | `REMISION_PRODUCTO_NO_PROGRAMADO` | 409 |

## MFR

La programación es por **bloques del DPP de PepsiCo** (línea × franja horaria), no por SKU. Ver [modules/mfr.md](modules/mfr.md).

| Método | Ruta | Permiso | Notas |
|---|---|---|---|
| GET | `/mfr/dia?fecha=YYYY-MM-DD` | `mfr.consultar` | tablero: bloques calculados, MFR por SKU, turnos, líneas, vista horaria, familias, `personal`, advertencias |
| GET | `/mfr/bloques?fecha=` | `mfr.consultar` | bloques del día con Mx/T/kg |
| PUT | `/mfr/bloques` | `mfr.cargar_programacion` | crea (sin `id`) o corrige (`id` + `motivo`): `{ fechaOperativa, lineaId, productoId, horaInicio, horaFin, cajasPorHora, eficienciaPorcentaje, loop?, personasAsignadas?, motivo? }` |
| DELETE | `/mfr/bloques/:id` | `mfr.cargar_programacion` | `{ motivo }` |
| POST | `/mfr/bloques/dia` | `mfr.cargar_programacion` | carga un día completo: `{ fechaOperativa, bloques[], origen, reemplazar, motivo? }` |
| POST | `/mfr/bloques/periodo` | `mfr.cargar_programacion` | **Carga de N días** (DPP semanal o mensual): `{ bloques[], origen, reemplazar, motivo? }`, donde cada bloque trae su `fechaOperativa`. Máximo 62 días |
| POST | `/mfr/bloques/copiar` | `mfr.cargar_programacion` | `{ desde, hacia, reemplazar, motivo? }` |
| POST | `/mfr/dpp/analizar` | `mfr.cargar_programacion` | multipart, campo `archivo` (PDF ≤ 5 MB) → propuesta cruzada con el catálogo; **no escribe** |
| POST | `/mfr/turno/cerrar` | `mfr.configurar_turno` | `{ fechaOperativa, turnoId, motivoFaltante? }`; irreversible. 400 `MFR_FALTANTE_SIN_MOTIVO` con `faltantes[]` si hay SKU bajo su target |
| GET | `/mfr/asistencia?fecha=` | `mfr.consultar` | personas que llegaron, por turno y grupo |
| PUT | `/mfr/asistencia` | `mfr.configurar_turno` | `{ fechaOperativa, turnoId, grupoId, personasLlegaron, observacion? }`; crea o corrige |
| GET | `/mfr/asignaciones?fecha=` | `mfr.consultar` | grupos asignados a líneas, por turno |
| PUT | `/mfr/asignaciones` | `mfr.configurar_turno` | `{ fechaOperativa, turnoId, lineaId, grupoId, personas }`; crea o corrige |
| DELETE | `/mfr/asignaciones/:id` | `mfr.configurar_turno` | quita la asignación |
| GET | `/mfr/lineas` | `mfr.consultar` | |
| POST | `/mfr/lineas` | `catalogo.editar` | `{ codigo, nombre, tipo, capacidadKgHora?, orden? }` |
| PATCH | `/mfr/lineas/:id` | `catalogo.editar` | parcial |
| GET | `/mfr/estandares` | `mfr.consultar` | incluye `pesoSugeridoKg` deducido de la descripción |
| PUT | `/mfr/estandares` | `catalogo.editar_estandares` | **Carga en lote**: `{ cambios: [{ productoId, cajasPorHora?, pesoNetoKg? }], motivo }`. Máximo 100 productos |
| PUT | `/mfr/estandares/:productoId` | `catalogo.editar_estandares` | `{ cajasPorHora?, pesoNetoKg?, motivo }` — el motivo es obligatorio |

### Carga de un período (DPP de varios días)

PepsiCo manda el DPP por día o por semana, y podría mandarlo mensual (área, 2026-09-22). El sistema no distingue periodicidades: maneja **N días**, y el diario es el caso N = 1.

**El día de cada bloque lo decide el bloque**, a partir de su propia fecha y hora de inicio con el corte de las 06:00 (`fechaOperativaDeHoraLocal`). Una fila que arranca a las 00:30 pertenece al día operativo anterior.

**Una transacción por día**, no una para todo. Dos razones: un mes no cabría en el límite de 500 escrituras por transacción de Firestore, y un día con el turno cerrado no debe impedir cargar el resto de la semana.

Por eso el endpoint **no falla entero**: devuelve qué pasó con cada día.

```json
{
  "dias": [
    { "fechaOperativa": "2026-09-16", "estado": "CARGADO", "bloquesCreados": 20 },
    { "fechaOperativa": "2026-09-17", "estado": "OMITIDO", "bloquesCreados": 0,
      "codigo": "MFR_DIA_CON_PROGRAMACION", "mensaje": "El día ya tiene 20 bloque(s)…" },
    { "fechaOperativa": "2026-09-18", "estado": "ERROR", "bloquesCreados": 0,
      "codigo": "MFR_TURNO_CERRADO", "mensaje": "El turno ya fue cerrado…" }
  ],
  "totalBloquesCreados": 20,
  "diasCargados": 1
}
```

`OMITIDO` es el día que ya tenía programación y no se pidió reemplazo: no es una falla, es el caso normal al recargar una semana. `ERROR` es cualquier otro rechazo de negocio. Los errores de infraestructura sí interrumpen la operación completa.

`reemplazar` aplica a cada día por separado y exige `motivo`.

### Carga de estándares en lote

Todo el lote va en **una sola transacción**: o entran todos los cambios con su auditoría, o no entra ninguno. Un motivo común se copia en el registro de auditoría de cada producto.

En cada producto del lote, **omitir un campo significa "no lo toques"** y enviarlo en `null`, "bórralo". Sin esa distinción, cargar solo los pesos borraría las cajas/hora de todo el catálogo.

Respuesta: `{ actualizados: EstandarProducto[], sinCambios: string[] }` — `sinCambios` trae los códigos que ya tenían ese mismo valor, que no se escriben ni se auditan.

El tope de 100 lo impone Firestore: una transacción admite 500 escrituras y cada producto gasta dos (el producto y su auditoría). Se rechaza con 400 `MFR_DATOS_INVALIDOS`, igual que un producto repetido dentro del mismo lote o uno que no exista o esté inactivo.

**Trazabilidad del personal** (regla dura): no se pueden asignar más personas de las que llegaron. Primero la asistencia, después la asignación.

## Averías

Solo PT por ahora (2026-09-28). Ver ROADMAP D1.

| Método | Ruta | Permiso | Notas |
|---|---|---|---|
| GET | `/averias/causales` | `catalogo.consultar` | activas e inactivas, ordenadas por `orden` y nombre |
| POST | `/averias/causales` | `catalogo.editar` | `{ codigo, nombre, orden }` · 409 `CAUSAL_CODIGO_DUPLICADO` |
| PATCH | `/averias/causales/:id` | `catalogo.editar` | parcial; `activo` para desactivar (no se eliminan) |
| GET | `/averias?desde=&hasta=&turnoId=&grupoId=&estado=` | `averia.consultar` | fechas operativas; rango máx. 93 días; más recientes primero |
| GET | `/averias/indicador?desde=&hasta=` | `averia.consultar` | % de averías contra el T del DPP (máx. 1 % por contrato): `total`, `porDia`, `porTurno`, `porGrupo`, `porProducto` (con `unidadesFueraDelDpp`), `alertas[]`. Rango máx. 93 días |
| GET | `/averias/:id` | `averia.consultar` | reporte con registros y `total` |
| GET | `/averias/:id/registros/:registroId/fotos/:tipo` | `averia.consultar` | la imagen; `tipo` = `UNIDAD` · `LOTE_FECHA` · `CONJUNTO` |
| POST | `/averias` | `averia.reportar` | multipart (ver abajo) · 201 |
| PATCH | `/averias/:id/registros/:registroId` | `averia.corregir` | parcial; las fotos no cambian |
| POST | `/averias/:id/anular` | `averia.corregir` | `{ motivo }` · 409 `AVERIA_NO_MODIFICABLE` si ya está anulado |

**Crear (multipart):** campo `datos` con `{ grupoId, registros: [{ productoId, fechaVencimiento: 'YYYY-MM-DD', lote, causalId, cantidad, unidadMedida }] }` (1 a 30 registros; `unidadMedida` = `UNIDAD` · `DOCENA` · `SIX` · `BOLSA`) y un archivo por foto, `foto_{fila}_{TIPO}` (fila desde 0). JPG, PNG o WEBP, máx. 5 MB cada una. Fecha, hora, turno y quién reporta los pone el servidor. Si algo falla, no queda ni el reporte ni las fotos.

**Respuesta:** el reporte con `fechaOperativa` (`YYYY-MM-DD`), `estado` (`REGISTRADO` · `ANULADO`), `reportadoPorNombre`, `registros[]` (con copia `productoCodigo` / `productoDescripcion` y `evidencias: [{ tipo }]`, sin rutas internas) y `total: { unidades, sinConvertir: { BOLSA? } }`.

## Inventario

Fase 1 (2026-09-29): catálogo único de ítems (INSUMO, PI, PT) y kardex. Ver ROADMAP D3.

| Método | Ruta | Permiso | Notas |
|---|---|---|---|
| GET | `/inventario/items?tipo=&texto=&soloActivos=` | `inventario.consultar` | existencias; `texto` busca en código y descripción |
| GET | `/inventario/items/:id` | `inventario.consultar` | un ítem con su existencia |
| GET | `/inventario/items/:id/movimientos?limite=` | `inventario.consultar` | kardex, más reciente primero (100 por defecto, máx. 500) |
| POST | `/inventario/items` | `inventario.catalogo` | INSUMO/PI: `{ tipo, codigo, descripcion, unidadMedida }` · PT: `{ tipo: 'PT', productoId, unidadMedida }` (código y descripción salen del producto) · 409 `INVENTARIO_ITEM_DUPLICADO` |
| PATCH | `/inventario/items/:id` | `inventario.catalogo` | `codigo`, `descripcion` (no en PT), `unidadMedida`, `activo`. Tipo y producto no cambian |
| POST | `/inventario/movimientos` | `inventario.registrar` | `{ itemId, tipo: ENTRADA \| SALIDA, cantidad > 0 (hasta 3 decimales), referencia?, observacion? }` · 409 `INVENTARIO_EXISTENCIA_INSUFICIENTE` si la salida deja negativo |
| POST | `/inventario/ajustes` | `inventario.ajustar` | `{ itemId, cantidad (con signo, ≠ 0), motivo, observacion? }` |
| GET | `/inventario/movimientos?desde=&hasta=&tipo=` | `inventario.consultar` | todos los movimientos del rango (máx. 93 días) |
| POST | `/inventario/entradas` | `inventario.registrar` | entrada de mercancía: `{ documento, remitente?, observacion?, lineas: [{ itemId, cantidad }] }` (1 a 50 líneas, sin ítems repetidos, solo INSUMO y PI). Todo o nada. Responde el encabezado con `lineas[]` (código, descripción, unidad, cantidad, saldo) |
| GET | `/inventario/entradas?desde=&hasta=` | `inventario.consultar` | encabezados del rango, más recientes primero |
| GET | `/inventario/entradas/:id` | `inventario.consultar` | encabezado y líneas · 404 `INVENTARIO_ENTRADA_NO_ENCONTRADA` |

Por ahora todos los permisos de inventario (y de averías) los tiene solo el administrador; los roles se reparten al final (usuario, 2026-09-29).

Respuesta de un movimiento: `{ movimiento, item }`. El movimiento trae `cantidad` con signo, `saldo`, `fechaHoraRegistro`, `fechaOperativa`, `turnoId`, `usuarioNombre`, `referencia`, `observacion`, `motivo`. Fecha, hora, turno y usuario los pone el servidor. Dos movimientos simultáneos sobre el mismo ítem se atienden uno detrás del otro (bloqueo de fila).

## Códigos de error de dominio

| Código | HTTP |
|---|---|
| `REMISION_DATOS_INVALIDOS`, `REMISION_INFORMACION_INCOMPLETA`, `USUARIO_DATOS_INVALIDOS`, `PRODUCTO_DATOS_INVALIDOS`, `GRUPO_DATOS_INVALIDOS` | 400 |
| `AUTH_CREDENCIALES_INVALIDAS` | 401 |
| `AUTH_USUARIO_INACTIVO`, `AUTH_PERMISO_DENEGADO` | 403 |
| `REMISION_NO_ENCONTRADA`, `USUARIO_NO_ENCONTRADO`, `PRODUCTO_NO_ENCONTRADO`, `GRUPO_NO_ENCONTRADO` | 404 |
| `REMISION_TRANSICION_INVALIDA`, `REMISION_NO_EDITABLE`, `USUARIO_DOCUMENTO_DUPLICADO`, `PRODUCTO_CODIGO_DUPLICADO`, `GRUPO_CODIGO_DUPLICADO` | 409 |
| `REMISION_SIN_PROGRAMACION`, `REMISION_PRODUCTO_NO_PROGRAMADO`, `REMISION_EXCEDE_PROGRAMACION` | 409 |
| `MFR_DATOS_INVALIDOS`, `MFR_MOTIVO_OBLIGATORIO`, `MFR_DPP_NO_RECONOCIDO`, `MFR_FALTANTE_SIN_MOTIVO` | 400 |
| `MFR_BLOQUE_NO_ENCONTRADO`, `MFR_LINEA_NO_ENCONTRADA`, `MFR_ASIGNACION_NO_ENCONTRADA` | 404 |
| `MFR_TURNO_CERRADO`, `MFR_BLOQUES_SOLAPADOS`, `MFR_DIA_CON_PROGRAMACION`, `MFR_LINEA_CODIGO_DUPLICADO` | 409 |
| `MFR_ASIGNACION_SIN_ASISTENCIA`, `MFR_ASIGNACION_EXCEDE_ASISTENCIA`, `MFR_ASISTENCIA_MENOR_QUE_ASIGNADAS` | 409 |
| `CAUSAL_DATOS_INVALIDOS`, `AVERIA_DATOS_INVALIDOS` | 400 |
| `CAUSAL_NO_ENCONTRADA`, `AVERIA_NO_ENCONTRADA` | 404 |
| `CAUSAL_CODIGO_DUPLICADO`, `AVERIA_NO_MODIFICABLE` | 409 |
| `SIN_TURNO_CONFIGURADO` (averías, inventario: la hora no cae en ningún turno configurado) | 409 |
| `RANGO_FECHAS_INVALIDO`, `INVENTARIO_DATOS_INVALIDOS` | 400 |
| `INVENTARIO_ITEM_NO_ENCONTRADO`, `INVENTARIO_ENTRADA_NO_ENCONTRADA` | 404 |
| `INVENTARIO_ITEM_DUPLICADO`, `INVENTARIO_EXISTENCIA_INSUFICIENTE` | 409 |

`MFR_FALTANTE_SIN_MOTIVO` añade `faltantes[]` al cuerpo de la respuesta, para que el cliente muestre qué SKU quedaron cortos.
