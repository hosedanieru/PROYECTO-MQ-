# CLAUDE.md — Aplicativo Maquila (MQ) · Inlotrans S.A.S.

Contexto del proyecto para continuar el desarrollo. Leer completo antes de escribir código.

---

## 1. Qué es este proyecto

Aplicativo para el área de **Maquila (MQ)** de Inlotrans S.A.S. (empresa de logística, Mosquera, Cundinamarca, Colombia). El área opera dentro de la planta **Maquila PepsiCo Santo Domingo**: empaca producto terminado (PT) y lo entrega a PepsiCo.

Objetivo: reemplazar un conjunto de formularios en Excel por un sistema integrado con trazabilidad real.

**Remisiones es la entidad raíz.** Todo lo demás se construye sobre los datos que produce:

```text
REMISIONES
   ├── MFR (Manufacturing Fill Rate — cumplimiento de lo programado)
   ├── Averías (% por día / turno / grupo)
   ├── Calidad (muestreos, controles PI/PT/insumos/rotulado)
   ├── Inventario (conciliación contra el WMS de bodega)
   ├── Planes de trabajo
   ├── Cuaderno virtual
   ├── Entrega de turno
   └── Alertas por desviación (general y por SKU)
```

No diseñar ni implementar esos módulos sin levantamiento previo. Remisiones está cerrado y MFR implementado (con la naturaleza de la línea pendiente de confirmar).

### Perfil del usuario

Jhonson, aprendiz SENA de Programación de Software, trabajando en Inlotrans. Se describe como principiante en full-stack. **Requiere explicaciones paso a paso, en español, con el razonamiento detrás de cada decisión** — no solo el código. Entorno Windows con PowerShell.

---

## 2. Reglas de trabajo (obligatorias)

Vienen del documento maestro del proyecto. Se cumplen sin excepción:

1. **No hacer suposiciones sobre el negocio.** Si falta información de MQ (procesos, formularios, roles, KPIs, nombres, flujos), preguntar. Si se puede continuar sin ella, marcar explícitamente `PENDIENTE DE DEFINIR`.
2. **No inventar datos.** Ni KPIs, ni reglas, ni entidades, ni significados de siglas.
3. **Ante una decisión técnica importante**, presentar: Problema · Opciones · Ventajas · Desventajas · Recomendación. Nunca decidir en silencio.
4. **Trabajar por fases.** Cada fase termina en estado funcional, probado y entendible. No generar miles de líneas de una sola vez.
5. **Si se detecta un problema arquitectónico, detenerse y explicarlo** antes de seguir.
6. **Señalar hallazgos en los datos.** Contradicciones, duplicados y valores inconsistentes se reportan al usuario para que los valide con el área; no se resuelven adivinando.

### Reglas de código

- No mezclar lógica de negocio con componentes visuales
- No acceder directamente a la base de datos desde el frontend
- No dispersar SQL por la aplicación
- No componentes ni archivos gigantes
- No duplicar lógica
- No crear abstracciones innecesarias
- No introducir tecnologías sin un problema concreto que resuelvan
- Reglas de negocio centralizadas en el dominio
- Evitar `any` cuando exista alternativa tipada
- Nunca secretos, credenciales ni tokens en el código fuente

---

## 3. Stack

| Capa | Tecnología |
|---|---|
| Backend | Node.js + TypeScript + NestJS |
| ORM | **Prisma 7** (solo con PostgreSQL) |
| Base de datos | **Seleccionable con `PERSISTENCIA`**: PostgreSQL 18 (`postgres`, por defecto) o **Firestore** (`firestore`, vía `firebase-admin`). Decisión del usuario (2026-09-17): Firebase por familiaridad y por no tener servidor de BD; PostgreSQL se conserva íntegro. |
| Frontend | React 19 + TypeScript + Vite 8 · Tailwind v4 · axios · TanStack Query · react-hook-form + zod · react-router 7 |
| Pruebas | Vitest |
| Infraestructura | Git, Docker (solo para despliegue futuro) |

### Prisma 7 — diferencias críticas con versiones anteriores

Prisma 7 rompió compatibilidad en tres puntos. Ignorarlos produce errores confusos:

1. **La `url` NO va en `schema.prisma`.** El bloque `datasource` solo lleva `provider`. La URL se configura en `prisma.config.ts`.
2. **`prisma.config.ts` requiere `import 'dotenv/config'`** en la primera línea. Sin él, `DATABASE_URL` llega vacío.
3. **`PrismaClient` requiere un driver adapter.** Se usa `PrismaPg` de `@prisma/adapter-pg`.

