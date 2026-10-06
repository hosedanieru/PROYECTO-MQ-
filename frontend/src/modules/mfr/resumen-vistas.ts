import type { IndicadoresDia } from '../../shared/types/mfr'
import { miles } from '../../shared/utils/numeros'

/*
 * Frases de resumen de las vistas del tablero MFR. Se muestran en la
 * pestaña (para saber qué hay antes de entrar) y arriba de la vista.
 * Archivo aparte para que Vite pueda recargar los componentes en caliente.
 */

/** Cuántos PT están bajo la meta. */
export function resumenPt(mfr: IndicadoresDia['mfr'], meta: number): string {
  const total = mfr.porProducto.length
  if (total === 0) return 'Sin PT programados'
  const bajo = mfr.porProducto.filter((p) => (p.cumplimiento ?? 0) < meta).length
  return bajo === 0 ? `Los ${total} PT en la meta` : `${bajo} de ${total} PT bajo la meta`
}

/** Cuántos turnos con dato cumplen la meta. */
export function resumenTurnos(turnos: IndicadoresDia['turnos'], meta: number): string {
  const conDato = turnos.filter((t) => t.cumplimiento !== null)
  if (conDato.length === 0) return 'Sin producción aún'
  const cumplen = conDato.filter((t) => (t.cumplimiento ?? 0) >= meta).length
  return `${cumplen} de ${conDato.length} turnos en la meta`
}

/** Kilos producidos frente a la meta del día. */
export function resumenKilos(horario: IndicadoresDia['horario']): string {
  const meta = horario.totalTargetKg.reduce((s, v) => s + v, 0)
  if (meta === 0) return 'Faltan pesos por caja'
  const producido = horario.totalInstantKg.reduce((s, v) => s + v, 0)
  return `${miles(producido)} de ${miles(meta)} kg`
}
