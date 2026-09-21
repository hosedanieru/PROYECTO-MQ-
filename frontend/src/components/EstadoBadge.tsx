import { ETIQUETA_ESTADO, type EstadoRemision } from '../shared/types/remision'

const COLOR: Record<EstadoRemision, string> = {
  BORRADOR: 'bg-slate-100 text-slate-700',
  ENTREGADA: 'bg-blue-100 text-blue-800',
  APROBADA: 'bg-amber-100 text-amber-800',
  RECHAZADA: 'bg-red-100 text-red-800',
  EN_RECTIFICACION: 'bg-orange-100 text-orange-800',
  VALIDADA: 'bg-green-100 text-green-800',
}

/**
 * APROBADA va en ámbar, no en verde, a propósito: está aceptada por
 * PepsiCo pero aún sin conciliar. Solo VALIDADA es "terminada".
 */
export function EstadoBadge({ estado }: { estado: EstadoRemision }) {
  return (
    <span
      className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-medium ${COLOR[estado]}`}
    >
      {ETIQUETA_ESTADO[estado]}
    </span>
  )
}
