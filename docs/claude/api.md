# API — endpoints y permisos

> Leer cuando se agrega o se consume un endpoint. Índice en `CLAUDE.md`.
>
> **Generado del código el 2026-10-07** leyendo los controladores (`backend/src/modules/**/*.controller.ts`):
> cada ruta con el permiso de su `@RequierePermisos` (o el de la clase). Al agregar o cambiar un endpoint,
> actualizar esta tabla. La explicación de cada endpoint (cuerpo, respuesta, ejemplos) está en `docs/api.md`.

## Reglas

- **Prefijo global `/api`** (`app.setGlobalPrefix('api')` en `main.ts`): `GET /mfr/dia` se llama `GET /api/mfr/dia`.
- **Protegido por defecto**: `JwtAuthGuard` y `PermisosGuard` son globales. Sin `@Publico()` toda ruta exige
  `Authorization: Bearer <token>`. "Solo autenticado" = basta con sesión iniciada, sin permiso particular.
- Sin el permiso → `PermisoDenegadoError` → **403**. El **ADMINISTRADOR** pasa siempre (superusuario).
- Quién ejecuta sale del token (`@UsuarioActual()`), nunca del cuerpo.
- `GET /remisiones/:id` va **al final** del controlador (si no, "consecutivo" se tomaría como un id).
- Al 2026-10-07: **99 rutas**; una pública (`POST /auth/login`), una solo autenticada (`GET /auth/perfil`),
  las demás con permiso.

## Permisos existentes

Sembrados en `backend/src/infrastructure/datos-base.ts` (fuente de verdad; el seed reemplaza los permisos de
cada rol en cada corrida).

| Módulo | Permisos |
|---|---|
| remision | `remision.crear`, `remision.consultar`, `remision.editar`, `remision.entregar`, `remision.registrar_aprobacion`, `remision.rectificar`, `remision.validar`, `remision.exportar`, `remision.enviar_correo`, `remision.firmar_emision`, `remision.firmar_verificacion`, `remision.firmar_recepcion` |
| catalogo | `catalogo.consultar`, `catalogo.editar`, `catalogo.editar_estandares` |
| admin | `admin.usuarios`, `admin.auditoria`, `admin.correos` |
| mfr | `mfr.consultar`, `mfr.cargar_programacion`, `mfr.configurar_turno`, `resumen.consultar` |
| averia | `averia.reportar`, `averia.consultar`, `averia.corregir` |
| inventario | `inventario.consultar`, `inventario.registrar`, `inventario.ajustar`, `inventario.catalogo` |

Roles: `ADMINISTRADOR`, `COORDINADOR_MQ`, `PATINADOR`, `CONSULTA`, `OPA_PEPSICO`. Los módulos nuevos son
**solo del administrador** hasta que se repartan los roles (usuario, 2026-09-29).

## Endpoints por controlador

### auth/auth.controller.ts

| Método | Ruta | Permiso |
|---|---|---|
| POST | `/auth/login` | público |
| GET | `/auth/perfil` | solo autenticado |

### auth/usuarios.controller.ts

| Método | Ruta | Permiso |
|---|---|---|
| GET | `/usuarios` | `admin.usuarios` (de la clase) |
| GET | `/usuarios/:id` | `admin.usuarios` (de la clase) |
| POST | `/usuarios` | `admin.usuarios` (de la clase) |
| PATCH | `/usuarios/:id` | `admin.usuarios` (de la clase) |

### averia/causal-averia.controller.ts

| Método | Ruta | Permiso |
|---|---|---|
| GET | `/averias/causales` | `catalogo.consultar` |
| POST | `/averias/causales` | `catalogo.editar` |
| PATCH | `/averias/causales/:id` | `catalogo.editar` |

### averia/reporte-averia.controller.ts

| Método | Ruta | Permiso |
|---|---|---|
| GET | `/averias` | `averia.consultar` |
| GET | `/averias/indicador` | `averia.consultar` |
| GET | `/averias/:id` | `averia.consultar` |
| GET | `/averias/:id/registros/:registroId/fotos/:tipo` | `averia.consultar` |
| POST | `/averias` | `averia.reportar` |
| PATCH | `/averias/:id/registros/:registroId` | `averia.corregir` |
| POST | `/averias/:id/anular` | `averia.corregir` |

### catalogo/catalogo.controller.ts

| Método | Ruta | Permiso |
|---|---|---|
| GET | `/catalogos/turnos` | `catalogo.consultar` |
| GET | `/catalogos/lugares` | `catalogo.consultar` |
| GET | `/catalogos/roles` | `admin.usuarios` |

### catalogo/grupo.controller.ts

| Método | Ruta | Permiso |
|---|---|---|
| GET | `/grupos` | `catalogo.consultar` |
| POST | `/grupos` | `catalogo.editar` |
| PATCH | `/grupos/:id` | `catalogo.editar` |

### catalogo/producto.controller.ts

| Método | Ruta | Permiso |
|---|---|---|
| GET | `/productos` | `catalogo.consultar` |
| GET | `/productos/:id` | `catalogo.consultar` |
| POST | `/productos` | `catalogo.editar` |
| PATCH | `/productos/:id` | `catalogo.editar` |

### correo/correo.controller.ts

| Método | Ruta | Permiso |
|---|---|---|
| GET | `/correos/listas` | `remision.enviar_correo` |
| POST | `/correos/listas` | `admin.correos` |
| PATCH | `/correos/listas/:id` | `admin.correos` |
| POST | `/correos/remisiones` | `remision.enviar_correo` |
| GET | `/correos/envios` | `admin.correos` |
| POST | `/correos/envios/:id/reenviar` | `admin.correos` |

