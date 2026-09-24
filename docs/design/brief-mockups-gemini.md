# Brief de contextualización — Mockups del Aplicativo Maquila (MQ)

> **Cómo usar este documento:** pégalo completo como primer mensaje a Gemini.
> Está escrito dirigiéndose a Gemini en segunda persona.
> Su salida alimenta después a un agente de diseño especializado que implementará
> las pantallas con React + Tailwind v4 + **anime.js**.

---

## 0. Quién eres en esta conversación y qué debes entregar

Eres un **director de arte y diseñador de producto** especializado en aplicaciones
internas de uso industrial. No escribes código de producción: produces una
**especificación de diseño tan precisa que otro agente pueda implementarla sin
preguntar nada**.

Tu entregable es un documento estructurado con:

1. Un **sistema de diseño** cerrado (tokens en JSON: color, tipografía, espaciado, radios, sombras, movimiento).
2. Una **especificación por pantalla** (13 pantallas, listadas en la sección 5), cada una con:
   - propósito en una frase y quién la usa,
   - wireframe en ASCII o descripción de layout por regiones y breakpoints,
   - jerarquía visual explícita (qué es lo primero, lo segundo y lo tercero que el ojo debe leer),
   - inventario de componentes que usa,
   - todos los estados (carga, vacío, error, sin permiso, éxito),
   - microcopy en español (títulos, etiquetas, mensajes vacíos, confirmaciones),
   - notas de movimiento (qué se anima, cuándo, con qué duración y easing).
3. Un **catálogo de componentes** reutilizables con sus variantes y estados.
4. Una **guía de movimiento** pensada para anime.js.
5. Una lista de **supuestos que hiciste** y de **preguntas abiertas**, separada del resto.

**Reglas duras de tu entrega:**

- **No inventes reglas de negocio, siglas, KPIs ni datos.** Si algo no está en este
  brief, escríbelo como `SUPUESTO:` o `PREGUNTA:` en la sección correspondiente. Este
  proyecto tiene la norma de no suponer nada sobre el negocio, y tu salida hereda esa norma.
- **Todo el microcopy va en español de Colombia**, sin anglicismos innecesarios
  (excepto los términos que la propia planta usa y que están en el glosario).
- No propongas tecnologías nuevas (ni librerías de UI, ni de gráficos, ni de iconos)
  sin nombrar el problema concreto que resuelven.
- No cambies el flujo ni la información de las pantallas: el backend ya existe y está
  cerrado. Diseñas sobre datos que ya se producen.

---

## 1. El negocio, en concreto

**Inlotrans S.A.S.** es una empresa de logística de Mosquera, Cundinamarca (Colombia).
Su **área de Maquila (MQ)** opera *dentro* de una planta de su cliente: la
**Maquila PepsiCo Santo Domingo**. El área empaca producto terminado (PT) y se lo
entrega a PepsiCo.

Hoy todo eso vive en un conjunto de formularios de Excel. El aplicativo los reemplaza
con un sistema con trazabilidad real.

La entidad raíz es la **remisión**: el documento con el que Inlotrans entrega producto
a PepsiCo. Todo lo demás se construye encima de lo que las remisiones producen. De los
módulos previstos, hoy hay **dos implementados y en uso**:

- **Remisiones** (el documento y su ciclo de vida).
- **MFR** — *Manufacturing Fill Rate*: qué tanto se cumplió lo que PepsiCo programó.

Los módulos que vendrán después (averías, calidad, inventario de insumos, planes de
trabajo, cuaderno virtual, entrega de turno, alertas) **no se diseñan ahora**, pero el
sistema de diseño que produzcas debe poder absorberlos sin rehacerse. Deja previsto
cómo crecería la navegación.

### Dos relaciones que explican casi todas las decisiones de pantalla

1. **Inlotrans registra, PepsiCo decide.** El OPA (facturador de PepsiCo) aprueba o
   rechaza la remisión, pero **no es usuario del sistema**: su respuesta la teclea un
   coordinador de Inlotrans, dejando constancia del nombre y cargo del OPA. Por eso hay
   pantallas donde alguien registra la decisión de un tercero — el diseño debe dejar
   clarísimo que se está *transcribiendo* algo, no decidiéndolo.
2. **PepsiCo manda la programación (el DPP) y no se puede producir de más ni de menos.**
   La regla del área es literal: *"ni una caja más de lo programado"*. El sistema
   bloquea lo que exceda el DPP y exige motivo cuando falta. El diseño debe hacer que
   el operario vea el techo **antes** de chocar con él, no después de un error 409.

---

## 2. Glosario obligatorio

Usa estos términos exactamente así en el microcopy. No los traduzcas ni los "mejores".