```typescript
// prisma.config.ts
import 'dotenv/config';
import path from 'node:path';
import { defineConfig, env } from 'prisma/config';

export default defineConfig({
  schema: path.join('prisma', 'schema.prisma'),
  datasource: { url: env('DATABASE_URL') },
  migrations: {
    path: path.join('prisma', 'migrations'),
    seed: 'tsx prisma/seed.ts',
  },
});
```

El cliente se genera en `src/generated/prisma`, no en `node_modules`.

Comandos:
```powershell
npx prisma migrate dev --name <nombre>
npx prisma db seed
npx prisma studio --config ./prisma.config.ts
```

---

## 4. Arquitectura

Clean Architecture en cuatro capas. **Las dependencias apuntan hacia adentro, nunca al revés.**

```text
PRESENTACIÓN   controlador, DTO, filtros HTTP
      ↓
APLICACIÓN     casos de uso (coordinan, no deciden)
      ↓
DOMINIO        entidades, reglas, interfaces de repositorio
      ↑
INFRAESTRUCTURA  Prisma, PostgreSQL, adaptadores
```

### Dos bases de datos, una sola aplicación

`infrastructure/persistence/persistencia.module.ts` es el **único** lugar que decide la implementación de cada puerto según `PERSISTENCIA`. Ningún módulo de negocio importa `PrismaService` ni `FirestoreService`. Al agregar un repositorio nuevo hay que implementarlo **dos veces** (`persistence/prisma/` y `firestore/repositorios/`) y registrarlo en ese módulo.

Reglas de la implementación Firestore (`infrastructure/firestore/`):
- Dentro de una transacción, **todas las lecturas antes que cualquier escritura**; por eso los repositorios nunca releen lo que acaban de escribir: devuelven el objeto construido.
- Consecutivo: transacción optimista con reintento sobre `consecutivos/REMISION-{anio}`.
- Listados: consulta por fecha operativa (`fechaOperativaTexto`) y resto de filtros en memoria (tope 5.000). Búsqueda de productos en memoria.
- Roles con permisos embebidos; horarios embebidos en el turno. Ids de catálogo = código.
- Sin migraciones: `npm run seed:firestore`. Reglas e índices en `infrastructure/firebase/`.
- Pruebas: `npm run test:firestore` contra un proyecto de pruebas (id con "test"/"prueba") o el emulador (requiere Java).

### Regla estructural inviolable

**`src/domain/` no importa nada externo.** Ni NestJS, ni Prisma, ni React, ni PostgreSQL. Solo TypeScript. Si un archivo de `domain/` necesita un import de librería, hay un error de diseño.

Consecuencia práctica: el dominio se prueba sin base de datos, en milisegundos.

### El dominio define sus propios tipos

El dominio NO importa los enums generados por Prisma. Define los suyos (`EstadoRemision` como union type) y el mapeador traduce. Se traduce con un `Record` explícito, no con un cast: así TypeScript reporta si alguien agrega un estado en un solo lado.

### Estructura de carpetas

```text
backend/src/
├── domain/
│   ├── shared/
│   │   ├── errores.ts                  ErrorDominio: base de TODOS los errores de negocio
│   │   ├── fecha-operativa.ts          regla del corte 6:00 a 6:00
│   │   └── unidad-de-trabajo.ts        puerto transaccional
│   ├── remision/
│   │   ├── remision.entity.ts          entidad + reglas + flujo de estados
│   │   ├── remision.errors.ts          errores de negocio
│   │   └── remision.repository.ts      interfaz
│   ├── usuario/
│   │   ├── usuario.entity.ts           entidad con tienePermiso()
│   │   ├── usuario.errors.ts
│   │   ├── usuario.repository.ts       interfaz
│   │   ├── contrasena.ts               regla mín. 8 chars + puerto HashContrasena
│   │   └── emisor-token.ts             puerto EmisorDeToken
│   ├── producto/producto.repository.ts
│   └── auditoria/auditoria.repository.ts
│
├── application/
│   ├── remision/
│   │   ├── crear-remision.use-case.ts
│   │   └── flujo-remision.use-cases.ts las 5 transiciones
│   ├── auth/
│   │   ├── iniciar-sesion.use-case.ts
│   │   └── crear-usuario.use-case.ts
│   └── pruebas/dobles-en-memoria.ts    dobles compartidos por los specs
│
├── infrastructure/
│   ├── database/prisma/                PrismaService, PrismaModule
│   ├── persistence/prisma/
│   │   ├── persistencia.module.ts      registra UoW + repositorios de lectura
│   │   ├── cliente-prisma.ts           tipo compatible con transacciones
│   │   ├── unidad-de-trabajo.prisma.ts
│   │   ├── remision.mapper.ts
│   │   ├── remision.prisma.repository.ts
│   │   ├── usuario.prisma.repository.ts
│   │   ├── producto.prisma.repository.ts
│   │   └── auditoria.prisma.repository.ts
│   ├── auth/
│   │   ├── jwt-auth.guard.ts           guard global: exige token salvo @Publico()
│   │   ├── permisos.guard.ts           guard global: exige @RequierePermisos()
│   │   ├── decoradores.ts              @Publico, @RequierePermisos, @UsuarioActual
│   │   ├── bcrypt-hash.service.ts
│   │   └── jwt-emisor-token.service.ts
│   ├── http/filters/error-dominio.filter.ts   tabla ErrorDominio → HTTP
│   └── shared/reloj-sistema.ts
│
└── modules/
    ├── remision/
    │   ├── remision.module.ts          wiring (DI)
    │   ├── remision.controller.ts
    │   └── dto/
    └── auth/
        ├── auth.module.ts              JwtModule + guards globales (APP_GUARD)
        ├── auth.controller.ts          login, perfil
        ├── usuarios.controller.ts      crear usuario
        └── dto/auth.dto.ts
```

