import { useLayoutEffect, useRef } from 'react'

import { crecerHasta } from '../../shared/animacion/animaciones'
import { COLOR_TONO, type TonoBadge } from '../Badge'

export interface SegmentoDona {
  clave: string
  etiqueta: string
  valor: number
  tono: TonoBadge
}

interface Props {
  segmentos: SegmentoDona[]
  /** Número grande del centro. */
  total: number
  /** Palabra bajo el total ("remisiones"). */
  unidad?: string
  tamano?: number
}

const GROSOR = 14
/**
 * Separación entre porciones, en píxeles de arco. No es decoración: dos
 * colores contiguos sin separación se leen como uno solo, y para quien
 * no distingue rojo y verde es la única pista de que son dos porciones.
 */
const SEPARACION = 3

/**
 * Dona de composición, con leyenda obligatoria.
 *
 * El orden de las porciones sigue el flujo de la remisión y NO es
 * decorativo: deja el morado de EN_RECTIFICACION entre el verde de
 * VALIDADA y el rojo de RECHAZADA. Verde y rojo pegados son el par que
 * un daltónico no puede separar; con el morado en medio, sí.
 *
 * La leyenda va siempre: el color nunca es la única forma de saber qué
 * es cada porción.
 */
export function Dona({ segmentos, total, unidad, tamano = 168 }: Props) {
  const grupo = useRef<SVGGElement>(null)

  const radio = (tamano - GROSOR) / 2
  const perimetro = 2 * Math.PI * radio
  const suma = segmentos.reduce((acumulado, s) => acumulado + s.valor, 0)

  // Cada porción arranca donde terminó la anterior, así que el arreglo se
  // construye acumulando: el inicio de una sale del final de la previa.
  const arcos = segmentos
    .filter((s) => s.valor > 0)
    .reduce<Array<SegmentoDona & { inicio: number; largo: number; visible: number }>>((previos, s) => {
      const anterior = previos.at(-1)
      const inicio = anterior ? anterior.inicio + anterior.largo : 0
      const largo = (s.valor / suma) * perimetro
      return [
        ...previos,
        // Nunca menos de 1 px: una porción de una sola remisión debe verse.
        { ...s, inicio, largo, visible: Math.max(largo - SEPARACION, 1) },
      ]
    }, [])

  useLayoutEffect(() => {
    const nodo = grupo.current
    if (!nodo) return
    const circulos = Array.from(nodo.querySelectorAll<SVGCircleElement>('circle'))
    const animaciones = circulos.map((circulo, indice) =>
      crecerHasta(circulo, 'strokeDashoffset', Number(circulo.dataset.largo), 0, indice * 90),
    )
    return () => {
      for (const animacion of animaciones) animacion?.revert()
    }
  }, [segmentos])

  if (suma === 0) {
    return (
      <p className="grid place-items-center text-sm text-tinta-suave" style={{ height: tamano }}>
        Sin registros todavía
      </p>
    )
  }

  return (
    <div className="flex flex-wrap items-center gap-6">
      <div className="relative shrink-0" style={{ width: tamano, height: tamano }}>
        <svg width={tamano} height={tamano} className="-rotate-90" aria-hidden="true">
          <g ref={grupo}>
            {arcos.map((arco) => (
              <circle
                key={arco.clave}
                data-largo={arco.visible}
                cx={tamano / 2}
                cy={tamano / 2}
                r={radio}
                fill="none"
                stroke={COLOR_TONO[arco.tono]}
                strokeWidth={GROSOR}
                strokeDasharray={`${arco.visible} ${perimetro}`}
                strokeDashoffset={0}
                transform={`rotate(${(arco.inicio / perimetro) * 360} ${tamano / 2} ${tamano / 2})`}
              />
            ))}
          </g>
        </svg>
        <div className="absolute inset-0 grid place-content-center text-center">
          <span className="cifra text-3xl font-bold text-tinta">{total}</span>
          {unidad && <span className="text-xs text-tinta-suave">{unidad}</span>}
        </div>
      </div>

      <ul className="min-w-0 flex-1 space-y-2">
        {segmentos.map((s) => (
          <li key={s.clave} className="flex items-center gap-2 text-sm">
            <span
              className="h-2.5 w-2.5 shrink-0 rounded-full"
              style={{ backgroundColor: COLOR_TONO[s.tono] }}
              aria-hidden="true"
            />
            <span className="min-w-0 flex-1 truncate text-tinta-suave">{s.etiqueta}</span>
            <span className="cifra font-semibold text-tinta">{s.valor}</span>
          </li>
        ))}
      </ul>
    </div>
  )
}
