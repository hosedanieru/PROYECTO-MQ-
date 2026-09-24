# Roles y permisos

Fuente de verdad: `backend/prisma/seed.ts`. El seed reemplaza los permisos de cada rol en cada corrida.

## Roles

| Rol | Quién | Resumen |
|---|---|---|
| `ADMINISTRADOR` | Administración de Inlotrans | **Superusuario.** Puede ejecutar cualquier acción y ver cualquier apartado del sistema, sin excepción. Está garantizado en dos niveles: el seed le asigna todos los permisos, y además `Usuario.tienePermiso()` devuelve `true` para este rol aunque el permiso no exista todavía en la base (un módulo nuevo nunca lo deja por fuera). El frontend aplica la misma regla. No está atado a ningún área. |
| `COORDINADOR_MQ` | Coordinador de Maquila en turno | Crea, edita, registra la respuesta del OPA, rectifica, valida (concilia), exporta. Edita catálogos (incluidos los grupos) y opera el MFR: carga la programación del DPP, registra asistencia y asignaciones, cierra el turno. |
| `PATINADOR` | Auxiliar logístico | Consulta y entrega al OPA. **No registra la respuesta del OPA** (decisión del área, 2026-09-16). |
| `CONSULTA` | Solo lectura | Consulta y exporta. |

Los actores de PepsiCo (OPA, contacto de conciliación) **no son usuarios**: se registran como dato en la remisión.

## Permisos

| Permiso | ADMIN | COORD | PATIN | CONSULTA |
|---|:-:|:-:|:-:|:-:|
| `remision.crear` | ✓ | ✓ | | |
| `remision.consultar` | ✓ | ✓ | ✓ | ✓ |
| `remision.editar` | ✓ | ✓ | | |
| `remision.entregar` | ✓ | | ✓ | |
| `remision.registrar_aprobacion` | ✓ | ✓ | | |
| `remision.rectificar` | ✓ | ✓ | | |
| `remision.validar` | ✓ | ✓ | | |
| `remision.exportar` | ✓ | ✓ | | ✓ |
| `catalogo.consultar` | ✓ | ✓ | ✓ | ✓ |
| `catalogo.editar` | ✓ | ✓ | | |
| `catalogo.editar_estandares` | ✓ | | | |
| `admin.usuarios` | ✓ | | | |
| `admin.auditoria` | ✓ | | | |
| `mfr.consultar` | ✓ | ✓ | | ✓ |
| `mfr.cargar_programacion` | ✓ | ✓ | | |
| `mfr.configurar_turno` | ✓ | ✓ | | |

`catalogo.editar` se le dio al coordinador el 2026-09-21 (decisión del usuario): necesitaba gestionar **grupos**, y se prefirió el permiso completo de catálogo antes que crear uno específico. Solo el administrador conserva `catalogo.editar_estandares` (cajas/hora y peso por caja).

## Cómo se aplica

- **Backend**: guards globales. Sin token → 401. Con token pero sin el permiso del endpoint → 403 `AUTH_PERMISO_DENEGADO` (el mensaje dice cuál permiso falta). Los permisos se leen de la base en cada petición.
- **Frontend**: el menú, los accesos del panel y los botones de acción se filtran por permiso. Es comodidad; la protección real es del backend.
- **Reglas adicionales**: un administrador no puede desactivarse a sí mismo. Un usuario desactivado pierde el acceso en la siguiente petición aunque su token siga vigente.

## Pendiente de definir con el área

- Vistas por **rol × área** (líneas de producción, averías, …): qué ve cada rol al entrar y qué hace un operario de cada área. Modelo de referencia: aplicativo de recepción de Inlotrans (rol × operación).
- Política de contraseñas (hoy solo mínimo 8 caracteres), auditoría de inicios de sesión, equipos compartidos.
