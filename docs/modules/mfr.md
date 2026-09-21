# Módulo MFR — Manufacturing Fill Rate (regido por el DPP de PepsiCo)

**Estado: implementado (2026-09-18)**. El MFR y las líneas siguen el estándar del **DPP de PepsiCo** ("SCHEDULE WM OMEGA", reporte GDPP508P): el schedule diario por línea y bloque horario. Reemplaza el diseño del 2026-09-17 (programación por SKU + configuración de turno).

## Decisiones del área

| Fecha | Pregunta | Respuesta | Dónde se aplica |
|---|---|---|---|
| 2026-09-17 | ¿Cajas o unidades? | **Cajas**; los kilos se derivan | `targetCajas`, `pesoNetoKg` |
| 2026-09-17 | ¿Cuándo cuenta una remisión? | **Al ser aprobada por el OPA** (APROBADA o VALIDADA) | `ESTADOS_QUE_CUENTAN` |
| 2026-09-17 | Meta de MFR | **95 %** | `META_MFR_PORCENTAJE`; verde ≥ 95, amarillo ≥ 85, rojo < 85 |
| 2026-09-18 | ¿Qué es una línea? | **Activo físico** (las plataformas del DPP) | Catálogo `linea_produccion` con tipo y capacidad |
| 2026-09-18 | Turnos | **Los del DPP**: T1 06:00–13:30, T2 14:00–21:30, T3 22:00–05:30, todos los días | `datos-base.ts` → `turno_horario` |
| 2026-09-18 | ¿La remisión registra línea? | **No** | La producción real se conoce por turno y SKU |
| 2026-09-18 | ¿Cómo entra la programación? | **Manual + importar el PDF** + copiar otro día | `/mfr/programacion` |
| 2026-09-18 | ¿Kilos y Loop? | **Sí** kilos (Target/Instant/Capacity/Overpull); Loop solo texto | Vista horaria; `bloque.loop` |

## El estándar del DPP

Cada página del schedule es una plataforma; cada fila de "Bar Details" es un **bloque**:

```text
L1  MULTIPACK  06:00 AM–01:30 PM  271350PQJ02-66770 SURT MG LNC 586GX4X1 BX22
    Trgt: 979  Loop: LOOP1  Max: 1,125  Efncy: 0.87      (BPM: 10.00 en la franja horaria)
```

Fórmulas, verificadas contra los 20 bloques del DPP del 2026-09-16 (todos cuadran):

```text
cajasPorHora  = Mx ÷ horas del bloque   (= BPM ÷ unidadesPorCaja × 60; el PDF trae BPM, se convierte)
Mx (Max)      = cajasPorHora × horas                         cajas al 100 %
T  (Trgt)     = Mx × E                                       cajas esperadas (E = Efncy)
Instant kg/h  = Mx × pesoNetoKg ÷ horas                      fila "Instant Kilograms"
Target  kg/h  = T  × pesoNetoKg ÷ horas                      fila "Target Kilograms"
Capacity      = capacidad nominal de la línea (kg/h)          306 MULTIPACK · 249 MANUAL · 203 REEMPAQUE
Pct Overpull  = Instant ÷ Capacity
```

Cruces con el catálogo de Inlotrans:

- **Línea**: por nombre o código sin espacios ni guiones (`MANUAL 1` ≡ `MANUAL-1`).
- **Producto**: los 5 últimos dígitos del código PepsiCo (`…-66770`) son los 5 últimos del SKU (`300066770`).
- **Ritmo (cajas/hora)**: decisión del área (2026-09-19): se maneja por hora, no en BPM. Al importar, cada bloque toma `Mx ÷ horas` del propio PDF (reproduce Mx y T exactos sin depender del catálogo). El `cajasPorHora` del producto (columna CAJAS POR HORA de la hoja TIEMPOS) es el **valor por defecto** al armar bloques a mano; si difiere del PDF, la propuesta lo señala como informativo.
- **Peso neto por caja**: lo mantiene el administrador; el sistema lo **sugiere** desde la descripción (`586GX4X1` → 0,586 × 4 = 2,344 kg; `MRGPLL5X1BX12X25GGTX2X25G` → 5 × (12×25 + 2×25) g = 1,75 kg).
- **Personas (LINEA IDEAL de la hoja TIEMPOS)**: `producto.personasIdeal` = personas necesarias en la línea para sacar la producción de ese SKU (área, 2026-09-19). Si un bloque no trae `personasAsignadas`, se toman las del producto; el turno las suma.
- **Familia (SUBDESCRIPCION)**: `producto.subdescripcion` (SURTIDO, OFERTA, REEMPAQUE, MULTIPACK, OFERTA C MAYOR…). Agrupa el **"Flavor Breakdown"** del DPP: kg target por hora por familia (`calcularFamiliasHorarias`; `familias` en el tablero). Los productos sin familia van a "SIN FAMILIA".
- **PC** de la hoja TIEMPOS: se ignora (área, 2026-09-19).

