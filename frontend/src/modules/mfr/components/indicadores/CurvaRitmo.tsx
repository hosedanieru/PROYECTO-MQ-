import { useState } from 'react'

import { FRENADO_SUAVE, motion, RESORTE_GRAFICA } from '../../../../shared/animacion/movimiento'
import type { PuntoRitmo } from '../../../../shared/types/mfr'
import { miles } from '../../../../shared/utils/numeros'

interface Props {
  serie: PuntoRitmo[]
  /** ±% alrededor de lo esperado que cuenta como "en línea". */
  tolerancia: number
  /** Solo las horas con algo esperado (el día recortado al DPP), para no dibujar madrugadas vacías. */
  recortar?: boolean
}

/*
 * Lienzo ancho: el SVG escala al ancho de la pantalla, y con uno angosto
 * el texto de los ejes se agrandaba al doble en un monitor de 1440 px.
 */
const ANCHO = 1100
const ALTO = 300
const MARGEN = { arriba: 12, derecha: 12, abajo: 26, izquierda: 52 }
const PLOT_ANCHO = ANCHO - MARGEN.izquierda - MARGEN.derecha
const PLOT_ALTO = ALTO - MARGEN.arriba - MARGEN.abajo

function techo(valor: number): number {
  if (valor <= 0) return 1
  const potencia = 10 ** Math.floor(Math.log10(valor))
  const paso = [1, 2, 5, 10].find((p) => p * potencia >= valor) ?? 10
  return paso * potencia
}

/**
 * CURVA DEL RITMO
 * ===============
 *
 * Cajas ACUMULADAS hora por hora. Lo esperado va punteado, dentro de una
 * franja que marca el ±5 % ("en línea"); lo real va en el azul de la
 * marca. Se lee de un vistazo: si la línea azul está dentro de la franja,
 * van en línea; arriba, adelantados; abajo, retrasados. La hora que aún
 * no llega no tiene línea azul.
 */
