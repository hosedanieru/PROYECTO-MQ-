/**
 * TEXTOS EN ESPAÑOL — origen de verdad
 * ====================================
 *
 * Este archivo manda: `en.ts` está tipado contra él, así que si aquí se
 * agrega una clave y allá no, TypeScript lo reporta al compilar. No hay
 * forma de dejar un texto sin traducir sin que el compilador avise.
 *
 * Convenciones:
 *   · la clave describe DÓNDE se usa: `seccion.elemento`
 *   · `{algo}` es un hueco que se rellena al usar el texto
 *   · los textos con singular y plural van en dos claves: `.uno` y `.varios`
 */

export const es = {
  // ---------- Navegación y marco ----------
  'nav.inicio': 'Inicio',
  'nav.remisiones': 'Remisiones',
  'nav.mfr': 'MFR del día',
  'nav.programacion': 'Programación',
  'nav.administracion': 'Administración',
  'nav.productos': 'Productos',
  'nav.lineas': 'Líneas',
  'nav.pesos': 'Pesos por caja',
  'nav.grupos': 'Grupos',
  'nav.usuarios': 'Usuarios',
  'nav.abrirMenu': 'Abrir menú',
  'nav.cerrarMenu': 'Cerrar menú',
  'nav.irAlInicio': 'Ir al inicio',
  'nav.eslogan': 'Juntos llevamos más lejos cada producto',

  // ---------- Barra superior ----------
  'barra.diaOperativo': 'Día operativo {fecha}',
  'barra.explicacionDia': 'El día productivo va de las 06:00 a las 06:00 del día siguiente',
  'barra.turnoEnCurso': 'Turno en curso',
  'barra.cerrarSesion': 'Cerrar sesión',
  'barra.salir': 'Salir',
  'barra.temaOscuro': 'Cambiar a tema oscuro',
  'barra.temaClaro': 'Cambiar a tema claro',
  'barra.cambiarIdioma': 'Switch to English',

  // ---------- Login ----------
  'login.titulo': 'Maquila MQ',
  'login.subtitulo': 'Ingresa con tu documento para continuar.',
  'login.documento': 'Documento',
  'login.contrasena': 'Contraseña',
  'login.recordar': 'Recordar sesión en este equipo',
  'login.avisoRecordar':
    'No lo marques en un computador compartido: la sesión se cerrará al cerrar la pestaña.',
  'login.entrar': 'Ingresar',
  'login.faltaDocumento': 'Ingrese su documento.',
  'login.faltaContrasena': 'Ingrese su contraseña.',
  'login.marcaEtiqueta': 'Aplicativo de Maquila',
  'login.marcaTitulo': 'Juntos movemos más',
  'login.marcaTexto':
    'Remisiones, cumplimiento del DPP y personal del turno, con trazabilidad de principio a fin.',
  'login.sede': 'Inlotrans S.A.S. · Mosquera, Cundinamarca',

  // ---------- Inicio ----------
  'inicio.buenosDias': 'Buenos días',
  'inicio.buenasTardes': 'Buenas tardes',
  'inicio.buenasNoches': 'Buenas noches',
  'inicio.subtitulo': 'Así va la maquila en el día operativo del {fecha}.',
  'inicio.diaEnCurso': 'Día operativo en curso',
  'inicio.indicadores': 'Indicadores del día',
  'inicio.remisionesDelDia': 'Remisiones del día',
  'inicio.frenteAyer': '{diferencia} frente a ayer',
  'inicio.cajasRemisionadas': 'Cajas remisionadas',
  'inicio.soloAprobadas': 'Solo cuentan las aprobadas por el OPA',
  'inicio.mfrDelDia': 'MFR del día',
  'inicio.meta': 'Meta {meta} %',
  'inicio.personalDelDia': 'Personal del día',
  'inicio.llegaronFrenteEsperado': 'Llegaron frente a lo esperado',
  'inicio.lineasEnProduccion': 'Líneas en producción',
  'inicio.lineasDescripcion': 'Qué SKU corre ahora en cada plataforma y con cuánta gente.',
  'inicio.cargandoProgramacion': 'Cargando la programación…',
  'inicio.flujoTitulo': 'Flujo de las remisiones',
  'inicio.flujoDescripcion': 'En qué punto está cada documento de hoy.',
  'inicio.avisosTitulo': 'Avisos del día',
  'inicio.avisosDescripcion':
    'Derivados de los datos de hoy; no reemplazan el módulo de alertas.',
  'inicio.cumplimientoPorTurno': 'Cumplimiento por turno',
  'inicio.cumplimientoTurnoDescripcion': 'Producido frente al target. Meta {meta} %.',
  'inicio.sinProgramacion': 'El día no tiene programación cargada.',
  'inicio.estadoRemisiones': 'Estado de las remisiones',
  'inicio.repartoDelDia': 'Reparto del día.',
  'inicio.resumenDelDia': 'Resumen del día',
  'inicio.kilosProducidos': 'Kilos producidos',
  'inicio.sinPesoConfirmado': 'Sin peso por caja confirmado',
  'inicio.deKg': 'de {total} kg',
  'inicio.cumplimientoKilos': 'Cumplimiento en kilos',
  'inicio.pedidosEmergencia': 'Pedidos de emergencia',
  'inicio.cajasFueraMfr': 'cajas, fuera del MFR',
  'inicio.ultimasRemisiones': 'Últimas remisiones',
  'inicio.ultimasDescripcion': 'Lo último registrado en el día operativo.',
  'inicio.verTodas': 'Ver todas',
  'inicio.accesosRapidos': 'Accesos rápidos',

  // ---------- Estados de remisión ----------
  'estado.BORRADOR': 'Borrador',
  'estado.ENTREGADA': 'Entregada',
  'estado.APROBADA': 'Aprobada',
  'estado.RECHAZADA': 'Rechazada',
  'estado.EN_RECTIFICACION': 'En rectificación',
  'estado.VALIDADA': 'Validada',

  // ---------- Genéricos ----------
  'comun.cajas': 'cajas',
  'comun.personas': 'personas',
  'comun.remisiones': 'remisiones',
  'comun.sinDato': 'Sin dato',
  'comun.cargando': 'Cargando…',
  'comun.procesando': 'Procesando…',
  'comun.guardar': 'Guardar',
  'comun.cancelar': 'Cancelar',
  'comun.cerrar': 'Cerrar',
  'comun.total': 'Total',
  'comun.nadaPendiente': 'Nada pendiente por ahora.',
} as const

export type ClaveTexto = keyof typeof es
