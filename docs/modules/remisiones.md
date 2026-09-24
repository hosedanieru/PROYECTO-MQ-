# Módulo Remisiones

**Estado: cerrado** (backend, frontend, PDF, Excel, historial, pruebas unitarias e integración). Es la entidad raíz del aplicativo: MFR, averías, calidad e inventario se construirán sobre sus datos.

## Qué es una remisión

Documento formal de entrega de Producto Terminado (PT) de Inlotrans a PepsiCo en la planta Maquila PepsiCo Santo Domingo. Reemplaza el formato en Excel `REMISIONES_AUTOMATIZADO_2026.xlsx`.

## Actores

| Actor | Organización | Usuario del sistema | Responsabilidad |
|---|---|---|---|
| Coordinador MQ en turno | Inlotrans | sí | Crea, edita, registra la respuesta del OPA, rectifica, concilia |
| Patinador | Inlotrans | sí | Entrega al OPA (y carga el PT al WMS de bodega, fuera del sistema) |
| OPA (facturador) | PepsiCo | **no** | Aprueba o rechaza; se registra su nombre y cargo |
| Contacto de conciliación | PepsiCo | **no** | Contraparte del cuaderno virtual; se registra su nombre |

## Reglas de negocio (en la entidad `Remision`)

Ver [workflows.md](../workflows.md) para el flujo de estados, la edición y las invariantes. Resumen:

- Un producto por remisión; consecutivo anual con bloqueo de fila; nunca se elimina.
- Fecha operativa con corte 06:00–06:00; el año del consecutivo sale de ella.
- Snapshot de código y descripción del producto.
- Cantidades enteras positivas; al menos una estiba completa o una caja suelta; números de estiba únicos; vencimiento posterior a la fecha operativa.
- Aprobación (OPA) y validación (conciliación interna) son eventos distintos.

## Pantallas

| Ruta | Qué hace |
|---|---|
| `/remisiones` | Listado con filtros en la URL (fecha operativa, estado, turno, grupo), paginación, selección para imprimir por lote, exportar a Excel. Aprobadas sin conciliar en ámbar. |
| `/remisiones/nueva` | Formulario con cálculo asistido: al escribir cajas, sugiere estibas completas, sueltas y unidades a partir del empaque del producto. Muestra el día operativo del registro. |
| `/remisiones/:id` | Detalle como se firmó, trazabilidad (entrega, OPA, conciliación), botones de flujo según estado y permiso, "Editar datos", "Imprimir PDF", historial (versiones; auditoría para quien tenga `admin.auditoria`). |
| `/remisiones/:id/editar` | Mismo formulario precargado; solo en BORRADOR o EN_RECTIFICACION; muestra el motivo del rechazo. |

## Documentos generados

- **PDF** con Puppeteer sobre una plantilla HTML (`infrastructure/pdf/plantilla-remision.ts`): formato actual del área, dos por hoja carta con línea de corte, marca de agua con el estado cuando no está aprobada, nota de versión rectificada, tres bloques de firma.
- **Excel** con exceljs: una fila por remisión, columnas equivalentes al Excel actual con estibas y números de estiba ya separados.

## Migración del histórico 2026

**Pendiente de decisión** (¿migrar, dejar como archivo, o migrar marcado como `HISTORICO_EXCEL`?). ~2.195 registros con problemas de calidad conocidos (estibas en texto libre, números de estiba dentro de observaciones, 322 variantes de turno). Cualquier importación debe generar reporte de excepciones; nunca adivinar.

## Catálogo de productos

Decisión del 2026-09-16: el administrador crea los productos **uno a uno** desde `/admin/productos`. La importación desde el Excel (con sus duplicados y contradicciones entre hojas) queda como opción futura y requiere respuestas del área.

## Lo que quedó fuera a propósito

- Estándares de producción del producto (`unidadesPorHora`, `cajasPorHora`): pertenecen a MFR, con permiso `catalogo.editar_estandares` y motivo obligatorio.
- Vistas distintas por rol × área: esperando la definición del área.
