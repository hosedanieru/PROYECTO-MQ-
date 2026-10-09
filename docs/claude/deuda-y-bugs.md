# Deuda técnica y bugs corregidos

> Leer cuando se tocan fechas, mapeadores, auth, despliegue o estilos. Índice en `CLAUDE.md`.
> Las secciones hasta el 2026-09-28 vienen del `CLAUDE.md` del commit `af7c694`; lo posterior se agregó el
> 2026-10-07 al recrear esta carpeta.

## Resuelto — hueco de seguridad (2026-09-16)

Los DTOs ya no reciben `*PorId` del cliente. El usuario sale del token y cada endpoint exige su permiso. Ver
"Autenticación y permisos" en `CLAUDE.md` §4. Revisado de nuevo el 2026-10-07 (`api.md`): de 99 rutas, solo
`POST /auth/login` es pública y `GET /auth/perfil` pide solo sesión; todas las demás tienen permiso.

## Pendientes técnicos

- Un JWT no se puede revocar antes de expirar (12 h). Si el área lo exige, habría que agregar refresh token o
  lista de revocación.
- `infrastructure/docker-compose.yml` se escribió sin poder ejecutarlo (Docker sin plugin Compose en el equipo de
  desarrollo). Validar con `docker compose config` antes del primer despliegue.
- La imagen del backend instala también las dependencias de desarrollo (la CLI de Prisma y `tsx` corren en el
  arranque para migrar y sembrar). Se puede adelgazar después.
- Los usuarios no pueden cambiar su propia contraseña; solo el administrador la restablece.
- El proyecto **no tiene `.prettierrc`** (2026-10-05): `PENDIENTE DE DEFINIR` si se agrega uno con el estilo actual
  (`--no-semi --single-quote --print-width 110`). Correr Prettier sin esas opciones cambia el estilo de todo.
- **Dos librerías de animación** (decisión del usuario, 2026-10-07): anime.js para lo existente y Motion para lo nuevo.
- `@react-three/fiber` muestra el aviso "THREE.Clock: This module has been deprecated" en consola. Viene de la
  librería, no del código del proyecto; desaparece cuando fiber actualice.

## Bug corregido el 2026-09-28: instantes corridos 5 horas

La sesión de PostgreSQL estaba en `America/Bogota` y `@prisma/adapter-pg` envía las fechas como hora UTC **sin zona**:
la base guardaba cada instante 5 h adelantado. La aplicación no lo notaba porque al leer se deshacía el error, pero lo
que generaba la propia base (`now()`) se leía 5 h atrasado, y cualquier consulta SQL directa veía horas falsas.

- **Regla:** toda conexión a PostgreSQL se crea con `crearAdaptadorPostgres()`
  (`infrastructure/database/prisma/adaptador-postgres.ts`), que fija `TimeZone=UTC` en la sesión. **Nunca**
  `new PrismaPg(...)` directo. La hora de Colombia se aplica solo al mostrar y al calcular la fecha operativa.
- Datos corregidos con la migración `20260928200000_instantes_a_utc` (resta el desfase de la zona de la sesión a todas
  las columnas `timestamptz`; en una base ya en UTC no cambia nada).
- Regresión cubierta por `test/zona-horaria.e2e-spec.ts` (mira la base por debajo de Prisma).

## Bugs corregidos el 2026-09-16 (para no repetirlos)

- El mapeador de remisión no persistía `motivo_ultimo_rechazo` ni los cambios de turno/grupo/lugar/producto.
- El cliente Prisma generado estaba desactualizado respecto al schema (falta de `prisma generate`).
- Un DTO con claves `undefined` pisaba valores reales al hacer spread (`sinIndefinidos` en los casos de uso de edición).
- Fechas de solo día formateadas en zona Bogotá retrocedían un día en el PDF.

## Bugs del frontend corregidos (2026-10-06 y 2026-10-07)

- **`text-base` no da tamaño**: el proyecto tiene un token de color `--base`, y Tailwind v4 resuelve `text-base` como
  `color: var(--base)` (blanco) y **nunca** como tamaño de 16 px. Si no hay otra clase de color que gane, el texto
  sale invisible (pasó con los títulos de `PestanasVista` y la columna de cajas del listado de remisiones). Corregido
  en todo el frontend con `text-[1rem]` (2026-10-07, a pedido del usuario). La trampa está escrita en `index.css`.
- **Velocidad al soltar = 0** en el giro 3D: `motionValue.getVelocity()` usa el reloj del bucle de Motion, que no
  avanza cuando el bucle lo lleva three. Se mide a mano con los movimientos de los últimos 100 ms (`giro.ts`).
- **Cromo negro** en el monograma 3D: sus caras frontales reflejaban el piso oscuro de la nave. Se resolvió con un
  ventanal frontal fuerte en `EntornoPlanta`, la placa inclinada hacia arriba y rugosidad 0,12.
- La banda (`EncabezadoPagina`) funde la izquierda del lienzo 3D con `mask-image`: las piezas protagonistas van en la
  mitad derecha o se apagan.
- La barra de navegación se midió **con la fuente Inter ya cargada** (`document.fonts.ready`); sin ella el texto es
  más angosto y la medida engaña. A 1024 px quedan 22 px libres: al agregar algo al menú, volver a medir.
