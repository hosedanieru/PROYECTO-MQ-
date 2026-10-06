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
| `grupos` | código | codigo, nombre, descripcion (proveedor escrito a mano), esperadasPorTurno { turnoId: personas }, activo. `seed:firestore` convierte el campo viejo `personasEsperadas` |
| `ajustesEsperadas` | `{fecha}_{turnoId}_{grupoId}` | fechaOperativa, fechaOperativaTexto, turnoId, grupoId, personas, motivo, usuarioId, fechaRegistro |
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
| `causalesAveria` | generado | catálogo de causales de avería |
| `reportesAveria` | generado | encabezado del reporte con sus **registros[]** embebidos (y las evidencias de cada uno, sin rutas públicas) |
| `unidadesMedida` | generado | codigo, nombre, activo |
| `pis` / `insumos` | generado | codigo, descripcion, unidadBaseId, presentacionId, contenidoPresentacion, unidadesPorCaja, cajasPorEstiba, activo |
| `itemsInventario` | generado | tipo (`PT`/`PI`/`INSUMO`), **una** referencia (`productoId` / `piId` / `insumoId`), existencia. El resto se lee del catálogo |
| `movimientosInventario` | generado | kardex (tipo, cantidad con signo, saldo, fecha operativa, turno, usuario, entradaId, remisionId, conteoTexto, cierreId…) |
| `recetas` | `{productoId}_v{version}` (se crea con `create`, que falla si ya existe) | productoId, version, vigenteDesde, creadaPorId, creadaPorNombre, **componentes[]** `{ itemId, cantidad }` (cantidad por caja, decimal) |
| `cierresInventario` | `YYYY-MM-DD` (se crea con `create`: un cierre por día) | fechaOperativa, fechaOperativaTexto, fechaHoraRegistro, usuarioId, usuarioNombre, observacion, **lineas[]** (sistema, enTransito, esperado, contado, merma, consumoTeorico, mermaPorcentaje, conteoTexto) |
| `listasDistribucion` | generado | nombre, recibe (REMISIONES por defecto), turnoId, incluirEnCierres, correos[], activo |
| `firmasRemision` | `{remisionId}_v{version}_{tipo}` | remisionId, version, tipo, usuarioId, usuarioNombre, usuarioDocumento, usuarioRol, declaracion, huella, trazo, dispositivo, ip, fechaHora (se crea con `create`: una por casilla y versión) |
| `resumenesTurno` | generado | tipo (TURNO/DIA), anio, numero, fechaOperativa, fechaOperativaTexto, turnoId, formato {codigo, version, vigencia}, datos (la foto), cerradoPorId, cerradoPorNombre, fechaHora. Consecutivo en `consecutivos/RESUMEN_TURNO-{anio}` y `RESUMEN_DIA-{anio}` |
| `enviosCorreo` | generado | origen, fechaHora, fechaOperativa, fechaOperativaTexto, turnoId, destinatarios[], remisionIds[], asunto, estado, error, usuarioId, usuarioNombre |
| `entradasMercancia` | generado | encabezado de la entrada de mercancía; sus líneas son los movimientos con su entradaId |

Colecciones sin uso (diseño anterior; se pueden borrar desde la consola): `programaciones`, `configTurnos` (desde 2026-09-18) y `proveedores` (renombrada a `grupos` el 2026-09-21; los 4 documentos ya están copiados).

## Diferencias frente a PostgreSQL (aceptadas)

- **Consecutivo**: transacción optimista con reintento sobre `consecutivos/REMISION-{anio}` en vez de bloqueo de fila. Misma garantía (sin duplicados), otra técnica.
- **Listados**: se consulta por fecha operativa en Firestore y el resto de filtros se aplica en memoria (tope 5.000 documentos). Evita mantener un índice compuesto por cada combinación de filtros. A la escala de MQ es correcto.
- **Búsqueda de productos**: el catálogo se trae completo y se filtra en memoria (Firestore no busca texto).
- **Sin migraciones**: no hay esquema; el seed crea los catálogos. Sin usuario de BD limitado: las reglas niegan todo y el backend usa la cuenta de servicio.
- **Respaldos**: exportación de Firestore desde Google Cloud (no `pg_dump`).
