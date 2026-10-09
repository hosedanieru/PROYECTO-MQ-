# Estado por módulo

> Leer cuando se toca o amplía un módulo. Índice en `CLAUDE.md`.
>
> **Origen (recreado el 2026-10-07):** esta carpeta se citaba en `CLAUDE.md` pero nunca llegó a git. La parte
> "Hasta el 2026-10-01" es copia literal del `CLAUDE.md` del commit `af7c694`. La parte "Después del 2026-10-01"
> se reconstruyó del código y de las decisiones guardadas por el usuario; donde no hay fuente se dice. El estado
> del rediseño visual y de los indicadores (ciclos 1 y 2) vive en `CLAUDE.md` §11, "Tarea en curso".

## Cambios posteriores sobre lo de abajo (léase junto con el texto copiado)

- El **rediseño visual del 2026-09-24** (barra lateral, panel de inicio con KPIs) quedó reemplazado por el Ciclo 1
  (2026-10-05/06): navegación arriba, sin tarjetas, banda con escena 3D por módulo; e Inicio solo con avisos y
  accesos (2026-10-06).
- Las **alertas de inventario** y el **indicador del 1 % de averías** ya no son pestañas de su módulo: son tableros
  (`/tableros/alertas-inventario`, `/tableros/averias-limite`) desde el 2026-10-06.
- "La remisión NO registra línea" sigue vigente, pero el usuario decidió **agregarla** (2026-10-05; Ciclo 2, fase 2,
  con bocetos del formulario antes).
- Roles: se sumó `OPA_PEPSICO` (2026-10-05, firma electrónica).
- Pruebas: al 2026-10-07 son **409 unitarias** (`npm test`).

---

## Hasta el 2026-10-01 (copia de `af7c694`)

