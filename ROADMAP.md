# ROADMAP — Aplicativo Maquila (MQ)

Detalle explícito de lo que falta. Cada tarea indica objetivo, pasos concretos, archivos involucrados, criterio de cierre y de qué depende.

**Convención de estado:** `LISTO` · `EN CURSO` · `PENDIENTE` · `BLOQUEADO` (requiere respuesta del área)

---

# PARTE A — Lo que ya está terminado

Para no repetir trabajo.

| Componente | Estado |
|---|---|
| Base de datos PostgreSQL 18 local + Prisma 7 configurado | LISTO |
| `schema.prisma` con 14 tablas y migraciones aplicadas | LISTO |
| Seed idempotente: 13 permisos, 4 roles, 3 turnos, 14 horarios, 1 lugar, 4 proveedores | LISTO |
| Regla `fecha_operativa` (corte 6:00 a 6:00) con pruebas de casos borde | LISTO |
| Dominio de Remisión: entidad, reglas, flujo de estados, errores, interfaces | LISTO |
| 6 casos de uso: crear + 5 transiciones | LISTO |
| Unidad de trabajo transaccional con auditoría garantizada | LISTO |
| Repositorios Prisma: remisión, producto, auditoría | LISTO |
| API HTTP de Remisiones: 9 endpoints | LISTO |
| Autenticación JWT, permisos por endpoint, admin inicial por seed (B1) | LISTO |
| 92 pruebas unitarias sin base de datos | LISTO |

**Lo que NO está:** frontend, PDF, catálogo de productos cargado, histórico migrado, y todos los módulos fuera de Remisiones.

---

# PARTE B — Cierre del módulo Remisiones

## B1 · Autenticación y autorización

**Estado:** LISTO (2026-09-16) · **Prioridad:** ALTA

### Qué se hizo

Cerrado el hueco de seguridad: ningún DTO recibe `*PorId`; el usuario sale del token y cada endpoint exige su permiso. Criterio de cierre cumplido y verificado por HTTP contra PostgreSQL real (401 sin token, 401 con token manipulado, 403 sin permiso, 400 si el cliente envía `creadaPorId`).

Decisiones tomadas (aprobadas por el usuario):

| Decisión | Elección | Razón |
|---|---|---|
| Duración del token | JWT único de **12 h**, sin refresh | Cubre el turno más largo (10 h). Refresh se puede sumar después sin rehacer nada |
| Identificador de login | **Documento** | Ya era único y obligatorio en el schema; los operarios no tienen correo corporativo |
| Contraseñas | Solo **mínimo 8 caracteres**; bcrypt 10 rondas | El resto es PENDIENTE DE DEFINIR con el área (ver Parte F) |
| Librería | `@nestjs/jwt` + guards propios, **sin Passport** | No había un problema que Passport resolviera; menos dependencias, flujo legible |
| Permisos en el token | **No**; se leen de la base en cada petición | Un cambio de rol o desactivación aplica de inmediato, no 12 h después |
| Protección | Guards **globales**; `@Publico()` para excepciones | Una ruta nueva sin decorador queda protegida, no expuesta |

Piezas: `domain/usuario/`, `application/auth/`, `infrastructure/auth/`, `modules/auth/`, `PersistenciaModule` (unidad de trabajo compartida), base `ErrorDominio` para todos los módulos, admin inicial por seed desde `ADMIN_INICIAL_*`.

### Lo que quedó fuera (para el frontend de administración, B5)

- Listar, editar, desactivar usuarios; cambiar contraseña; restablecer contraseña por el administrador.
- Revocación de tokens antes de expirar (requeriría refresh token o lista de revocación).
- Auditoría de inicios de sesión (PENDIENTE DE DEFINIR con el área).

### Pregunta pendiente al área

**¿Quién registra la respuesta del OPA: el coordinador, el patinador, o ambos?** Hoy ambos roles tienen el permiso `remision.registrar_aprobacion`. Si es solo uno, hay que quitarlo del otro en el seed.

---

## B2 · Pruebas de integración contra PostgreSQL

**Estado:** PENDIENTE · **Prioridad:** ALTA · **Depende de:** nada

### Por qué importa

Las 92 pruebas actuales no tocan la base de datos. Eso es correcto para el dominio, pero deja sin verificar justamente lo más delicado:

- El bloqueo de fila del consecutivo bajo concurrencia real
- Que la transacción efectivamente revierta cuando la auditoría falla
- Que el mapeador traduzca bien en ambos sentidos

Hoy se simula. La atomicidad real solo se comprueba contra PostgreSQL.

### Tareas