### Inyección de dependencias

Las interfaces de TypeScript no existen en runtime, así que se usan tokens `Symbol` y `useFactory`:

```typescript
{
  provide: REMISION_REPOSITORY,
  inject: [PrismaService],
  useFactory: (prisma: PrismaService) => new RemisionPrismaRepository(prisma),
}
```

Tokens existentes: `REMISION_REPOSITORY`, `PRODUCTO_REPOSITORY`, `USUARIO_REPOSITORY`, `AUDITORIA_REPOSITORY`, `UNIDAD_DE_TRABAJO`, `RELOJ`, `HASH_CONTRASENA`, `EMISOR_DE_TOKEN`.

`UNIDAD_DE_TRABAJO` y los repositorios de lectura se registran una sola vez en `PersistenciaModule`; los módulos de negocio lo importan.

### Autenticación y permisos

- **Protegido por defecto.** `JwtAuthGuard` y `PermisosGuard` son globales (`APP_GUARD`). Toda ruta exige `Authorization: Bearer <token>` salvo que lleve `@Publico()`. Una ruta nueva sin decorador queda protegida, no expuesta.
- **Quién ejecuta la acción sale del token** (`@UsuarioActual()`), nunca del cuerpo. Los DTOs no reciben identificadores de usuario.
- **Permisos por endpoint** con `@RequierePermisos('remision.crear')`. Sin permiso → `PermisoDenegadoError` → 403.
- **El ADMINISTRADOR es superusuario**: `Usuario.tienePermiso()` devuelve `true` para ese rol aunque el permiso no exista en la base; el frontend hace lo mismo. Todo lo que el sistema haga, el administrador lo puede hacer. Los permisos finos del resto de roles se ajustarán cuando el área defina las vistas por rol × área.
- **Los permisos NO viajan en el token**; el guard carga el usuario de la base en cada petición. Un cambio de rol o una desactivación aplican de inmediato, no cuando el token expire.
- **Token JWT de 12 h**, sin refresh (cubre el turno más largo, 10 h). Login por `documento`. Contraseñas con bcrypt (10 rondas), mínimo 8 caracteres.
- Sin Passport: `@nestjs/jwt` + guards propios. No había un problema que Passport resolviera.
- `JWT_SECRET` (≥32 chars) es obligatorio: la app no arranca sin él.
- Admin inicial: lo crea `prisma db seed` desde `ADMIN_INICIAL_*` solo si no existe.
- El login **no** se audita (es lectura). PENDIENTE DE DEFINIR si el área quiere registro de intentos.

---

## 5. Conocimiento del negocio

### Actores

| Actor | Organización | ¿Usuario del sistema? | Responsabilidad |
|---|---|---|---|
| Coordinador MQ en turno | Inlotrans | Sí | Crea la remisión; valida/concilia |
| Patinador (auxiliar logístico) | Inlotrans | Sí | Entrega al OPA, firma como verificador, ingresa el PT al WMS |
| **OPA** (facturador de PepsiCo) | PepsiCo | **No** | Aprueba o rechaza |
| Contacto de conciliación | PepsiCo | **No** | Contraparte del cuaderno virtual |

Los actores de PepsiCo se registran como **dato** (nombre, cargo, fecha), no como cuenta. El contacto de conciliación se modela como rol, nunca por nombre fijo.

### Turnos y horarios

Son configuración (`turno_horario`), no valores en código. **Decisión del 2026-09-18: se usan los horarios del DPP de PepsiCo, todos los días de la semana**:

| Turno | Horario | Horas productivas |
|---|---|---|
| T1 | 06:00–13:30 | 7,5 |
| T2 | 14:00–21:30 | 7,5 |
| T3 | 22:00–05:30 | 7,5 |

Los horarios anteriores por día de la semana (lunes 08:00–14:00, sábado sin T3…) quedaron en pausa: `PENDIENTE DE DEFINIR` si algún día opera distinto. El turno de un bloque del DPP se deriva de su hora de inicio (`turnoDeHora` en `domain/mfr/horas-turno.ts`).

### Fecha operativa — el corte 6:00 a 6:00

**La regla más importante del sistema.** El día productivo NO coincide con el día calendario:

```text
Día operativo D = D 06:00 ──────► D+1 06:00

fecha_operativa = fecha(timestamp − 6 horas)  en zona America/Bogota
```

Motivo: el T3 cruza la medianoche. Sin esto, la producción nocturna se parte en dos días y todos los indicadores salen mal.

El corte de las 06:00 coincide con el cierre del T3 en todos los días, así que la regla no necesita conocer los turnos.

**Reglas derivadas:**
- Toda agregación, reporte e indicador se agrupa por `fecha_operativa`, **nunca** por fecha calendario. Aplica también a MFR, averías, calidad y entrega de turno.
- El cálculo se hace en hora de Colombia (UTC−5, sin horario de verano). Restar 6 horas sobre el valor UTC da un resultado corrido.
- **El año del consecutivo sale de la fecha operativa**, no del calendario. Una remisión del 1 de enero a las 02:00 pertenece al 31 de diciembre anterior y lleva el consecutivo del año que cierra.

Implementado y probado en `src/domain/shared/fecha-operativa.ts`.

### Flujo de la remisión

```text
   BORRADOR ──► ENTREGADA ──► APROBADA ──► VALIDADA
                    ▲              │
                    │              ▼
                    └── EN_RECTIFICACION ◄── RECHAZADA
```

| Estado | Quién | Qué ocurre |
|---|---|---|
| BORRADOR | Coordinador MQ | Registra producto, cantidades, vencimiento, estibas. Editable |
| ENTREGADA | Patinador | Lleva producto y documento al OPA; carga el PT al WMS. Ya no editable |
| APROBADA | OPA (registrado por Inlotrans) | PepsiCo acepta. Se guarda nombre y cargo del OPA |
| RECHAZADA | OPA (registrado por Inlotrans) | No acepta. Motivo obligatorio |
| EN_RECTIFICACION | Coordinador MQ | Se corrige. Versión +1, **mismo consecutivo**. Vuelve a ser editable |
| VALIDADA | Coordinador MQ | Conciliación interna (cuaderno virtual). Estado final |

Las transiciones válidas están en una tabla (`TRANSICIONES_PERMITIDAS`) dentro de la entidad, no en condicionales. Nada fuera de ese diagrama está permitido.

**Edición:** `Remision.editar(cambios)` solo funciona en BORRADOR o EN_RECTIFICACION (`RemisionNoEditableError` → 409 en los demás). Revalida el documento completo con las mismas reglas de `crear`. Editables: turno, grupo, lugar, producto (con snapshot nuevo que resuelve el caso de uso), vencimiento, cantidades, estibas, observaciones. NO editables: consecutivo, fecha operativa, fecha de registro, autor, estado, versión. Cada edición se audita con valor anterior y nuevo.

### Invariantes del negocio

1. **Una remisión = un solo producto (SKU).** En el Excel se imprimen dos por hoja, pero eso es solo formato de impresión.
2. **El consecutivo reinicia cada año.** Identidad de negocio = `(año, número)`, con restricción única. Se reserva con bloqueo de fila.
3. **Nunca se elimina una remisión.** Es un documento firmado. Un rechazo se corrige mediante rectificación; el consecutivo no se quema.
4. **Aprobación ≠ validación.** Dos eventos distintos, con responsables y momentos distintos. Mantenerlas separadas permite detectar remisiones aprobadas sin conciliar (fuente probable de descuadres actuales).
5. **Snapshot de producto.** La remisión guarda copia congelada del código y descripción, además de la referencia al catálogo. Si el catálogo cambia, el documento debe seguir mostrando lo que decía al firmarse. Duplicación intencional.
6. **Estibas como dato estructurado.** En el Excel, `N° Estibas` mezclaba número y texto (`"2 ESTIBAS+ 21 CAJAS"`), y las observaciones contenían los números de estiba (`"EST: 31,32,33"`). Ahora: `estibas_completas` + `cajas_sueltas` (enteros) y tabla `remision_estiba`. El texto se calcula para mostrar, no se almacena.
7. **Ni una caja más de lo programado** (área, 2026-09-18). Lo remisionado de un SKU en un día debe ser exactamente lo que el DPP de PepsiCo programó. Al crear, editar y aprobar se verifica `aprobadas + esta ≤ Σ T del SKU` (solo APROBADAS/VALIDADAS cuentan); sin DPP cargado o con un SKU fuera del DPP se bloquea (409). "Ni menos" se controla al cerrar el turno: exige motivo del faltante. Excepción: remisión **extraoficial** (pedido de emergencia, con motivo), que no entra en el tope ni en el MFR. Ver `docs/modules/mfr.md`.