## Indicadores

| Indicador | Fórmula | Responde |
|---|---|---|
| **MFR del día** | producido / Σ T por SKU | ¿Cumplimos lo que PepsiCo programó? |
| **Turno — cumplimiento** | producido del turno / Σ T del turno | Semáforo del turno |
| **Turno — eficiencia planeada** | Σ T / Σ Mx (la E del DPP) | Lo que PepsiCo espera |
| **Turno — eficiencia real** | producido / Σ Mx | Lo que realmente rindió |
| **Línea** | horas, Mx, T, kg planeados | Sin producción real (la remisión no registra línea) |
| **Vista horaria** | Target / Instant / Capacity / Overpull por línea y hora | Las filas de kilos del DPP |

Regla del MFR total: cada SKU aporta como máximo lo programado (producir de más en un SKU no compensa faltar en otro). Lo producido sin programación se muestra aparte.

## "Ni más ni menos": las remisiones contra el DPP (área, 2026-09-18)

Lo remisionado de un SKU en un día debe ser exactamente lo que el DPP programó (Σ T de sus bloques, todas las líneas y turnos).

| Regla | Cómo se aplica | Error |
|---|---|---|
| **Ni más** | Al **crear**, **editar** y **aprobar** una remisión: `aprobadas del SKU en el día + esta remisión ≤ programado`. Solo cuentan APROBADAS y VALIDADAS (por eso también se verifica al aprobar). Se verifica dentro de la transacción, antes de consumir el consecutivo. | 409 `REMISION_EXCEDE_PROGRAMACION` (dice programado, aprobadas y sobrante) |
| **Sin DPP cargado** | Se bloquea la remisión (decisión del área). | 409 `REMISION_SIN_PROGRAMACION` |
| **SKU fuera del DPP** | Se bloquea. | 409 `REMISION_PRODUCTO_NO_PROGRAMADO` |
| **Ni menos** | No se puede impedir; al **cerrar el turno** con SKU por debajo de su target el cierre exige `motivoFaltante`, que queda auditado junto con la lista de faltantes. | 400 `MFR_FALTANTE_SIN_MOTIVO` con `faltantes[]` |
| **Excepción: extraoficial** | Pedido de emergencia por fuera del schedule. La remisión lleva `extraoficial: true` + `motivoExtraoficial` (obligatorio, ≥ 5). No entra en el tope ni en el MFR; el tablero la muestra aparte ("Pedidos de emergencia"); el PDF es idéntico (decisión del área); en el listado lleva una etiqueta. | — |

Código: `domain/remision/tope-programacion.ts` (regla pura), `application/remision/control-programacion.ts` (arma la situación: bloques + estándares + remisiones aprobadas), usado por `crear-remision`, `editar-remision` y `AprobarRemisionUseCase` (`antes` de la transición). `faltantesDelTurno` en `calculo-mfr.ts`; `CerrarTurnoUseCase` lo aplica.

## Importar la hoja TIEMPOS del Excel

```powershell
cd backend
npm run importar:tiempos -- "<ruta del .xlsx>"                       # simula: no escribe, genera el reporte
npm run importar:tiempos -- "<ruta>" --aplicar                        # aplica (auditado como ADMIN_INICIAL_DOCUMENTO o --usuario <documento>)
npm run importar:tiempos -- "<ruta>" --aplicar --con-peso-sugerido    # además carga el peso deducido de la descripción (solo en vacíos)
```

Lee ITEM, DESCRIPCION, PROCESO, UNIDADES X CAJA, CAJAS X ESTIBA, CAJAS POR HORA (o productividad × cajas/estiba si la fórmula no trae resultado), LINEA IDEAL y SUBDESCRIPCION. Crea los productos nuevos y actualiza los existentes a través de los casos de uso (misma validación y auditoría que el panel; los estándares con motivo "Importación hoja TIEMPOS"). Idempotente. Escribe `backend/informes/importacion-tiempos-<fecha>.md` con creados, actualizados (campo a campo), excepciones y pesos sugeridos.

