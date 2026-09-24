# Arquitectura

## Capas y dirección de dependencias

Clean Architecture en cuatro capas. **Las dependencias apuntan hacia adentro.**

```text
PRESENTACIÓN     modules/*     controladores, DTOs, filtro HTTP, guards (NestJS)
      ↓
APLICACIÓN       application/* casos de uso: coordinan, no deciden
      ↓
DOMINIO          domain/*      entidades, reglas, puertos (interfaces). Solo TypeScript.
      ↑
INFRAESTRUCTURA  infrastructure/*  Prisma, bcrypt, JWT, Puppeteer, exceljs
```

Regla inviolable: **`src/domain/` no importa nada externo** (ni NestJS, ni Prisma, ni librerías). Por eso el dominio se prueba en milisegundos sin base de datos: 189 pruebas unitarias corren en segundos.

### Puertos e implementaciones

Cada dependencia externa se abstrae detrás de una interfaz del dominio; la implementación vive en infraestructura y se conecta por inyección de dependencias con tokens `Symbol` (las interfaces no existen en runtime).

| Puerto (dominio) | Implementación (infraestructura) | Token |
|---|---|---|
| `RemisionRepository` | `RemisionPrismaRepository` | `REMISION_REPOSITORY` |
| `ProductoRepository` | `ProductoPrismaRepository` | `PRODUCTO_REPOSITORY` |
| `UsuarioRepository` | `UsuarioPrismaRepository` | `USUARIO_REPOSITORY` |
| `CatalogoRepository` | `CatalogoPrismaRepository` | `CATALOGO_REPOSITORY` |
| `HistorialRemisionRepository` | `HistorialRemisionPrismaRepository` | `HISTORIAL_REMISION_REPOSITORY` |
| `AuditoriaRepository` | `AuditoriaPrismaRepository` | (dentro de la unidad de trabajo) |
| `UnidadDeTrabajo` | `UnidadDeTrabajoPrisma` | `UNIDAD_DE_TRABAJO` |
| `Reloj` | `RelojSistema` | `RELOJ` |
| `HashContrasena` | `BcryptHashService` | `HASH_CONTRASENA` |
| `EmisorDeToken` | `JwtEmisorTokenService` | `EMISOR_DE_TOKEN` |
| `GeneradorPdfRemision` | `PuppeteerPdfService` | `GENERADOR_PDF_REMISION` |
| `ExportadorExcelRemision` | `ExceljsExportadorService` | `EXPORTADOR_EXCEL_REMISION` |

Los repositorios de lectura y la unidad de trabajo se registran una sola vez en `PersistenciaModule`; los módulos de negocio lo importan.

## Unidad de trabajo y auditoría

El área definió que **la auditoría debe estar completa para que el proceso avance**. Toda escritura ocurre dentro de `UnidadDeTrabajo.ejecutar(...)`, que abre una transacción de PostgreSQL y entrega repositorios ligados a ella:

```text
BEGIN
  reservar consecutivo (SELECT ... FOR UPDATE)
  INSERT remisión + estibas
  INSERT auditoría        ← si falla, nada de lo anterior queda
COMMIT
```

Consecuencias:

- Los repositorios **no** abren transacciones. Reciben `ClientePrisma`, que puede ser el cliente normal (lecturas) o el de la transacción (escrituras).
- `AuditoriaPrismaRepository` no tiene try/catch: el error se propaga a propósito.
- Al agregar un módulo, su repositorio se suma a `ContextoTransaccional` y a `UnidadDeTrabajoPrisma`.

Verificado contra PostgreSQL real en `backend/test/remisiones.e2e-spec.ts`: 20 creaciones en paralelo obtienen consecutivos 1..20 sin repetidos, y una auditoría que falla no deja remisión ni consume el número.

## Errores de dominio → HTTP

Todos los errores de negocio heredan de `ErrorDominio` (`domain/shared/errores.ts`) y llevan un `codigo` estable. `ErrorDominioFilter` los traduce con una tabla, no con lógica:

| Error | HTTP |
|---|---|
| Datos inválidos / incompletos | 400 |
| Credenciales inválidas | 401 |
| Usuario inactivo, sin permiso | 403 |
| No encontrado | 404 |
| Transición inválida, no editable, duplicado | 409 |

## Autenticación y autorización

- **Protegido por defecto**: `JwtAuthGuard` y `PermisosGuard` son globales. Toda ruta exige token salvo `@Publico()`.
- El usuario sale del token (`@UsuarioActual()`), nunca del cuerpo de la petición.
- Permisos por endpoint con `@RequierePermisos('remision.crear')`. Se leen de la base en cada petición, no del token: un cambio de rol aplica de inmediato.
- JWT de 12 h (cubre el turno más largo). Login por documento. bcrypt con 10 rondas. Sin Passport.
- `JWT_SECRET` (≥ 32 caracteres) es obligatorio: la app no arranca sin él.

## Frontend

React 19 + Vite + Tailwind v4 + axios + TanStack Query + react-hook-form/zod + react-router 7.

```text
frontend/src/
├── app/          providers (Query → Sesión → Router), router, layout, panel de inicio
├── modules/      auth, remisiones, catalogo, admin — cada uno con api/, hooks/, pages/, components/
├── components/   Boton, Campo, Select, AreaTexto, Alerta, Dialogo, EstadoBadge
├── services/     http.ts (axios: token, 401 → cerrar sesión, ErrorApi), almacen-token.ts, archivos.ts
└── shared/       types/, utils/fechas.ts
```

Reglas: nada llama a axios fuera de `services/http.ts`; los permisos en el frontend solo **ocultan** acciones (la autorización real es del backend); los filtros del listado viven en la URL; cada mutación invalida exactamente las claves de caché que toca.

## Estructura del backend

```text
backend/src/
├── domain/
│   ├── shared/        errores.ts, fecha-operativa.ts, unidad-de-trabajo.ts
│   ├── remision/      entity, errors, repository, historial.repository, generador-pdf, exportador-excel
│   ├── usuario/       entity, errors, repository, contrasena, emisor-token
│   ├── producto/      repository (+ validarDatosProducto), errors
│   ├── catalogo/      repository
│   └── auditoria/     repository
├── application/
│   ├── remision/      crear, editar, flujo (5), imprimir, exportar
│   ├── auth/          iniciar-sesion, crear-usuario, actualizar-usuario
│   ├── catalogo/      producto.use-cases
│   └── pruebas/       dobles-en-memoria.ts (compartidos por los specs)
├── infrastructure/
│   ├── database/prisma/      PrismaService, PrismaModule
│   ├── persistence/prisma/   persistencia.module, unidad-de-trabajo, repositorios, mapper
│   ├── auth/                 guards, decoradores, bcrypt, jwt
│   ├── pdf/                  plantilla-remision (HTML), puppeteer-pdf.service
│   ├── excel/                exceljs-exportador.service
│   ├── http/filters/         error-dominio.filter
│   └── shared/               reloj-sistema
└── modules/
    ├── remision/     controller, module, dto/
    ├── auth/         auth.controller, usuarios.controller, module, dto/
    └── catalogo/     catalogo.controller, producto.controller, module, dto/
```
