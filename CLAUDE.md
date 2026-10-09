# CLAUDE.md — Aplicativo Maquila (MQ) · Inlotrans S.A.S.

Contexto del proyecto para continuar el desarrollo. Leer completo antes de escribir código.

> **Mapa de documentos.** Este archivo guarda lo que se necesita en TODA tarea (reglas, arquitectura, negocio, pendientes, tarea en curso). El detalle va aparte, en `docs/claude/`: **leer cada archivo solo cuando la tarea toque ese tema**, sin importarlos todos.
>
> | Archivo | Contiene | Leer cuando |
> |---|---|---|
> | `docs/claude/estado-modulos.md` | Qué está hecho por módulo (Remisiones, MFR, Averías, Inventario, correo, resúmenes, firma electrónica) con las decisiones del usuario y su fecha; catálogos sembrados | Se toca o amplía ese módulo |
> | `docs/claude/api.md` | Todos los endpoints con su permiso | Se agrega o consume un endpoint |
> | `docs/claude/estructura-backend.md` | Árbol de carpetas del backend | Se crean archivos nuevos en el backend |
> | `docs/claude/frontend-estructura.md` | Árbol del frontend | Se crean pantallas, hooks o componentes |
> | `docs/claude/deuda-y-bugs.md` | Deuda técnica, bug de zona horaria (2026-09-28), bugs de 2026-09-16, bugs del frontend (`text-base`, 3D) | Se tocan fechas, mapeadores, auth, despliegue o estilos |
>
> La carpeta se recreó el 2026-10-07 (nunca había llegado a git): `api.md` se genera de los controladores; los árboles salen del código; estado y deuda copian el `CLAUDE.md` del commit `af7c694` y suman lo posterior.

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

No diseñar ni implementar esos módulos sin levantamiento previo. Remisiones está cerrado, MFR y Averías implementados. Inventario en construcción: fase 1 (kardex) hecha, el resto en levantamiento (ver sección 11).

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

### Método de trabajo: ciclos (usuario, 2026-10-05)

Se trabaja **una tarea a la vez, en ciclos cerrados**. Hasta que una tarea no termine, no se pasa a la siguiente.

```text
1. DEFINIR     tarea + criterio de cierre, anotados en "Tarea en curso" (sección 11)
2. LEVANTAR    si falta información del negocio, preguntar (regla 1) antes de codificar
3. HACER       una fase pequeña (regla 4)
4. VERIFICAR   backend: npm test + npm run build; frontend: npm run build (tsc + vite);
               npm run test:e2e si se tocó la base de datos
5. DOCUMENTAR  actualizar este CLAUDE.md (y docs/ si aplica) con lo hecho y lo decidido
6. CERRAR      el usuario revisa y hace el commit (Claude nunca ejecuta git commit)
   └─ si algo falla en 4, se vuelve a 3; no se abre otra tarea
```

**Trazabilidad de instrucciones:** toda instrucción o decisión nueva del usuario sobre el proyecto se escribe en este archivo **en el mismo turno en que se da, sin excepción**. Lo que no está aquí no se considera acordado.

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
- **Toda conexión a PostgreSQL se crea con `crearAdaptadorPostgres()`** (fija `TimeZone=UTC`); nunca `new PrismaPg(...)` directo (ver `docs/claude/deuda-y-bugs.md`)

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

Árbol completo en `docs/claude/estructura-backend.md`. Capas: `domain/` (entidades, reglas, interfaces), `application/` (casos de uso), `infrastructure/` (Prisma, Firestore, auth, HTTP, PDF, correo) y `modules/` (controladores, DTOs y wiring de DI por módulo).

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
| **OPA** (facturador de PepsiCo) | PepsiCo | **Sí, desde el 2026-10-05** (rol `OPA_PEPSICO`, piloto de firma electrónica); antes solo como dato | Aprueba firmando o rechaza |
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

Hechos: Remisiones (con firma electrónica fases 1–3), MFR, Averías, Inventario (fases A–D y cierre del día), correo fase 1 y resumen del turno/día fase 2a. Detalle por módulo y decisiones con fecha: `docs/claude/estado-modulos.md`. Endpoints: `docs/claude/api.md`. Estructura del frontend: `docs/claude/frontend-estructura.md`.

Reglas del frontend: nada llama a axios fuera de `services/http.ts`; los permisos solo OCULTAN acciones (la autorización real es del backend); los filtros del listado viven en la URL; las mutaciones invalidan exactamente las claves de caché que tocan.

### Fechas: regla de formato

La base trabaja en **UTC** (la sesión la fija `crearAdaptadorPostgres()`; ver sección 7). Las fechas de solo día (`fechaOperativa`, `fechaVencimiento`) se guardan a medianoche UTC y **se formatean en UTC**; formatearlas en zona Bogotá retrocede un día. Los instantes reales (`fechaHoraRegistro`, entrega, aprobación, validación) se muestran en `America/Bogota`. Aplica a PDF, Excel y frontend.

### PDF con Puppeteer

Decisión del usuario (2026-09-16). Requiere un Chrome/Chromium: `PUPPETEER_EXECUTABLE_PATH` en `.env` (en este equipo, Google Chrome instalado; la descarga automática de Puppeteer falla porque la ruta del perfil tiene acentos). En Docker, `chromium` del sistema. El navegador se abre una vez y se reutiliza.

`GET /:id` va **al final** del controlador: si estuviera antes de `consecutivo/:anio/:numero`, NestJS interpretaría "consecutivo" como un id.

---

## 7. Deuda técnica y bugs corregidos

Ver `docs/claude/deuda-y-bugs.md`. Antes del primer despliegue, validar `docker compose config` (el compose se escribió sin poder ejecutarlo).

