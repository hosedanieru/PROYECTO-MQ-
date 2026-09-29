import type { TonoBadge } from '../../components/Badge'
import type { TipoItem, TipoMovimiento } from '../../shared/types/inventario'

/** Color de la etiqueta de cada tipo de ítem, igual en todas las pantallas. */
export const TONO_TIPO: Record<TipoItem, TonoBadge> = { INSUMO: 'neutro', PI: 'acento', PT: 'marca' }

export const TONO_MOVIMIENTO: Record<TipoMovimiento, TonoBadge> = { ENTRADA: 'exito', SALIDA: 'marca', AJUSTE: 'alerta' }
