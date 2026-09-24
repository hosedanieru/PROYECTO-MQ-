# Preguntas abiertas al área

Ninguna de estas se resuelve adivinando. Cada respuesta se anota en `CLAUDE.md` y en el documento del módulo correspondiente.

## Respondidas

| Fecha | Pregunta | Respuesta |
|---|---|---|
| 2026-09-16 | ¿Quién registra la respuesta del OPA? | Solo el coordinador |
| 2026-09-16 | ¿Cómo se carga el catálogo de productos? | A mano, uno a uno, desde el panel del administrador |
| 2026-09-16 | ¿Siguiente módulo en prioridad? | MFR |
| 2026-09-17 | ¿La programación viene en cajas o unidades? | Cajas; los kilos se derivan |
| 2026-09-17 | ¿Cuándo cuenta una remisión para el MFR? | Al aprobarla el OPA |
| 2026-09-17 | Meta del MFR | 95 % |
| 2026-09-18 | ¿La línea es activo físico o armado diario? | Activo físico: las 8 plataformas del DPP |
| 2026-09-18 | Turnos | Los del DPP (06:00–13:30 / 14:00–21:30 / 22:00–05:30), todos los días |
| 2026-09-18 | ¿Se puede remisionar más de lo programado? | No: ni más ni menos. Excepción: remisión extraoficial con motivo |
| 2026-09-19 | ¿Qué es `LINEA IDEAL`? | Personas necesarias en la línea para ese SKU |
| 2026-09-19 | ¿Qué es `PC`? | Se ignora por ahora |
| 2026-09-19 | ¿`SUBDESCRIPCION` se modela? | Sí: familia del producto; agrupa el Flavor Breakdown |
| 2026-09-19 | ¿El ritmo se maneja en BPM o por hora? | Por hora (cajas/hora) |
| 2026-09-21 | ¿"Proveedores" o "grupos"? | **Grupos**, sin excepción; el proveedor real va en la descripción |
| 2026-09-21 | ¿Contra qué se compara el personal del turno? | Solo contra las personas esperadas del grupo; la línea ideal del DPP es referencia |
| 2026-09-21 | ¿Se pueden asignar a líneas más personas de las que llegaron? | No. Primero asistencia, después asignación |
| 2026-09-22 | ¿Qué es la "receta"? | **Los insumos con los que se arma cada producto** (lista de materiales), no solo la configuración de empaque |
| 2026-09-22 | ¿Qué inventario necesita MQ? | El de **insumos**. El PT sigue siendo del WMS de bodega: con ese se concilia, no se duplica |
| 2026-09-22 | ¿Cuándo va el inventario? | Entre los **últimos** módulos, construido poco a poco |

## Urgente — bloquean trabajo inmediato

| # | Pregunta | Desbloquea |
|---|---|---|
| A1 | Lista de **áreas** de MQ (líneas de producción, averías, ¿calidad, inventario, bodega?) | Vistas por rol × área |
| A2 | Por cada área, qué **roles** existen y qué hace cada uno en el aplicativo | Vistas por rol × área |
| A3 | ¿Existe **supervisor** o el coordinador cumple ese papel? ¿Es de un área o de todas? | Roles |
| A4 | ¿Un usuario puede pertenecer a más de un área? | Modelo de usuario |
| A5 | ¿Desde qué **dispositivo** usa el sistema cada rol (tablet en planta, computador)? | Diseño de pantallas |
| A6 | ¿Hay zonas sin conexión? ¿Se necesita offline? | Arquitectura del frontend |

## Alta — pendientes del módulo MFR

El MFR quedó desbloqueado (ver la tabla de respondidas y [modules/mfr.md](modules/mfr.md)). Lo que sigue abierto:

| # | Pregunta | Bloquea |
|---|---|---|
| H1 | **Peso neto por caja** de los productos del DPP. Desde el 2026-09-22 hay pantalla de carga en lote (`/admin/pesos`) con la sugerencia calculada; falta que el administrador confirme los valores | Los kilos del tablero |
| H2 | `descripcion` (proveedor real) y `personasEsperadas` de los 4 grupos sembrados | El semáforo de personal del turno |
| H3 | ¿Algún día de la semana opera con horarios distintos a los del DPP? | Turnos |
| H5 | Un **PDF semanal real** para verificar el formato. El importador de N días ya está (2026-09-22), pero se construyó sobre el supuesto de que el semanal es el mismo reporte GDPP508P con filas de varios días | Confirmar el importador semanal |
| H6 | Si durante la semana PepsiCo manda un diario corregido, ¿manda sobre el semanal ya cargado? Hoy hay que marcar "reemplazar" a mano con motivo | Política de recarga |
| H4 | Cómo traducir el faltante de personas de una línea a tiempo o productividad | Estimar el impacto del personal |

## Media — mejoran el diseño

| # | Pregunta |
|---|---|
| M1 | Política de contraseñas (complejidad, rotación, bloqueo por intentos); hoy solo mínimo 8 |
| M2 | ¿Auditar los inicios de sesión? |
| M3 | ¿Equipos compartidos entre coordinadores? (hoy: casilla "Recordar sesión") |
| M4 | ¿Migrar el histórico 2026, dejarlo como archivo, o migrarlo marcado `HISTORICO_EXCEL`? |
| M5 | ¿`LINEA` y `AUTOMATICA` son el mismo proceso? ¿Qué hoja manda cuando PRODUCTOS y TIEMPOS se contradicen? ¿Los códigos duplicados son repetidos o variantes? (solo si se retoma la importación) |
| M6 | ¿Qué hoja manda cuando PRODUCTOS y TIEMPOS se contradicen? (13 diferencias y 3 códigos repetidos detectados el 2026-09-19, sin aplicar) |
| M7 | ¿Qué significan PT y PI exactamente? |
| M8 | ¿El vencimiento puede ser anterior a la fecha operativa? (hoy se rechaza) |
| M9 | ¿Qué es el **cuaderno virtual**? |
| M10 | ¿El WMS registra el número de remisión de origen? (sigue abierto: define si la conciliación de PT es exacta o solo por totales) |
| M15 | **Receta / lista de materiales**: ¿cambia en el tiempo? Si sí hay que versionarla, y eso se decide antes de modelar. ¿Es por SKU o varía por línea/proceso? ¿Existe ya como ficha de armado en PDF? |
| M16 | **Insumos**: ¿qué cuenta como insumo? ¿Los pone PepsiCo o los compra Inlotrans? ¿Se manejan lotes, vencimiento, ubicaciones? |
| M17 | ¿Se adelanta una captura mínima de movimientos de insumos antes del módulo completo? El consumo real **no se puede reconstruir** después; lo teórico sí, porque las remisiones ya se guardan |
| M11 | ¿Planes de trabajo y configuración de turno son lo mismo? |
| M12 | ¿La "receta" es la ficha de armado o hay receta de ingredientes? |
| M13 | ¿Acceso a SAP? ¿De quién es el SAP? |
| M14 | ¿Dónde se despliega y quién administra? ¿Cuántos usuarios concurrentes? ¿Se necesitan fotografías? |

## Módulos sin levantamiento

Averías, Calidad, Inventario, Planes de trabajo, Cuaderno virtual, Entrega de turno, Alertas por desviación, Recetas. (Personal por turno quedó parcialmente resuelto dentro del MFR: grupos, asistencia y asignación a líneas.) Cada uno necesita responder las 13 preguntas de levantamiento de la Parte D del ROADMAP antes de escribir código; la más importante: **¿cómo se conecta con Remisiones?**
