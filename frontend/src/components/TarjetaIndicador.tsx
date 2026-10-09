import type { ComponentType, SVGProps } from 'react'

import { useConteo } from '../shared/animacion/useAnimacion'
import { miles } from '../shared/utils/numeros'
import { COLOR_TONO, type TonoBadge } from './Badge'

/** Fondo pastel de cada tono (tokens de index.css). */
const FONDO: Record<TonoBadge, string> = {
  marca: 'bg-marca-claro',
  exito: 'bg-exito-claro',
  alerta: 'bg-alerta-claro',
  critico: 'bg-critico-claro',
  acento: 'bg-acento-claro',
  neutro: 'bg-velo',
}

interface Props {
  /** Qué mide, en mayúsculas pequeñas ("PROGRAMADO"). */
  etiqueta: string
  /** Unidad junto a la etiqueta, como en el tablero de Power BI: "CJ", "UND". */
  unidad?: string
  /** `null` = sin dato: se escribe "—", nunca 0. */
  valor: number | null
  Icono: ComponentType<SVGProps<SVGSVGElement>>
  tono: TonoBadge
  /** Línea pequeña debajo de la cifra ("6,5 % del programado"). */
  nota?: string
  /** Cómo se escribe la cifra (por defecto, miles con punto). */
  formato?: (n: number) => string
}

/**
 * TARJETA DE INDICADOR — al estilo del tablero de Power BI del área
 * =================================================================
 *
 * Referencia: `MQ VISUAL J3.pdf` (usuario, 2026-10-07): fondo pastel del
 * tono, cuadro de color con el ícono, etiqueta y cifra grande, y una raya
 * del color debajo de la cifra. Decisión del usuario (2026-10-07): los
 * paneles de indicadores quedan como el PDF; eso trae de vuelta las
 * tarjetas SOLO en los tableros (el resto sigue sin cajas, 2026-10-05).
 *
 * La cifra va en el color del texto (`text-tinta`), no en el del tono: un
 * naranja sobre naranja pálido no llega al contraste mínimo (4,5:1).
 * El color lo llevan el cuadro del ícono y la raya.
 */
export function TarjetaIndicador({ etiqueta, unidad, valor, Icono, tono, nota, formato = miles }: Props) {
  const cifra = useConteo(valor ?? 0, formato)

  return (
    <div className={`flex min-w-0 items-center gap-4 rounded-tarjeta p-4 shadow-tarjeta ${FONDO[tono]}`}>
      <span
        className="grid h-14 w-14 shrink-0 place-items-center rounded-2xl text-white shadow-tarjeta"
        style={{ backgroundColor: COLOR_TONO[tono] }}
        aria-hidden="true"
      >
        <Icono className="h-7 w-7" />
      </span>
      <div className="min-w-0">
        <p className="truncate text-xs font-bold uppercase tracking-wider text-tinta-suave">
          {etiqueta}
          {unidad && <span className="ml-1 font-semibold normal-case tracking-normal">({unidad})</span>}
        </p>
        <p className="cifra mt-0.5 text-3xl font-black leading-tight tracking-tight text-tinta">
          {valor === null ? '—' : <span ref={cifra}>{formato(valor)}</span>}
        </p>
        <span className="mt-1 block h-1 w-12 rounded-full" style={{ backgroundColor: COLOR_TONO[tono] }} aria-hidden="true" />
        {/* La nota pasa a una segunda línea en vez de cortarse: es la que da el contexto de la cifra. */}
        {nota && <p className="mt-1.5 text-xs font-semibold leading-snug text-tinta-suave">{nota}</p>}
      </div>
    </div>
  )
}