**Barrido por caídas (usuario, 2026-10-09):** el backend resistió carga, cortes de la base y caídas de Chromium; lo que lo deja fuera de línea es correrlo con `npm run start:dev` (cada guardado en `src/` lo reinicia ~7–10 s, y si muere `--watch` no lo levanta). Corregido: tope de espera de conexión del pool de PostgreSQL (10 s) + `keepAlive`, ruta `{*ruta}` del middleware de registro. `PENDIENTE DE DEFINIR` con el usuario: cómo dejarlo en línea en el equipo de MQ hasta tener Docker. Detalle en `docs/claude/deuda-y-bugs.md`.

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
| 9 | ~~¿El módulo de inventario lleva inventario propio o concilia contra el WMS?~~ **Respondido 2026-09-22: las dos cosas, sobre objetos distintos.** Inventario propio de **insumos**; el PT se concilia contra el WMS. La receta (lista de materiales por SKU) es la pieza que los une. Va después de Averías (usuario, 2026-09-28) | — |
| 10 | ¿El WMS registra el número de remisión de origen? | Inventario |
| 11 | ~~¿Quién registra la respuesta del OPA?~~ **Respondido 2026-09-16: solo el coordinador.** Aplicado en el seed. | — |
| 12 | ¿El vencimiento puede ser anterior a la fecha operativa? (hoy se rechaza) | Validación |
| 13 | Turnos: se adoptaron los del DPP (06:00/14:00/22:00, 7,5 h) todos los días. ¿Algún día opera distinto? | Turnos |
| 18 | Peso neto por caja de los productos del DPP (el sistema lo sugiere desde la descripción; lo confirma el administrador) | Kilos en el MFR |
| 14 | ~~¿Qué significan PT y PI?~~ **Respondido 2026-09-28: PT = Producto Terminado; PI = Producto Intermedio** (con lo que se realizan los PT) | — |
| 15 | Acceso a SAP para sincronizar el catálogo | Ninguna (catálogo local funciona) |
| 16 | Política de contraseñas: ¿complejidad, rotación, bloqueo por intentos? (hoy solo mínimo 8) | Ninguna |
| 17 | ¿Deben auditarse los inicios de sesión (exitosos y fallidos)? | Ninguna |

**Sobre el punto 9:** el patinador ya carga el PT al WMS de bodega, así que un inventario paralelo de PT generaría dos verdades sobre lo mismo; eso se concilia (por API si se consigue la clave, o por comparativo — ambas detrás de una interfaz, así que no bloquea el diseño). Lo que **sí** necesita inventario propio son los **insumos**, que no viven en el WMS. La receta por SKU permite calcular el consumo teórico (`remisión × receta`) y compararlo con el real para medir merma. Detalle en la Parte D del ROADMAP (D3 y D9).

**Lo único urgente de ese módulo, aunque vaya de último:** el consumo **real** de insumos no se está capturando y no se puede reconstruir después. El teórico sí, porque las remisiones ya se guardan.

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

Remisiones (B1–B5, B7) y MFR están cerrados. Lo que sigue, según el ROADMAP (Parte G, Bloque 4):

**Decisión del usuario (2026-09-28): Averías va primero, Inventario después** (reemplaza la del 2026-09-24, que ponía Inventario antes). Riesgo aceptado: el consumo real de insumos que no se capture mientras tanto no se puede reconstruir. Orden: 9. Averías → 10. Inventario → 11. Calidad → …

| Camino | Qué resuelve | Cuándo conviene |
|---|---|---|
| ~~Averías (D1)~~ | **Hecho 2026-09-28** (reporte con fotos + indicador del 1 %) | Pendientes menores: equivalencia de la Bolsa; averías de PI e insumos llegan con Inventario |
| **Inventario (D3)** | Cuánto hay de **insumos, PI y PT** (usuario, 2026-09-28). **Hecho (2026-09-29): catálogo por tipo + unidades + kardex + existencias + entrada de mercancía + receta versionada del PT.** | Fases A–D hechas (2026-09-30). Después: conteo físico, enlace con remisiones/averías, conciliación PT vs WMS. Indicadores al final |
| **Datos que faltan para el MFR** | Peso neto por caja (ya hay herramienta: `/admin/pesos`) y las personas esperadas **por turno** de los 4 grupos | Cuando el administrador los confirme; sin ellos no hay kilos ni semáforo de personal |
| **Migración del histórico 2026 (B6)** | ~2.195 registros del Excel | Requiere la decisión del área: migrar, descartar, o migrar marcado `HISTORICO_EXCEL` |
| **Importación del catálogo desde el Excel** | Hoy el catálogo se carga a mano; `npm run importar:tiempos` simula y reporta diferencias | Bloqueado por qué hoja manda cuando PRODUCTOS y TIEMPOS se contradicen |

Pendientes del MFR que no dependen del área: cierre automático del turno al terminar su hora (hoy es manual) y la vista de estadística histórica por línea.

Pendiente transversal: **vistas por rol × área**, que esperan a que el área defina áreas y roles.

### Tarea en curso (método de ciclos, sección 2)

**Ciclo 0 — Línea base** · Estado: `VERIFICADO 2026-10-05, falta el commit del usuario`
- Backend: 364 pruebas en verde y `nest build` OK. Frontend: `tsc -b` + `vite build` OK; `npm run lint` (oxlint) sin errores, 3 advertencias previas.
- El frontend NO usa ESLint sino **oxlint** (`npm run lint`).

