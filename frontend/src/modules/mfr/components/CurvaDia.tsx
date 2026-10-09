import { useState } from 'react'

import { FRENADO_SUAVE, motion } from '../../../shared/animacion/movimiento'
import { miles } from '../../../shared/utils/numeros'

interface Props {
  horas: string[]
  /** Kilos de meta por hora (Σ de las líneas). */
  meta: number[]
  /** Kilos producidos por hora (Σ de las líneas). */
  producido: number[]
}

/* Lienzo en unidades del viewBox: el SVG escala al ancho disponible. */
const ANCHO = 720
const ALTO = 220
const MARGEN = { arriba: 12, derecha: 12, abajo: 26, izquierda: 48 }
const PLOT_ANCHO = ANCHO - MARGEN.izquierda - MARGEN.derecha
const PLOT_ALTO = ALTO - MARGEN.arriba - MARGEN.abajo

/** Redondea el máximo del eje a un número "limpio" (1, 2, 5 × 10ⁿ). */
function techo(valor: number): number {
  if (valor <= 0) return 1
  const potencia = 10 ** Math.floor(Math.log10(valor))
  const paso = [1, 2, 5, 10].find((p) => p * potencia >= valor) ?? 10
  return paso * potencia
}

/**
 * LA CURVA DEL DÍA
 * ================
 *
 * Meta y producido del día entero, hora por hora, en kilos. El mapa de
 * calor de abajo dice DÓNDE (qué línea); esta curva dice CUÁNDO: el
 * hueco entre las dos líneas es la hora en que se perdió producción.
 *
 * Dos series, un solo eje (los dos están en kilos). La meta va punteada
 * y en gris (es la referencia); lo producido va en el azul de la marca
 * con área (es el dato). Pasar el cursor muestra los valores de la hora.
 */
