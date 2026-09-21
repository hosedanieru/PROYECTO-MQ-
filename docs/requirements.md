# Preguntas abiertas al área

Ninguna de estas se resuelve adivinando. Cada respuesta se anota en `CLAUDE.md` y en el documento del módulo correspondiente.

## Respondidas

| Fecha | Pregunta | Respuesta |
|---|---|---|
| 2026-09-16 | ¿Quién registra la respuesta del OPA? | Solo el coordinador |
| 2026-09-16 | ¿Cómo se carga el catálogo de productos? | A mano, uno a uno, desde el panel del administrador |
| 2026-09-16 | ¿Siguiente módulo en prioridad? | MFR |

## Urgente — bloquean trabajo inmediato

| # | Pregunta | Desbloquea |
|---|---|---|
| A1 | Lista de **áreas** de MQ (líneas de producción, averías, ¿calidad, inventario, bodega?) | Vistas por rol × área |
| A2 | Por cada área, qué **roles** existen y qué hace cada uno en el aplicativo | Vistas por rol × área |
| A3 | ¿Existe **supervisor** o el coordinador cumple ese papel? ¿Es de un área o de todas? | Roles |
| A4 | ¿Un usuario puede pertenecer a más de un área? | Modelo de usuario |
| A5 | ¿Desde qué **dispositivo** usa el sistema cada rol (tablet en planta, computador)? | Diseño de pantallas |
| A6 | ¿Hay zonas sin conexión? ¿Se necesita offline? | Arquitectura del frontend |

## Alta — bloquean el módulo MFR

Ver [modules/mfr.md](modules/mfr.md): cajas o unidades; aprobadas o creadas; línea física o armado diario; `LINEA IDEAL`; meta de MFR; un correo real de programación; domingos y lunes 06:00–08:00.

## Media — mejoran el diseño

| # | Pregunta |
|---|---|
| M1 | Política de contraseñas (complejidad, rotación, bloqueo por intentos); hoy solo mínimo 8 |
| M2 | ¿Auditar los inicios de sesión? |
| M3 | ¿Equipos compartidos entre coordinadores? (hoy: casilla "Recordar sesión") |
| M4 | ¿Migrar el histórico 2026, dejarlo como archivo, o migrarlo marcado `HISTORICO_EXCEL`? |
| M5 | ¿`LINEA` y `AUTOMATICA` son el mismo proceso? ¿Qué hoja manda cuando PRODUCTOS y TIEMPOS se contradicen? ¿Los códigos duplicados son repetidos o variantes? (solo si se retoma la importación) |
| M6 | ¿Qué es `PC` en la hoja TIEMPOS? ¿`SUBDESCRIPCION` se modela? |
| M7 | ¿Qué significan PT y PI exactamente? |
| M8 | ¿El vencimiento puede ser anterior a la fecha operativa? (hoy se rechaza) |
| M9 | ¿Qué es el **cuaderno virtual**? |
| M10 | ¿El WMS registra el número de remisión de origen? ¿El inventario de MQ concilia contra el WMS o cubre otro alcance? |
| M11 | ¿Planes de trabajo y configuración de turno son lo mismo? |
| M12 | ¿La "receta" es la ficha de armado o hay receta de ingredientes? |
| M13 | ¿Acceso a SAP? ¿De quién es el SAP? |
| M14 | ¿Dónde se despliega y quién administra? ¿Cuántos usuarios concurrentes? ¿Se necesitan fotografías? |

## Módulos sin levantamiento

Averías, Calidad, Inventario, Planes de trabajo, Cuaderno virtual, Entrega de turno, Personal por turno, Alertas por desviación, Recetas. Cada uno necesita responder las 13 preguntas de levantamiento de la Parte D del ROADMAP antes de escribir código; la más importante: **¿cómo se conecta con Remisiones?**
