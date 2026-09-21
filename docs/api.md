# API HTTP

Prefijo `/api`. Todas las rutas exigen `Authorization: Bearer <token>` salvo las marcadas **público**. Errores de dominio responden `{ codigo, mensaje }`; errores de validación de forma responden el formato de NestJS `{ statusCode, message[], error }`.

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

## Catálogos

| Método | Ruta | Permiso |
|---|---|---|
| GET | `/catalogos/turnos` | `catalogo.consultar` |
| GET | `/catalogos/proveedores` | `catalogo.consultar` |
| GET | `/catalogos/lugares` | `catalogo.consultar` |
| GET | `/catalogos/roles` | `admin.usuarios` |

Cada ítem: `{ id, codigo, nombre, activo }`.

## Productos

| Método | Ruta | Permiso | Notas |
|---|---|---|---|
| GET | `/productos?texto=&soloActivos=true` | `catalogo.consultar` | búsqueda por código o descripción |
| GET | `/productos/:id` | `catalogo.consultar` | |
| POST | `/productos` | `catalogo.editar` | `{ codigo, descripcion, proceso?, unidadesPorCaja?, cajasPorEstiba? }` · 409 `PRODUCTO_CODIGO_DUPLICADO` |
| PATCH | `/productos/:id` | `catalogo.editar` | parcial; `activo` para desactivar. Estándares de producción **no** se editan aquí (MFR). |

## Remisiones

| Método | Ruta | Permiso | Notas |
|---|---|---|---|
| POST | `/remisiones` | `remision.crear` | ver cuerpo abajo → 201 |
| PATCH | `/remisiones/:id` | `remision.editar` | parcial; 409 `REMISION_NO_EDITABLE` si no está en BORRADOR/EN_RECTIFICACION |
| POST | `/remisiones/:id/entregar` | `remision.entregar` | sin cuerpo |
| POST | `/remisiones/:id/aprobar` | `remision.registrar_aprobacion` | `{ opaNombre, opaCargo? }` |
| POST | `/remisiones/:id/rechazar` | `remision.registrar_aprobacion` | `{ motivo }` (5–500) |
| POST | `/remisiones/:id/rectificar` | `remision.rectificar` | sin cuerpo; versión +1 |
| POST | `/remisiones/:id/validar` | `remision.validar` | `{ concilidadoCon }` |
| GET | `/remisiones?anio=&turnoId=&proveedorId=&productoId=&estado=&desde=&hasta=&pagina=&porPagina=` | `remision.consultar` | `desde`/`hasta` son fechas operativas `YYYY-MM-DD`; máximo 100 por página |
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
  "turnoId": "uuid", "proveedorId": "uuid", "lugarId": "uuid", "productoId": "uuid",
  "fechaVencimiento": "2027-03-01",
  "cantidadCajas": 36, "cantidadUnidades": 144,
  "estibasCompletas": 1, "cajasSueltas": 0,
  "numerosEstiba": [31],
  "observaciones": "opcional"
}
```

Quién ejecuta cada acción sale del token: enviar `creadaPorId` u otro `*PorId` en el cuerpo responde 400.

Respuesta de una remisión (`presentar()`): `id, consecutivo, anio, numero, version, estado, fechaOperativa, fechaHoraRegistro, turnoId, proveedorId, lugarId, producto{id,codigo,descripcion}, fechaVencimiento, cantidadCajas, cantidadUnidades, estibasCompletas, cajasSueltas, descripcionEstibas, numerosEstiba, observaciones, entrega{}, aprobacion{}, validacion{}, motivoUltimoRechazo, esEditable, estaPendienteDeConciliar`.

## MFR

| Método | Ruta | Permiso | Notas |
|---|---|---|---|
| GET | `/mfr/dia?fecha=YYYY-MM-DD` | `mfr.consultar` | tablero: `mfr`, `turnos[]` (eficiencia), `alerta`, `programacion`, `configuraciones` |
| GET | `/mfr/programacion?fecha=` | `mfr.consultar` | |
| POST | `/mfr/programacion` | `mfr.cargar_programacion` | `{ fechaOperativa, filas:[{productoId, cantidadProgramadaCajas}], archivoOrigen? }` — reemplaza filas existentes |
| DELETE | `/mfr/programacion/:id` | `mfr.cargar_programacion` | `{ motivo }` |
| GET | `/mfr/config-turno?fecha=` | `mfr.consultar` | |
| PUT | `/mfr/config-turno` | `mfr.configurar_turno` | `{ fechaOperativa, turnoId, lineaId, productoId, porcentajeRendimiento, personasAsignadas, motivo? }` — crea o corrige; corregir exige motivo |
| DELETE | `/mfr/config-turno/:id` | `mfr.configurar_turno` | `{ motivo }`; 409 si el turno está cerrado |
| POST | `/mfr/config-turno/cerrar` | `mfr.configurar_turno` | `{ fechaOperativa, turnoId }` — irreversible |
| GET | `/mfr/lineas` | `mfr.consultar` | |
| POST | `/mfr/lineas` | `catalogo.editar` | `{ codigo, nombre }` |
| PATCH | `/mfr/lineas/:id` | `catalogo.editar` | `{ codigo?, nombre?, activo? }` |
| GET | `/mfr/estandares` | `mfr.consultar` | |
| PUT | `/mfr/estandares/:productoId` | `catalogo.editar_estandares` | `{ cajasPorHora?, unidadesPorHora?, motivo }` |

## Códigos de error de dominio

| Código | HTTP |
|---|---|
| `REMISION_DATOS_INVALIDOS`, `REMISION_INFORMACION_INCOMPLETA`, `USUARIO_DATOS_INVALIDOS`, `PRODUCTO_DATOS_INVALIDOS` | 400 |
| `AUTH_CREDENCIALES_INVALIDAS` | 401 |
| `AUTH_USUARIO_INACTIVO`, `AUTH_PERMISO_DENEGADO` | 403 |
| `REMISION_NO_ENCONTRADA`, `USUARIO_NO_ENCONTRADO`, `PRODUCTO_NO_ENCONTRADO` | 404 |
| `REMISION_TRANSICION_INVALIDA`, `REMISION_NO_EDITABLE`, `USUARIO_DOCUMENTO_DUPLICADO`, `PRODUCTO_CODIGO_DUPLICADO` | 409 |
| `MFR_DATOS_INVALIDOS`, `MFR_MOTIVO_OBLIGATORIO` | 400 |
| `MFR_CONFIG_TURNO_NO_ENCONTRADA`, `MFR_LINEA_NO_ENCONTRADA` | 404 |
| `MFR_TURNO_CERRADO`, `MFR_LINEA_CODIGO_DUPLICADO` | 409 |
