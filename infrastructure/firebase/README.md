# Firebase / Firestore

Configuración del proyecto de Firebase para el aplicativo MQ cuando `PERSISTENCIA=firestore`.

## Desplegar reglas e índices

```bash
npm install -g firebase-tools
firebase login
cd infrastructure/firebase
firebase use <id-del-proyecto>
firebase deploy --only firestore:rules,firestore:indexes
```

- `firestore.rules` niega todo acceso directo: el navegador nunca habla con Firestore; solo el backend (SDK de administrador).
- `firestore.indexes.json` declara el único índice compuesto que necesita el backend (auditoría por entidad + id). Si Firestore pide otro, el error incluye un enlace que lo crea con un clic; después agrégalo aquí.

## Emulador (desarrollo sin proyecto real)

Requiere Java 11+.

```bash
cd infrastructure/firebase
firebase emulators:start
# en backend/.env:  PERSISTENCIA=firestore  FIREBASE_PROJECT_ID=mq-local  FIRESTORE_EMULATOR_HOST=localhost:8080
```

## Colecciones

| Colección | Id del documento | Contenido |
|---|---|---|
| `usuarios` | generado | documento, nombre, email, passwordHash, activo, rolId (= código del rol), creadoEn, actualizadoEn |
| `roles` | código (`ADMINISTRADOR`…) | codigo, nombre, descripcion, activo, **permisos[]** (códigos embebidos) |
| `permisos` | código | modulo, descripcion |
| `turnos` | código (`T1`…) | codigo, nombre, activo, **horarios[]** embebidos |
| `grupos` | código | codigo, nombre, descripcion (proveedor escrito a mano), personasEsperadas, activo |
| `lugares` | código | codigo, nombre, activo |
| `productos` | generado | codigo, descripcion, subdescripcion, proceso, unidadesPorCaja, cajasPorEstiba, personasIdeal, cajasPorHora, pesoNetoKg, activo |
| `remisiones` | generado | todos los campos de la entidad + `numerosEstiba[]`, `fechaOperativaTexto` (YYYY-MM-DD), `anioNumero` (2026-0001) |
| `remisionVersiones` | `{remisionId}-v{n}` | version, motivoRechazo, datosAnteriores, rectificadaPorId, fechaRectificacion |
| `consecutivos` | `REMISION-{anio}` | ultimo |
| `auditoria` | generado | entidad, entidadId, accion, valorAnterior, valorNuevo, motivo, usuarioId, creadoEn |
| `lineasProduccion` | código (seed) o generado | codigo, nombre (como PepsiCo), tipo, capacidadKgHora, orden, activo |
| `bloquesProgramacion` | generado | fechaOperativa, fechaOperativaTexto, lineaId, turnoId, productoId, horaInicio, horaFin, cajasPorHora, eficienciaPorcentaje, loop, personasAsignadas, origen, creadoPorId, fechaCreacion, cerradoEn, cerradoPorId |
| `asistenciasTurno` | `{fecha}_{turnoId}_{grupoId}` | fechaOperativa, fechaOperativaTexto, turnoId, grupoId, personasLlegaron, observacion, registradaPorId, fechaRegistro |
| `asignacionesLinea` | `{fecha}_{turnoId}_{lineaId}_{grupoId}` | fechaOperativa, fechaOperativaTexto, turnoId, lineaId, grupoId, personas, registradaPorId, fechaRegistro |

Colecciones sin uso (diseño anterior; se pueden borrar desde la consola): `programaciones`, `configTurnos` (desde 2026-09-18) y `proveedores` (renombrada a `grupos` el 2026-09-21; los 4 documentos ya están copiados).

## Diferencias frente a PostgreSQL (aceptadas)

- **Consecutivo**: transacción optimista con reintento sobre `consecutivos/REMISION-{anio}` en vez de bloqueo de fila. Misma garantía (sin duplicados), otra técnica.
- **Listados**: se consulta por fecha operativa en Firestore y el resto de filtros se aplica en memoria (tope 5.000 documentos). Evita mantener un índice compuesto por cada combinación de filtros. A la escala de MQ es correcto.
- **Búsqueda de productos**: el catálogo se trae completo y se filtra en memoria (Firestore no busca texto).
- **Sin migraciones**: no hay esquema; el seed crea los catálogos. Sin usuario de BD limitado: las reglas niegan todo y el backend usa la cuenta de servicio.
- **Respaldos**: exportación de Firestore desde Google Cloud (no `pg_dump`).