1. Base de datos de pruebas separada (`mq_test`) y `.env.test`
2. Configurar `vitest.config.e2e.ts` para levantar el módulo Nest real
3. Utilidad de limpieza de tablas entre pruebas
4. **Prueba de concurrencia del consecutivo:** lanzar 20 creaciones en paralelo con `Promise.all` y verificar que los números sean 1..20 sin repetidos ni huecos
5. **Prueba de rollback:** forzar el fallo de auditoría y verificar que no quede ni remisión ni consecutivo consumido
6. **Prueba de ida y vuelta del mapeador:** crear, leer, y comparar que todos los campos coincidan
7. **Prueba del flujo completo:** crear → entregar → rechazar → rectificar → entregar → aprobar → validar, verificando estados, versión y filas de auditoría

### Criterio de cierre

`npx vitest run --config vitest.config.e2e.ts` pasa, incluyendo la prueba de concurrencia.

---

## B3 · Importación del catálogo de productos

**Estado:** BLOQUEADO PARCIALMENTE · **Prioridad:** ALTA · **Bloquea:** uso real del sistema

### Situación

El catálogo está vacío. Sin productos no se puede crear ninguna remisión. Los datos están en el Excel, pero con problemas que no se pueden resolver adivinando:

| Problema | Detalle |
|---|---|
| Códigos duplicados | PRODUCTOS: 92 filas / 87 únicos. TIEMPOS: 88 filas / 85 únicos |
| Tres valores de proceso | PRODUCTOS: MANUAL, LINEA. TIEMPOS: MANUAL, AUTOMATICA, AUTOMATICO (typo) |
| Contradicción entre hojas | Código `300033679`: `LINEA` en PRODUCTOS, `AUTOMATICA` en TIEMPOS |
| Campos sin significado confirmado | `LINEA IDEAL` (valores 0–13), `PC` (280.49 y 10.05), `SUBDESCRIPCION` (OFERTA, SURTIDO, REEMPAQUE, OFERTA C MAYOR) |

### Tareas

1. **Script de importación** — `backend/scripts/importar-productos.ts`
   - Lee el Excel con `xlsx` o `exceljs`
   - Normaliza códigos y descripciones
   - Corrige el typo `AUTOMATICO` → `AUTOMATICA`
   - Detecta duplicados y contradicciones **sin decidir por su cuenta**
2. **Reporte de excepciones** en CSV, con una fila por conflicto: código, hoja de origen, valores en conflicto, motivo
3. **Modo simulación** (`--dry-run`) que genera el reporte sin escribir en la base
4. **Modo aplicación** que importa solo los registros sin conflicto
5. **Carga manual** desde el panel para resolver los conflictos caso por caso
6. Ampliar el enum `ProcesoProducto` según lo que responda el área

### Preguntas pendientes al área

1. ¿`LINEA` y `AUTOMATICA` son el mismo proceso con dos nombres, o procesos distintos?
2. Cuando PRODUCTOS y TIEMPOS se contradicen, ¿cuál hoja manda?
3. Los códigos duplicados: ¿son filas repetidas idénticas (descartar) o variantes con datos distintos (elegir)?
4. ¿Qué es `LINEA IDEAL`? Los valores van de 0 a 13 e incluyen el 0, así que no parece ser un número de línea física. ¿Es la cantidad ideal de personas?
5. ¿Qué es `PC`? Un campo casi constante para 88 productos no parece atributo del producto.
6. ¿`SUBDESCRIPCION` debe modelarse como campo del producto?

### Criterio de cierre

El catálogo cargado con los productos válidos, y un reporte de excepciones entregado al área para los conflictos.

---

## B4 · PDF de la remisión

**Estado:** PENDIENTE · **Prioridad:** MEDIA · **Depende de:** nada

### Objetivo

Reproducir el formato actual imprimible, con dos remisiones por hoja (así lo maneja hoy el área — es solo ahorro de papel, las dos remisiones no están relacionadas entre sí).

### Estructura del formato actual

```text
REMISIÓN                                   No. ____
LUGAR: MAQUILA PEPSICO SANTO DOMINGO
FECHA: ____          HORA: ____

TURNO | ITEM | DESCRIPCIÓN | F. VENC | CAJAS | UNIDADES | ESTIBAS | OBSERVACIONES

FIRMA QUIEN RECIBE      FIRMA INLOTRANS      FIRMA VERIFICADOR
Nombre: ______          Nombre: ______       Nombre: ______
Cargo:  ______          Cargo:  ______       Cargo:  ______
Cliente: ______                              Cliente: ______
```

### Tareas