- Base de datos: 30 tablas (`schema.prisma`), migraciones aplicadas
- Seed idempotente: 23 permisos, 4 roles, 3 turnos con 21 horarios (7 días × 3), 1 lugar, 4 grupos, 9 líneas de producción, 12 causales de avería
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
- **MFR regido por el DPP de PepsiCo** (2026-09-18): bloques por línea y hora (producto, **cajas/hora**, E) con `Mx = cajasPorHora × h`, `T = Mx × E` (decisión 2026-09-19: el ritmo se maneja por hora, no en BPM; al importar el PDF, cajas/h = Mx ÷ horas del bloque, así T queda exacto; el estándar del producto —hoja TIEMPOS— es solo el valor por defecto para bloques a mano y se puede dar al crear el producto); 8 líneas físicas con tipo y capacidad kg/h; importador del PDF del DPP (`pdf-parse`, lector puro en `domain/mfr/dpp-pepsico.ts`), copiar día, corregir con motivo, cerrar turno; tablero con MFR por SKU, turnos (eficiencia planeada/real) y vista horaria en kg (Target/Instant/Capacity/Overpull). Decisiones: cajas; cuenta al aprobar el OPA; meta 95 %; la remisión NO registra línea. Ver `docs/modules/mfr.md`.
- **Tope "ni más ni menos"** (2026-09-18): al crear, editar y aprobar se verifica contra el DPP del día; sin DPP o con SKU fuera del DPP se bloquea; al cerrar el turno, los faltantes exigen motivo. Excepción: remisión extraoficial con motivo
- **Personal del turno** (2026-09-21): grupos (antes proveedores) con personas esperadas, asistencia por turno y grupo, asignación de grupos a líneas con la regla de no asignar más personas de las que llegaron
- **DPP de N días** (área, 2026-09-22: PepsiCo también lo manda semanal, y podría mandarlo mensual): no hay camino "semanal"; el sistema carga **N días** y el diario es N = 1. El día de cada bloque sale de su propia fecha y hora con el corte de las 06:00 (`fechaOperativaDeHoraLocal`), no de la pantalla. Una transacción **por día** (límite de 500 escrituras en Firestore + un turno cerrado no debe frenar la semana); la respuesta dice qué pasó con cada día: CARGADO / OMITIDO / ERROR. Falta verificar con un PDF semanal real
- **Carga de estándares en lote** (2026-09-22): `PUT /mfr/estandares` y pantalla `/admin/pesos` para confirmar de una pasada el peso neto por caja (sin él el tablero no muestra kilos). Una sola transacción con un motivo común; lo que no se envía no se toca. `EstandarRepository.actualizarVarios` es escritura pura por la regla de Firestore (lecturas antes que escrituras)
- **Rediseño visual del frontend** (2026-09-24): barra lateral + barra superior (`app/layout/navegacion.ts` define el menú), panel de inicio con KPIs, flujo de remisiones, líneas en vivo y avisos del día; tema claro/oscuro, textos en español/inglés, fuente Inter, animaciones con `animejs` y gráficas propias en SVG (sin librería de gráficas)
- **Averías — completo** (2026-09-28), solo PT:
  - Dominio `domain/averia/`: causales (catálogo en BD, 12 sembradas, sin valor por defecto); registro (3 fotos obligatorias UNIDAD / LOTE_FECHA / CONJUNTO, cantidad entera > 0, lote obligatorio, copia congelada del producto; **sin línea**: el área la descartó el 2026-09-28 porque las cajas averiadas a veces llegan sin saber de qué línea vienen, columna eliminada en `20260928190000_averia_sin_linea`); reporte (REGISTRADO → ANULADO con motivo, nunca se borra; máx. 30 registros, límite técnico); conversión Docena = 12, Six = 6, Bolsa `PENDIENTE DE DEFINIR` (se registra pero no suma); el total se calcula, no se guarda.
  - Fecha, hora y **turno automáticos** (servidor: `registroActual` + `turnoDeHora(horaLocalDe(ahora))`); quien reporta sale del token (con copia del nombre); "Operador MQ" = grupo.
  - Fotos: puerto `AlmacenDeEvidencias` (`ALMACEN_DE_EVIDENCIAS`), hoy `AlmacenEvidenciasDisco` en `EVIDENCIAS_DIR` (por defecto `backend/evidencias/`, fuera de git), independiente de `PERSISTENCIA`. Se guardan antes de la transacción y se borran si falla. El navegador las comprime (≤1600 px, JPEG). La respuesta nunca expone rutas; la foto se pide por reporte/registro/tipo.
  - Permisos: `averia.reportar`, `averia.consultar`, `averia.corregir` (corregir registro sin tocar fotos, anular con motivo). **Por ahora solo el administrador** (usuario, 2026-09-29: los roles se reparten al final).
  - Tablas `causal_averia`, `reporte_averia`, `registro_averia`, `evidencia_averia`; Firestore `causalesAveria`, `reportesAveria` (registros embebidos).
  - Pantallas: `/averias` (listado con filtros en la URL), `/averias/nuevo` (formulario para celular, cámara directa), `/averias/:id` (detalle con fotos, corregir/anular), `/admin/causales`.
  - **Indicador** (`domain/averia/indicador-averias.ts`, función pura): % = unidades averiadas (reportes vigentes) ÷ (Σ T del DPP × unidades por caja), sumando los días del periodo. **Máximo 1 % por contrato con PepsiCo** (`MAXIMO_AVERIAS_PORCENTAJE`); pasarlo genera alertas (por día y por periodo) que se ven en `/averias` y en los avisos del panel de inicio. Por día, turno, grupo (aporte de cada grupo al % sobre el mismo DPP) y SKU. Todas las averías cuentan; las de un producto que no estaba en el DPP **del día de la avería** se marcan aparte. El T sale de `calcularBloque` del MFR (no se duplica)