**Ciclo 1 — Rediseño visual del frontend** (usuario, 2026-10-05) · Estado: `CERRADO` 2026-10-06 (commit `dd540d0`); lo que quedó pendiente (formularios con boceto) pasa a la cola
- Decisiones: mantener el **azul actual** (tokens de `index.css`; nada de colores en crudo); estilo **"tablero de planta"** (cifras grandes, franja de color al borde según estado, alto contraste, botones grandes); dispositivos: computador de MQ, tablet en piso, celular y TV; **modo TV** del tablero MFR (pantalla completa, sin menú, letra grande, refresco solo); orden: **base común primero**, luego módulo por módulo; más gráficas por módulo y guiar al usuario sobre qué hacer.
- Hecho: componentes base (`EncabezadoPagina`, `Tabla`, `EstadoVacio`, `PanelFiltros`, `Paginacion`, `BarraSeleccion`, `CifraEstado`, `franjas.ts`); `RemisionesListaPage` ya los usa.
- **Hecho 2026-10-05 — Tablero MFR (`/mfr`)**, pendiente de revisión visual del usuario: banda con `Medidor` (arco de 270° con la marca de la meta, `components/graficas/Medidor.tsx`), frase guía ("para llegar al 95 % faltan N cajas") y cinco cifras (programadas, producidas, faltan PT por PT, fuera del DPP, emergencia); `SelectorFecha` con variante `vidrio` (flechas día a día y "Hoy"). Debajo, **cuatro vistas** con `PestanasVista` (resúmenes en `modules/mfr/resumen-vistas.ts`): **Turnos** (`ColumnaTurno`, columnas abiertas separadas por líneas; reemplaza a `TarjetaTurno`), **Por PT** (`RankingPt`: filas a todo el ancho, primero lo que más falta u "Orden del DPP"), **Kilos** (`CurvaDia`: meta contra producido por hora, con cursor) y **Líneas** (mapa de calor por línea con las 4 series, o por familia). El semáforo → tono quedó en un solo lugar: `modules/mfr/semaforo.ts`.
- **Hecho 2026-10-05 — Modo TV (`/mfr/tv`)**, fuera del `AppLayout`: día operativo en curso (cambia solo a las 06:00), reloj, refresco cada 10 s (`REFRESCO_TABLERO`), medidor grande, una columna por turno y los 6 PT con más cajas pendientes; botones discretos de pantalla completa y volver.
- **Revisión del usuario (2026-10-05):** aprueba la estructura del tablero. Ningún título de sección queda "volando" y el título va junto a su información.
- **Decisión del usuario (2026-10-05): fuera las tarjetas** ("muy repetitivo y genérico"). Se eligió **"Una vista a la vez"** entre cuatro opciones (secciones abiertas, sala de control oscura, una vista a la vez, mapa de la planta): debajo de la banda del módulo va una **barra de pestañas grandes** (`components/PestanasVista.tsx`, con ícono y un resumen vivo en cada pestaña) y **cada vista ocupa todo el ancho, sin cajas**: los datos van directo sobre el fondo, separados con líneas finas y franjas de color. La vista elegida vive en la URL (`?vista=`), como los filtros. Reemplaza al `PanelSeccion` (eliminado). Aplica a todas las pantallas rediseñadas; la banda `EncabezadoPagina` se conserva.
- **Legibilidad (usuario, 2026-10-05: "las letras deberían ser más visibles sobre los fondos")**, aplicada en TODO el frontend y medida con la fórmula de contraste WCAG (mínimo 4,5:1 para texto pequeño): el degradado de la banda termina en `--hero-final` (#1e40af) y no en `--marca` (con --marca el blanco caía a 3,1:1, y en tema oscuro ni el blanco puro llegaba: 3,3:1); todo relleno azul con texto blanco usa `--marca-relleno` (#1d4ed8, 6,7:1 en los dos temas) y no `bg-marca`; sobre la banda, el vidrio o la barra de navegación el texto blanco va como mínimo al **80 %** (lo secundario al 90 %); **ningún texto por debajo de 12 px** (`text-xs`). La regla está escrita también en `index.css`.
- **Hecho 2026-10-05 — Figura 3D (`HeroVisual3D`)**, pendiente de revisión visual del usuario. El usuario aprobó las librerías ("las herramientas que consideres óptimas… que vaya para todo el aplicativo"): `three`, `@react-three/fiber`, `@react-three/drei` (+ `@types/three`). Vive en `shared/visual3d/`: `Escena3D.tsx` es el **único** archivo que importa three/fiber/drei (como anime.js en `shared/animacion/`); `HeroVisual3D.tsx` es lo que usan las pantallas y la carga con `lazy` (three va en un archivo aparte de ~262 KB gzip que solo se descarga donde hay figura). Nudo toroidal de metal pulido en `--marca-relleno`, reflejos de `Lightformer` (sin descargar HDR) con aro de `--acento`; gira, flota y se inclina hacia el puntero (se escucha la ventana). No se dibuja en <640 px ni sin WebGL; queda quieta con "reducir movimiento"; se pausa fuera de pantalla; baja la resolución si el equipo no sostiene los FPS (`PerformanceMonitor`). Está en **`EncabezadoPagina`** (todas las pantallas con banda; en celular sigue el ícono en marca de agua) y en el **panel de marca del login** (el formulario no se tocó). **No va en el modo TV.** Verificado con capturas reales (Puppeteer) en claro, oscuro, 1440 y 820 px, sin errores de consola.
- **Instrucción del usuario (2026-10-05): "migrar el modelado de los mockups a todos los apartados" y "enfocar el modelo 3D al tema del proyecto (productos de PepsiCo flotando o similar)".** Hecho el mismo día:
  - **Escena 3D temática**: ya no es un nudo abstracto, flota **empaque**: bolsa tipo almohada (snack) en `--marca-relleno`, `--acento` y `--plata`, y una caja corrugada en `--carton` con cinta y etiqueta de código de barras (`shared/visual3d/productos3d.tsx`, modelado por código, sin descargar modelos). **Decisión de diseño: genéricos, sin logos ni marcas de PepsiCo** (son de PepsiCo y exigen su autorización; el aplicativo es de Inlotrans). Si el área consigue el aval y los artes, se cambia solo la textura. Tokens nuevos `--carton` y `--plata` (decoración, iguales en los dos temas).
  - **Banda común en TODAS las pantallas**: los 15 encabezados escritos a mano pasaron a `EncabezadoPagina` (Inicio, Inventario —en su layout—, Averías lista/nuevo/detalle, Remisión nueva/editar/detalle, Programación, Correos, Usuarios, Grupos, Líneas, Pesos, Causales). Las acciones de cada pantalla quedaron en la banda con `Boton` `claro`/`vidrio`. `EncabezadoPagina` ganó `volver` (enlace encima del título) e `insignia` (estado/versión junto al título). En el detalle de la remisión, `AccionesRemision` (entregar, aprobar…) va **debajo** de la banda: sus botones son azules y se perderían en ella.
  - **Formularios**: solo cambió su encabezado; los campos y su distribución NO se tocaron (regla de consultar antes).
- **Instrucción del usuario (2026-10-05): "dale más detalle y sé más creativo con los apartados".** Hecho: **una escena 3D por módulo** (`EncabezadoPagina escena="…"`, ver `shared/visual3d/escenas.tsx`): `empaque` (Inicio, listado de remisiones, login), `remision` (tabla con la remisión firmada y sellada), `averia` (cono de seguridad + caja abollada + bolsa cayendo; también Causales), `inventario` (estiba con cajas), `produccion` (banda transportadora con bolsas en movimiento; MFR, Programación, Líneas), `correo` (sobres), `personas` (cascos + planilla; Usuarios, Grupos), `pesos` (báscula con caja). Más detalle: arrugas en las bolsas, tabla nutricional y hojuelas en el estampado; caja con vetas, solapas, flechas "este lado arriba", sello de reciclaje y etiqueta. Piezas en `shared/visual3d/piezas/` (empaque, oficina, planta, texturas con caché, medidas). Tokens nuevos `--madera` y `--papel`. Verificado con capturas de las 8 escenas y del login.
  - **Incidente (2026-10-05):** al formatear se corrió `prettier --write` sin configuración y cambió comillas/punto y coma de 15 pantallas. Se restauró el estilo (`--no-semi --single-quote --print-width 110`); el código es el mismo pero los saltos de línea de esos archivos cambiaron. El proyecto **no tiene `.prettierrc`**: `PENDIENTE DE DEFINIR` si se agrega uno con ese estilo para que no vuelva a pasar.
- **Siguiente (usuario, 2026-10-05): tableros de productividad.** Levantamiento hecho el mismo día (respuestas del usuario):
  - **Indicador: cajas por persona-hora** = cajas aprobadas ÷ (personas que llegaron × horas). **Horas = las 7,5 h productivas del turno** (`turno_horario`), no las de los bloques.
  - **Cortes:** turno, grupo (proveedor), línea y PT. **Periodos:** día en curso, tendencia de 7 días y mensual.
  - **Meta:** la define el área → configurable por el administrador; sin semáforo hasta que exista (`PENDIENTE DE DEFINIR` el valor).
  - **Hallazgo:** la remisión no guarda la línea y la asistencia es por turno × grupo, así que turno y grupo salen exactos, pero línea y PT no. **Decisión del usuario: agregar la línea a la remisión.** Toca un módulo cerrado (entidad, Prisma + Firestore, formulario); las remisiones anteriores quedan "sin línea".
  - Plan por fases: **F1** dominio + endpoint de productividad por turno y grupo (con pruebas) y meta configurable · **F2** tablero (día, 7 días, mes) · **F3** línea en la remisión → cortes por línea y PT.
  - Falta definir antes de F3: ¿la línea es obligatoria? ¿Debe ser una línea donde el DPP programó ese PT en ese turno, o cualquiera activa? ¿Cómo va en el formulario? (se consulta con boceto, regla de formularios). ¿De dónde salen las personas por línea (asignación de personas a líneas que ya existe)?
- **Instrucción del usuario (2026-10-05): "mejora el diseño de todos los container… la información se ve saturada y no cabe bien dentro de los cards… cambiarlos por mejores alternativas".** Hecho el mismo día, en todas las pantallas de **consulta**:
  - **Componentes base nuevos** (en `components/`, cada uno solo dibuja): `ListaRegistros` + `FilaRegistro` + `MetaDato` (reemplazo de la tabla apretada: franja de color, título legible, datos secundarios como etiquetas, **cifra principal grande a la derecha**, se acomoda hacia abajo en pantallas angostas); `Seccion` (reemplazo de `Tarjeta` con título: franja + contador + línea, sin caja); `Ficha` (datos de un documento en franja con separadores, reemplaza Tarjeta+rejilla de `Dato`); `LineaTiempo` (historia agrupada por día operativo: kardex, entradas, envíos, reportes); `EncabezadoDetalle` (registro dentro de un módulo con banda: título + cifra grande); `SelectorSegmentado`; `BarraProporcion`; `Iniciales`. Utilidades: `diaLargo` (día operativo, en UTC) y `hora` (instante, en Bogotá) en `shared/utils/fechas.ts`; `agruparEnOrden` en `shared/utils/agrupar.ts`. `PestanasVista` acomoda 2, 3 o 4 pestañas. `Tabla` y `PanelFiltros` quedaron **sin caja** (también afecta al listado de remisiones).
  - **Inventario**: Existencias (filas con la existencia grande, selector de tipo), Kardex (línea de tiempo, entradas en verde y salidas en rojo, saldo de cada movimiento), Alertas (marcador grande + secciones por grupo con barra "hay vs necesita"), Entradas (línea de tiempo) y su detalle (ficha + filas), Cierre del día (solo el **resultado**: ficha + merma por material con barra contado/esperado), PT (eran 12 columnas → filas con estándares como etiquetas y "sin receta" en ámbar), PI/Insumos, Unidades.
  - **Administración**: Usuarios (iniciales + rol), Grupos (personas/día grande, turnos como etiquetas, "sin proveedor" en ámbar), Causales (número de orden grande), Correos (listas con destinatarios + envíos en línea de tiempo).
  - **Averías**: "una vista a la vez" con dos pestañas, **Reportes** (línea de tiempo) e **Indicador del 1 %** (marcador grande y desgloses por día/turno/grupo/PT como barras contra la línea del límite; el desglose por grupo va en azul porque el backend no le da semáforo). Detalle del reporte: ficha + cada avería con su número grande, cantidad, causal y fotos.
  - **Remisión (detalle)**: cifras grandes (cajas, unidades, estibas, vencimiento), **recorrido del documento** en pasos (`RecorridoRemision`: Registrada → Entregada → Aprobada → Validada; rechazo en rojo), ficha de registro, **firmas como renglones de papel** e historial con selector. En celular el listado de remisiones usa filas abiertas.
  - **Inicio**: las 4 cifras pasaron a la banda (tocar una lleva al módulo), **los avisos van primero** (filas con franja) y lo demás en 3 vistas con pestañas (Líneas en vivo · Remisiones de hoy · Turnos y kilos). Textos nuevos en `es.ts` y `en.ts`.
  - **Programación**: turnos en columnas abiertas y cada línea con encabezado abierto y la meta grande (la tabla de bloques no cambió).
  - **NO se tocaron (formularios, regla de consultar):** login, conteo del cierre, nueva entrada, nuevo reporte de averías, formulario de remisión, tabla editable de Líneas, edición en lote de Pesos, diálogos de crear/editar, la tabla de bloques de Programación por dentro. Tampoco los accesos rápidos del Inicio (son botones de navegación).
  - Verificado: `tsc -b` + `vite build` + oxlint sin avisos nuevos; capturas con datos de ejemplo en computador, tablet y celular, claro y oscuro.
- **Decisión del usuario (2026-10-05): la navegación pasa de la barra lateral a la parte SUPERIOR** ("en el lado nos quita espacio"), sin quitar nada y sin barra de desplazamiento. Hecho el mismo día (`app/layout/`):
  - Una franja marina (`BarraSuperior`): `Inicio · Remisiones · Producción ▾ (MFR del día, Programación) · Averías · Inventario · Administración ▾ (6 enlaces en rejilla)` + chip del día operativo + menú de la cuenta. 6 elementos en vez de 12: los que van juntos se agrupan en desplegables (`MenuDesplegable`: cierra con clic afuera, Escape o al elegir; devuelve el foco con Escape).
  - **Menú de la cuenta** (`MenuCuenta`): nombre, rol, planta, idioma y tema (sueltos en la barra solo desde 1536 px), cerrar sesión y el eslogan que estaba al pie de la lateral.
  - **Chip del día operativo** (`ChipDiaOperativo`): reúne día operativo + turno en curso + hora; lo escrito crece con el ancho (fecha corta < 1280 px; "Día operativo dd/mm/aaaa" ≥ 1280; día de la semana ≥ 1536) y el título lo dice completo.
  - Por anchos: logo solo con el símbolo < 1280 px; íconos del menú ≥ 1536 px. **Medido sin solapes** en 1024, 1280, 1440 y 1536 px (mínimo 71 px libres) y sin desborde horizontal en 390 px.
  - **< 1024 px**: botón ☰ que abre un panel desde la barra (`MenuMovil`) con todo agrupado en dos columnas.
  - `navegacion.ts` ahora tiene enlaces y grupos (`navegacionVisible`, `enlaceActivo`). El contenido gana el ancho: `max-w-[96rem]` (antes `max-w-7xl` junto a una lateral de 256 px). `BarraLateral.tsx` eliminado. `BotonIdioma`/`BotonTema` tienen `sobreOscuro` para fondos marina. Textos nuevos `nav.*` en `es.ts` y `en.ts`.
- Falta: (1) la **revisión visual del usuario** con datos reales del rediseño sin tarjetas; (2) los **formularios**, que se consultan antes con bocetos (instrucción de abajo); (3) la capa `Tarjeta`/`TarjetaKpi` queda solo en formularios y en lo que falte revisar: se retira cuando ya no la use nadie.
- **Instrucción del usuario (2026-10-05):** toda la interfaz debe presentar la información de forma **más creativa, dinámica e intuitiva**. **Los formularios NO se rediseñan sin consultar antes al usuario**: se le presentan opciones (boceto o descripción) para alinearlos con lo que le gusta ver al cliente, y se espera su respuesta. Las pantallas de consulta (tableros, listados, detalles) sí se pueden rediseñar directamente.

**Ciclo 1 — Rediseño visual** · Estado: `CERRADO` (commit del usuario `dd540d0`, 2026-10-06).

**Ciclo 2 — Indicadores de producción** (usuario, 2026-10-06) · Estado: **F1 `VERIFICADA 2026-10-06`, falta la revisión y el commit del usuario**; F2 y F3 pendientes
- **F1 hecha:** dominio puro (`indicadores-produccion.ts`, `ritmo-produccion.ts`) con 41 pruebas + casos de uso con su prueba + `GET /mfr/indicadores` y `GET /mfr/ritmo` + pantalla `/mfr/indicadores` (menú Producción ▾; luego repartida en tableros individuales, ver abajo). Sin cambios en la base de datos. Backend: 408 pruebas en verde y `nest build` OK; frontend: `tsc -b` + `vite build` OK, oxlint sin avisos nuevos; capturas con datos de ejemplo de las 5 vistas en 1440 y 768 px. Detalle y criterios a confirmar en `docs/modules/mfr.md` → "Fase 1 — implementada".
- **Decisión del usuario (2026-10-06): tableros individuales, separados de los formularios** ("así no revolvemos la información con los formularios"). Respuestas: **un tablero por indicador** (no uno por tema ni uno general); salen de las pantallas de operación y van a tableros: el **indicador del 1 % de Averías**, el **Tablero MFR**, las **Alertas de Inventario** y **las metas y el personal de Programación** (se le advirtió que el coordinador los usa mientras carga bloques; lo eligió igual: en Programación queda solo lo editable, los formularios de personal y cierre de turno se quedan); **Inicio queda solo con avisos y accesos** (sin cifras ni gráficas).
- **Tableros hechos (2026-10-06, `VERIFICADO`, falta revisión y commit del usuario):** módulo `frontend/src/modules/tableros/` con 10 tableros bajo `/tableros/*` (lista y redirecciones de rutas viejas en `docs/modules/mfr.md` → "Fase 1 — implementada"). Menú: Inicio · Remisiones · Programación · Averías · Inventario · **Tableros ▾** · Administración ▾ (desaparece el grupo Producción). Quitado de la operación: pestaña del indicador en Averías (queda la línea de tiempo de reportes), pestaña Alertas de Inventario, metas/personal/columnas Máximo-Meta-Kilos de Programación (botón "Ver metas y personal"); Inicio = avisos + accesos (borrados `FlujoRemisiones`, `LineasEnVivo`, `UltimasRemisiones`, `TarjetaKpi`). Barra superior medida con la fuente Inter cargada: sin solapes en 1024 (22 px libres, el ancho más justo), 1280, 1440 y 1536 px; logo completo, idioma y tema sueltos solo desde 1536 px. Verificado: 408 pruebas + `nest build`; `tsc -b` + `vite build`; oxlint con las 3 advertencias previas.
- **Bug encontrado y corregido en la F1:** la clase `text-base` pinta de blanco (existe el color `base`): los títulos de `PestanasVista` eran invisibles (también en el tablero MFR y en Averías) y la columna de cajas del listado de remisiones salía en blanco. Corregido con `text-[1rem]`; la trampa quedó escrita en `index.css`.
- Pedido: MFR, FR, OTIF, averías vs lo fabricado, PT con más y menos producción, ritmo del personal por hora (adelantado / en línea / retrasado) con horas productivas, efectividad por línea en % y cajas, cumplimiento esperado según las personas que llegaron. Absorbe el tablero de productividad (cajas por persona-hora) levantado el 2026-10-05.
- **Definiciones acordadas (respuestas del usuario): ver `docs/modules/mfr.md` → "Indicadores nuevos".** En corto: FR = aprobado ÷ programado sin tope por SKU (el pedido es el DPP); OTIF por SKU = completo y aprobado antes del fin de su último bloque; averías ÷ (aprobado + averiado); ranking por PT; ritmo por hora de creación de la remisión con tolerancia ±5 %; 7,5 h productivas sin pausas; efectividad por línea = producido ÷ T; esperado por personas = T × asignadas ÷ línea ideal (máx. 100 %).
- **Fases:** F1, lo que no necesita la línea (FR, OTIF, averías vs fabricado, ranking, ritmo y productividad por turno) · F2, la línea en la remisión (bocetos del formulario antes) · F3, lo de por línea.
- Criterio de cierre de F1: funciones puras en `domain/` con pruebas de cada fórmula (casos borde: día sin DPP, SKU en varios bloques, remisión fuera del DPP, turno sin asistencia), endpoint con permiso, implementado en Prisma y Firestore si lee datos nuevos, y una vista en el frontend; `npm test` + `npm run build` + `npm run build` del frontend en verde.
- Confirmado (usuario, 2026-10-06): el ritmo cuenta todas las remisiones creadas no extraoficiales; el ranking incluye los PT programados en 0; periodos día / 7 días / mes.
- 2026-10-06: el usuario hizo el commit del Ciclo 1 (`dd540d0`) y se arrancó la F1.
- **Confirmado (usuario, 2026-10-07) — los tres criterios de la F1:** (1) las extraoficiales cuentan como fabricadas en averías vs fabricado, **pero con un identificador propio en las estadísticas** ("un color extra en la barra"): hecho el mismo día, campo `extraoficialUnidades` + barra apilada azul/morado/rojo (`BarraFabricado`) + cifra "Extraoficiales" en la banda; el morado (`--acento`) es el color de lo extraoficial en todo el aplicativo; (2) la productividad deja por fuera los turnos sin asistencia; (3) ranking por lo aprobado, ritmo por lo creado. Verificado: 409 pruebas + `nest build`; `tsc -b` + `vite build`; oxlint con las 3 advertencias previas. Detalle en `docs/modules/mfr.md`.

**Instrucción del usuario (2026-10-07): gráficas y decoración más dinámicas, tomando como base el ejemplo de Motion `https://motion.dev/examples/js-three-orbit` ("sorpréndeme"), y modificar con él los modelos 3D existentes.** Lo que aporta el ejemplo: entorno procedural (cielo GLSL con nubes FBM y piso a cuadros capturado en un `CubeCamera` como mapa de reflejos), metal pulido (`metalness 1`, `roughness 0,055`), giro por arrastre con **inercia** (`motionValue` + `getVelocity()` al soltar, `animate` de vuelta a la velocidad de reposo en 2,4 s con `ease [0.16, 1, 0.3, 1]`, tope ±2,4) y bucle con `frame.update`/`frame.render`.
- **Decisión del usuario (2026-10-07): `motion` se instala JUNTO a anime.js** (se le ofreció que Motion reemplazara a anime.js, recomendado, o no usar Motion). anime.js sigue en lo que ya existe; Motion se usa para lo nuevo: 3D y gráficas (resortes con velocidad, reordenamiento animado, trazado de curvas). Costo aceptado: dos librerías de animación.
- Fases: **A** escenas 3D (entorno procedural de "nave de planta" + giro con inercia + materiales) · **B** gráficas con Motion.
- **Hecho 2026-10-07 (`VERIFICADO`, falta revisión visual y commit del usuario):**
  - Única puerta a Motion: `shared/animacion/movimiento.ts` (reexporta lo usado + `FRENADO_SUAVE` = curva del ejemplo y `RESORTE_GRAFICA`). `MotionConfig reducedMotion="user"` en `app/providers.tsx`.
  - **A · 3D** (`shared/visual3d/`): `EntornoPlanta.tsx` — shader de nave de planta (techo marina con hileras de lámparas, ventanal frontal, portón cálido, resplandor de acento, piso epóxico a cuadros con FBM; funciones de ruido y `checkerBox` del ejemplo) capturado UNA vez con `<Environment frames={1} resolution={256}>`; reemplaza los `Lightformer`. `giro.ts` — agarrar y girar con inercia: se escucha la banda (padre de la figura), solo cuenta un toque sobre la zona del lienzo que no cae en botón/enlace/título; al soltar, la velocidad de los últimos 100 ms pasa a `impulso` y `animate` la frena en 2,4 s con la curva del ejemplo; `touch-action: pan-y` en tablet; manito de agarrar. `piezas/monograma.tsx` — "IN" extruido con bisel en metal pulido sobre placa azul mate (isotipo PROVISIONAL, se cambia por el SVG cuando llegue la marca), pieza estrella de la escena `empaque`. Cada pieza entra con resorte (de adelante hacia atrás) y gira con la mano (`GiroContexto`). Bolsas más metalizadas.
  - **B · gráficas**: `Medidor` (arco con `pathLength` y resorte: con cada refresco va del valor anterior al nuevo, sin volver a 0), `CurvaRitmo` y `CurvaDia` (la línea real se traza sola; el punto del "ahora" se desliza con resorte), `RankingPt` (`layout`: las filas se deslizan al reordenarse; barra con resorte), `BarraProporcion` (compartida: alertas, merma, ranking) y `BarraFabricado` (tramos en cascada).
  - **Hallazgos al verificar:** (1) `motionValue.getVelocity()` da 0 aquí porque el reloj de Motion solo avanza con su propio bucle de cuadros y el bucle lo lleva three: la velocidad se mide a mano (`velocidadAlSoltar`). (2) El cromo se veía negro: sus caras reflejaban el piso oscuro; se resolvió con un ventanal frontal fuerte, la placa inclinada hacia arriba y rugosidad 0,12 (el ejemplo usa 0,055 porque su cielo es claro). (3) La banda funde la izquierda del lienzo con `mask-image`: las piezas protagonistas van en la mitad derecha. (4) Las pruebas visuales con Chrome sin pantalla deben usar la GPU real (`--use-angle=d3d11`): con swiftshader el hilo se bloquea segundos y las capturas salen vacías (no es un fallo del código). (5) `text-base` genera SOLO `color: var(--base)`, nunca el tamaño de 16 px: hay 13 usos más (con otra clase de color que hoy gana); `PENDIENTE DE DEFINIR` si se cambian a `text-[1rem]` (puede mover diseños ya revisados). Corregido el de `RankingPt` (título de "Producido sin estar en el DPP").
  - Verificado: `tsc -b` + `vite build`; oxlint con las 3 advertencias previas; backend 409 pruebas + `nest build`; capturas con GPU real de las escenas empaque (claro y oscuro), producción e inventario y prueba de arrastre simulado (el ángulo sigue al puntero; la figura no se remonta).

**Instrucciones del usuario (2026-10-07):**
- **Cambiar los `text-base` → hecho** el mismo día: los 13 usos pasaron a `text-[1rem]` (solo quedan los comentarios que explican la trampa). Efecto: esos textos ahora sí miden 16 px (antes heredaban el tamaño del contenedor). Build y oxlint en verde.
- **Crear `docs/claude/` → hecho**: la carpeta se citaba aquí pero nunca llegó a git. Se recreó con fuentes verificables: `api.md` (generado de los controladores: 99 rutas con su permiso), `estructura-backend.md` y `frontend-estructura.md` (árboles del código actual), `deuda-y-bugs.md` y `estado-modulos.md` (copia literal de la sección 7 y de "Terminado" del `CLAUDE.md` del commit `af7c694` + lo posterior reconstruido del código y de las decisiones guardadas). Al revisar los permisos no apareció ningún hueco: solo `POST /auth/login` es pública.
- **Los indicadores y estadísticos de los paneles deben quedar como el PDF `MQ VISUAL J3.pdf`** (en Descargas del usuario: tableros de Power BI). Es la referencia del **refactor del frontend base**, que el usuario abre en el siguiente ciclo. Contenido del PDF:
  - **Tablero diario "Control de producción MFR MQ"** (pág. 5, versión con estilo de la pág. 1): fecha larga; tarjetas de color con ícono: Programado (azul), Fabricado (verde), Faltante (naranja, negativo), # de personas, Cant. averías (rojo); "Avance del plan del día" (barra + estado); "Cumplimiento general" en medio arco con zonas de color y aguja; "Cumplimiento por producto" (barras programado vs fabricado); "Top productos más atrasados" con estado; "Personal por turno".
  - **Tablero mensual "Cumplimiento operacional"** (pág. 4, versión con estilo de la pág. 3): anillo de cumplimiento mensual con meta 95 % e insignia de estado; tarjetas Programado / Fabricado / Faltante / Cant. averías con "% del programado"; curva % cumplimiento MFR contra unidades averiadas por día; tabla "Clasificación por armado" (SURTIDO, REEMPAQUE, OFERTA, MULTIPACK: fabricado y %); averías por tipo (Producto / Insumo); "% recurrente de causales" (NO CUMPLIMIENTO, CALIDAD); personas por día.
  - **Informe de averías** (págs. 2 y 7): filtros Causal, Turno, Tipo de material, rango de fechas; tarjetas Cant. averías, Fabricado (UND), % averías; programado vs fabricado por día con la línea de averías; distribución por causal (torta); top de PT con más averías; tabla causal × turno; párrafo de conclusión con las cifras del periodo.
- **Hallazgos del PDF contra el sistema (para validar con el usuario/área antes de construir; regla 6):** (1) **tres escalas de semáforo distintas**: la pág. 5 usa ≥ 90 Excelente / 70–89 Aceptable / < 70 Crítico; la pág. 4 usa ≥ 95 / 70–89 / < 70 (deja sin color 90–94); el sistema usa ≥ 95 verde / ≥ 85 amarillo / < 85 rojo (`semaforo()` en `domain/mfr/calculo-mfr.ts`). (2) **"Armado"** (SURTIDO, REEMPAQUE, OFERTA, MULTIPACK) no existe en el modelo: el producto tiene `proceso` (MANUAL/AUTOMATICA) y `subdescripcion` (familia); la línea tiene tipo (MULTIPACK, MANUAL, REEMPAQUE…); "OFERTA" no aparece en ningún lado. (3) **Causales de incumplimiento** (NO CUMPLIMIENTO, CALIDAD): hoy el motivo del faltante al cerrar el turno es texto libre, sin catálogo. (4) **Averías de insumos** (filtro "Tipo de material"): hoy las averías son solo de PT. (5) **% averías**: el PDF divide entre lo fabricado (22.379 ÷ 1.428.974 = 1,57 %) y en la pág. 4 entre lo programado; el sistema tiene "averías ÷ (fabricado + averiado)" (usuario, 2026-10-06) y el límite del 1 % contra el DPP.

**Respuestas del usuario a los hallazgos del PDF (2026-10-08) — arranca el refactor del frontend base ("vamos a ello"):**
1. **Semáforo: el que ya tiene el sistema** (verde ≥ 95, amarillo ≥ 85, rojo < 85; `semaforo()` en `domain/mfr/calculo-mfr.ts`). Las zonas de los medidores al estilo del PDF usan esos cortes, no los del PDF.
2. **"Armado" (SURTIDO, REEMPAQUE, OFERTA, MULTIPACK) es un DATO NUEVO** del producto. Toca base de datos (Prisma + Firestore) y el formulario del PT (se consulta con boceto, regla de formularios). `PENDIENTE DE DEFINIR`: si la lista es fija (las 4 del PDF) o la administra el panel.
3. **Causales de incumplimiento: texto libre** que permita digitar lo que quieran (como el motivo del faltante al cerrar el turno hoy). Consecuencia: el "% recurrente de causales" del PDF solo puede agrupar textos iguales.
4. **Las averías son SOLO de insumos y PI**: "un PT no se puede averiar hasta el momento según el flujo de trabajo". **Cambia la decisión del 2026-09-28** (averías de PT). Es un cambio de modelo del módulo Averías (ver el análisis en el reporte de este día) y se trata en su propio ciclo.
5. **% de averías: relacionar las fórmulas del PDF con los tableros que ya existen** y mencionarle al usuario las que no se sepa relacionar.

**Ciclo 3 — Refactor del frontend base al estilo del PDF** (usuario, 2026-10-08) · Fase 1 `VERIFICADA 2026-10-08`, falta revisión y commit del usuario
- **Hecho (fase 1):** piezas base nuevas, solo para tableros de indicadores (el resto sigue sin cajas): `components/TarjetaIndicador.tsx` (fondo pastel del tono, cuadro de color con ícono, etiqueta + unidad "(CJ)", cifra grande en `text-tinta` por contraste, raya del color, nota "x % del programado"), `components/PanelIndicador.tsx` (caja blanca con título en mayúsculas e ícono), `components/graficas/MedidorZonas.tsx` (medio arco rojo/amarillo/verde con aguja; la aguja anima el ÁNGULO con `useSpring` + `useTransform` de Motion), `components/graficas/BarrasComparadas.tsx` (programado vs fabricado por fila, misma escala). `cortesSemaforo(meta)` en `modules/mfr/semaforo.ts` (espejo de la regla del dominio: verde desde la meta, amarillo 10 puntos abajo).
- **Tablero MFR del día (`/tableros/mfr`) rehecho como la pág. 5 del PDF** (`modules/mfr/components/ResumenDiaMfr.tsx`): 5 tarjetas (Programado, Fabricado con % del programado, Faltante en negativo con % del programado, Personas del día, Averías UND del indicador de averías), Avance del plan del día (barra con la raya de la meta + frase guía + fuera del DPP y emergencia, que el PDF no tiene), Cumplimiento por producto (10 PT con más cajas), Cumplimiento general (medio arco), Productos más atrasados (5, con estado) y Personal por turno. La banda quedó solo con título, día y acciones; las 4 vistas de antes siguen debajo como "Detalle del día". Diferencia consciente: "Faltante" suma PT por PT (lo que sobra de un PT no tapa lo que falta de otro); el PDF resta totales.
- Verificado: `tsc -b` + `vite build`; oxlint con las 3 advertencias previas; capturas con datos de ejemplo a 1280 y 1440 px (claro y oscuro) y 390 px, sin desborde horizontal.
- **Instrucción del usuario (2026-10-08): esqueleto con brillo cuando la página demora en cargar, pasado el primer segundo**, tomando como base el ejemplo de Motion `https://motion.dev/examples/react-skeleton-shimmer` (huesos con un degradado que recorre de izquierda a derecha en 1,5 s y se repite; el esqueleto copia la forma real del contenido; al llegar el dato, un barrido descubre el contenido). Si carga en menos de un segundo, no se muestra nada (evita el parpadeo).
  - **Hecho 2026-10-08 (`VERIFICADO`, falta revisión y commit del usuario):** `components/Esqueleto.tsx` (`Hueso` y `Brillo` con el degradado del ejemplo animado con Motion, colores de tokens con `color-mix`, quieto con "reducir movimiento"); `shared/useDemora.ts` (`DEMORA_ESQUELETO_MS = 1000`); `PantallaCargando` ahora no muestra nada el primer segundo y luego el esqueleto con forma `tablero`, `lista` (por defecto) o `detalle` (los 16 usos siguen igual; las 5 pantallas de detalle pasan `forma="detalle"`); `components/ConCarga.tsx` (esqueleto + barrido al llegar el dato) en los tableros: MFR del día, los 5 de `TableroConIndicadores`, ritmo y metas/personal. CSS del barrido en `index.css` (`@property --barrido`, `@keyframes barrido`, clase `barrido`, `:root { view-transition-name: none }`).
  - **Decisión técnica (Claude):** el barrido usa el `<ViewTransition>` de React directo (con `default="none"` y `update` solo para transiciones marcadas con `addTransitionType('carga')`) y no `AnimateView` de Motion: `AnimateView` dejaba activas las animaciones por defecto y CUALQUIER transición de React (cargar la ruta, cambiar de pestaña) animaba el área y bloqueaba los clics ~0,6 s. Motion sigue haciendo el brillo de los huesos.
  - **Verificado** con la red demorada a propósito (Chrome sin pantalla interceptando la API): con 2,5 s, nada antes del segundo, esqueleto a 1,9 s y barrido de ~650 ms al llegar el dato; con 400 ms, ni esqueleto ni barrido; ninguna transición al arrancar la página. `tsc -b` + `vite build`; oxlint con las 3 advertencias previas.
- **Siguiente (fases):** tablero mensual "Cumplimiento operacional" (pág. 4; necesita "armado") e informe de averías (págs. 2 y 7; depende del cambio de averías a insumos/PI). Pendiente del usuario: la relación de fórmulas de % de averías (ver el reporte del 2026-10-08) y las preguntas del cambio de averías.

### Cola (no se abre hasta cerrar el ciclo anterior; el usuario decide el orden)

- Correo fase 2b: envío automático al cerrar el turno (resumen + aprobadas), reenviar, sin deshacer el cierre si falla.
- Resumen 2c / MFR: cierre automático del turno a su hora.
- MFR: estadística histórica por línea.
- Calidad (D2): en levantamiento; falta si bloquea la remisión y la tabla de muestreo exacta.
- **Integración con las API de iLogic para vincular los inventarios** (usuario, 2026-10-08: "nos van a pasar" las API). Revisado ese día: **no hay nada construido** (ni interfaz, ni adaptador, ni variables de entorno); solo la intención de §8 punto 9 (conciliar el PT contra el WMS "detrás de una interfaz"). Ayuda lo que ya existe: patrón puerto + adaptador (como correo, PDF del DPP y fotos), el PT ligado al código de ítem del producto como clave de cruce, y el kardex/entradas con documento de soporte. **Levantamiento pendiente antes de diseñar:** qué es iLogic (¿el WMS de bodega?), qué inventario trae (PT, insumos, PI), solo lectura o también escritura, para qué (comparar existencias, alimentar el kardex o ambas), frecuencia (a pedido, programada, tiempo real), si trae el número de remisión de origen (pregunta M10) y la documentación de la API (endpoints, respuesta, autenticación). Propuesta inicial de Claude, sin aprobar: empezar solo con lectura y un botón "conciliar" que muestre diferencias sin mover existencias. Credenciales solo en `.env`, nunca en el código ni en `.env.example`.