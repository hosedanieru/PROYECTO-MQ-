import { useLayoutEffect, useRef } from 'react'

import { crecerHasta } from '../../shared/animacion/animaciones'
import { COLOR_TONO, type TonoBadge } from '../Badge'

export interface BarraDato {
  clave: string
  /** Rótulo del eje ("T1"). */
  etiqueta: string
  /** `null` = no hay dato (turno sin programación), que no es lo mismo que 0. */
  valor: number | null
  tono?: TonoBadge
  /** Texto del globo al pasar el cursor. */
  detalle?: string
}

interface Props {
  datos: BarraDato[]
  /** Valor que ocupa todo el alto. */
  maximo: number
  /** Línea de referencia punteada (la meta del 95 %). */
  meta?: number
  sufijo?: string
  altura?: number
}

/**
 * Barras verticales con línea de meta.
 *
 * Con pocas barras (aquí son tres turnos) el valor se escribe encima de
 * cada una en vez de dibujar un eje vertical con marcas: se lee más
 * rápido y sobra la mitad de la tinta.
 */
export function Barras({ datos, maximo, meta, sufijo = '', altura = 150 }: Props) {
  const contenedor = useRef<HTMLDivElement>(null)

  useLayoutEffect(() => {
    const nodo = contenedor.current
    if (!nodo) return
    const barras = Array.from(nodo.querySelectorAll<HTMLElement>('[data-barra]'))
    const animaciones = barras.map((barra, indice) => crecerHasta(barra, 'scaleY', 0, 1, indice * 90))
    return () => {
      for (const animacion of animaciones) animacion?.revert()
    }
  }, [datos])

  const alto = (valor: number) => `${Math.min((valor / maximo) * 100, 100)}%`

  return (
    <div ref={contenedor}>
      <div className="relative flex items-end gap-4" style={{ height: altura }}>
        {meta !== undefined && meta <= maximo && (
          <div
            className="pointer-events-none absolute inset-x-0 border-t border-dashed border-tinta-suave/40"
            style={{ bottom: alto(meta) }}
          >
            <span className="absolute -top-2.5 right-0 bg-base px-1 text-[10px] font-semibold text-tinta-suave">
              meta {meta}
              {sufijo}
            </span>
          </div>
        )}

        {datos.map((dato) => (
          <div key={dato.clave} className="flex h-full flex-1 flex-col justify-end">
            {dato.valor === null ? (
              <span className="mb-1 text-center text-xs text-tinta-suave">—</span>
            ) : (
              <>
                <span className="cifra mb-1 text-center text-xs font-bold text-tinta">
                  {dato.valor}
                  {sufijo}
                </span>
                <div
                  data-barra
                  title={dato.detalle}
                  className="w-full origin-bottom rounded-t"
                  style={{
                    height: alto(dato.valor),
                    backgroundColor: COLOR_TONO[dato.tono ?? 'marca'],
                  }}
                />
              </>
            )}
          </div>
        ))}
      </div>

      <div className="mt-2 flex gap-4 border-t border-borde pt-2">
        {datos.map((dato) => (
          <span key={dato.clave} className="flex-1 text-center text-xs font-semibold text-tinta-suave">
            {dato.etiqueta}
          </span>
        ))}
      </div>
    </div>
  )
}