| Término | Qué es |
|---|---|
| **Remisión** | Documento de entrega de producto terminado a PepsiCo. Un documento = **un solo SKU**. |
| **Consecutivo** | Identidad de negocio de la remisión. Formato `AAAA-NNNN` (ej. `2026-0148`). **Reinicia cada año.** Nunca se reutiliza ni se quema. |
| **Versión** | Una remisión rechazada se corrige y sube de versión (v2, v3…) **conservando el mismo consecutivo**. |
| **Fecha operativa** | El día productivo va de las **06:00 a las 06:00** del día siguiente, hora de Colombia. Todo se agrupa por fecha operativa, nunca por fecha de calendario. Es la regla más importante del sistema. |
| **Turno** | T1 06:00–13:30 · T2 14:00–21:30 · T3 22:00–05:30. 7,5 h productivas cada uno. El T3 cruza la medianoche. |
| **OPA** | Facturador de PepsiCo que aprueba o rechaza. No es usuario: es un dato (nombre + cargo + fecha). |
| **Patinador** | Auxiliar logístico de Inlotrans. Lleva el producto y el documento al OPA y carga el PT al WMS de bodega. |
| **Coordinador MQ** | Crea la remisión, registra la respuesta del OPA y concilia. Es el usuario principal del sistema. |
| **DPP** | La programación que PepsiCo envía (en PDF). Trae bloques por **línea** y **hora**: producto, cajas/hora y eficiencia. Puede llegar diario, semanal o mensual. |
| **Bloque** | Una fila del DPP: línea + hora inicio + hora fin + producto + cajas/hora + eficiencia (E). |
| **Mx** | Capacidad máxima del bloque = `cajasPorHora × horas`. |
| **T** (target) | Meta real del bloque = `Mx × E`. Lo que se compara contra lo producido. |
| **E** | Eficiencia planeada del bloque, en porcentaje. |
| **MFR** | *Manufacturing Fill Rate*: producido ÷ programado. **Meta: 95 %.** Cuenta una remisión **cuando el OPA la aprueba**, no cuando se crea. |
| **SKU / Producto** | Referencia de producto. Tiene código, descripción, subdescripción (familia), cajas/hora estándar, peso neto por caja y "personas ideal". |
| **Línea** | Plataforma física de producción. Hay 9: L1–L4 (MULTIPACK, 306 kg/h), L5 (MANUAL, 306 kg/h), MANUAL-1 y MANUAL-2 (249 kg/h), REEMPAQU-2 y REEMPAQUES (203 kg/h). |
| **Grupo** | El proveedor de personal que opera las líneas: LOGICMARD, MAXISERVICE, APOYOS MAXI, MIX. Cada uno tiene un número de **personas esperadas** por turno. |
| **Asistencia** | Cuántas personas **llegaron** realmente por turno y grupo. Nunca se puede asignar a líneas más gente de la que llegó. |
| **Línea ideal** | Personas necesarias en la línea para ese SKU. Viene del producto y del DPP. |
| **Estibas** | `estibas completas` + `cajas sueltas` (números enteros) y la lista de **números de estiba** (ej. 31, 32, 33). El texto "2 ESTIBAS + 21 CAJAS" se **calcula** para mostrar, no se guarda. |
| **Extraoficial** | Remisión de pedido de emergencia, con motivo obligatorio. **No cuenta para el MFR ni para el tope del DPP.** |
| **Validar / conciliar** | Paso interno posterior a la aprobación de PepsiCo. Aprobación ≠ validación: son dos eventos distintos. |
| **Semáforo** | `VERDE` / `AMARILLO` / `ROJO`, contra la meta de 95 %. Puede venir `null` = "sin dato". |
| **PT** | Producto Terminado. |

---

## 3. Quién usa esto, dónde y cómo

Esto **no** es un SaaS que se mira desde un escritorio tranquilo. Condiciona todo el diseño:

| Usuario | Rol | Cómo trabaja |
|---|---|---|
| **Coordinador MQ** | Usuario principal | Crea remisiones durante el turno, entre interrupciones. Lee el tablero MFR al empezar y al cerrar la jornada. Carga y corrige el DPP. |
| **Patinador** | Auxiliar logístico | Entra poco y para tareas puntuales: marcar entregado. Puede estar de pie, con prisa. |
| **Administrador** | Superusuario | Gestiona usuarios, catálogo de productos, líneas, grupos y pesos por caja. Sesiones largas, mucha tabla y mucho formulario. |
| **Consulta** | Solo lectura | Mira, no toca. |

**Contexto físico y sus consecuencias de diseño:**

- Entorno de planta: **equipos compartidos**. Por eso "Cerrar sesión" está siempre
  visible en la cabecera, y por eso el usuario actual debe ser identificable de un vistazo.
- Turnos de hasta 7,5 h; el **T3 es nocturno** (22:00–05:30). Propón cómo tratarías
  esto visualmente y márcalo como `SUPUESTO:` — el área todavía no ha pedido modo oscuro.
- Pantalla objetivo principal: **escritorio 1366×768 y 1920×1080**. El layout actual es
  `max-w-7xl` centrado. Debe funcionar en **tablet** (uso de pie) y degradar dignamente
  en móvil: hoy la navegación ya colapsa en un menú hamburguesa por debajo de `sm`.
- Se imprime: las remisiones salen en **PDF, dos por hoja**. El diseño de pantalla y el
  del documento impreso son dos cosas distintas; no los mezcles.
- Hay **mucha tabla densa** (el tablero MFR tiene una matriz línea × hora con hasta 24
  columnas y scroll horizontal con primera columna fija). La elegancia tiene que
  sobrevivir a la densidad: no puedes resolverlo con aire y tarjetas gigantes.

---

## 4. Los dos flujos que hay que entender antes de dibujar

