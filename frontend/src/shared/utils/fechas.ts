/**
 * Fechas en la interfaz.
 *
 * `fechaOperativaDe` es el espejo de `calcularFechaOperativa` del
 * backend: día en hora de Bogotá del instante menos 6 horas. Se usa
 * SOLO para mostrarle al coordinador a qué día productivo va a quedar
 * el registro; el valor real lo calcula el servidor.
 */

const ZONA = 'America/Bogota'
const SEIS_HORAS = 6 * 60 * 60 * 1000

const formatoDia = new Intl.DateTimeFormat('en-CA', {
  timeZone: ZONA,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
})

/** YYYY-MM-DD del día operativo al que pertenece el instante. */
export function fechaOperativaDe(instante: Date): string {
  return formatoDia.format(new Date(instante.getTime() - SEIS_HORAS))
}

/** "14/09/2026" a partir de "2026-09-14". */
export function fechaCorta(iso: string): string {
  const [a, m, d] = iso.slice(0, 10).split('-')
  return `${d}/${m}/${a}`
}

const formatoDiaLargo = new Intl.DateTimeFormat('es-CO', {
  timeZone: 'UTC',
  weekday: 'long',
  day: 'numeric',
  month: 'short',
  year: 'numeric',
})

/**
 * "lunes, 14 sept 2026" a partir de "2026-09-14". Es un día de solo fecha
 * (día operativo): se formatea en UTC, porque en zona Bogotá retrocede un
 * día (ver la regla de fechas en CLAUDE.md).
 */
export function diaLargo(iso: string): string {
  const [a, m, d] = iso.slice(0, 10).split('-').map(Number)
  return formatoDiaLargo.format(new Date(Date.UTC(a, m - 1, d)))
}

/** "09:30" en hora de Bogotá: el instante real de un registro. */
export function hora(iso: string): string {
  return new Intl.DateTimeFormat('es-CO', { timeZone: ZONA, hour: '2-digit', minute: '2-digit', hour12: false }).format(
    new Date(iso),
  )
}

/** "14/09/2026 09:30" en hora de Bogotá a partir de un ISO completo. */
export function fechaHora(iso: string): string {
  return new Intl.DateTimeFormat('es-CO', {
    timeZone: ZONA,
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(new Date(iso))
}
