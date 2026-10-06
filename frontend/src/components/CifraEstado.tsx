import type { TonoBadge } from './Badge'
import { COLOR_TONO } from './Badge'
import { FRANJA_TONO } from './franjas'
import { useConteo } from '../shared/animacion/useAnimacion'
import { miles } from '../shared/utils/numeros'

type Variante = 'tarjeta' | 'vidrio'

interface Props {
  etiqueta: string
  /** `null` = todavía no hay dato: se escribe "—", no un cero. */
  valor: number | null
  tono: TonoBadge
  /** Si se pasa, se dibuja la barra con la parte de este total que es `valor`. */
  total?: number | null
  /** Si se pasa, el recuadro es un botón (por ejemplo, para filtrar). */
  onClick?: () => void
  /** Marcado como el filtro en uso. */
  activo?: boolean
  /** Texto pequeño debajo ("sin conciliar"). */
  detalle?: string
  /**
   * `tarjeta` (por defecto) para fondo claro; `vidrio` para ir dentro de
   * la banda oscura de `EncabezadoPagina`.
   */
  variante?: Variante
}

const ANILLO_ACTIVO: Record<TonoBadge, string> = {
  neutro: 'ring-neutro',
  marca: 'ring-marca',
  exito: 'ring-exito',
  alerta: 'ring-alerta',
  critico: 'ring-critico',
  acento: 'ring-acento',
}

/**
 * Cifra grande con el color de su estado: "6 · Por aprobar".
 *
 * Va en fila sobre los listados. Tocarla filtra el listado por ese
 * estado: el número dice cuántas hay y a la vez es el atajo para verlas.
 *
 * El número cuenta desde cero al aparecer y al cambiar (`useConteo`),
 * pero el valor real ya está escrito en el HTML: si la animación no
 * corre, el dato correcto sigue a la vista.
 */
export function CifraEstado({
  etiqueta,
  valor,
  tono,
  total,
  onClick,
  activo = false,
  detalle,
  variante = 'tarjeta',
}: Props) {
  const cifra = useConteo(valor ?? 0, (n) => miles(Math.round(n)))
  const color = COLOR_TONO[tono]
  const proporcion = valor !== null && total ? Math.min(100, (valor / total) * 100) : null
  const vidrio = variante === 'vidrio'

  const clases = vidrio
    ? `vidrio destello group relative flex min-w-0 flex-col items-start rounded-2xl px-4 pb-3 pt-4 text-left transition duration-200 ${
        activo ? 'bg-white/20 ring-2 ring-white/80' : ''
      }`
    : `group relative flex min-w-0 flex-col items-start rounded-xl border border-l-[6px] border-borde bg-base px-4 py-3 text-left shadow-tarjeta transition duration-200 ${FRANJA_TONO[tono]} ${
        activo ? `ring-2 ${ANILLO_ACTIVO[tono]}` : ''
      }`

  const contenido = (
    <>
      {vidrio && (
        // Línea de color arriba con su resplandor: el estado se reconoce desde lejos.
        <span
          className="absolute inset-x-4 top-0 h-1 rounded-b-full"
          style={{ backgroundColor: color, boxShadow: `0 0 18px 2px ${color}` }}
          aria-hidden="true"
        />
      )}
      <span
        ref={valor === null ? undefined : cifra}
        className={`cifra text-3xl font-black leading-none sm:text-4xl ${vidrio ? 'text-white' : 'text-tinta'}`}
      >
        {valor === null ? '—' : miles(valor)}
      </span>
      <span
        className={`mt-2 truncate text-xs font-bold uppercase tracking-wider ${vidrio ? 'text-white/90' : 'text-tinta-suave'}`}
      >
        {etiqueta}
      </span>
      {detalle && <span className={`text-xs ${vidrio ? 'text-white/80' : 'text-tinta-suave'}`}>{detalle}</span>}
      {proporcion !== null && (
        <span
          className={`mt-2.5 block h-1.5 w-full overflow-hidden rounded-full ${vidrio ? 'bg-white/10' : 'bg-velo'}`}
          aria-hidden="true"
        >
          <span
            className="block h-full rounded-full transition-[width] duration-700 ease-out"
            style={{ width: `${proporcion}%`, backgroundColor: color }}
          />
        </span>
      )}
    </>
  )

  if (!onClick) return <div className={clases}>{contenido}</div>

  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={activo}
      className={`${clases} hover:-translate-y-1 ${vidrio ? 'hover:bg-white/15' : 'hover:shadow-elevada'}`}
    >
      {contenido}
    </button>
  )
}
