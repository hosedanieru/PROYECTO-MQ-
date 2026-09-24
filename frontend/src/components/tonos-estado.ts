import type { EstadoRemision } from '../shared/types/remision'
import type { TonoBadge } from './Badge'

/**
 * Color de cada estado de remisión.
 *
 * Vive en su propio archivo y no junto a `EstadoBadge` porque también lo
 * usan las gráficas: el color pertenece al estado, no al componente que
 * lo dibuja. Una remisión APROBADA tiene el mismo ámbar en la etiqueta,
 * en la dona y en la línea de tiempo.
 *
 * APROBADA va en ámbar y no en verde a propósito: está aceptada por
 * PepsiCo pero aún sin conciliar. Solo VALIDADA es "terminada".
 */
export const TONO_ESTADO: Record<EstadoRemision, TonoBadge> = {
  BORRADOR: 'neutro',
  ENTREGADA: 'marca',
  APROBADA: 'alerta',
  RECHAZADA: 'critico',
  EN_RECTIFICACION: 'acento',
  VALIDADA: 'exito',
}
