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
      <div
        className="h-full rounded-full transition-[width] duration-700"
        style={{ width: `${porcentaje}%`, backgroundColor: COLOR_TONO[tono] }}
      />
    </div>
  )
}