### 4.1 Ciclo de vida de la remisión

```text
   BORRADOR ──► ENTREGADA ──► APROBADA ──► VALIDADA
                    ▲              │
                    │              ▼
                    └── EN_RECTIFICACION ◄── RECHAZADA
```

| Estado | Quién actúa | Qué significa |
|---|---|---|
| `BORRADOR` | Coordinador MQ | Se registró. **Editable.** |
| `ENTREGADA` | Patinador | Salió hacia el OPA. **Ya no es editable.** |
| `APROBADA` | Coordinador registra al OPA | PepsiCo aceptó. Se guarda nombre y cargo del OPA. **Aún falta conciliar.** |
| `RECHAZADA` | Coordinador registra al OPA | PepsiCo no aceptó. Motivo obligatorio. |
| `EN_RECTIFICACION` | Coordinador MQ | Se está corrigiendo. Sube de versión, **mismo consecutivo**. Vuelve a ser editable. |
| `VALIDADA` | Coordinador MQ | Conciliación interna hecha. **Estado final.** |

**Una remisión NUNCA se elimina.** Es un documento firmado. No diseñes acciones de
borrado, ni papeleras, ni "deshacer" destructivos.

**Detalle de color que ya está decidido y no debes cambiar:** `APROBADA` se pinta en
ámbar/naranja, **no en verde**, a propósito. Está aceptada por PepsiCo pero **sin
conciliar** — es la fuente probable de descuadres. Solo `VALIDADA` es "terminada" y va
en verde. En el listado, las remisiones pendientes de conciliar llevan la fila
resaltada. Respeta esta semántica: **verde = cerrado de verdad; naranja = requiere que
alguien vuelva**.

### 4.2 El día operativo del MFR

1. Llega el **PDF del DPP** de PepsiCo (1 día, una semana o un mes).
2. El coordinador lo sube → el sistema propone bloques → él revisa y carga. También
   puede **copiar el día anterior** o crear bloques a mano.
3. Registra la **asistencia** por grupo (cuántos llegaron) y **asigna grupos a líneas**
   con un número de personas. No puede asignar más gente de la que llegó.
4. Durante el turno se crean remisiones. El sistema verifica contra el DPP: lo
   remisionado de un SKU no puede exceder el `Σ T` del día.
5. Cuando el OPA aprueba, esa remisión **entra al MFR**.
6. Al **cerrar el turno** (acción irreversible, congela los bloques), si hay SKU por
   debajo del target, el sistema exige un **motivo del faltante**.

---

## 5. Inventario de pantallas

Trece pantallas. Todas salvo el login viven dentro de un layout común.

### 5.0 Marco común (`AppLayout`)

Cabecera fija en la parte superior con: marca "MQ / Maquila · Inlotrans", navegación
horizontal, usuario actual (nombre + código de rol + avatar con inicial) y botón
"Salir". Debajo, el contenido centrado con ancho máximo.

Los enlaces del menú se **filtran por permiso** (quien no puede consultar remisiones no
ve el enlace): Remisiones · MFR · Productos · Líneas · Grupos · Usuarios. Por debajo de
`sm` la navegación colapsa en un panel desplegable.

> Para ti: el menú actual usa una "marca" de una letra (R, M, P, L, G, U) como icono
> improvisado. **Propón un set de iconos coherente** y di cuál usarías (no incorpores
> una librería sin justificarla). Propón también cómo crecerá esta navegación cuando
> entren 5–6 módulos más: ¿sigue horizontal, pasa a lateral, se agrupa?

---

### 5.1 `/login` — Inicio de sesión

- **Quién:** todos. Equipos compartidos, se usa muchas veces al día.
- **Datos:** documento (no email) + contraseña + casilla "Recordar sesión".
- **Estados:** inactivo, cargando, credenciales inválidas, usuario desactivado.
- **Nota:** es el único momento del día con espacio para que la marca respire. Es tu
  mejor oportunidad de movimiento y carácter — sin volverla lenta: alguien que entra
  cinco veces por turno odiará una animación de 2 segundos.

---

### 5.2 `/` — Panel de inicio

- **Quién:** todos, al entrar.
- **Contenido actual:**
  - Saludo con el nombre del usuario + indicador "Sesión activa".
  - Un **carrusel** de 3 diapositivas que rota cada 6,5 s (Operación / Remisiones / MFR),
    con puntos de navegación y flechas.
  - Rejilla de **accesos rápidos** filtrados por permiso (hasta 9 tarjetas): Nueva
    remisión, Remisiones, MFR del día, Programación DPP, Productos, Líneas, Pesos por
    caja, Grupos, Usuarios. Cada una: icono, título, descripción de una línea y "Abrir →".
- **Tu trabajo aquí:** el carrusel actual es decorativo y no aporta información
  operativa. **Propón una alternativa** que use el mismo espacio para decir algo útil
  del día (por ejemplo: MFR de hoy, remisiones pendientes de conciliar, turno en curso),
  y preséntalo con la estructura **Problema · Opciones · Ventajas · Desventajas ·
  Recomendación** — es la norma de decisiones de este proyecto. Marca como
  `PREGUNTA:` qué dato pondrías si no está disponible.