### Auditoría — requisito estricto

**El área definió que la auditoría debe estar completa para que el proceso avance.**

Toda operación de escritura ocurre dentro de una **unidad de trabajo** (transacción) junto con su registro de auditoría. Si la auditoría falla, la operación se revierte:

```text
BEGIN
  reservar consecutivo (SELECT ... FOR UPDATE)
  INSERT remisión
  INSERT estibas
  INSERT auditoría   ◄── si falla, nada de lo anterior queda
COMMIT
```

Consecuencias de diseño:
- **Los repositorios NO abren transacciones.** Eso es responsabilidad de `UnidadDeTrabajo`.
- Los repositorios reciben `ClientePrisma`, que puede ser el cliente normal (lecturas) o el de una transacción (escrituras).
- `AuditoriaPrismaRepository` **no** tiene try/catch: el error se propaga a propósito.
- Al agregar un módulo nuevo, su repositorio se suma a `ContextoTransaccional`.

El bloqueo de fila del consecutivo es la otra razón de la transacción: sin `FOR UPDATE`, dos coordinadores simultáneos obtendrían el mismo número.

---

## 6. Estado actual

### Terminado

- Base de datos: 14 tablas (`schema.prisma`), migraciones aplicadas
- Seed idempotente: 13 permisos, 4 roles, 3 turnos con 14 horarios, 1 lugar, 4 grupos
- Dominio de Remisión completo: entidad, reglas, flujo de estados, errores, interfaces
- Regla `fecha_operativa` con pruebas de casos borde
- 6 casos de uso: crear + las 5 transiciones
- Infraestructura: unidad de trabajo, mapeador, 4 repositorios Prisma, reloj
- API HTTP completa con validación y traducción de errores de dominio
- Autenticación JWT + permisos por endpoint (B1 del ROADMAP), verificada por HTTP
- Catálogos de referencia, productos (crear/editar/desactivar) y usuarios (listar/editar/restablecer clave)
- Frontend: login, sesión, listado/detalle/creación de remisiones, las 5 acciones de flujo, administración de usuarios y productos
- Edición de remisiones en BORRADOR / EN_RECTIFICACION (backend + pantalla), con lo que rectificar sí corrige
- Historial de versiones y auditoría en el detalle; "Recordar sesión" (localStorage / sessionStorage)
- PDF (Puppeteer, dos por hoja, marca de estado) y exportación a Excel (exceljs) con los filtros del listado
- **MFR regido por el DPP de PepsiCo** (2026-09-18): bloques por línea y hora (producto, **cajas/hora**, E) con `Mx = cajasPorHora × h`, `T = Mx × E` (decisión 2026-09-19: el ritmo se maneja por hora, no en BPM; al importar el PDF, cajas/h = Mx ÷ horas del bloque, así T queda exacto; el estándar del producto —hoja TIEMPOS— es solo el valor por defecto para bloques a mano y se puede dar al crear el producto); 8 líneas físicas con tipo y capacidad kg/h; importador del PDF del DPP (`pdf-parse`, lector puro en `domain/mfr/dpp-pepsico.ts`), copiar día, corregir con motivo, cerrar turno; tablero con MFR por SKU, turnos (eficiencia planeada/real) y vista horaria en kg (Target/Instant/Capacity/Overpull). Decisiones: cajas; cuenta al aprobar el OPA; meta 95 %; la remisión NO registra línea. Ver `docs/modules/mfr.md`. Archivos obsoletos vacíos por borrar: `domain/mfr/{programacion,config-turno}.ts`, `application/mfr/{programacion,config-turno}.use-cases.ts`, `frontend/.../ConfigTurnoPage.tsx`.
- 152 pruebas unitarias sin base de datos + 8 de integración contra PostgreSQL (`npm run test:e2e`, base `mq_test`)
- Despliegue: Dockerfiles, `infrastructure/docker-compose.yml`, usuario de BD limitado (`database/`), CI en GitHub Actions
- Documentación en `docs/` (arquitectura, base de datos, roles, flujos, API, despliegue, módulos, preguntas abiertas)

