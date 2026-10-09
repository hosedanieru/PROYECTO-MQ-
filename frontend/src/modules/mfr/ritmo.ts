import type { TonoBadge } from '../../components/Badge'
import type { EstadoRitmo } from '../../shared/types/mfr'

/**
 * Estado del ritmo → color y texto, en un solo lugar (como `semaforo.ts`).
 * Adelantado va en azul y no en verde: no es "mejor que en línea", es
 * producir antes de lo planeado, que también conviene revisar.
 */
export const TONO_RITMO: Record<EstadoRitmo, TonoBadge> = {
  ADELANTADO: 'marca',
  EN_LINEA: 'exito',
  RETRASADO: 'critico',
  SIN_DATO: 'neutro',
}

export const TEXTO_RITMO: Record<EstadoRitmo, string> = {
  ADELANTADO: 'Adelantado',
  EN_LINEA: 'En línea',
  RETRASADO: 'Retrasado',
  SIN_DATO: 'Sin dato',
}