- Aquí es donde, en el futuro, vivirán las **vistas por rol × área**. Deja claro cómo
  el diseño soporta que a cada rol le abra una pantalla distinta.

---

### 5.3 `/remisiones` — Listado

La pantalla más usada después del panel.

- **Barra superior:** título + acciones: "Imprimir seleccionadas (n)", "Exportar a Excel",
  "Nueva remisión".
- **Filtros** (5, en una fila que colapsa): Desde (fecha operativa), Hasta, Estado,
  Turno, Grupo. **Viven en la URL**, así que son compartibles y sobreviven a recargar.
- **Tabla paginada** (20 por página), columnas:
  `[checkbox] · Consecutivo · Fecha op. · Turno · Grupo · Producto · Cajas · Unidades · Estibas · Estado`
  - El consecutivo es un enlace; si `versión > 1` se anota `v2` al lado; si es
    extraoficial lleva una etiqueta.
  - El producto va en dos renglones: código en monoespaciada pequeña arriba,
    descripción truncada debajo.
  - Las filas **pendientes de conciliar** (aprobadas sin validar) van resaltadas.
  - Checkbox de "seleccionar todas las de esta página" en el encabezado; la selección
    alimenta la impresión por lote.
- **Pie:** total de remisiones + paginación Anterior / Página X de Y / Siguiente.
- **Estados:** cargando, "No hay remisiones con esos filtros", error de API, error al
  generar el archivo.
- **Tu trabajo:** resolver la densidad con elegancia. Define alto de fila, ritmo
  tipográfico, tratamiento del encabezado, cómo se ve el hover, cómo se ve la fila
  seleccionada **y** la resaltada al mismo tiempo (se superponen), y cómo se comporta la
  tabla en tablet.

---

### 5.4 `/remisiones/nueva` y `/remisiones/:id/editar` — Formulario

- **Campos:** turno, grupo, lugar, producto (búsqueda sobre el catálogo), fecha de
  vencimiento, cantidad de cajas, cantidad de unidades, estibas completas, cajas
  sueltas, números de estiba (lista), observaciones, y el par
  **extraoficial + motivo** (el motivo se vuelve obligatorio si se marca).
- **La pieza crítica:** al elegir producto y cantidad, el sistema valida contra el tope
  del DPP (`aprobadas + esta ≤ Σ T del SKU del día`). Si no hay DPP cargado, o el SKU no
  está en el DPP, **se bloquea**. Hoy eso aparece como un error después de enviar.
  **Diseña cómo mostrar el margen disponible mientras se escribe** — cuánto queda de
  ese SKU hoy — para que el error sea la excepción y no la norma.
- **Números de estiba:** entrada de lista (tipo chips). Define cómo se agregan, se
  borran y se ven cuando son 15.
- La edición solo existe en `BORRADOR` y `EN_RECTIFICACION`; en cualquier otro estado
  el backend responde 409. Diseña ese caso.
- No hay guardado automático. Di si lo recomiendas y por qué.

---

### 5.5 `/remisiones/:id` — Detalle

El documento leído como se firmó.

- **Cabecera:** volver a Remisiones · "Remisión 2026-0148" (+ "versión 2" si aplica) ·
  insignia de estado · aviso "Aprobada por PepsiCo, pendiente de conciliar" cuando toca ·
  botón "Imprimir PDF".
- **Cuerpo:** lista de datos en pares etiqueta/valor: fecha operativa, fecha y hora de
  registro, turno, grupo, lugar, producto (**snapshot congelado**, no el catálogo
  actual), vencimiento, cajas, unidades, descripción de estibas, números de estiba,
  observaciones, motivo del último rechazo, y los tres bloques de trazabilidad:
  **entrega** (quién, cuándo), **aprobación** (OPA: nombre, cargo, fecha) y
  **validación** (quién, con quién se concilió, cuándo).
- **Acciones** según estado y permiso: Entregar · Aprobar · Rechazar (motivo obligatorio) ·
  Rectificar · Validar · Editar. Varias abren un diálogo que pide datos.
- **Historial:** versiones (con motivo del rechazo, quién rectificó y cuándo) y
  auditoría (acción, valor anterior, valor nuevo, motivo, usuario, fecha).
- **Tu trabajo:**
  1. Que el documento se lea como documento y no como formulario apagado.
  2. Que **el estado y la siguiente acción posible** sean lo primero que se ve.
  3. Diseñar una **línea de tiempo** del ciclo de vida que muestre dónde está el
     documento y por dónde pasó, incluido el rebote rechazo → rectificación.
  4. Que el snapshot del producto se lea como "lo que decía al firmarse" y no se
     confunda con el catálogo vivo.

---

### 5.6 `/mfr` — Tablero MFR del día

La pantalla más rica en información de todo el sistema. Tiene cinco zonas:

1. **Cabecera:** título, explicación ("Contra el DPP de PepsiCo. Cuentan las remisiones
   **aprobadas por el OPA**. Meta: 95 %"), **selector de fecha operativa** y enlace a la
   programación del día.
2. **Cuatro tarjetas de indicador:**
   - *MFR del día*: porcentaje grande + semáforo + "X de Y cajas programadas · X de Y kg".
   - *Programado (Σ T del DPP)*: cajas + "N bloques en M líneas · X kg".
   - *Producido sin programar*: cajas de SKU que PepsiCo no programó.
   - *Pedidos de emergencia*: cajas extraoficiales, fuera del MFR.
3. **Tabla por SKU:** Producto (código + descripción) · Programado · Producido ·
   Faltante · kg prog. · kg prod. · Cumplimiento (semáforo). Debajo, en gris, las filas
   *sin programar*, y en ámbar las *extraoficiales* — tres categorías visualmente
   distintas dentro de la misma tabla.
4. **Tres tarjetas de turno** (T1, T2, T3): cumplimiento + semáforo, "X de **T** cajas
   (Mx Y)", kilos, "Eficiencia planeada X % · real Y %", personal (insignia + grupos con
   `llegaron/esperadas`), asignación de grupos a líneas (con "faltan N" si está
   incompleta), y la lista de bloques del turno
   (`L3 06:00–13:30 · 300033679 · 420 cajas/h · E 85 % → T 2.678`). Un turno puede estar
   marcado como *cerrado* o *no opera*.
5. **Vista horaria (kg), como el DPP:** matriz **línea × hora** con primera columna fija
   y scroll horizontal, con un conmutador de serie:
   *Target Kilograms · Instant Kilograms · Capacity · Pct Overpull*. Fila de totales
   (solo en Target e Instant). Los ceros se pintan en gris muy claro.
6. **Flavor Breakdown:** la misma matriz pero por **familia** de producto (la
   subdescripción del SKU), en kg target.

- **Avisos:** "No hay programación (DPP) cargada para este día" y una lista de
  advertencias que envía el backend.
- **Tu trabajo aquí es el más exigente:**
  - Ordenar seis niveles de información sin que se vea como una hoja de cálculo triste.
  - Definir el tratamiento del **semáforo** (VERDE / AMARILLO / ROJO / sin dato) de forma
    que **no dependa solo del color** — hay que poder leerlo en impresión gris y con
    daltonismo.
  - Resolver la matriz densa: altura de celda, alineación (los números van a la derecha y
    en monoespaciada), columna fija, sombra de scroll, cómo se marca la **hora actual**.
  - Considerar si alguna de estas matrices merece una representación gráfica
    (*heatmap*, sparkline por línea). Si propones un gráfico, justifica qué pregunta
    responde que la tabla no responde.
  - Definir el estado "día sin DPP" para que no se vea como un error del sistema.

---

### 5.7 `/mfr/programacion` — Programación del día (DPP)

Pantalla de trabajo diario del coordinador.

- **Cabecera:** selector de fecha operativa + acciones: **Importar PDF**, **Copiar día
  anterior**, y por turno **Cerrar turno**.
- **Una tarjeta por línea** con sus bloques: hora inicio, hora fin, producto, cajas/h,
  E, y lo derivado: **Mx**, **T** y kilos.
- **Agregar / corregir / quitar bloques a mano.** Corregir y quitar **exigen motivo**.
- **Panel de personal por turno:** asistencia por grupo (cuántos llegaron frente a
  cuántos se esperaban) y asignación de grupos a líneas con número de personas
  (CUBIERTA / INCOMPLETA contra la línea ideal). Nunca más personas de las que llegaron.
- **Importar PDF (flujo de 3 pasos):** subir archivo → el sistema devuelve una
  **propuesta** (no escribe nada todavía) → el coordinador revisa y confirma. Si el PDF
  trae N días, la respuesta dice qué pasó con **cada día**: `CARGADO` / `OMITIDO` /
  `ERROR`. Diseña esa pantalla de resultado por día.
- **Cerrar turno:** irreversible. Hoy se confirma con un `window.confirm` del navegador,
  y los motivos se piden con `window.prompt`. **Eso hay que rediseñarlo:** necesito
  diálogos propios, con el peso visual que corresponde a una acción irreversible, y un
  diálogo específico para "hay SKU por debajo del target: explica el faltante".
- **Tu trabajo:** proponer la representación del día. ¿Tarjetas por línea (como hoy)?
  ¿Una rejilla temporal tipo calendario con los bloques como barras sobre el eje de
  horas? Evalúalo con Problema · Opciones · Ventajas · Desventajas · Recomendación,
  teniendo en cuenta que los bloques se editan mucho y a mano.

---

### 5.8–5.12 Pantallas de administración

Comparten patrón: cabecera + tabla + formulario de creación/edición (en diálogo o en
panel lateral — decide cuál y sé consistente).

| Ruta | Qué gestiona | Particularidad |
|---|---|---|
| `/admin/usuarios` | Cuentas, roles, activo/inactivo, restablecer contraseña | Los roles son `ADMINISTRADOR`, `COORDINADOR_MQ`, `PATINADOR`, `CONSULTA`. El administrador es superusuario. |
| `/admin/productos` | Catálogo: código, descripción, subdescripción (familia), empaque, cajas/hora, peso por caja, personas ideal, activo | Nunca se borra un producto: se **desactiva**. Búsqueda por texto. |
| `/admin/lineas` | Las 9 plataformas: código, nombre, tipo (MULTIPACK / MANUAL / REEMPAQUE) y capacidad en kg/h | Catálogo pequeño y estable. |
| `/admin/grupos` | LOGICMARD, MAXISERVICE, APOYOS MAXI, MIX: descripción y **personas esperadas** por turno | El proveedor real se escribe a mano en la descripción. |
| `/admin/pesos` | **Edición en lote** del peso neto por caja de todos los productos | Es una pantalla especial: muchos campos numéricos editables a la vez, un **motivo común** para todo el lote, máximo 100 cambios por envío, y el sistema **sugiere** un peso leído de la descripción que el administrador confirma o corrige. Sin este dato, el tablero MFR no puede mostrar kilos. |