export function CurvaDia({ horas, meta, producido }: Props) {
  const [indice, setIndice] = useState<number | null>(null)

  const n = horas.length
  const maximo = techo(Math.max(...meta, ...producido, 0))
  const x = (i: number) => MARGEN.izquierda + (n <= 1 ? PLOT_ANCHO / 2 : (i / (n - 1)) * PLOT_ANCHO)
  const y = (v: number) => MARGEN.arriba + PLOT_ALTO - (v / maximo) * PLOT_ALTO

  const trazo = (serie: number[]) => serie.map((v, i) => `${i === 0 ? 'M' : 'L'}${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(' ')
  const area = `${trazo(producido)} L${x(n - 1).toFixed(1)},${y(0)} L${x(0).toFixed(1)},${y(0)} Z`
  const marcas = [0, 0.5, 1].map((f) => f * maximo)
  const paso = Math.max(1, Math.ceil(n / 8))

  const totalMeta = meta.reduce((s, v) => s + v, 0)
  const totalProducido = producido.reduce((s, v) => s + v, 0)

  return (
    // Sin marco propio: va dentro de un `PanelSeccion`, que pone el título.
    <figure className="relative">
      <figcaption className="mb-2 flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-tinta-suave">
          <span className="cifra text-lg font-black text-tinta">{miles(totalProducido)}</span> de{' '}
          <span className="cifra font-semibold text-tinta">{miles(totalMeta)}</span> kg en el día
        </p>
        <ul className="flex gap-4 text-xs text-tinta-suave">
          <li className="flex items-center gap-1.5">
            <span className="h-0.5 w-5 border-t-2 border-dashed border-neutro" aria-hidden="true" />
            Kilos de meta <span className="text-xs font-normal">(Target)</span>
          </li>
          <li className="flex items-center gap-1.5">
            <span className="h-2.5 w-5 rounded-sm bg-marca/30 ring-2 ring-inset ring-marca" aria-hidden="true" />
            Kilos producidos <span className="text-xs font-normal">(Instant)</span>
          </li>
        </ul>
      </figcaption>

      <div className="relative">
        <svg
          viewBox={`0 0 ${ANCHO} ${ALTO}`}
          className="h-auto w-full"
          role="img"
          aria-label={`Curva del día: ${miles(totalProducido)} de ${miles(totalMeta)} kilos`}
          onMouseLeave={() => setIndice(null)}
        >
          <defs>
            <linearGradient id="curva-dia-relleno" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="var(--color-marca)" stopOpacity={0.32} />
              <stop offset="100%" stopColor="var(--color-marca)" stopOpacity={0.02} />
            </linearGradient>
          </defs>

          {/* Rejilla recesiva y eje en kilos. */}
          {marcas.map((v) => (
            <g key={v}>
              <line x1={MARGEN.izquierda} x2={ANCHO - MARGEN.derecha} y1={y(v)} y2={y(v)} stroke="var(--color-borde)" />
              <text x={MARGEN.izquierda - 6} y={y(v) + 4} textAnchor="end" className="cifra fill-tinta-suave text-xs">
                {miles(v)}
              </text>
            </g>
          ))}
          {horas.map((h, i) =>
            i % paso === 0 ? (
              <text key={h} x={x(i)} y={ALTO - 8} textAnchor="middle" className="cifra fill-tinta-suave text-xs">
                {h}
              </text>
            ) : null,
          )}

          {/* Al entrar: lo producido se traza solo y el área aparece detrás (Motion). */}
          <motion.path d={area} fill="url(#curva-dia-relleno)" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.5, duration: 0.8 }} />
          <path d={trazo(meta)} fill="none" stroke="var(--color-neutro)" strokeWidth={2} strokeDasharray="5 4" />
          <motion.path
            d={trazo(producido)}
            fill="none"
            stroke="var(--color-marca)"
            strokeWidth={2}
            strokeLinejoin="round"
            initial={{ pathLength: 0 }}
            animate={{ pathLength: 1 }}
            transition={{ duration: 1.4, ease: [...FRENADO_SUAVE] }}
          />

          {indice !== null && (
            <g pointerEvents="none">
              <line x1={x(indice)} x2={x(indice)} y1={MARGEN.arriba} y2={y(0)} stroke="var(--color-tinta-suave)" strokeDasharray="2 3" />
              <circle cx={x(indice)} cy={y(meta[indice] ?? 0)} r={4.5} fill="var(--color-neutro)" stroke="var(--color-base)" strokeWidth={2} />
              <circle cx={x(indice)} cy={y(producido[indice] ?? 0)} r={5} fill="var(--color-marca)" stroke="var(--color-base)" strokeWidth={2} />
            </g>
          )}

          {/* Zonas de contacto: una columna por hora, más ancha que el punto. */}
          {horas.map((h, i) => (
            <rect
              key={h}
              x={x(i) - PLOT_ANCHO / Math.max(n - 1, 1) / 2}
              y={MARGEN.arriba}
              width={PLOT_ANCHO / Math.max(n - 1, 1)}
              height={PLOT_ALTO}
              fill="transparent"
              onMouseEnter={() => setIndice(i)}
              onTouchStart={() => setIndice(i)}
            />
          ))}
        </svg>

        {indice !== null && (
          <div
            className="pointer-events-none absolute top-1 z-10 -translate-x-1/2 rounded-lg border border-borde bg-base px-3 py-2 text-xs shadow-elevada"
            // Acotado para que en las horas de los extremos no se salga del recuadro.
            style={{ left: `${Math.min(Math.max((x(indice) / ANCHO) * 100, 12), 88)}%` }}
          >
            <p className="cifra font-bold text-tinta">{horas[indice]}</p>
            <p className="text-tinta-suave">
              Meta <span className="cifra font-semibold text-tinta">{miles(meta[indice] ?? 0)}</span> kg
            </p>
            <p className="text-tinta-suave">
              Producido <span className="cifra font-semibold text-tinta">{miles(producido[indice] ?? 0)}</span> kg
            </p>
          </div>
        )}
      </div>
    </figure>
  )
}