export function CurvaRitmo({ serie, tolerancia, recortar = true }: Props) {
  const [indice, setIndice] = useState<number | null>(null)

  // Recorte: desde la última hora sin nada esperado antes del DPP hasta la primera hora con todo lo esperado completo.
  const primera = recortar ? Math.max(0, serie.findIndex((p) => p.esperadoCajas > 0) - 1) : 0
  const totalEsperado = serie[serie.length - 1]?.esperadoCajas ?? 0
  const completa = serie.findIndex((p) => p.esperadoCajas >= totalEsperado)
  const ultima = recortar && completa >= 0 ? Math.min(serie.length - 1, completa + 1) : serie.length - 1
  const puntos = serie.slice(primera, ultima + 1)

  const n = puntos.length
  const maximo = techo(Math.max(...puntos.map((p) => Math.max(p.esperadoCajas * (1 + tolerancia / 100), p.realCajas ?? 0)), 0))
  const x = (i: number) => MARGEN.izquierda + (n <= 1 ? PLOT_ANCHO / 2 : (i / (n - 1)) * PLOT_ANCHO)
  const y = (v: number) => MARGEN.arriba + PLOT_ALTO - (v / maximo) * PLOT_ALTO

  const trazo = (valores: number[]) => valores.map((v, i) => `${i === 0 ? 'M' : 'L'}${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(' ')
  const esperado = puntos.map((p) => p.esperadoCajas)
  const arriba = esperado.map((v) => v * (1 + tolerancia / 100))
  const abajo = esperado.map((v) => v * (1 - tolerancia / 100))
  // Franja "en línea": borde de arriba de ida y borde de abajo de vuelta.
  const franja = `${trazo(arriba)} ${abajo
    .map((v, i) => ({ v, i }))
    .reverse()
    .map(({ v, i }) => `L${x(i).toFixed(1)},${y(v).toFixed(1)}`)
    .join(' ')} Z`
  const reales = puntos.map((p, i) => ({ v: p.realCajas, i })).filter((p): p is { v: number; i: number } => p.v !== null)
  const trazoReal = reales.map(({ v, i }, k) => `${k === 0 ? 'M' : 'L'}${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(' ')
  const ultimoReal = reales.length > 0 ? reales[reales.length - 1] : null
  const marcas = [0, 0.5, 1].map((f) => f * maximo)
  const paso = Math.max(1, Math.ceil(n / 9))
  const punto = indice === null ? null : puntos[indice]

  if (n === 0 || totalEsperado === 0) {
    return <p className="border-y border-borde py-10 text-center text-sm text-tinta-suave">El día no tiene DPP cargado: no hay ritmo que medir.</p>
  }

  return (
    <figure className="relative">
      <figcaption className="mb-2 flex flex-wrap justify-end gap-4 text-xs text-tinta-suave">
        <span className="flex items-center gap-1.5">
          <span className="h-3 w-5 rounded-sm bg-exito/20 ring-1 ring-inset ring-exito/40" aria-hidden="true" />
          En línea (±{tolerancia} % de lo esperado)
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-0.5 w-5 border-t-2 border-dashed border-neutro" aria-hidden="true" />
          Esperado
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-1 w-5 rounded-full bg-marca" aria-hidden="true" />
          Real (remisiones creadas)
        </span>
      </figcaption>

      <div className="relative">
        <svg
          viewBox={`0 0 ${ANCHO} ${ALTO}`}
          className="h-auto w-full"
          role="img"
          aria-label="Cajas acumuladas por hora: esperado contra real"
          onMouseLeave={() => setIndice(null)}
        >
          {marcas.map((v) => (
            <g key={v}>
              <line x1={MARGEN.izquierda} x2={ANCHO - MARGEN.derecha} y1={y(v)} y2={y(v)} stroke="var(--color-borde)" />
              <text x={MARGEN.izquierda - 6} y={y(v) + 4} textAnchor="end" className="cifra fill-tinta-suave text-xs">
                {miles(v)}
              </text>
            </g>
          ))}
          {puntos.map((p, i) =>
            i % paso === 0 ? (
              // Los extremos se alinean hacia adentro: centrados, se cortaban en el borde del dibujo.
              <text
                key={p.hora}
                x={x(i)}
                y={ALTO - 8}
                textAnchor={i === 0 ? 'start' : i === n - 1 ? 'end' : 'middle'}
                className="cifra fill-tinta-suave text-xs"
              >
                {p.hora}
              </text>
            ) : null,
          )}

          <path d={franja} fill="var(--color-exito)" fillOpacity={0.14} />
          <path d={trazo(esperado)} fill="none" stroke="var(--color-neutro)" strokeWidth={2} strokeDasharray="5 4" />
          {/* Lo real se traza solo al entrar; con cada refresco el trazo cambia sin volver a dibujarse. */}
          {reales.length > 0 && (
            <motion.path
              d={trazoReal}
              fill="none"
              stroke="var(--color-marca)"
              strokeWidth={3}
              strokeLinejoin="round"
              strokeLinecap="round"
              initial={{ pathLength: 0 }}
              animate={{ pathLength: 1 }}
              transition={{ duration: 1.4, ease: [...FRENADO_SUAVE] }}
            />
          )}
          {/* El punto del "ahora": aparece al terminar el trazo y se desliza con resorte cuando llega un dato nuevo. */}
          {ultimoReal && (
            <motion.circle
              r={5}
              fill="var(--color-marca)"
              stroke="var(--color-base)"
              strokeWidth={2}
              initial={{ opacity: 0, cx: x(ultimoReal.i), cy: y(ultimoReal.v) }}
              animate={{ opacity: 1, cx: x(ultimoReal.i), cy: y(ultimoReal.v) }}
              transition={{ ...RESORTE_GRAFICA, opacity: { delay: 1.1, duration: 0.3 } }}
            />
          )}

          {indice !== null && (
            <line x1={x(indice)} x2={x(indice)} y1={MARGEN.arriba} y2={y(0)} stroke="var(--color-tinta-suave)" strokeDasharray="2 3" pointerEvents="none" />
          )}
          {puntos.map((p, i) => (
            <rect
              key={p.hora}
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

        {punto && indice !== null && (
          <div
            className="pointer-events-none absolute top-1 z-10 -translate-x-1/2 rounded-lg border border-borde bg-base px-3 py-2 text-xs shadow-elevada"
            style={{ left: `${Math.min(Math.max((x(indice) / ANCHO) * 100, 12), 88)}%` }}
          >
            <p className="cifra font-bold text-tinta">hasta las {punto.hora}</p>
            <p className="text-tinta-suave">
              Esperado <span className="cifra font-semibold text-tinta">{miles(punto.esperadoCajas)}</span> cajas
            </p>
            <p className="text-tinta-suave">
              Real{' '}
              <span className="cifra font-semibold text-tinta">{punto.realCajas === null ? 'aún no' : miles(punto.realCajas)}</span>
              {punto.realCajas !== null && ' cajas'}
            </p>
          </div>
        )}
      </div>
    </figure>
  )
}