1. Elegir librería (PDFKit, Puppeteer con plantilla HTML, o `pdf-lib`) y plantear la decisión con ventajas y desventajas
2. `src/infrastructure/pdf/remision-pdf.service.ts` detrás de una interfaz de dominio
3. Plantilla con dos remisiones por hoja
4. Endpoint `GET /api/remisiones/:id/pdf`
5. Endpoint de impresión por lote: `GET /api/remisiones/pdf?ids=...` que arme las hojas de a dos
6. Marca de agua o etiqueta de estado cuando la remisión no está aprobada, para que no se confunda un borrador con un documento válido
7. Mostrar la versión cuando sea mayor que 1, para distinguir un documento rectificado

### Criterio de cierre

El PDF generado es equivalente al formato actual y el área lo acepta como reemplazo.

---

## B5 · Frontend de Remisiones

**Estado:** PENDIENTE · **Prioridad:** ALTA · **Depende de:** B1 (autenticación) — LISTO

### Situación

`frontend/src/` tiene solo el scaffold de Vite: `App.tsx`, `main.tsx`, `index.css`. No hay routing, ni cliente HTTP, ni estructura de módulos.

### Tareas

1. **Dependencias base**
   ```powershell
   npm install react-router-dom @tanstack/react-query react-hook-form zod @hookform/resolvers axios
   ```

2. **Estructura**
   ```text
   frontend/src/
   ├── app/
   │   ├── router.tsx
   │   ├── providers.tsx          QueryClient, auth
   │   └── layout/
   ├── modules/
   │   ├── auth/                  login, contexto de sesión
   │   ├── remisiones/
   │   │   ├── pages/             listado, detalle, crear
   │   │   ├── components/        formulario, tabla, badge de estado
   │   │   ├── hooks/             useRemisiones, useCrearRemision
   │   │   └── api/               llamadas HTTP
   │   └── admin/                 catálogos
   ├── components/                UI compartida
   ├── services/
   │   └── http.ts                cliente axios con interceptor de token
   └── shared/
       ├── types/
       └── utils/
   ```

3. **Autenticación en el cliente**
   - Pantalla de login
   - Contexto de sesión con el usuario y sus permisos
   - Interceptor que añade el token y redirige al login en 401
   - Rutas protegidas y ocultamiento de acciones según permisos

4. **Formulario de creación de remisión**
   - Selectores de turno, proveedor, lugar y producto desde los catálogos
   - Validación con Zod, espejo de las reglas del backend
   - Cálculo asistido de estibas: al ingresar cajas, sugerir estibas completas y cajas sueltas usando `cajasPorEstiba` del producto
   - Ingreso de números de estiba con validación de duplicados
   - Mostrar la fecha operativa calculada, para que el coordinador vea a qué día productivo va a quedar el registro

5. **Listado de remisiones**
   - Tabla con filtros: fecha operativa, turno, proveedor, producto, estado
   - Paginación
   - Indicador visual de estado
   - Destacar las remisiones aprobadas sin conciliar

6. **Detalle de remisión**
   - Datos completos
   - Botones de acción según el estado y los permisos del usuario
   - Historial de versiones con motivo de rechazo
   - Registro de auditoría

7. **Pantallas de flujo**
   - Entregar, aprobar (con nombre y cargo del OPA), rechazar (con motivo obligatorio), rectificar, validar (con contacto de conciliación)

8. **Administración de catálogos**
   - Productos: crear, editar, activar/desactivar
   - Turnos y horarios
   - Proveedores
   - Usuarios y roles

### Consideraciones de diseño a validar con el área

- **¿Desde qué dispositivos se usará?** Si el coordinador registra desde una tablet en planta, el formulario necesita botones grandes y poca escritura. Si es desde computador de oficina, puede ser más denso.
- **¿Hay zonas sin conexión?** Si sí, habría que evaluar funcionamiento offline, lo que cambia bastante la arquitectura del frontend.
- **¿Se necesita tomar fotografías?** Aparece como necesidad en calidad y averías; conviene saberlo antes de definir el patrón de captura.

### Criterio de cierre

Un coordinador puede operar un turno completo desde el navegador, sin abrir el Excel.

---

## B6 · Migración del histórico 2026

**Estado:** PENDIENTE · **Prioridad:** MEDIA · **Depende de:** B3 (catálogo cargado)

### Situación

~2.195 registros con datos reales en la hoja `REMISIONES GUARDADAS 2026`. Requieren limpieza antes de migrar.