### Frontend — estructura

```text
frontend/src/
├── app/            providers (Query → Sesión → Router), router, layout, InicioPage (panel)
├── modules/
│   ├── auth/       api, SesionContext (provider), useSesion, RutaProtegida, LoginPage
│   ├── remisiones/ api, hooks (useRemisiones, useAccionRemision), pages (lista, detalle, crear), AccionesRemision
│   ├── catalogo/   api, hooks (useTurnos, useGrupos, useLugares, useRoles, useProductos)
│   └── admin/      UsuariosPage, ProductosPage
├── components/     Boton, Campo, Select, AreaTexto, Alerta, Dialogo, EstadoBadge, PantallaCargando
├── services/       http.ts (axios: token, 401 → cerrar sesión, ErrorApi), almacen-token.ts (localStorage)
└── shared/         types (api, remision, catalogo), utils/fechas (fechaOperativaDe espejo del backend)
```

Reglas del frontend: nada llama a axios fuera de `services/http.ts`; los permisos solo OCULTAN acciones (la autorización real es del backend); los filtros del listado viven en la URL; las mutaciones invalidan exactamente las claves de caché que tocan.

### API existente

```text
POST   /api/auth/login                  público → { token, usuario }
GET    /api/auth/perfil                 usuario del token con sus permisos

GET    /api/usuarios                    admin.usuarios
GET    /api/usuarios/:id                admin.usuarios
POST   /api/usuarios                    admin.usuarios
PATCH  /api/usuarios/:id                admin.usuarios  (nombre, email, rol, activo, contraseña)

GET    /api/catalogos/turnos            catalogo.consultar
GET    /api/grupos                      catalogo.consultar  (POST/PATCH con catalogo.editar: descripcion, personasEsperadas)
GET    /api/catalogos/lugares           catalogo.consultar
GET    /api/catalogos/roles             admin.usuarios

GET    /api/productos?texto=&soloActivos=   catalogo.consultar
GET    /api/productos/:id               catalogo.consultar
POST   /api/productos                   catalogo.editar
PATCH  /api/productos/:id               catalogo.editar  (datos, activo; NO estándares)

POST   /api/remisiones                  remision.crear
PATCH  /api/remisiones/:id              remision.editar  (solo BORRADOR / EN_RECTIFICACION → 409 si no)
POST   /api/remisiones/:id/entregar     remision.entregar
POST   /api/remisiones/:id/aprobar      remision.registrar_aprobacion
POST   /api/remisiones/:id/rechazar     remision.registrar_aprobacion
POST   /api/remisiones/:id/rectificar   remision.rectificar
POST   /api/remisiones/:id/validar      remision.validar

GET    /api/remisiones?anio=&turnoId=&grupoId=&productoId=&estado=&desde=&hasta=&pagina=&porPagina=
GET    /api/remisiones/pdf?ids=a,b,c                  remision.consultar  (PDF, dos por hoja)
GET    /api/remisiones/exportar?…filtros              remision.exportar   (.xlsx)
GET    /api/remisiones/:id/pdf                        remision.consultar
GET    /api/remisiones/consecutivo/:anio/:numero      remision.consultar
GET    /api/remisiones/:id/versiones                  remision.consultar
GET    /api/remisiones/:id/auditoria                  remision.consultar + admin.auditoria
GET    /api/remisiones/:id                            remision.consultar
```

Detalle completo de la API en `docs/api.md`.

### Fechas: regla de formato

Las fechas de solo día (`fechaOperativa`, `fechaVencimiento`) se guardan a medianoche UTC y **se formatean en UTC**; formatearlas en zona Bogotá retrocede un día. Los instantes reales (`fechaHoraRegistro`, entrega, aprobación, validación) se muestran en `America/Bogota`. Aplica a PDF, Excel y frontend.

### PDF con Puppeteer

Decisión del usuario (2026-09-16). Requiere un Chrome/Chromium: `PUPPETEER_EXECUTABLE_PATH` en `.env` (en este equipo, Google Chrome instalado; la descarga automática de Puppeteer falla porque la ruta del perfil tiene acentos). En Docker, `chromium` del sistema. El navegador se abre una vez y se reutiliza.

`GET /:id` va **al final** del controlador: si estuviera antes de `consecutivo/:anio/:numero`, NestJS interpretaría "consecutivo" como un id.

### Catálogos sembrados