- **Inventario — fase 1** (2026-09-29; regla del usuario: primero trazabilidad y control, los indicadores al final):
  - **Kardex**: cada ENTRADA, SALIDA o AJUSTE queda con quién, fecha/hora, día operativo y turno (automáticos, `application/shared/momento-operativo.ts`, compartido con Averías) y el saldo que dejó. Nunca se borra; un error se corrige con AJUSTE con motivo.
  - **Una tabla por tipo** (usuario, 2026-09-29; migración `20260929180000_pi_insumo_unidades`): `producto` (el PT; **en pantalla se llama "PT"**, por dentro la tabla y el código siguen diciendo `producto`), `pi` e `insumo`. Cada uno tiene su catálogo; `item_inventario` es solo el **eje de existencias**: apunta a exactamente uno de los tres (`producto_id` / `pi_id` / `insumo_id`, CHECK `item_inventario_una_referencia`) y guarda la existencia. Código, descripción, unidad y activo se leen del catálogo (no se duplican). El código es único entre PI e insumo. Crear un PT, PI o insumo crea su ítem en la misma transacción. Sin lote (usuario: no relevante).
  - **Unidades de medida** (`unidad_medida`): lista desplegable que mantiene el administrador (sembrada: `UNIDAD`). PI e insumo tienen su **medida** (`unidadBase`: en qué se lleva la existencia y en qué se descuenta, ej. METRO), una **presentación opcional con su contenido** (`presentacion` + `contenidoPresentacion`: ROLLO con 50 METRO; van juntas, CHECK en la base) y escalones enteros opcionales **estiba → caja → presentación** (`cajasPorEstiba`, `unidadesPorCaja` = presentaciones por caja, o medidas si no hay presentación). El PT se cuenta en `CAJA`.
  - **Decimales** (usuario, 2026-09-29, revierte "todo en enteros" del mismo día: un rollo no se gasta por caja y varía por producto): existencias, cantidades y saldos de PI e insumos con **hasta 3 decimales** (`Decimal(14,3)`; regla única en `domain/inventario/cantidad.ts`, que también redondea las sumas para quitar el ruido de coma flotante). El **PT sigue en cajas enteras**. Migración `20260929210000_inventario_decimales`.
  - **Sin existencia negativa** (regla del usuario). `item_inventario.existencia` se guarda (excepción consciente a "lo derivado se calcula"): es la fila que se bloquea con `SELECT … FOR UPDATE` para que dos salidas simultáneas no saquen la misma existencia (probado en `test/inventario.e2e-spec.ts`), y en Firestore sumar el kardex crecería sin límite. Cuadra con Σ movimientos.
  - **Entrada de mercancía** (2026-09-29): lo que llega en un mismo documento = encabezado (`entrada_mercancia`: documento de soporte obligatorio, quién entrega, observación; fecha/hora/turno/quién recibe automáticos) + líneas, que son los movimientos ENTRADA con `entradaId` (no se duplican). Todo o nada. Recibe INSUMOS y PI (el PT se produce, no llega de afuera); máx. 50 líneas (límite técnico). Los ítems se bloquean en orden de id (evita deadlock). PI = lo que llega de PepsiCo para reempaque (usuario, 2026-09-29).
  - Permisos: `inventario.consultar`, `inventario.registrar`, `inventario.ajustar`, `inventario.catalogo`. **Por ahora solo el administrador** (usuario, 2026-09-29: los roles se reparten al final; lo mismo para averías). Entradas/salidas y ajustes van por rutas distintas.
  - **Productos e inventario son UN SOLO MÓDULO** (usuario, 2026-09-29): en el menú hay una sola entrada **Inventario** con pestañas (`InventarioLayout`): Existencias · Entradas de mercancía · PT · PI · Insumos · Unidades. Se fusionó lo que ve el usuario, **no las tablas**: `producto` sigue aparte porque remisiones, DPP, tope y averías solo aceptan PT. **Crear un producto crea su ítem de PT** en la misma transacción (`CrearProductoUseCase`), y el PT toma código, descripción y **activo** de su producto (se activa/desactiva desde Productos; nunca se desincronizan). Los productos existentes recibieron su PT con la migración `20260929160000_pt_de_productos_existentes` (Firestore: `seed:firestore`).
  - Pantallas: `/inventario` (existencias por tipo, registrar movimiento; el ajuste se pide como "existencia física contada"), `/inventario/:id` (kardex, con enlace a la entrada de origen), `/inventario/entradas` (listado, `/nueva` formulario, `/:id` detalle), `/inventario/pt` (antes `/admin/productos`), `/inventario/pi`, `/inventario/insumos`, `/inventario/unidades`. Las rutas viejas redirigen.
  - **Fases acordadas** (usuario, 2026-09-29): A) tablas por tipo + unidades + "PT" en pantalla — **hecha**; B) conteo mixto — **hecha** (ver abajo); C) receta por PT — **hecha**; D) alertas — **hecha** (ver abajo).
  - **Receta del PT** (fase C, 2026-09-29; migración `20260929194000_receta_pt`, tablas `receta` + `receta_componente`, Firestore `recetas/{productoId}_v{n}` con componentes embebidos): lista de PI e insumos existentes y activos, cada uno con la **cantidad exacta que gasta UNA caja**, en la medida del componente y con decimales ("1,8 METRO por caja"; se quitó "por N cajas"). Decisiones del usuario: **versionada** (cada guardado crea la versión siguiente con fecha y autor, nunca edita encima; la vigente es la de número más alto; motivo: el consumo teórico de una remisión pasada usa la receta que regía), **botón "Receta" aparte** en la lista de PT, y **obligatoria para PT nuevos** (`CrearProductoUseCase` crea la versión 1 en la misma transacción). Los PT que ya existían quedan "Sin receta" hasta digitarla. El componente apunta al **ítem de inventario** (para leer existencia en las alertas); la receta guarda solo referencia + equivalencia y el caso de uso completa código/descripción. Unicidad de versión: `@@unique(productoId, version)` en Postgres; id determinista + `crearNuevo` (create que falla si existe) en Firestore. Consecuencia: `npm run importar:tiempos` ya **no crea** PT nuevos (la hoja no trae receta): los reporta como excepción.
  - **Consumo al aprobar la remisión** (usuario, 2026-09-29; migración `20260929220000_consumo_por_remision`): `AprobarRemisionUseCase` descuenta **cajas × receta vigente** en la MISMA transacción que la aprobación (o quedan los dos, o ninguno). Una SALIDA por componente en el kardex con `remisionId`, referencia "Remisión AAAA-NNNN" y la versión de receta en la observación; también las **extraoficiales**. **Se bloquea la aprobación (409)** si el PT no tiene receta (`INVENTARIO_PT_SIN_RECETA`) o si algún componente no alcanza (`INVENTARIO_CONSUMO_INSUFICIENTE`, lista todos los faltantes): se mantiene "sin existencia negativa". Reglas puras en `domain/inventario/consumo.ts`; lecturas (`prepararConsumo`, en el paso `antes`) y escrituras (`registrarConsumo`, en `despues`) separadas en `application/inventario/consumo-remision.ts` por la regla de Firestore. El turno del movimiento sale de `momentoOperativo` (por eso Aprobar recibe `HORARIO_REPOSITORY`). **Consecuencia operativa elegida por el usuario: ningún PT sin receta se puede aprobar.**
  - **Conteo mixto (fase B, 2026-09-29; migración `20260929230000_conteo_mixto`)**: PI e insumos se digitan **como vienen** —estibas + cajas + presentaciones (rollos) + medida suelta— y el backend convierte a la medida con las equivalencias del ítem (`domain/inventario/conteo.ts`: 1 estiba = cajasPorEstiba cajas; 1 caja = unidadesPorCaja presentaciones; 1 presentación = contenidoPresentacion medidas). Escalones en enteros, lo suelto con 3 decimales; solo se usa un escalón definido. Aplica a entradas de mercancía (`lineas[].conteo`), entradas/salidas (`conteo`) y **ajustes** (el conteo es lo CONTADO físicamente; el ajuste = contado − existencia). El kardex guarda `conteo_texto` ("10 ROLLO (1 ROLLO = 50 METRO)"; en ajustes "Conteo físico: …") como copia de lo digitado y la equivalencia usada. `ItemInventario.equivalencias` (null en el PT, que sigue en cajas y no admite conteo). Pantalla: `CampoConteo` muestra solo los campos del ítem y el total en vivo (espejo en `modules/inventario/conteo.ts`).
  - **Alertas (fase D, 2026-09-30)**: `GET /api/inventario/alertas?fecha=` calcula en el momento (no se guardan; regla pura `domain/inventario/alertas-inventario.ts`): **PT_SIN_RECETA** (crítica si el PT tiene cajas pendientes en el DPP del día: no se podrá aprobar), **COMPONENTE_INACTIVO** (receta vigente con PI/insumo desactivado), **AGOTADO** (PI/insumo activo en 0; crítico si una receta lo usa) y **NO_ALCANZA_DPP** (lo que falta producir hoy = Σ T del DPP − aprobadas oficiales, × receta vigente, contra la existencia; dice cuánto falta). Lo aprobado se resta porque ya descontó su consumo; las extraoficiales no restan del DPP. Si un ítem "no alcanza" no se repite como agotado. `RecetaRepository.vigentes()` trae las vigentes con componentes. Pantallas: pestaña **Alertas** (`/inventario/alertas?fecha=`) y un aviso por tipo en el panel de inicio (se refrescan cada 30 s). Sin umbrales de "stock bajo": el área no los ha definido (`PENDIENTE DE DEFINIR` si se quieren mínimos).
  - `PENDIENTE DE DEFINIR` con el equipo: **reúso** de bolsas de PT averiadas (solo administrador cuando se implemente); equivalencia de la Bolsa (depende del PT al que pertenece).
  - Pendiente con el área (ROADMAP D3): conteo físico, de quién son los insumos, WMS con número de remisión