| Problema | Tratamiento |
|---|---|
| `N° Estibas` mezcla número y texto (`"2 ESTIBAS+ 21 CAJAS"`) | Separar en `estibas_completas` / `cajas_sueltas` |
| `Observaciones` contiene números de estiba (`"EST: 31,32,33"`) | Extraer a `remision_estiba`; dejar en observaciones solo el texto real |
| `Turno` en texto libre, 322 variantes | Normalizar contra la tabla `turno` |
| Filas de plantilla vacías | Descartar |
| Registros sin fecha de validación | Migrar como `APROBADA`, no `VALIDADA` |
| Campo `Tipo` (único valor: "Original") | Descartar; el flujo de estados cubre su función |

### Tareas

1. Script `backend/scripts/migrar-historico.ts`
2. Parser del campo de estibas, con reporte de lo que no pueda interpretar
3. Parser de números de estiba desde observaciones
4. Normalizador de turnos, con tabla de equivalencias explícita
5. Resolver el consecutivo: los registros traen número propio, hay que respetarlo y ajustar la tabla `consecutivo` al máximo importado
6. Usuario de sistema para `creadaPorId` (los registros históricos no tienen autor identificable)
7. Modo `--dry-run` con reporte de excepciones en CSV
8. Verificación posterior: totales de cajas y unidades del Excel contra la base

### Decisión a plantear

**¿Migrar el histórico o dejarlo en el Excel como archivo?** Migrarlo permite reportes continuos y comparativos año contra año. Dejarlo evita meter datos de calidad dudosa en un sistema nuevo. Una tercera vía: migrarlo marcado como `origen: HISTORICO_EXCEL` para poder excluirlo de indicadores si hace falta.

### Criterio de cierre

Histórico migrado (o descartado por decisión explícita), con reporte de excepciones revisado.

---

## B7 · Exportación a Excel

**Estado:** PENDIENTE · **Prioridad:** BAJA · **Depende de:** B5

El permiso `remision.exportar` ya existe en el seed.

### Tareas

1. `src/infrastructure/excel/remision-excel.service.ts`
2. Endpoint `GET /api/remisiones/exportar` con los mismos filtros del listado
3. Columnas equivalentes al Excel actual, para que el área reconozca el formato
4. Botón en el listado del frontend

---

# PARTE C — Módulo MFR

**Estado:** BLOQUEADO · **Depende de:** tres respuestas del área

MFR = **Manufacturing Fill Rate**, cumplimiento de lo programado.

## Lo que ya está definido

- PepsiCo envía la programación **por correo**, **por SKU y día**
- Los coordinadores la cargan
- Se quiere control y metas **por turno**
- La productividad es variable y la define el coordinador o el administrador, por turno
- Las líneas de producción activas varían según el día y el producto

## Fórmula acordada

```text
META_TURNO = Σ (por cada línea configurada en el turno)

     horas_turno  ×  unidades_hora_SKU  ×  % rendimiento
          ↑                 ↑                    ↑
    turno_horario      estándar del SKU    lo fija el coordinador
     (automático)      (edita el admin)     o el administrador
```

El `% rendimiento` es el rendimiento esperado de la línea sobre el estándar fijo del SKU para ese turno.

## Dos indicadores distintos, no uno

| Indicador | Se mide contra | Responde |
|---|---|---|
| **MFR** | Programación de PepsiCo | ¿Cumplimos con el cliente? |
| **Eficiencia de turno** | Capacidad configurada por el coordinador | ¿El turno rindió lo que podía? |

El MFR es innegociable: su meta la fija PepsiCo y nadie de Inlotrans la modifica. La eficiencia sirve para gestión interna.

**Alerta derivada:** si la capacidad configurada de los tres turnos suma menos que la programación diaria, el día arranca condenado a incumplir. El sistema puede avisarlo al inicio de la jornada, no al cierre.

## Bloqueos

| # | Pregunta | Por qué bloquea |
|---|---|---|
| 1 | ¿La programación viene en cajas o en unidades? | Define contra qué campo de la remisión se compara. Sin esto el porcentaje sale mal |
| 2 | ¿El MFR cuenta remisiones aprobadas o creadas? | Si una se rechaza y se rectifica, ¿el cumplimiento se registra al crear o al aprobar el OPA? |
| 3 | ¿La línea de producción es un activo físico fijo o un armado diario? | Determina el modelo de datos completo (ver abajo) |

### Sobre el punto 3

**Si es activo físico:** existe un catálogo `linea_produccion` con identidad estable, y se puede comparar rendimiento entre líneas a lo largo del tiempo, hacer mantenimiento por línea, detectar que una rinde peor que otra.

**Si es armado diario:** la línea es solo un número secuencial del día y ese análisis no es posible.

Es la decisión de mayor impacto del módulo.

## Modelo preliminar

