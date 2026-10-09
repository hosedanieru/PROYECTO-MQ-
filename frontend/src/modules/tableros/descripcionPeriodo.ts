import { fechaCorta } from '../../shared/utils/fechas'
import type { PeriodoTablero } from './usePeriodoTablero'

/** "Día operativo 06/10/2026." o "Del 30/09/2026 al 06/10/2026." */
export function descripcionPeriodo(p: Pick<PeriodoTablero, 'periodo' | 'desde' | 'hasta'>): string {
  return p.periodo === 'dia' ? `Día operativo ${fechaCorta(p.hasta)}.` : `Del ${fechaCorta(p.desde)} al ${fechaCorta(p.hasta)}.`
}