- 333 pruebas unitarias sin base de datos (`npm test`) + 18 de integración contra PostgreSQL (`npm run test:e2e`, base `mq_test`) + 5 contra Firestore (`npm run test:firestore`)
- Despliegue: Dockerfiles, `infrastructure/docker-compose.yml`, usuario de BD limitado (`database/`), CI en GitHub Actions
- Documentación en `docs/` (arquitectura, base de datos, roles, flujos, API, despliegue, módulos, preguntas abiertas)

---

## Después del 2026-10-01 (reconstruido el 2026-10-07)

Fuentes: decisiones guardadas por el usuario (memoria del proyecto) y el código. El detalle fino de diseño de estas
fases estaba solo en los archivos perdidos; lo que no se pudo confirmar queda señalado.

### Inventario — cierre del día y merma (2026-10-01)

Decisiones del usuario: **conteo físico al cierre del día operativo** (no despacho a línea); consumo real = inicial
+ entradas − contado; **solo los PI e insumos que usan las recetas vigentes**; lo **en tránsito** (remisiones
producidas sin aprobar: BORRADOR, ENTREGADA, RECHAZADA, EN_RECTIFICACION × receta vigente) se descuenta para que no
parezca merma. Diseño: merma = (sistema − en tránsito) − contado; el ajuste deja la existencia en contado + en
tránsito; un cierre por día, todos los materiales de la lista obligatorios, guardado como documento con líneas; %
merma contra el consumo teórico desde el cierre anterior. Código: `domain/inventario/cierre-inventario.ts`,
`application/inventario/cierre-inventario.use-cases.ts`; endpoints `GET /inventario/cierres/preparar`,
`POST /inventario/cierres`, `GET /inventario/cierres`; pantalla `CierrePage`. Indicadores de merma: al final.

