/**
 * Formateadores compartidos por las plantillas HTML de los PDF.
 *
 * Regla de fechas (CLAUDE.md): las de solo día se formatean en UTC (en
 * hora de Bogotá retrocederían un día); los instantes reales, en Bogotá.
 */

const ZONA = 'America/Bogota';

export function escapar(texto: string | number | null | undefined): string {
  return String(texto ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/** Fechas de solo día (operativa, vencimiento): en UTC, no retroceden. */
export function fechaDia(d: Date, anioCorto = false): string {
  return new Intl.DateTimeFormat('es-CO', {
    timeZone: 'UTC',
    day: '2-digit',
    month: '2-digit',
    year: anioCorto ? '2-digit' : 'numeric',
  }).format(d);
}

/** Instantes reales: en hora de Colombia. */
export function fechaRegistro(d: Date): string {
  return new Intl.DateTimeFormat('es-CO', { timeZone: ZONA, day: '2-digit', month: '2-digit', year: 'numeric' }).format(d);
}

export function horaRegistro(d: Date): string {
  return new Intl.DateTimeFormat('es-CO', { timeZone: ZONA, hour: 'numeric', minute: '2-digit', hour12: false }).format(d);
}