- **Roles:** `ADMINISTRADOR`, `COORDINADOR_MQ`, `PATINADOR`, `CONSULTA`
- **Grupos** (antes "proveedores"; renombrados el 2026-09-21 sin excepción, el proveedor real se escribe a mano en `descripcion`): LOGICMARD, MAXISERVICE, APOYOS MAXI, MIX. Cada grupo tiene `personasEsperadas` (personas que debe enviar por turno). En la programación se registra, por turno y grupo, cuántas llegaron (`asistencia_turno`); el tablero marca el personal como A_FIN / AFECTADA comparando **solo** contra las esperadas del grupo (la línea ideal del DPP es referencia). Ver `docs/modules/mfr.md`.
- **Lugar:** MAQUILA PEPSICO SANTO DOMINGO

---

## 7. Deuda técnica conocida

### Resuelto — hueco de seguridad (2026-09-16)

Los DTOs ya no reciben `*PorId` del cliente. El usuario sale del token y cada endpoint exige su permiso. Ver "Autenticación y permisos" en la sección 4.

### Pendientes técnicos

- Un JWT no se puede revocar antes de expirar (12 h). Si el área lo exige, habría que agregar refresh token o lista de revocación.
- `infrastructure/docker-compose.yml` se escribió sin poder ejecutarlo (Docker sin plugin Compose en el equipo de desarrollo). Validar con `docker compose config` antes del primer despliegue.
- La imagen del backend instala también las dependencias de desarrollo (la CLI de Prisma y `tsx` corren en el arranque para migrar y sembrar). Se puede adelgazar después.
- Los usuarios no pueden cambiar su propia contraseña; solo el administrador la restablece.

### Bugs corregidos el 2026-09-16 (para no repetirlos)

- El mapeador de remisión no persistía `motivo_ultimo_rechazo` ni los cambios de turno/grupo/lugar/producto.
- El cliente Prisma generado estaba desactualizado respecto al schema (falta de `prisma generate`).
- Un DTO con claves `undefined` pisaba valores reales al hacer spread (`sinIndefinidos` en los casos de uso de edición).
- Fechas de solo día formateadas en zona Bogotá retrocedían un día en el PDF.

---

## 8. Pendientes de definir con el área

No implementar nada que dependa de estos puntos sin confirmarlos.

| # | Pregunta | Bloquea |
|---|---|---|
| 1 | ~~¿Programación en cajas o unidades?~~ **Respondido 2026-09-17: cajas.** | — |
| 2 | ~~¿El MFR cuenta aprobadas o creadas?~~ **Respondido: al aprobar el OPA. Meta 95 %.** | — |
| 3 | ~~¿La línea es activo físico o armado diario?~~ **Respondido 2026-09-18 por el DPP: activo físico** (8 plataformas). | — |
| 4 | ~~¿Qué es `LINEA IDEAL`?~~ **Respondido 2026-09-19: personas necesarias en la línea para ese SKU** → `producto.personasIdeal`, por defecto en los bloques del DPP. `SUBDESCRIPCION` → `producto.subdescripcion` (familia; agrupa el Flavor Breakdown). | — |
| 5 | ~~¿Qué es `PC`?~~ **Respondido 2026-09-19: se ignora por ahora.** | — |
| 6 | ¿`LINEA` y `AUTOMATICA` son el mismo proceso con dos nombres? | Catálogo |
| 7 | ¿Qué hoja manda cuando PRODUCTOS y TIEMPOS se contradicen? (2026-09-19: el catálogo se completó a mano en el panel; `npm run importar:tiempos` simula y reporta diferencias sin resolverlas) | Catálogo |
| 8 | ¿Qué es el "cuaderno virtual"? | Módulo posterior |
| 9 | ¿El módulo de inventario lleva inventario propio o concilia contra el WMS? | Inventario |
| 10 | ¿El WMS registra el número de remisión de origen? | Inventario |
| 11 | ~~¿Quién registra la respuesta del OPA?~~ **Respondido 2026-09-16: solo el coordinador.** Aplicado en el seed. | — |
| 12 | ¿El vencimiento puede ser anterior a la fecha operativa? (hoy se rechaza) | Validación |
| 13 | Turnos: se adoptaron los del DPP (06:00/14:00/22:00, 7,5 h) todos los días. ¿Algún día opera distinto? | Turnos |
| 18 | Peso neto por caja de los productos del DPP (el sistema lo sugiere desde la descripción; lo confirma el administrador) | Kilos en el MFR |
| 14 | ¿Qué significan PT y PI? (PT = Producto Terminado, presumible; PI sin confirmar) | Terminología |
| 15 | Acceso a SAP para sincronizar el catálogo | Ninguna (catálogo local funciona) |
| 16 | Política de contraseñas: ¿complejidad, rotación, bloqueo por intentos? (hoy solo mínimo 8) | Ninguna |
| 17 | ¿Deben auditarse los inicios de sesión (exitosos y fallidos)? | Ninguna |

