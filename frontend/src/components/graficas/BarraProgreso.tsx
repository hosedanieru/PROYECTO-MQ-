import { useLayoutEffect, useRef } from 'react'

import { crecerHasta } from '../../shared/animacion/animaciones'
import { COLOR_TONO, type TonoBadge } from '../Badge'

interface Props {
  /** Porcentaje 0–100. */
  valor: number
  tono?: TonoBadge
  titulo?: string
  retraso?: number
}

/** Barra de avance horizontal. Crece de izquierda a derecha al aparecer. */
export function BarraProgreso({ valor, tono = 'marca', titulo, retraso = 0 }: Props) {
  const barra = useRef<HTMLDivElement>(null)
  const porcentaje = Math.min(Math.max(valor, 0), 100)

  useLayoutEffect(() => {
    const animacion = crecerHasta(barra.current, 'scaleX', 0, 1, retraso)
    return () => {
      animacion?.revert()
    }
  }, [porcentaje, retraso])

  return (
    <div
      className="h-1.5 w-full overflow-hidden rounded-full bg-borde"
      role="progressbar"
      aria-valuenow={Math.round(porcentaje)}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-label={titulo}
    >
      <div
        ref={barra}
        className="h-full origin-left rounded-full"
        style={{ width: `${porcentaje}%`, backgroundColor: COLOR_TONO[tono] }}
      />
    </div>
  )
}