Excepciones que reporta y **no resuelve** (regla del proyecto): código repetido con datos distintos (se omite), fila sin código, proceso no reconocido (`AUTOMATICO` se acepta como `AUTOMATICA`), sin cajas/hora, `LINEA IDEAL` en 0, y descripción cuyo "…NX1" contradice las unidades por caja (no se propone peso). Código: `infrastructure/importacion/hoja-tiempos.ts` (lector puro, probado) e `importar-tiempos.ts` (script; corre sobre `dist/` porque NestJS necesita metadatos que `tsx` no emite).

Estado 2026-09-19: el catálogo se completó a mano en el panel; la simulación contra la hoja deja 13 diferencias que son decisiones del área (familias, cajas/estiba) y 3 códigos repetidos en la hoja (`300034223`/`300034224` comparten código con los "DUOS", `300064890` con línea ideal 9 vs 10). No se aplicó.

## Personal del turno: grupos y asistencia (área, 2026-09-21)

Los antiguos "proveedores" pasaron a llamarse **grupos** en todo el sistema. Cada grupo tiene `personasEsperadas` (número fijo de personas que debería enviar por turno) y una `descripcion` donde se escribe a mano a qué proveedor corresponde. Ambos los edita el administrador en `/admin/grupos`.

En la programación del día, por turno, el coordinador registra cuántas personas de cada grupo **llegaron** (varios grupos por turno). El sistema compara **solo contra las personas esperadas del grupo**:

- `A_FIN`: todos los grupos registrados llegaron con las esperadas o más;
- `AFECTADA`: al menos un grupo llegó por debajo (llegar de más en otro grupo no compensa);
- `SIN_DATO`: nada registrado, o el grupo no tiene esperadas definidas (se registra pero no se compara).

La "línea ideal" del DPP (`personasIdeal` del producto → `personasAsignadas` del bloque) se muestra como referencia (`requeridasDpp` = Σ por línea del máximo del turno) pero **no decide** el estado. Registrar de nuevo el mismo (fecha, turno, grupo) corrige el valor y se audita con el anterior.

### Grupos por línea (área, 2026-09-21, opción B)

Además de la asistencia, por día y turno el coordinador **asigna grupos a líneas con un número de personas** (`asignacion_linea`, única por fecha+turno+línea+grupo). Un grupo puede repartirse entre líneas y una línea tener varios grupos. Aquí sí se compara contra la línea ideal del DPP, porque ya se sabe cuántas personas hay en cada línea:

- `CUBIERTA`: Σ personas asignadas ≥ línea ideal (máximo `personasAsignadas` de los bloques de esa línea en el turno);
- `INCOMPLETA`: faltan personas (se muestra cuántas);
- `SIN_DATO`: nadie asignado, o el DPP no trae línea ideal para esa línea.

Cada grupo muestra además cuántas personas tiene "en líneas" frente a las que llegaron; si asigna más de las que llegaron se resalta (aviso, no bloqueo). Se decidió no ligar la asignación al bloque (SKU) sino a la línea y turno, para que cuadre con la asistencia, que también es por turno.

## Gobierno

1. **Motivo obligatorio** al corregir o eliminar un bloque existente; se audita con valor anterior y nuevo.
2. **Cerrar turno** (`POST /mfr/turno/cerrar`): congela sus bloques; después no se editan ni eliminan (409 `MFR_TURNO_CERRADO`). Irreversible.
3. **Reemplazar un día** (importar o copiar sobre un día con bloques): exige `reemplazar: true` + motivo; falla si hay bloques cerrados.
4. **Sin solapamientos** en la misma línea (409 `MFR_BLOQUES_SOLAPADOS`); el bloque debe caber en el día operativo 06:00→06:00.
5. **Estándares** (`cajas_por_hora`, `peso_neto_kg` en `producto`): se pueden dar **al crear** el producto (valor inicial, sin motivo); después solo `catalogo.editar_estandares` (administrador), siempre con motivo.
6. El **turno** de un bloque lo deriva el sistema de su hora de inicio (último turno que arranca en o antes de esa hora; la pausa 13:30–14:00 queda con el turno anterior).

## Modelo de datos