```text
PROGRAMACION (lo que envía PepsiCo)
├── fecha_operativa
├── producto_id
├── cantidad_programada
├── unidad_medida .......... PENDIENTE (cajas o unidades)
├── cargada_por
├── fecha_carga
└── archivo_origen ......... trazabilidad del correo

CONFIG_TURNO (lo que arma el coordinador)
├── fecha_operativa
├── turno_id
├── linea_id ............... PENDIENTE (depende del punto 3)
├── producto_id
├── porcentaje_productividad
├── personas_asignadas
├── configurada_por
└── fecha_configuracion
```

`personas_asignadas` habilita el indicador de afectación del número de personas sobre el cumplimiento, que el área pidió expresamente.

## Gobierno del `% rendimiento`

El coordinador edita un dato que define su propia meta. Bajando el porcentaje, el turno siempre cumpliría. No es una acusación: un sistema de trazabilidad debería impedir que la duda exista.

Tres controles obligatorios:

1. **Auditoría completa**: quién, cuándo, valor anterior, valor nuevo, motivo obligatorio
2. **Congelamiento al cierre del turno**: después de cerrado no se edita retroactivamente
3. **Separación de permisos**: el coordinador configura el turno; solo el administrador modifica los estándares base (`unidades_hora` por SKU)

El MFR contra PepsiCo no se ve afectado por estos controles, porque su meta no la toca nadie de Inlotrans.

## Tareas, cuando se desbloquee

1. Dominio: `Programacion`, `ConfigTurno`, `LineaProduccion`, cálculo de MFR y eficiencia
2. Carga de la programación: manual, y evaluar importador si PepsiCo manda siempre el mismo formato
3. Pantalla de configuración de turno: líneas, producto, % rendimiento, personas
4. Cálculo de indicadores agrupados por `fecha_operativa`
5. Alerta de capacidad insuficiente al inicio de la jornada
6. Dashboard de cumplimiento

## Pregunta adicional

**¿Cuál es la meta de MFR?** Un porcentaje objetivo (95%, 98%) para marcar en verde/rojo y disparar alertas por desviación.

**Si consigues el correo con la programación de PepsiCo, súbelo.** Con el formato real en mano se puede determinar si el importador automático es viable.

---

# PARTE D — Módulos sin levantar

Ninguno tiene información suficiente para diseñarse. Cada uno necesita su propio levantamiento antes de escribir código.

## El levantamiento de cada módulo debe responder

1. ¿Cómo comienza el proceso?
2. ¿Quién lo inicia?
3. ¿Qué información necesita?
4. ¿Qué pasos tiene?
5. ¿Quién participa?
6. ¿Qué información se registra?
7. ¿Dónde se registra actualmente?
8. ¿Quién revisa? ¿Quién aprueba?
9. ¿Qué ocurre si hay un error?
10. ¿Qué ocurre si queda incompleto?
11. ¿Cómo sabemos que terminó?
12. ¿Qué historial debe conservarse?
13. **¿Cómo se conecta con Remisiones?**

La pregunta 13 es la más importante: todo cuelga de Remisiones.

## D1 · Averías

**Estado:** SIN LEVANTAR

Lo único que se sabe: se quiere el **% de averías por día y por turno, segmentado por proveedor**.

Preguntas mínimas:
- ¿Qué es una avería en este contexto? ¿Producto dañado, empaque defectuoso, material de entrada malo?
- ¿Se registra **sobre** una remisión existente, o es independiente y se relaciona después?
- ¿"Proveedor" aquí es el que suministra el material, o la empresa que opera el turno? (En remisiones es lo segundo, pero en averías podría ser lo primero — y eso cambia el modelo)
- ¿Cómo se registra hoy?
- ¿Hay tipos o categorías de avería?
- ¿Requiere evidencia fotográfica?

## D2 · Calidad

**Estado:** SIN LEVANTAR · El área indicó que **hoy se maneja de forma muy básica**

Lo que se sabe: se quiere **% de muestreo, controles de calidad, PI, PT, insumos, rotulado**, y controles basados en **muestreos estadísticos**.

Preguntas mínimas:
- ¿Qué significan exactamente **PI** y **PT**? (PT = Producto Terminado es presumible; PI sin confirmar)
- ¿Qué método de muestreo estadístico se usa? ¿Hay una norma o tabla de referencia?
- ¿Cuáles son los criterios de aceptación?
- ¿Qué tipos de defecto existen?
- ¿Quién inspecciona y quién aprueba?
- ¿Se requieren fotografías como evidencia?
- ¿Cómo se cierra una no conformidad?
- ¿El control de calidad bloquea la entrega de una remisión, o es paralelo?

