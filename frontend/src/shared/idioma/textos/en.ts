/**
 * TEXTOS EN INGLÉS
 * ================
 *
 * Tipado contra `es.ts`: si allá se agrega una clave y aquí falta,
 * TypeScript no compila. Es la garantía de que no queda medio traducido.
 *
 * Los nombres del DPP de PepsiCo (T, Mx, Target Kilograms…) ya vienen
 * del documento en inglés, así que en esta versión son el término
 * principal en vez de la aclaración entre paréntesis.
 */

import type { ClaveTexto } from './es'

export const en: Record<ClaveTexto, string> = {
  // ---------- Navegación y marco ----------
  'nav.inicio': 'Home',
  'nav.remisiones': 'Delivery notes',
  'nav.mfr': "Today's MFR",
  'nav.programacion': 'Schedule',
  'nav.administracion': 'Administration',
  'nav.productos': 'Products',
  'nav.lineas': 'Lines',
  'nav.pesos': 'Weight per case',
  'nav.grupos': 'Crews',
  'nav.usuarios': 'Users',
  'nav.abrirMenu': 'Open menu',
  'nav.cerrarMenu': 'Close menu',
  'nav.irAlInicio': 'Go to home',
  'nav.eslogan': 'Together we take every product further',

  // ---------- Barra superior ----------
  'barra.diaOperativo': 'Operating day {fecha}',
  'barra.explicacionDia': 'The production day runs from 06:00 to 06:00 the next day',
  'barra.turnoEnCurso': 'Shift in progress',
  'barra.cerrarSesion': 'Sign out',
  'barra.salir': 'Sign out',
  'barra.temaOscuro': 'Switch to dark theme',
  'barra.temaClaro': 'Switch to light theme',
  'barra.cambiarIdioma': 'Cambiar a español',

  // ---------- Login ----------
  'login.titulo': 'Maquila MQ',
  'login.subtitulo': 'Sign in with your ID number to continue.',
  'login.documento': 'ID number',
  'login.contrasena': 'Password',
  'login.recordar': 'Remember me on this computer',
  'login.avisoRecordar':
    'Do not tick this on a shared computer: the session will end when you close the tab.',
  'login.entrar': 'Sign in',
  'login.faltaDocumento': 'Enter your ID number.',
  'login.faltaContrasena': 'Enter your password.',
  'login.marcaEtiqueta': 'Maquila application',
  'login.marcaTitulo': 'Together we move more',
  'login.marcaTexto':
    'Delivery notes, DPP compliance and shift staffing, traceable end to end.',
  'login.sede': 'Inlotrans S.A.S. · Mosquera, Cundinamarca',

  // ---------- Inicio ----------
  'inicio.buenosDias': 'Good morning',
  'inicio.buenasTardes': 'Good afternoon',
  'inicio.buenasNoches': 'Good evening',
  'inicio.subtitulo': "How the maquila is doing on the operating day of {fecha}.",
  'inicio.diaEnCurso': 'Operating day in progress',
  'inicio.indicadores': "Today's indicators",
  'inicio.remisionesDelDia': "Today's delivery notes",
  'inicio.frenteAyer': '{diferencia} vs. yesterday',
  'inicio.cajasRemisionadas': 'Cases delivered',
  'inicio.soloAprobadas': 'Only those approved by the OPA count',
  'inicio.mfrDelDia': "Today's MFR",
  'inicio.meta': 'Target {meta} %',
  'inicio.personalDelDia': "Today's staffing",
  'inicio.llegaronFrenteEsperado': 'Turned up vs. expected',
  'inicio.lineasEnProduccion': 'Lines in production',
  'inicio.lineasDescripcion': 'Which SKU is running on each platform and with how many people.',
  'inicio.cargandoProgramacion': 'Loading the schedule…',
  'inicio.flujoTitulo': 'Delivery note flow',
  'inicio.flujoDescripcion': "Where each of today's documents stands.",
  'inicio.avisosTitulo': "Today's notices",
  'inicio.avisosDescripcion':
    "Derived from today's data; they do not replace the alerts module.",
  'inicio.cumplimientoPorTurno': 'Compliance by shift',
  'inicio.cumplimientoTurnoDescripcion': 'Produced against target. Goal {meta} %.',
  'inicio.sinProgramacion': 'This day has no schedule loaded.',
  'inicio.estadoRemisiones': 'Delivery note status',
  'inicio.repartoDelDia': "Today's breakdown.",
  'inicio.resumenDelDia': "Day summary",
  'inicio.kilosProducidos': 'Kilograms produced',
  'inicio.sinPesoConfirmado': 'Weight per case not confirmed',
  'inicio.deKg': 'of {total} kg',
  'inicio.cumplimientoKilos': 'Compliance in kilograms',
  'inicio.pedidosEmergencia': 'Emergency orders',
  'inicio.cajasFueraMfr': 'cases, outside the MFR',
  'inicio.ultimasRemisiones': 'Latest delivery notes',
  'inicio.ultimasDescripcion': 'The most recent entries of the operating day.',
  'inicio.verTodas': 'See all',
  'inicio.accesosRapidos': 'Quick links',

  // ---------- Estados de remisión ----------
  'estado.BORRADOR': 'Draft',
  'estado.ENTREGADA': 'Delivered',
  'estado.APROBADA': 'Approved',
  'estado.RECHAZADA': 'Rejected',
  'estado.EN_RECTIFICACION': 'Being corrected',
  'estado.VALIDADA': 'Reconciled',

  // ---------- Genéricos ----------
  'comun.cajas': 'cases',
  'comun.personas': 'people',
  'comun.remisiones': 'delivery notes',
  'comun.sinDato': 'No data',
  'comun.cargando': 'Loading…',
  'comun.procesando': 'Working…',
  'comun.guardar': 'Save',
  'comun.cancelar': 'Cancel',
  'comun.cerrar': 'Close',
  'comun.total': 'Total',
  'comun.nadaPendiente': 'Nothing pending right now.',
}