| Tabla / colección | Campos clave | Notas |
|---|---|---|
| `linea_produccion` / `lineasProduccion` | `codigo`, `nombre` (como PepsiCo), `tipo` MULTIPACK·MANUAL, `capacidad_kg_hora`, `orden`, `activo` | 8 líneas sembradas: L1–L4, MANUAL-1, MANUAL-2, REEMPAQU-2, REEMPAQUES |
| `bloque_programacion` / `bloquesProgramacion` | `fecha_operativa`, `linea_id`, `turno_id` (derivado), `producto_id`, `hora_inicio`, `hora_fin`, `cajas_por_hora`, `eficiencia_porcentaje` (1–100), `loop`, `personas_asignadas`, `origen` MANUAL·DPP·COPIA, `creado_por_id`, `cerrado_en`, `cerrado_por_id` | Id aleatorio; la regla de no solapamiento la aplica el caso de uso en la transacción |
| `producto` | `cajas_por_hora` (Decimal 8,2), `peso_neto_kg` (Decimal 8,3), `personas_ideal` (Int), `subdescripcion` (texto ≤ 40, en mayúsculas) | Estándar y datos de la hoja TIEMPOS |
| `grupo` / `grupos` | `codigo`, `nombre`, `descripcion`, `personas_esperadas`, `activo` | Antes `proveedor`; `remision.grupo_id` |
| `asistencia_turno` / `asistenciasTurno` | `fecha_operativa`, `turno_id`, `grupo_id`, `personas_llegaron`, `observacion`, `registrada_por_id`, `fecha_registro` | Única por (fecha, turno, grupo); en Firestore el id es `{fecha}_{turno}_{grupo}` |
| `asignacion_linea` / `asignacionesLinea` | `fecha_operativa`, `turno_id`, `linea_id`, `grupo_id`, `personas`, `registrada_por_id`, `fecha_registro` | Única por (fecha, turno, línea, grupo); en Firestore el id es `{fecha}_{turno}_{linea}_{grupo}` |

Migraciones Prisma: `20260918140000_mfr_bloques_dpp_pepsico` (elimina `programacion` y `config_turno`), `20260918160000_remision_extraoficial`, `20260919090000_cajas_por_hora` (renombra `bpm` → `cajas_por_hora`), `20260921090000_proveedor_a_grupo`, `20260921100000_asistencia_turno`, `20260921120000_asignacion_linea`. En Firestore, las colecciones `programaciones` y `configTurnos` quedaron sin uso (2 + 2 documentos de prueba, borrables desde la consola).

## API

| Método y ruta | Permiso | Qué hace |
|---|---|---|
| `GET /mfr/dia?fecha=` | `mfr.consultar` | Tablero: bloques calculados, MFR, turnos, líneas, vista horaria, advertencias |
| `GET /mfr/bloques?fecha=` | `mfr.consultar` | Bloques del día con Mx/T/kg |
| `PUT /mfr/bloques` | `mfr.cargar_programacion` | Crea (sin `id`) o corrige (`id` + `motivo`) |
| `DELETE /mfr/bloques/:id` | `mfr.cargar_programacion` | `{ motivo }` |
| `POST /mfr/bloques/dia` | `mfr.cargar_programacion` | Carga un día completo (`origen`, `reemplazar`, `motivo`) |
| `POST /mfr/bloques/copiar` | `mfr.cargar_programacion` | `{ desde, hacia, reemplazar, motivo }` |
| `POST /mfr/dpp/analizar` (multipart `archivo`) | `mfr.cargar_programacion` | PDF → propuesta cruzada con el catálogo; no escribe |
| `POST /mfr/turno/cerrar` | `mfr.configurar_turno` | `{ fechaOperativa, turnoId, motivoFaltante? }` (400 `MFR_FALTANTE_SIN_MOTIVO` con `faltantes` si hay SKU bajo target) |
| `GET /mfr/asistencia?fecha=` | `mfr.consultar` | Asistencia registrada del día (turno, grupo, personas) |
| `PUT /mfr/asistencia` | `mfr.configurar_turno` | `{ fechaOperativa, turnoId, grupoId, personasLlegaron, observacion? }`; crea o corrige |
| `GET /mfr/asignaciones?fecha=` | `mfr.consultar` | Grupos asignados a líneas por turno |
| `PUT /mfr/asignaciones` · `DELETE /mfr/asignaciones/:id` | `mfr.configurar_turno` | `{ fechaOperativa, turnoId, lineaId, grupoId, personas }`; crea o corrige / quita (404 `MFR_ASIGNACION_NO_ENCONTRADA`) |
| `GET/POST/PATCH /api/grupos` | `catalogo.consultar` / `catalogo.editar` | Catálogo de grupos (`descripcion`, `personasEsperadas`) |
| `GET/POST/PATCH /mfr/lineas` | `mfr.consultar` / `catalogo.editar` | Catálogo de líneas |
| `GET /mfr/estandares` · `PUT /mfr/estandares/:productoId` | `mfr.consultar` / `catalogo.editar_estandares` | Incluye `pesoSugeridoKg`; `{ cajasPorHora, pesoNetoKg, motivo }` |