La última pregunta es clave: si calidad debe aprobar antes de que el patinador entregue, hay que agregar un estado al flujo de remisiones.

## D3 · Inventario

**Estado:** SIN LEVANTAR · Decisión de alcance pendiente

### El punto crítico

El patinador ya ingresa el PT al **WMS de la bodega**. Es decir, **el inventario ya existe en otro sistema**. Construir un inventario paralelo generaría dos verdades sobre lo mismo y descuadres permanentes.

El usuario indicó que puede resolverse por **API** (si se consigue la clave) o por **comparativo**, y que lo importante es que las informaciones vayan a la par. Ambas opciones quedan detrás de una interfaz, así que la decisión técnica no bloquea el diseño:

```text
        Caso de uso: ConciliarInventario
                    │
         InventarioWmsRepository (interfaz)
                    │
        ┌───────────┴───────────┐
        ↓                       ↓
  WmsApiRepository        WmsArchivoRepository
   (si hay API key)      (importación Excel/CSV)
```

### Lo que sí bloquea

**¿Con qué campo se cruzan los dos sistemas?** Para comparar lo remisionado contra lo ingresado al WMS hace falta una llave común:

- **Número de remisión** — si el patinador lo digita al cargar el PT en el WMS, la conciliación es exacta: *"la remisión 428 no entró al WMS"*
- **Código de producto + fecha operativa + turno** — si el WMS no guarda el número de remisión, solo se detectan diferencias de totales: *"el martes sobran 340 cajas en alguna parte"*

**Pregunta para el patinador o el administrador del WMS: ¿el WMS registra algún dato que identifique la remisión de origen?**

### Otras preguntas

- ¿El inventario de MQ es el mismo del WMS, o cubre algo distinto (insumos, material de empaque, producto en proceso)?
- El área mencionó "comparativo de lo fabricado vs inventario, en cuanto a lo consumido y el ingreso del PT". ¿Se necesita controlar también el **consumo** de insumos?
- ¿Se manejan ubicaciones, desperdicios, alertas de existencias?

## D4 · Planes de trabajo

**Estado:** SIN LEVANTAR

Preguntas mínimas:
- ¿Qué es un plan de trabajo en MQ? ¿La asignación de personal y líneas por turno, o algo distinto?
- ¿Se crea **a partir de** una remisión, o al revés — la remisión nace de un plan ya existente?
- ¿Quién lo elabora y quién lo aprueba?
- ¿Se relaciona con la programación de PepsiCo?
- ¿Se solapa con `CONFIG_TURNO` del módulo MFR? (Podrían ser lo mismo con dos nombres)

La última pregunta importa: si son lo mismo, no hay que construir dos módulos.

## D5 · Cuaderno virtual

**Estado:** SIN DEFINIR

Aparece mencionado dos veces: las remisiones deben alimentarlo, y la fecha de validación corresponde a la fecha de conciliación registrada allí.

**Pregunta básica: ¿qué es el cuaderno virtual?** ¿Un módulo nuevo (bitácora diaria), o algo que ya existe hoy —físico o en Excel— que hay que digitalizar?

Sin eso no se puede diseñar nada.

## D6 · Entrega de turno

**Estado:** SIN LEVANTAR

Preguntas mínimas:
- ¿Qué se entrega entre turnos? ¿Producción pendiente, novedades, estado de las líneas?
- ¿Hay un formato actual?
- ¿Quién entrega y quién recibe?
- ¿Requiere firma o aprobación?
- ¿Bloquea el inicio del turno siguiente?

## D7 · Personal y proveedores por turno

**Estado:** SIN LEVANTAR

El área mencionó "personal, líderes, proveedor por turno". Se relaciona con `CONFIG_TURNO` del MFR y con la afectación del número de personas sobre el cumplimiento.

Preguntas:
- ¿Se registra el personal nominalmente, o solo la cantidad?
- ¿Quién es el "líder" y qué rol cumple?
- ¿El proveedor de personal es el mismo concepto que el `proveedor` de las remisiones?

## D8 · Alertas por desviación

**Estado:** SIN LEVANTAR · **Depende de:** los módulos que generan los datos

El área pidió alertas por desviación **a nivel general y por cada SKU**.

Modelo conceptual:
```text
Evento → Condición → Alerta → Usuario responsable → Acción
```

Preguntas:
- ¿Qué desviaciones hay que vigilar y con qué umbral?
- ¿Cómo se notifica? ¿En pantalla, correo, WhatsApp?
- ¿Quién es responsable de cada tipo de alerta?
- ¿Qué se registra cuando alguien atiende una alerta?