### Calidad (D2) — en levantamiento (2026-10-02)

Se inspecciona PT y rotulado; muestreo por tabla o norma (tipo NTC-ISO 2859, falta la tabla exacta); rol nuevo de
calidad. `PENDIENTE DE DEFINIR`: si bloquea la entrega de la remisión, tipos de defecto, criterios, fotos, no
conformidades. **No hay código.**

### Remisiones por correo — fase 1 (2026-10-03)

Imprimir se cambia por **enviar por correo** (se seleccionan y se envían). Fase 1: envío manual + **listas de
distribución administradas en el panel** (PepsiCo = correos en una lista, no usuarios) + registro de envíos
(ENVIADO / FALLIDO); sin `CORREO_HOST` se guarda un `.eml`. Envío por el buzón corporativo por SMTP (TI debe
entregar la cuenta). "Ver PDF" quedó como botón secundario. Código: `domain/correo/`, `application/correo/`,
`infrastructure/correo/enviador-nodemailer.ts`; pantalla `CorreosPage`, `EnviarCorreoDialogo`.
Fase 2b (cola): envío automático al cerrar el turno (resumen a listas internas + aprobadas a quien las recibe),
reenviar, y el envío nunca deshace el cierre (fuera de la transacción, FALLIDO + reintento).

### Resumen del turno y del día — fase 2a (2026-10-03)

Al cerrar el turno se guarda una foto y se genera un PDF: Producción/MFR + remisiones, Personal, Averías +
inventario y **Novedades** (obligatorias, las escribe el coordinador al cerrar). Uno por turno y uno del día (al
cerrar el T3). PDF sin logo, identificado con código de formato del SIG + consecutivo propio (RT-AAAA-NNNN turno,
RD-AAAA-NNNN día); el código SIG aún no existe → va en `.env` y el PDF dice "pendiente de aprobación SIG". Un turno
**sin DPP no se cierra** ni tiene resumen. Cada lista de correo dice qué recibe. Código: `domain/resumen/`,
`application/resumen/armar-resumen.ts`, `infrastructure/pdf/plantilla-resumen.ts`; endpoints `/resumenes`.
Fase 2c (cola): cierre automático del turno a su hora.