### inventario/catalogo-inventario.controller.ts

| Método | Ruta | Permiso |
|---|---|---|
| GET | `/inventario/unidades` | `inventario.consultar` |
| POST | `/inventario/unidades` | `inventario.catalogo` |
| PATCH | `/inventario/unidades/:id` | `inventario.catalogo` |
| GET | `/inventario/catalogo/:tipo` | `inventario.consultar` |
| POST | `/inventario/catalogo/:tipo` | `inventario.catalogo` |
| PATCH | `/inventario/catalogo/:tipo/:id` | `inventario.catalogo` |
| GET | `/inventario/recetas` | `inventario.consultar` |
| GET | `/inventario/recetas/:productoId` | `inventario.consultar` |
| PUT | `/inventario/recetas/:productoId` | `inventario.catalogo` |

### inventario/inventario.controller.ts

| Método | Ruta | Permiso |
|---|---|---|
| GET | `/inventario/items` | `inventario.consultar` |
| GET | `/inventario/items/:id` | `inventario.consultar` |
| GET | `/inventario/items/:id/movimientos` | `inventario.consultar` |
| POST | `/inventario/movimientos` | `inventario.registrar` |
| POST | `/inventario/ajustes` | `inventario.ajustar` |
| POST | `/inventario/entradas` | `inventario.registrar` |
| GET | `/inventario/entradas` | `inventario.consultar` |
| GET | `/inventario/entradas/:id` | `inventario.consultar` |
| GET | `/inventario/alertas` | `inventario.consultar` |
| GET | `/inventario/cierres/preparar` | `inventario.consultar` |
| POST | `/inventario/cierres` | `inventario.ajustar` |
| GET | `/inventario/cierres` | `inventario.consultar` |
| GET | `/inventario/movimientos` | `inventario.consultar` |

### mfr/mfr.controller.ts

| Método | Ruta | Permiso |
|---|---|---|
| GET | `/mfr/dia` | `mfr.consultar` |
| GET | `/mfr/indicadores` | `mfr.consultar` |
| GET | `/mfr/ritmo` | `mfr.consultar` |
| GET | `/mfr/bloques` | `mfr.consultar` |
| PUT | `/mfr/bloques` | `mfr.cargar_programacion` |
| DELETE | `/mfr/bloques/:id` | `mfr.cargar_programacion` |
| POST | `/mfr/bloques/dia` | `mfr.cargar_programacion` |
| POST | `/mfr/bloques/periodo` | `mfr.cargar_programacion` |
| POST | `/mfr/bloques/copiar` | `mfr.cargar_programacion` |
| POST | `/mfr/dpp/analizar` | `mfr.cargar_programacion` |
| POST | `/mfr/turno/cerrar` | `mfr.configurar_turno` |
| GET | `/mfr/asistencia` | `mfr.consultar` |
| PUT | `/mfr/asistencia` | `mfr.configurar_turno` |
| PUT | `/mfr/esperadas-dia` | `mfr.configurar_turno` |
| GET | `/mfr/asignaciones` | `mfr.consultar` |
| PUT | `/mfr/asignaciones` | `mfr.configurar_turno` |
| DELETE | `/mfr/asignaciones/:id` | `mfr.configurar_turno` |
| GET | `/mfr/lineas` | `mfr.consultar` |
| POST | `/mfr/lineas` | `catalogo.editar` |
| PATCH | `/mfr/lineas/:id` | `catalogo.editar` |
| GET | `/mfr/estandares` | `mfr.consultar` |
| PUT | `/mfr/estandares` | `catalogo.editar_estandares` |
| PUT | `/mfr/estandares/:productoId` | `catalogo.editar_estandares` |

### remision/remision.controller.ts

| Método | Ruta | Permiso |
|---|---|---|
| GET | `/remisiones/:id/firmas` | `remision.consultar` |
| POST | `/remisiones/:id/firmas` | `remision.consultar` |
| POST | `/remisiones` | `remision.crear` |
| PATCH | `/remisiones/:id` | `remision.editar` |
| POST | `/remisiones/:id/entregar` | `remision.entregar` |
| POST | `/remisiones/:id/aprobar` | `remision.registrar_aprobacion` |
| POST | `/remisiones/:id/aprobar-firmando` | `remision.registrar_aprobacion` |
| POST | `/remisiones/:id/rechazar` | `remision.registrar_aprobacion` |
| POST | `/remisiones/:id/rectificar` | `remision.rectificar` |
| POST | `/remisiones/:id/validar` | `remision.validar` |
| POST | `/remisiones/:id/validar-firmando` | `remision.validar` |
| GET | `/remisiones` | `remision.consultar` |
| GET | `/remisiones/resumen` | `remision.consultar` |
| GET | `/remisiones/pdf` | `remision.consultar` |
| GET | `/remisiones/exportar` | `remision.exportar` |
| GET | `/remisiones/:id/pdf` | `remision.consultar` |
| GET | `/remisiones/consecutivo/:anio/:numero` | `remision.consultar` |
| GET | `/remisiones/:id/versiones` | `remision.consultar` |
| GET | `/remisiones/:id/auditoria` | `remision.consultar + admin.auditoria` |
| GET | `/remisiones/:id` | `remision.consultar` |

### resumen/resumen.controller.ts

| Método | Ruta | Permiso |
|---|---|---|
| GET | `/resumenes` | `resumen.consultar` |
| GET | `/resumenes/:id/pdf` | `resumen.consultar` |
| GET | `/resumenes/:id` | `resumen.consultar` |

