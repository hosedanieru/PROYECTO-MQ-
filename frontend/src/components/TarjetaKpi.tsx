import type { ComponentType, SVGProps } from 'react'
import { Link } from 'react-router-dom'

import { useConteo } from '../shared/animacion/useAnimacion'
import { miles } from '../shared/utils/numeros'
import type { TonoBadge } from './Badge'
import { Anillo } from './graficas/Anillo'

interface Props {
  etiqueta: string
  valor: number
  /** Denominador: "12 / 18". Sin él se muestra solo el valor. */
  sobre?: number | null
  unidad?: string
  /** Texto pequeño bajo la cifra ("+2 frente a ayer"). */
  detalle?: string
  tonoDetalle?: 'exito' | 'critico' | 'neutro'
  /** Valor del anillo, 0–100. `null` = no hay contra qué comparar. */
  porcentaje: number | null
  tono?: TonoBadge
  Icono: ComponentType<SVGProps<SVGSVGElement>>
  /** Si se pasa, la tarjeta completa es un enlace. */
  a?: string
  /**
   * No hay dato todavía: se escribe "—" en vez de la cifra. Un cero
   * significa "cero"; la ausencia de dato no es un cero.
   */
  sinDato?: boolean
}

const COLOR_DETALLE = {
  exito: 'text-exito',
  critico: 'text-critico',
  neutro: 'text-tinta-suave',
} as const

/**
 * Tarjeta de indicador: ícono, cifra grande, comparación y anillo.
 *
 * La cifra se escribe completa en el HTML y la animación solo la
 * recorre desde cero: si el JavaScript de animación no corre, el número
 * correcto ya está ahí.
 */
export function TarjetaKpi({
  etiqueta,
  valor,
  sobre,
  unidad,
  detalle,
  tonoDetalle = 'neutro',
  porcentaje,
  tono = 'marca',
  Icono,
  a,
  sinDato = false,
}: Props) {
  const cifra = useConteo(sinDato ? 0 : valor, (n) => miles(Math.round(n)))

  const contenido = (
    <>
      <div className="flex items-start gap-3">
        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-marca-claro text-marca-texto">
          <Icono />
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-xs font-semibold uppercase tracking-wide text-tinta-suave">
            {etiqueta}
          </p>
          <p className="mt-1 flex items-baseline gap-1">
            {sinDato ? (
              <span className="cifra text-2xl font-bold text-tinta-suave">—</span>
            ) : (
              <>
                <span ref={cifra} className="cifra text-2xl font-bold text-tinta">
                  {miles(valor)}
                </span>
                {sobre !== undefined && sobre !== null && (
                  <span className="cifra text-sm font-semibold text-tinta-suave">/ {miles(sobre)}</span>
                )}
                {unidad && <span className="text-xs text-tinta-suave">{unidad}</span>}
              </>
            )}
          </p>
          {detalle && <p className={`mt-1 text-xs font-medium ${COLOR_DETALLE[tonoDetalle]}`}>{detalle}</p>}
        </div>
        {porcentaje !== null && (
          <Anillo valor={porcentaje} tono={tono} titulo={`${etiqueta}: ${Math.round(porcentaje)} %`} />
        )}
      </div>
    </>
  )

  const clases =
    'block rounded-tarjeta border border-borde bg-base p-5 shadow-tarjeta transition duration-200'

  if (a) {
    return (
      <Link to={a} className={`${clases} hover:-translate-y-0.5 hover:border-marca/30 hover:shadow-elevada`}>
        {contenido}
      </Link>
    )
  }

  return <div className={clases}>{contenido}</div>
}
