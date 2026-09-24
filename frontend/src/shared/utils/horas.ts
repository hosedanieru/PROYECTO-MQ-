/**
 * HORAS DENTRO DEL DÍA OPERATIVO
 * ==============================
 *
 * Espejo de `minutosOperativos` y `horasDeHorario` del backend
 * (`domain/mfr/horas-turno.ts`). Se usa SOLO para mostrar: qué bloque
 * está corriendo ahora. Ningún cálculo que valga como dato sale de aquí.
 *
 * El día operativo empieza a las 06:00, así que "22:00" son 960 minutos
 * de día operativo y "05:30" son 1410 (casi el final), no 330.
 */

const INICIO_DIA_OPERATIVO = '06:00'
const MINUTOS_DIA = 24 * 60

/** "22:00" → 1320 minutos de reloj. */
function minutosDeReloj(hora: string): number {
  const [h, m] = hora.split(':').map(Number)
  return h * 60 + m
}

/** Minutos desde las 06:00: "06:00" → 0, "05:30" → 1410. */
export function minutosOperativos(hora: string): number {
  return (minutosDeReloj(hora) - minutosDeReloj(INICIO_DIA_OPERATIVO) + MINUTOS_DIA) % MINUTOS_DIA
}

/** Duración en minutos de un rango; "22:00"→"06:00" son 480, no negativos. */
export function duracionMinutos(horaInicio: string, horaFin: string): number {
  const minutos = minutosDeReloj(horaFin) - minutosDeReloj(horaInicio)
  return minutos <= 0 ? minutos + MINUTOS_DIA : minutos
}

/** Hora del reloj de Bogotá, "HH:mm". */
export function horaBogotaDe(instante: Date): string {
  return new Intl.DateTimeFormat('en-GB', {
    timeZone: 'America/Bogota',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(instante)
}

/** Minuto del día operativo en el que estamos ahora mismo. */
export function minutoOperativoActual(instante: Date): number {
  return minutosOperativos(horaBogotaDe(instante))
}

/** ¿El minuto cae dentro del bloque? */
export function estaEnCurso(
  bloque: { horaInicio: string; horaFin: string },
  minutoActual: number,
): boolean {
  const inicio = minutosOperativos(bloque.horaInicio)
  const fin = inicio + duracionMinutos(bloque.horaInicio, bloque.horaFin)
  return minutoActual >= inicio && minutoActual < fin
}