`/admin/pesos` merece diseño propio y cuidado: es "captura masiva con sugerencias". Define
cómo se ve una sugerencia aceptada, una modificada y una sin tocar; cómo se sabe cuántos
cambios llevas; y qué pasa al llegar al tope de 100.

---

## 6. Dirección de diseño

### 6.1 El adjetivo que persigo

**Elegante, sobrio, minimalista pero no extremo, y a la vez dinámico y creativo.**

Cómo traduzco eso, para que no quede en adjetivos:

- **Elegante** = jerarquía tipográfica resuelta, alineaciones que se cumplen, números
  tabulares, espaciado con un ritmo constante. No = decoración.
- **Sobrio** = color con oficio, no de adorno. El color significa algo (estado,
  semáforo, jerarquía). Una pantalla en calma es mayoritariamente neutra.
- **Minimalista pero no extremo** = no quiero pantallas vacías y frías, ni bordes
  invisibles, ni gris sobre gris. Quiero superficies definidas, contraste real y
  componentes con presencia. Que no haya ruido no significa que no haya carácter.
- **Dinámico y creativo** = el carácter vive en el **movimiento**, en las **transiciones
  de estado** y en uno o dos momentos memorables (login, panel de inicio, entrada al
  tablero). No en texturas ni en formas raras.

**Contraejemplos explícitos — no quiero:**
glassmorphism, degradados arcoíris, sombras difusas por todas partes, esquinas
sobre-redondeadas tipo juguete, ilustraciones genéricas de personitas, emojis como
iconos, tipografías display en la interfaz de trabajo, animaciones rebotonas ni
partículas de fondo.

### 6.2 Paleta

Trabaja con **verdes, azules, naranjas y cafés**. Los neutros deben ser **cálidos**
(base café/greige), no grises azulados: eso es lo que le dará la personalidad sobria
que busco, y separa la app del "dashboard genérico". Los valores de abajo son un
**punto de partida que debes auditar y ajustar**, no un mandato.

```jsonc
{
  "neutro": {           // base cálida
    "fondo":     "#FBFAF7",   // fondo de la aplicación
    "superficie":"#FFFFFF",   // tarjetas y tablas
    "hundido":   "#F3F1EC",   // encabezados de tabla, campos deshabilitados
    "borde":     "#E4DFD6",
    "borde-alto":"#CFC7B9",
    "tinta":     "#1C2B27",   // texto principal (verde-negro, no negro puro)
    "tinta-2":   "#4A5A54",   // texto secundario
    "tinta-3":   "#7B8781"    // terciario, marcas de agua, placeholders
  },
  "verde": {            // marca, acción primaria, "cerrado / conforme"
    "50": "#E8F2EE", "100": "#CFE5DC", "500": "#12715F", "600": "#0E5B4D", "700": "#0A4539"
  },
  "azul": {             // información, datos, MFR, "en tránsito"
    "50": "#E6EFF5", "100": "#C9DFEC", "500": "#1D6A97", "600": "#175477", "700": "#123E58"
  },
  "naranja": {          // atención, pendiente de conciliar, extraoficial, rectificación
    "50": "#FBEFE2", "100": "#F6DCC0", "500": "#C97B2C", "600": "#A5601C", "700": "#7E4813"
  },
  "cafe": {             // jerarquía cálida, histórico, cerrado, series secundarias
    "50": "#F2EDE6", "300": "#BFAE99", "500": "#7A6250", "700": "#4E3E31"
  },
  "terracota": {        // error y rechazo — derivado del naranja, no rojo puro
    "50": "#F7E7E3", "500": "#A93E2B", "600": "#8A2F1F"
  }
}
```

**Asignación semántica que debes respetar (ya está decidida por el negocio):**

| Concepto | Color |
|---|---|
| `BORRADOR` | neutro cálido (café 50 / tinta-2) |
| `ENTREGADA` | azul |
| `APROBADA` | **naranja** — aceptada por PepsiCo pero sin conciliar |
| `RECHAZADA` | terracota |
| `EN_RECTIFICACION` | naranja, con tratamiento distinto al de APROBADA (debe distinguirse de un vistazo) |
| `VALIDADA` | **verde** — lo único terminado |
| Semáforo `VERDE` / `AMARILLO` / `ROJO` | verde / naranja / terracota |
| Semáforo `null` | neutro con la etiqueta "sin dato" |
| Acción primaria | verde |
| Acción destructiva o irreversible (cerrar turno) | terracota |
| Datos, gráficos y contexto del MFR | azul, con café para series secundarias |

**Obligaciones:**
- Verifica **todos** los pares texto/fondo con un medidor de contraste real y reporta las
  cifras: mínimo **4,5:1** en texto normal y **3:1** en texto grande y elementos de
  interfaz. Corrige los tonos que no lleguen; no confíes en los hex que te di.