## D9 · Recetas / fichas de armado

**Estado:** PARCIALMENTE ACLARADO

El área pidió "un apartado con la receta para consulta". La hoja `PRODUCTOS` del Excel contiene la configuración de empaque: unidades por caja, cajas por estiba, tipo de proceso. La hoja `TIEMPOS` menciona además una **ficha de armado en PDF**.

**Pregunta: ¿la "receta" es la ficha de armado y empaque (cuántas unidades en una caja, cuántas cajas en una estiba, con qué proceso), o existe además una receta de ingredientes?**

Si es lo primero, buena parte ya está modelada en la tabla `producto` y solo falta la pantalla de consulta más el acceso a las fichas PDF.

---

# PARTE E — Transversales

## E1 · Dashboards y KPIs

**Estado:** BLOQUEADO · **Depende de:** los módulos que generan los datos

El área pidió: producción diaria, producción por operario, por máquina, defectos, reprocesos, cumplimiento, novedades, tiempos, calidad.

**Ningún KPI se implementa sin responder primero:**

1. ¿Qué mide?
2. ¿Por qué lo necesitamos?
3. ¿De dónde sale el dato?
4. ¿Quién lo necesita?
5. ¿Con qué frecuencia se calcula?
6. ¿Cuál es un buen resultado? ¿Cuál es malo?
7. ¿Qué filtros necesita?

Dimensiones probables: fecha operativa, operario, producto, máquina, lote, orden, estado.

**Regla firme: todos los indicadores se agrupan por `fecha_operativa`, nunca por fecha calendario.**

## E2 · Requerimientos técnicos sin definir

Afectan decisiones de arquitectura y conviene resolverlos antes del frontend:

| Pregunta | Qué decide |
|---|---|
| ¿Cuántos usuarios? ¿Cuántos concurrentes? | Dimensionamiento del servidor |
| ¿Desde qué dispositivos? ¿Computador, tablet, celular? | Diseño del frontend |
| ¿Hay zonas de planta sin buena conexión? | Si se necesita funcionamiento offline |
| ¿Se necesita funcionamiento offline? | Cambia la arquitectura del frontend por completo |
| ¿Se necesita tomar fotografías? | Almacenamiento de archivos, patrón de captura |
| ¿Volumen esperado de registros? | Índices, estrategia de archivado |
| ¿Se necesita impresión? ¿Desde dónde? | Formato del PDF |
| ¿Integraciones futuras además de SAP y WMS? | Diseño de los puertos |

## E3 · Despliegue

**Estado:** PENDIENTE

- ¿Dónde se despliega? ¿Servidor propio, nube, on-premise?
- ¿Quién lo administra?
- El `docker-compose.yml` ya existe en `infrastructure/` para PostgreSQL
- Falta: Dockerfile del backend, del frontend, compose de producción
- **Crear un usuario de base de datos con permisos limitados.** En desarrollo se usa el superusuario `postgres`, lo cual está bien localmente pero no en producción
- GitHub Actions: lint, pruebas, build
- Respaldos de base de datos

## E4 · Documentación

Mantener actualizado a medida que se toman decisiones:

```text
docs/
├── architecture.md
├── requirements.md
├── database.md
├── modules/
│   ├── remisiones.md          ya existe
│   └── mfr.md
├── roles-permissions.md
├── workflows.md
└── api.md
```

Y actualizar `CLAUDE.md` cada vez que el área responda una de las preguntas pendientes o se cierre un módulo.

---

# PARTE F — Preguntas al área, por urgencia

## Urgente — bloquean trabajo inmediato

| # | Pregunta | Desbloquea |
|---|---|---|
| 1 | ¿Quién registra la respuesta del OPA: coordinador, patinador o ambos? | B1 (permisos) |
| 2 | ¿`LINEA` y `AUTOMATICA` son el mismo proceso? | B3 (catálogo) |
| 3 | Cuando PRODUCTOS y TIEMPOS se contradicen, ¿cuál manda? | B3 |
| 4 | Códigos duplicados: ¿filas repetidas o variantes distintas? | B3 |
| 5 | ¿Desde qué dispositivos se usará el sistema? | B5 (frontend) |
| 6 | ¿Hay zonas sin conexión? ¿Se necesita offline? | B5 |

## Alta — bloquean el siguiente módulo

