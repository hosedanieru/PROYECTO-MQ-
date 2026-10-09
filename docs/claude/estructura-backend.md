# Estructura del backend

> Leer cuando se crean archivos nuevos en el backend. Índice en `CLAUDE.md`.
> Árbol tomado del código el 2026-10-07 (sin los `.spec.ts`, que van al lado de cada archivo).
> Reemplaza el árbol del 2026-09-16, que solo tenía remisiones y autenticación.

## Las cuatro capas

Las dependencias apuntan hacia adentro: `modules` → `application` → `domain` ← `infrastructure`.
**`domain/` no importa nada externo** (ni NestJS, ni Prisma, ni Firestore): se prueba sin base de datos.

```text
backend/src/
├── domain/                     REGLAS DEL NEGOCIO (solo TypeScript)
│   ├── shared/                 errores.ts (base de los errores de negocio), fecha-operativa.ts (corte 6:00),
│   │                           rango-fechas.ts, unidad-de-trabajo.ts (puerto transaccional)
│   ├── remision/               remision.entity.ts (entidad + flujo de estados), remision.errors.ts,
│   │                           remision.repository.ts, historial.repository.ts, tope-programacion.ts
│   │                           ("ni más ni menos" que el DPP), firma-remision.ts (casillas y huella),
│   │                           generador-pdf.ts y exportador-excel.ts (puertos)
│   ├── usuario/                usuario.entity.ts (tienePermiso), contrasena.ts, emisor-token.ts, …
│   ├── producto/ grupo/ catalogo/ auditoria/    interfaces de repositorio y errores
│   ├── mfr/                    dpp-pepsico.ts (lector puro del PDF), bloque-programacion.ts, calculo-mfr.ts,
│   │                           horas-turno.ts (turnoDeHora), linea-produccion.ts, estandar-produccion.ts,
│   │                           asistencia-turno.ts, asignacion-linea.ts, esperadas-personal.ts,
│   │                           indicadores-produccion.ts (FR, OTIF, ranking, averías vs fabricado,
│   │                           productividad), ritmo-produccion.ts, mfr.errors.ts
│   ├── averia/                 reporte-averia.ts, registro-averia.ts, causal-averia.ts,
│   │                           indicador-averias.ts (límite 1 %), almacen-evidencias.ts (puerto de fotos)
│   ├── inventario/             item-inventario.ts, material.ts, unidad-medida.ts, cantidad.ts (3 decimales),
│   │                           movimiento-inventario.ts (kardex), entrada-mercancia.ts, receta.ts, consumo.ts,
│   │                           conteo.ts (conteo mixto), alertas-inventario.ts, cierre-inventario.ts (merma)
│   ├── correo/correo.ts        puerto del enviador y listas
│   └── resumen/resumen-turno.ts
│
├── application/                CASOS DE USO (coordinan, no deciden)
│   ├── remision/               crear, editar, flujo (5 transiciones), firma, exportar, imprimir,
│   │                           control-programacion.ts (tope contra el DPP)
│   ├── auth/                   iniciar sesión, crear y actualizar usuario
│   ├── mfr/                    analizar-dpp, bloques, asistencia, asignación, catálogos, indicadores del día,
│   │                           indicadores-produccion (periodo + ritmo)
│   ├── averia/ inventario/ catalogo/ correo/ resumen/
│   ├── shared/momento-operativo.ts   fecha, hora, día operativo y turno automáticos (averías, kardex)
│   └── pruebas/                dobles en memoria compartidos por los specs (uno por módulo)
│
├── infrastructure/             ADAPTADORES
│   ├── persistence/            persistencia.module.ts: ÚNICO lugar que elige Prisma o Firestore según
│   │   └── prisma/             PERSISTENCIA; unidad de trabajo, mapeadores y repositorios Prisma
│   ├── firestore/              cliente, unidad de trabajo optimista, repositorios/, seed-firestore.ts
│   ├── database/prisma/        PrismaService + crearAdaptadorPostgres() (fija TimeZone=UTC; nunca new PrismaPg)
│   ├── auth/                   jwt-auth.guard, permisos.guard (globales), decoradores, bcrypt, jwt
│   ├── http/                   filtro de errores de dominio → HTTP, validadores, registro de peticiones
│   ├── pdf/                    Puppeteer (navegador reutilizado), plantillas de remisión y de resumen
│   ├── excel/                  exceljs
│   ├── dpp/lector-pdf.ts       pdf-parse
│   ├── correo/                 nodemailer (sin CORREO_HOST guarda .eml)
│   ├── evidencias/             fotos de averías en disco (EVIDENCIAS_DIR, fuera de git)
│   ├── importacion/            hoja TIEMPOS del Excel (simula y reporta diferencias)
│   ├── shared/                 reloj del sistema, huella SHA-256
│   └── datos-base.ts           permisos, roles, turnos, líneas… (fuente de verdad del seed)
│
├── modules/                    PRESENTACIÓN + WIRING (controladores, DTOs, DI con tokens Symbol)
│   └── auth/ remision/ mfr/ averia/ inventario/ catalogo/ correo/ resumen/
│
└── generated/prisma/           cliente Prisma generado (no se edita)
```

## Al agregar un repositorio nuevo

1. Interfaz en `domain/<modulo>/` con su token `Symbol`.
2. Implementarlo **dos veces**: `infrastructure/persistence/prisma/` y `infrastructure/firestore/repositorios/`.
3. Registrarlo en `persistencia.module.ts`; si escribe, sumarlo a `ContextoTransaccional`.
4. En Firestore, dentro de una transacción: **todas las lecturas antes que cualquier escritura**.