- `APROBADA` (naranja) y `EN_RECTIFICACION` (naranja) tienen que ser distinguibles
  **sin leer la etiqueta**: resuelve con relleno vs. contorno, o con un punto/patrón.
- El semáforo nunca puede depender solo del color: forma, icono o texto acompañan siempre.
- Entrega la paleta también como **variables CSS** en el formato de Tailwind v4
  (`@theme { --color-...: ... }`), que es el que usa el proyecto.

### 6.3 Tipografía

Hoy la aplicación usa `'Trebuchet MS', 'Segoe UI', sans-serif`, que es un valor por
defecto sin decidir. **Propón una tipografía** con estas condiciones:

- Legible en tamaños pequeños y en tablas densas.
- **Números tabulares obligatorios** (`font-variant-numeric: tabular-nums`): hay columnas
  de cifras por todos lados y deben alinearse.
- Una **monoespaciada** para códigos de producto, consecutivos y celdas numéricas de la
  matriz horaria (ya se usa así hoy).
- Disponible sin licencia problemática y cargable en un entorno corporativo. Di si
  requiere descargar archivos o si basta con fuentes de sistema, y ofrece una alternativa
  100 % de sistema por si el área no permite recursos externos.
- Entrega una **escala tipográfica completa** (tamaño / peso / interlineado /
  espaciado entre letras) con nombres de rol: título de pantalla, título de sección,
  título de tarjeta, etiqueta de dato, cuerpo, cuerpo pequeño, dato numérico grande,
  cifra de tabla, microcopy, etiqueta de insignia.

### 6.4 Resto del sistema

Define y justifica: escala de espaciado (base 4 u 8), radios (hoy hay mezcla de 8 / 12 /
16 px — unifícalo), elevación (2–3 niveles como máximo, sombras cálidas y discretas),
grosor y color de bordes, altura de los controles (botones y campos, para que se alineen
entre sí), anchos de columna en tablas, y el estilo del **foco visible** — hoy es un
contorno turquesa de 3 px, y es importante conservar un foco bien visible: hay usuarios
que navegan con teclado en planta.

---

## 7. Movimiento (esto pasa a un agente que implementará con anime.js)

El movimiento es donde vive lo "dinámico y creativo". Pero es una **herramienta de
producto industrial**, no un espectáculo: cuando alguien crea su remisión número
catorce del turno, la animación tiene que haber desaparecido de su consciencia.

**Reglas que debes escribir explícitamente en tu entrega:**

1. **Presupuesto de duración:** microinteracción 120–180 ms · transición de componente
   180–260 ms · entrada de pantalla 300–420 ms. Nada por encima de 500 ms salvo en el
   login. Hoy el proyecto ya usa una entrada de 420 ms (`aparecer-arriba`: opacidad +
   10 px de desplazamiento vertical); mantén esa familia.
2. **Easing:** salidas rápidas y entradas suaves (`easeOutQuad` / cubic-bezier
   equivalente). Nada de rebotes, salvo — si lo justificas — un único acento en la
   confirmación de una acción exitosa.
3. **Escalonado (`stagger`):** 30–50 ms entre elementos, con tope: en una tabla de 20
   filas no escalones las 20 (queda lento y mareado). Define el tope.
4. **Qué sí animar, con un porqué:**
   - Entrada de pantalla y de secciones.
   - Transición de estado de una remisión (es el corazón del producto: merece un momento).
   - Cambio de serie en la matriz horaria del MFR (Target → Instant → Capacity → Overpull):
     los números deben **interpolarse**, no saltar.
   - Los porcentajes grandes y las barras de cumplimiento: contar desde cero al cargar.
   - Apertura y cierre de diálogos.
   - Filas que aparecen o desaparecen al filtrar.
   - Retroalimentación de guardado exitoso.
5. **Qué NO animar:** el contenido de tablas al hacer scroll, los tooltips, nada que
   retrase la lectura de un dato operativo, nada que se repita en bucle de fondo.
6. **`prefers-reduced-motion`:** obligatorio. El proyecto ya lo respeta globalmente. Toda
   animación que propongas debe tener su versión reducida descrita.
7. **API objetivo:** **anime.js v4** (`animate`, `createTimeline`, `stagger`, `utils`,
   `createSpring`). Si el proyecto termina usando v3, el equivalente es `anime({...})` y
   `anime.stagger(...)` — escribe las notas de movimiento de forma que sirvan para ambas:
   describe **propiedad, valores inicial y final, duración, easing, retraso y
   disparador**, no llamadas literales.
8. Entrega los valores de movimiento como **tokens** (`--motion-rapido`, `--motion-medio`,
   `--motion-entrada`, y los easings), para que el implementador no invente números.

---

## 8. Componentes a especificar

Estos ya existen en el código y tienen que quedar definidos con todas sus variantes y
estados (normal, hover, foco, activo, deshabilitado, cargando, error):

`Boton` (primario, secundario, destructivo; con estado de carga) · `Campo` (texto,
número, fecha, con etiqueta, ayuda y error) · `Select` · `AreaTexto` · `Alerta`
(info, éxito, advertencia, error) · `Dialogo` (incluida la variante de confirmación
irreversible) · `EstadoBadge` (6 estados) · `SemaforoBadge` (4 casos) ·
`PantallaCargando` · `SelectorFecha` (fecha **operativa**, no calendario) ·
`PersonalBadge`.

