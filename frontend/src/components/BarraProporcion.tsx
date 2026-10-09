import { motion, RESORTE_GRAFICA } from '../shared/animacion/movimiento'
import { COLOR_TONO, type TonoBadge } from './Badge'

interface Props {
  valor: number
  total: number
  tono: TonoBadge
  /** Qué compara, para lectores de pantalla ("Hay 40 de 100 necesarios"). */
  descripcion: string
}

/**
 * Barra delgada "cuánto de cuánto": hay frente a lo que se necesita,
 * contado frente a lo esperado. Ver la proporción es más rápido que
 * restar dos números de cabeza.
 *
 * Crece con un resorte (Motion, 2026-10-07); si el dato cambia, va del
 * valor anterior al nuevo sin volver a cero.
 */
export function BarraProporcion({ valor, total, tono, descripcion }: Props) {
  const porcentaje = total > 0 ? Math.max(0, Math.min(100, (valor / total) * 100)) : 0
  return (
    <div
      role="meter"
      aria-label={descripcion}
      aria-valuemin={0}
      aria-valuemax={total}
      aria-valuenow={valor}
      className="h-2 w-full max-w-md overflow-hidden rounded-full bg-velo"
    >
      <motion.div
        className="h-full rounded-full"
        style={{ backgroundColor: COLOR_TONO[tono] }}
        initial={{ width: '0%' }}
        animate={{ width: `${porcentaje}%` }}
        transition={RESORTE_GRAFICA}
      />
    </div>
  )
}