## Pantallas

| Ruta | Qué hace |
|---|---|
| `/mfr` | Tablero: MFR total y por SKU (cajas y kg), turnos (Mx, T, producido, eficiencias), vista horaria en kg con selector Target/Instant/Capacity/Overpull |
| `/mfr/programacion` | Programación del día: una tarjeta por línea con sus bloques; agregar/corregir/quitar; **Importar PDF del DPP** (propuesta → revisar → cargar); **Copiar otro día**; por turno: badge de personal (a fin / afectada), panel "Personal" para registrar la asistencia por grupo y asignar grupos a líneas (cubierta / incompleta contra la línea ideal), y cerrar el turno |
| `/admin/grupos` | Grupos: código, nombre, descripción (proveedor a mano), personas esperadas por turno, activo |
| `/admin/lineas` | Líneas: código, nombre PepsiCo, tipo, kg/h, orden |
| `/admin/productos` | Crear producto con cajas/hora y peso; editar (cambiar el estándar exige motivo); botón "Estándar" con sugerencia de peso desde la descripción |

Flujo diario del coordinador: abrir `/mfr/programacion` → "Importar PDF del DPP" → revisar la propuesta (✓ = Mx y T coinciden con el PDF) → "Cargar N bloques" → durante el día, corregir con motivo si PepsiCo cambia algo → al terminar, "Cerrar" el turno.

## Código

```text
domain/mfr/        bloque-programacion (entidad + solapamiento), linea-produccion, estandar-produccion
                   (+ pesoNetoSugeridoKg), horas-turno (minutos operativos, turnoDeHora), calculo-mfr
                   (funciones puras), dpp-pepsico (lector del texto del DPP), asistencia-turno
                   (validación + evaluarPersonalTurno), asignacion-linea (evaluarLineasTurno), mfr.errors
                   dpp-ejemplo-2026-09-16.txt  texto real del DPP usado en las pruebas
domain/grupo/      grupo.repository (Grupo, validarDatosGrupo), grupo.errors
application/mfr/   bloques (guardar, eliminar, cargar día, copiar día, cerrar turno), analizar-dpp,
                   catalogos-mfr, indicadores-dia (incluye `personal` por turno: grupos y líneas), asistencia, asignacion
application/catalogo/grupo.use-cases (crear, actualizar)
infrastructure/    dpp/lector-pdf (pdf-parse), persistence/prisma/mfr.prisma.repositories,
                   firestore/repositorios/mfr.firestore.repositories
modules/mfr/       mfr.controller, mfr.module, dto/mfr.dto
```

Pruebas: 19 del dominio (cálculo, entidad, horas, peso sugerido), 6 del lector del DPP real, 11 de casos de uso. Verificación por HTTP contra Firestore: análisis del PDF (20/20 bloques coinciden), carga, copia, corrección con motivo, solapamiento rechazado, cierre de turno.

Archivos obsoletos que quedaron vacíos (borrar): `domain/mfr/programacion.ts`, `domain/mfr/config-turno.ts`, `application/mfr/programacion.use-cases.ts`, `application/mfr/config-turno.use-cases.ts`, `frontend/src/modules/mfr/pages/ConfigTurnoPage.tsx`.

## Pendiente

- Registrar el **peso neto por caja** de los productos del DPP (el sistema lo sugiere; lo confirma el administrador). Sin él no hay kilos.
- "Instant Kilograms" real por hora: requeriría la hora de producción de cada remisión; hoy la producción real se muestra por turno.
- Cierre automático del turno al terminar su hora (hoy es manual).
- Estadística histórica por línea: los bloques quedan guardados; falta la vista.
- Valores reales de `descripcion` y `personasEsperadas` de los 4 grupos sembrados: los carga el administrador en `/admin/grupos` (hoy están vacíos).
