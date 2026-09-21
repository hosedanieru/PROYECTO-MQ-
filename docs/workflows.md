# Flujos

## Día operativo (regla más importante del sistema)

La operación corre de **06:00 a 06:00** en hora de Bogotá. Todo lo que ocurre antes de las 06:00 pertenece al día operativo anterior.

```text
fecha_operativa = fecha( instante − 6 horas ) en America/Bogota
```

Motivo: el T3 (20:00/22:00 → 06:00) cruza la medianoche. Sin esta regla la producción nocturna se partiría en dos días y todos los indicadores saldrían mal. **Toda agregación, reporte e indicador se agrupa por fecha operativa**, nunca por fecha calendario. El año del consecutivo también sale de ella.

El formulario de creación muestra al coordinador a qué día operativo quedará el registro.

## Flujo de la remisión

```text
   BORRADOR ──► ENTREGADA ──► APROBADA ──► VALIDADA
                    ▲              │
                    │              ▼
                    └── EN_RECTIFICACION ◄── RECHAZADA
```

| Paso | Estado resultante | Quién (permiso) | Datos que exige |
|---|---|---|---|
| Crear | `BORRADOR` | `remision.crear` | turno, proveedor, lugar, producto, vencimiento, cantidades, estibas |
| Editar datos | (no cambia) | `remision.editar` | solo en `BORRADOR` o `EN_RECTIFICACION` |
| Entregar al OPA | `ENTREGADA` | `remision.entregar` | — (usuario del token) |
| Registrar aprobación | `APROBADA` | `remision.registrar_aprobacion` | nombre del OPA, cargo opcional |
| Registrar rechazo | `RECHAZADA` | `remision.registrar_aprobacion` | motivo (obligatorio, ≥ 5 caracteres) |
| Rectificar | `EN_RECTIFICACION` | `remision.rectificar` | — ; versión +1, **mismo consecutivo**; la versión anterior se archiva con el motivo |
| Entregar de nuevo | `ENTREGADA` | `remision.entregar` | — |
| Validar (conciliar) | `VALIDADA` | `remision.validar` | contacto de PepsiCo con quien se concilió |

Las transiciones válidas están en `TRANSICIONES_PERMITIDAS` dentro de la entidad. Cualquier otra → 409 `REMISION_TRANSICION_INVALIDA`.

**Aprobación ≠ validación.** La aprobación la da el OPA de PepsiCo; la validación es la conciliación interna (cuaderno virtual). Una remisión `APROBADA` sin validar se destaca en ámbar en el listado: es la fuente probable de descuadres.

## Edición y rectificación

- `Remision.editar(cambios)` solo funciona en `BORRADOR` o `EN_RECTIFICACION` (409 `REMISION_NO_EDITABLE` en los demás).
- Se revalida el documento **completo** con las mismas reglas de la creación: una edición parcial no puede dejarlo incoherente.
- Editables: turno, proveedor, lugar, producto (con snapshot nuevo), vencimiento, cantidades, estibas, números de estiba, observaciones.
- No editables: consecutivo, fecha operativa, fecha/hora de registro, autor, estado, versión.
- Flujo típico tras un rechazo: **Rechazada → Rectificar → Editar datos → Entregar de nuevo**. La pantalla de edición muestra el motivo del rechazo.
- Cada edición y cada transición dejan auditoría con valor anterior y nuevo.

## Invariantes del negocio

1. Una remisión = un solo producto (SKU).
2. El consecutivo reinicia cada año; identidad `(año, número)`; reserva con bloqueo de fila.
3. Nunca se elimina una remisión. Un rechazo se corrige por rectificación; el consecutivo no se quema.
4. Snapshot de producto: el documento sigue diciendo lo que decía al firmarse aunque el catálogo cambie.
5. Estibas como dato estructurado: `estibas_completas` + `cajas_sueltas` + tabla de números. El texto ("2 estibas + 21 cajas") se calcula, no se guarda.
6. Debe haber al menos una estiba completa o una caja suelta; vencimiento posterior a la fecha operativa; números de estiba enteros positivos sin repetir.

## Documentos

- **PDF** (`GET /remisiones/:id/pdf`, `GET /remisiones/pdf?ids=`): formato impreso actual, dos por hoja carta. Marca de agua con el estado si no está aprobada; nota "versión N — rectificada" si N > 1. Desde el detalle ("Imprimir PDF") o seleccionando varias en el listado.
- **Excel** (`GET /remisiones/exportar`): mismos filtros del listado, sin paginar (tope 5000). Columnas del Excel del área con datos ya estructurados. Fechas de solo día en UTC; horas en Bogotá.

## Sesión

- Login por documento y contraseña. "Recordar sesión" → `localStorage`; sin marcar → `sessionStorage` (se cierra con la pestaña; para equipos compartidos).
- Token de 12 h. Un 401 en cualquier petición cierra la sesión y vuelve al login recordando a dónde se iba.