### Firma electrónica de remisiones — fases 1 a 3 (2026-10-03 a 2026-10-05), en piloto

Todo dentro del aplicativo, **sin correos**; se firman todas las casillas del formato y las firmas van **dentro del
PDF**. **Contraseña en cada firma** (el computador de MQ es compartido). Huella SHA-256 de la versión firmada;
rectificar = nueva versión y firmar de nuevo; nada se borra; auditado. Orden exigido: el OPA solo firma cuando el
verificador ya firmó el conteo. Textos de declaración: borrador `PENDIENTE DE VALIDAR` con el área y PepsiCo.
- Fase 1: casillas INLOTRANS y VERIFICADOR con la remisión ENTREGADA; PDF con trazo + constancia + "PILOTO".
- Fase 2: rol **`OPA_PEPSICO`** (remision.consultar, registrar_aprobacion, firmar_recepcion, catalogo.consultar);
  "Aprobar y firmar" en la casilla RECIBE, en la misma transacción que la aprobación y el consumo de inventario.
- Fase 3: casilla VALIDACION al validar ("Validar y firmar"). Interruptor único `FIRMA_ELECTRONICA_PILOTO`: con
  `false` las firmas son obligatorias (409 `FIRMAS_INCOMPLETAS`).
- Aval de PepsiCo y del área legal: desconocido → piloto. `PENDIENTE DE DEFINIR`: si una persona puede firmar dos
  casillas de la misma remisión (hoy se permite).
- Código: `domain/remision/firma-remision.ts`, `application/remision/firma-remision.use-cases.ts`; endpoints
  `/remisiones/:id/firmas`, `aprobar-firmando`, `validar-firmando`; pantallas `FirmasRemision`, `PanelFirma`.

### Rediseño visual (Ciclo 1, cerrado 2026-10-06) e indicadores (Ciclo 2, desde 2026-10-06)

Ver `CLAUDE.md` §11. En corto: navegación arriba, sin tarjetas, escenas 3D por módulo; indicadores FR, OTIF,
averías vs fabricado, ranking de PT, ritmo y productividad (`/mfr/indicadores`, `/mfr/ritmo`); un tablero por
indicador en `/tableros/*`; gráficas y escenas con Motion (2026-10-07).

## Catálogos sembrados (copia de `af7c694`, con el rol nuevo)

- **Roles:** `ADMINISTRADOR`, `COORDINADOR_MQ`, `PATINADOR`, `CONSULTA`, `OPA_PEPSICO` (este último desde el 2026-10-05)
- **Grupos** (antes "proveedores"; renombrados el 2026-09-21 sin excepción, el proveedor real se escribe a mano en `descripcion`): LOGICMARD, MAXISERVICE, APOYOS MAXI, MIX. Cada grupo tiene `personasEsperadas` (personas que debe enviar por turno). En la programación se registra, por turno y grupo, cuántas llegaron (`asistencia_turno`); el tablero marca el personal como A_FIN / AFECTADA con **dos comparaciones** (usuario, 2026-09-30; antes era solo contra el grupo): **contra lo que pide el DPP** (Σ por línea del **máximo** de personas de sus bloques en el turno; cobertura % = llegaron ÷ requeridas, base del indicador de afectación) **y** contra las esperadas de cada grupo; basta que falle una para AFECTADA. El tablero trae también el personal del día (solo turnos ya registrados). Los grupos se asignan a líneas por día y turno con número de personas (`asignacion_linea`; CUBIERTA / INCOMPLETA contra la línea ideal) y **nunca más personas de las que llegaron** (asistencia primero; 409 si excede o si la asistencia baja de lo asignado). El coordinador tiene `catalogo.editar` para gestionar grupos. Ver `docs/modules/mfr.md`.
- **Lugar:** MAQUILA PEPSICO SANTO DOMINGO
- **Líneas de producción:** las 9 plataformas del DPP (L1–L4 MULTIPACK 306 kg/h; **L5 MANUAL 306 kg/h**, agregada el 2026-09-22 al aparecer en el DPP semanal; MANUAL-1/2 249 kg/h; REEMPAQU-2 y REEMPAQUES 203 kg/h). `PENDIENTE DE CONFIRMAR`: L5 es MANUAL pero con la capacidad de una MULTIPACK

---