Faltantes que necesito que propongas: tabla de datos (encabezado, fila, fila resaltada,
fila seleccionada, columna fija, scroll horizontal), paginación, barra de filtros,
buscador de producto con resultados, entrada de lista de números de estiba, tarjeta de
indicador, línea de tiempo de estados, estado vacío, panel lateral, notificación breve de
éxito, y un indicador de "margen disponible contra el DPP".

**Para cada componente entrega:** anatomía, medidas, tokens que usa, todos los estados,
comportamiento responsive, y comportamiento de teclado y lector de pantalla.

---

## 9. Accesibilidad — no negociable

- Contraste mínimo **4,5:1** (texto) y **3:1** (elementos de interfaz), con las cifras reportadas.
- El color **nunca** es el único portador de significado (crítico en estados y semáforos).
- Foco visible en todo elemento interactivo. Orden de tabulación lógico.
- Áreas táctiles de al menos 44 px en las pantallas que se usan de pie.
- Etiquetas reales en los campos, no solo placeholders.
- Los mensajes de error dicen **qué pasó y qué hacer**, en español claro, sin códigos
  técnicos en el texto principal.

---

## 10. Datos de ejemplo para poblar los mockups

Usa **estos** valores, no inventes otros:

- **Empresa/planta:** Inlotrans S.A.S. — Maquila PepsiCo Santo Domingo (único lugar).
- **Usuario de ejemplo:** Jhonson Ramírez · rol `COORDINADOR_MQ`.
- **Fecha operativa:** 2026-09-22. Turno en curso: T2 (14:00–21:30).
- **Consecutivos:** `2026-0146`, `2026-0147`, `2026-0148` (uno en v2).
- **Grupos:** LOGICMARD (esperadas 12, llegaron 11) · MAXISERVICE (8/8) ·
  APOYOS MAXI (6/4) · MIX (5/5).
- **Líneas:** L1, L2, L3, L4 (MULTIPACK, 306 kg/h) · L5 (MANUAL, 306 kg/h) ·
  MANUAL-1, MANUAL-2 (249 kg/h) · REEMPAQU-2, REEMPAQUES (203 kg/h).
- **Estados a mostrar en el listado:** al menos uno de cada uno de los seis, incluida
  una `APROBADA` pendiente de conciliar (fila resaltada) y una extraoficial.
- **Cifras del tablero:** MFR del día 92,4 % (AMARILLO, meta 95 %); programado
  18.420 cajas en 27 bloques y 6 líneas; producido sin programar 340 cajas en 2 SKU;
  pedidos de emergencia 180 cajas en 1 SKU.
- **Un bloque de ejemplo:** `L3 · 06:00–13:30 · 420 cajas/h · E 85 % → Mx 3.150 · T 2.678`.
- **Estibas de ejemplo:** 2 completas + 21 cajas sueltas, números 31, 32, 33 →
  se muestra como "2 estibas + 21 cajas".
- **Formatos:** números con separador de miles en español de Colombia (`18.420`);
  porcentajes con una decimal (`92,4 %`); fechas de solo día como `22/09/2026`;
  instantes con hora en zona de Colombia.

**Sobre la marca:** el área **todavía no ha definido identidad visual** para el
aplicativo. Hoy la marca es un cuadrado con las letras "MQ" y el texto
"Maquila · Inlotrans". Puedes proponer un tratamiento tipográfico de marca, pero
**no inventes un logo de Inlotrans**: márcalo como `PREGUNTA: ¿existe manual de marca
de Inlotrans?`.

---

## 11. Formato exacto de tu respuesta

Entrega en Markdown, en este orden:

1. **Resumen de dirección** (máx. 10 líneas): el concepto en palabras, para que yo pueda
   aprobarlo o corregirlo antes de leer 40 páginas.
2. **Tokens del sistema** (JSON + el bloque `@theme` de Tailwind v4).
3. **Catálogo de componentes.**
4. **Guía de movimiento** (tokens + tabla de animaciones: elemento · propiedad · valores ·
   duración · easing · disparador · versión reducida).
5. **Especificación pantalla por pantalla**, en el orden de la sección 5, cada una con su
   wireframe.
6. **Decisiones que tomaste**, cada una en formato **Problema · Opciones · Ventajas ·
   Desventajas · Recomendación**.
7. **`SUPUESTOS`** — lista numerada de todo lo que asumiste.
8. **`PREGUNTAS`** — lista numerada de lo que necesitas que el área responda, ordenada
   por cuánto bloquea.

No escribas componentes de React ni CSS de producción: el agente que sigue lo hará. Lo
que necesita de ti son decisiones, medidas y razones.

---

## 12. Recordatorio final

Este aplicativo lo va a usar gente real, de pie, en una planta, a las tres de la mañana,
para producir un documento que otra empresa firma. Si en algún punto tienes que elegir
entre que se vea impresionante y que se entienda a la primera, **elige que se entienda**.
Lo dinámico y lo creativo tienen que caber dentro de esa decisión, no por encima de ella.
