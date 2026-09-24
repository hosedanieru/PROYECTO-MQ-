import { useLayoutEffect, useRef } from 'react'

import { crecerHasta } from '../../shared/animacion/animaciones'
import { COLOR_TONO, type TonoBadge } from '../Badge'

interface Props {
  /** Porcentaje 0–100. Por encima de 100 el arco se queda lleno. */
  valor: number
  tono?: TonoBadge
  /** Diámetro en píxeles. */
  tamano?: number
  grosor?: number
  /** Texto del centro. Si se omite, se escribe el porcentaje. */
  etiqueta?: string
  /** Descripción para lectores de pantalla (el SVG por sí solo no dice nada). */
  titulo: string
}

/**
 * Anillo de un solo valor: el indicador redondo de las tarjetas del
 * tablero.
 *
 * El arco se dibuja con `stroke-dasharray`: se le dice al trazo que
 * dibuje N píxeles y salte el resto. Animar `stroke-dashoffset` de N a 0
 * hace que el arco "crezca" desde el inicio.
 */
export function Anillo({ valor, tono = 'marca', tamano = 56, grosor = 6, etiqueta, titulo }: Props) {
  const arco = useRef<SVGCircleElement>(null)

  const radio = (tamano - grosor) / 2
  const perimetro = 2 * Math.PI * radio
  const porcion = Math.min(Math.max(valor, 0), 100) / 100
  const largo = perimetro * porcion

  useLayoutEffect(() => {
    const animacion = crecerHasta(arco.current, 'strokeDashoffset', largo, 0)
    return () => {
      animacion?.revert()
    }
  }, [largo])

  return (
    <div className="relative shrink-0" style={{ width: tamano, height: tamano }}>
      <svg width={tamano} height={tamano} role="img" aria-label={titulo} className="-rotate-90">
        <circle
          cx={tamano / 2}
          cy={tamano / 2}
          r={radio}
          fill="none"
          stroke="var(--color-borde)"
          strokeWidth={grosor}
        />
        <circle
          ref={arco}
          cx={tamano / 2}
          cy={tamano / 2}
          r={radio}
          fill="none"
          stroke={COLOR_TONO[tono]}
          strokeWidth={grosor}
          strokeLinecap="round"
          strokeDasharray={`${largo} ${perimetro}`}
          strokeDashoffset={0}
        />
      </svg>
      <span className="cifra absolute inset-0 grid place-items-center text-xs font-bold text-tinta">
        {etiqueta ?? `${Math.round(valor)}%`}
      </span>
    </div>
  )
}