| # | Pregunta | Desbloquea |
|---|---|---|
| 7 | ¿La programación de PepsiCo viene en cajas o unidades? | MFR |
| 8 | ¿El MFR cuenta remisiones aprobadas o creadas? | MFR |
| 9 | ¿La línea de producción es física o un armado diario? | MFR |
| 10 | ¿Qué es `LINEA IDEAL`? ¿Personas por línea? | MFR |
| 11 | ¿Cuál es la meta de MFR (95%, 98%)? | MFR, alertas |
| 12 | ¿Qué es el cuaderno virtual? | D5 |
| 13 | ¿El WMS registra el número de remisión de origen? | D3 (inventario) |
| 14 | ¿El inventario de MQ concilia contra el WMS o cubre otro alcance? | D3 |

## Media — mejoran el diseño pero no bloquean

| # | Pregunta |
|---|---|
| 15 | ¿Qué significan PT y PI exactamente? |
| 16 | ¿Qué es `PC` en la hoja TIEMPOS? |
| 17 | ¿Se produce los domingos? ¿Y el lunes entre 06:00 y 08:00? |
| 18 | ¿El vencimiento puede ser anterior a la fecha operativa? (hoy se rechaza) |
| 19 | ¿Se migra el histórico 2026 o se deja como archivo? |
| 20 | ¿`SUBDESCRIPCION` (OFERTA, SURTIDO, REEMPAQUE) debe modelarse? |
| 21 | ¿La "receta" es la ficha de armado, o hay además receta de ingredientes? |
| 22 | ¿Existe acceso a SAP? ¿De quién es el SAP: Inlotrans o PepsiCo? |
| 23 | ¿Planes de trabajo y configuración de turno son lo mismo? |
| 24 | ¿Con qué frecuencia se crean productos nuevos? |
| 25 | Política de contraseñas: ¿complejidad, rotación, bloqueo por intentos fallidos? (hoy solo mínimo 8 caracteres) |
| 26 | ¿Deben quedar auditados los inicios de sesión, exitosos y fallidos? |
| 27 | ¿Los equipos de planta son compartidos entre coordinadores? (afecta si 12 h de sesión es aceptable) |

---

# PARTE G — Orden recomendado

## Bloque 1 — Hacer el sistema usable (2–4 semanas)

```text
1. B1  Autenticación y autorización          LISTO
2. B3  Importación del catálogo (con lo que el área responda)
3. B5  Frontend de Remisiones
4. B2  Pruebas de integración
```

Al terminar: el área puede operar un turno completo sin el Excel.

## Bloque 2 — Reemplazar el Excel por completo

```text
5. B4  PDF de la remisión
6. B7  Exportación a Excel
7. B6  Migración del histórico (si se decide migrar)
```

## Bloque 3 — Segundo módulo

```text
8. MFR, cuando estén respondidas las preguntas 7, 8 y 9
```

En paralelo: levantamiento de Averías, que es el siguiente en importancia según el área.

## Bloque 4 — En adelante

```text
9.  Averías
10. Calidad
11. Inventario / conciliación WMS
12. Planes de trabajo
13. Cuaderno virtual
14. Entrega de turno
15. Alertas por desviación
16. Dashboards
```

## Regla general

**El levantamiento de un módulo va en paralelo al desarrollo del anterior.** No se detiene el código esperando respuestas, ni se escribe código adivinando lo que falta.

---

# PARTE H — Lo que no hay que hacer

Errores concretos que este diseño evita, y que hay que seguir evitando:

1. **No agrupar por fecha calendario.** Siempre `fecha_operativa`. El T3 cruza la medianoche.
2. **No importar Prisma en `src/domain/`.** Ni NestJS, ni nada externo.
3. **No poner reglas de negocio en los DTOs.** Los DTOs validan forma; las reglas van en la entidad, para que se cumplan también en importaciones y scripts.
4. **No abrir transacciones dentro de los repositorios.** Eso es de `UnidadDeTrabajo`.
5. **No tolerar fallos de auditoría.** El área definió que debe estar completa para que el proceso avance.
6. **No borrar remisiones.** Son documentos firmados. Rechazo → rectificación.
7. **No almacenar datos derivados.** `descripcionEstibas`, `consecutivo` y `cruzaMedianoche` se calculan.
8. **No guardar solo la referencia al producto.** El snapshot de código y descripción es intencional.
9. **No asignar el consecutivo fuera de la transacción con bloqueo.** Dos coordinadores simultáneos obtendrían el mismo número.
10. **No modelar por nombre de persona.** El contacto de conciliación es un rol; el nombre es dato de cada registro.
11. **No construir un inventario paralelo al WMS** sin resolver primero el alcance.
12. **No inventar KPIs.** Cada indicador responde las siete preguntas de E1.
13. **No adivinar datos en las importaciones.** Reporte de excepciones y revisión humana.
14. **No dejar credenciales en el código.** Variables de entorno, y `.env` fuera de Git.