**Sobre el punto 9:** el patinador ya carga el PT al WMS de bodega. Construir un inventario paralelo al WMS generaría dos verdades sobre lo mismo. El usuario indicó que puede resolverse por API (si se consigue la clave) o por comparativo; ambas opciones quedan detrás de una interfaz, así que la decisión no bloquea el diseño.

**Sobre el punto 10:** determina la precisión de la conciliación. Con el número de remisión se identifica el registro exacto que falló; sin él, solo se detectan diferencias de totales.

---

## 9. Calidad de los datos de origen

El Excel `REMISIONES_AUTOMATIZADO_2026.xlsx` tiene problemas que deben tratarse en la importación, **nunca adivinando**:

### Hoja REMISIONES GUARDADAS 2026 (~2.195 registros con datos)

| Problema | Tratamiento |
|---|---|
| `N° Estibas` mezcla número y texto | Separar en `estibas_completas` / `cajas_sueltas` |
| `Observaciones` contiene números de estiba | Extraer a `remision_estiba` |
| `Turno` en texto libre (322 variantes: `"6:00-13:30"`, `"TURNO 1 08/05/26 BOLSA NUEVA"`) | Normalizar contra tabla `turno` |
| Filas de plantilla vacías | Descartar |
| Sin fecha de validación | Migrar como `APROBADA`, no `VALIDADA` |

### Hojas PRODUCTOS y TIEMPOS

| Problema | Detalle |
|---|---|
| Códigos duplicados | PRODUCTOS: 92 filas / 87 únicos. TIEMPOS: 88 filas / 85 únicos |
| Valores de proceso inconsistentes | PRODUCTOS: MANUAL, LINEA. TIEMPOS: MANUAL, AUTOMATICA, AUTOMATICO (typo) |
| Contradicción entre hojas | Ej. código `300033679`: `LINEA` en PRODUCTOS, `AUTOMATICA` en TIEMPOS |
| `HORAS TURNO = 7` para todos | **Eliminado del diseño.** Ningún turno dura 7 h (duran 4, 6, 8 o 10). Era una limitación del Excel: la hoja no podía saber en qué turno estaba. Las horas salen de `turno_horario` |

**Toda importación debe generar un reporte de excepciones** con las filas que no se pudieron normalizar, para revisión manual del coordinador.

---

## 10. Convenciones

- **Todo en español**: nombres de clases, métodos, variables, comentarios, mensajes de error. El dominio es un negocio colombiano.
- Modelos Prisma en PascalCase, campos en camelCase, tablas y columnas en snake_case vía `@map`.
- Errores de dominio heredan de `ErrorRemision` y llevan un `codigo` legible (`REMISION_TRANSICION_INVALIDA`). El filtro HTTP los traduce: datos inválidos → 400, transición inválida → 409, no encontrada → 404.
- Los DTOs validan la **forma** (tipos, rangos, UUID). Las reglas de **negocio** van en la entidad — así se cumplen también cuando el dato entra por importación de Excel o por un script, no solo por HTTP.
- Datos derivados se calculan, no se almacenan (`descripcionEstibas`, `cruzaMedianoche`, `consecutivo`).
- Dependencias externas se abstraen para poder probarlas: `Reloj` en lugar de `new Date()`, repositorios en lugar de Prisma.
- Los seeds son idempotentes (`upsert`) y reemplazan permisos de rol en cada corrida, de modo que el archivo es la fuente de verdad.

---

## 11. Próximos pasos

Autenticación (B1) está cerrada. Siguen, según el orden del ROADMAP (Parte G):

| Camino | Qué resuelve | Cuándo conviene |
|---|---|---|
| **Importación de catálogo (B3)** | Sin productos no se puede crear ninguna remisión | Parcialmente bloqueado por preguntas al área; el script con `--dry-run` se puede construir ya |
| **Frontend de Remisiones (B5)** | Formulario y listado; algo visible para el área | Ya tiene login del que colgarse |
| **Pruebas de integración (B2)** | Verifica atomicidad y bloqueo del consecutivo contra PostgreSQL real | No depende de nada |

Pendientes menores en Remisiones: generación del PDF (formato dos por hoja), importación del catálogo de productos con reporte de excepciones, y migración del histórico 2026.

Después: levantamiento y desarrollo de MFR (parcialmente bloqueado), luego Averías, Calidad e Inventario.
