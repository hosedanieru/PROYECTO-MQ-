import { miles } from '../../../shared/utils/numeros'

export interface FilaTabla {
  id: string
  nombre: string
  valores: Array<number | null>
}

interface Props {
  /** Cabecera de la primera columna: "Línea", "Familia"… */
  etiquetaFila: string
  horas: string[]
  filas: FilaTabla[]
  /** Fila de totales al pie. */
  totales?: number[]
  unidad: string
  sufijo?: string
  /**
   * `true` cuando el valor puede ser mejor o peor que cero (la
   * sobreproducción). Entonces el color va en dos sentidos desde un
   * gris central, en vez de una sola escala.
   */
  divergente?: boolean
}

/** Opacidad máxima del relleno: por encima, el número deja de leerse. */
const TINTE_MAXIMO = 0.38

/**
 * MATRIZ DE LÍNEA × HORA COMO MAPA DE CALOR
 * =========================================
 *
 * Son 24 columnas. Leídas como números sueltos hay que recorrerlas una
 * por una para encontrar dónde está la carga del día; con el color, la
 * forma se ve de un vistazo y el número queda para cuando hace falta el
 * dato exacto.
 *
 * Reglas de color:
 *   · magnitud (kilos)  → un solo tono, de claro a intenso
 *   · sobreproducción   → dos tonos desde un centro neutro, porque
 *                         pasarse y quedarse corto son cosas distintas
 *
 * El tinte no pasa del 38 %: por encima, el número deja de leerse sobre
 * el fondo, y aquí el número sigue importando.
 */
export function TablaHoraria({
  etiquetaFila,
  horas,
  filas,
  totales,
  unidad,
  sufijo = '',
  divergente = false,
}: Props) {
  const absolutos = filas.flatMap((f) => f.valores.filter((v): v is number => v !== null).map(Math.abs))
  const maximo = Math.max(...absolutos, 1)

  const fondo = (valor: number | null): string | undefined => {
    if (valor === null || valor === 0) return undefined
    const intensidad = (Math.abs(valor) / maximo) * TINTE_MAXIMO
    const tono = divergente && valor < 0 ? 'var(--alerta)' : 'var(--marca)'
    // `color-mix` respeta el token, así que el mapa cambia solo con el tema.
    return `color-mix(in oklab, ${tono} ${(intensidad * 100).toFixed(1)}%, transparent)`
  }

  return (
    <div className="overflow-x-auto rounded-tarjeta border border-borde bg-base shadow-tarjeta">
      <table className="min-w-full text-[11px]">
        <thead>
          <tr className="border-b border-borde text-tinta-suave">
            <th className="sticky left-0 z-10 bg-base px-3 py-2 text-left font-semibold">
              {etiquetaFila}
            </th>
            {horas.map((h) => (
              <th key={h} className="cifra px-1.5 py-2 text-right font-medium">
                {h}
              </th>
            ))}
            <th className="px-3 py-2 text-right font-semibold">Total</th>
          </tr>
        </thead>

        <tbody>
          {filas.map((fila) => {
            const total = fila.valores.reduce<number>((s, v) => s + (v ?? 0), 0)
            return (
              <tr key={fila.id} className="border-b border-borde/50 last:border-0">
                <td className="sticky left-0 z-10 bg-base px-3 py-1.5 font-semibold text-tinta">
                  {fila.nombre}
                </td>
                {fila.valores.map((v, i) => (
                  <td
                    key={horas[i] ?? i}
                    style={{ backgroundColor: fondo(v) }}
                    title={v === null ? undefined : `${fila.nombre} · ${horas[i]} · ${miles(v)}${sufijo} ${unidad}`}
                    className={`cifra px-1.5 py-1.5 text-right ${
                      v === null || v === 0 ? 'text-tinta-suave/40' : 'text-tinta'
                    }`}
                  >
                    {v === null ? '' : `${v}${sufijo}`}
                  </td>
                ))}
                <td className="cifra px-3 py-1.5 text-right font-bold text-tinta">
                  {divergente ? '' : miles(total)}
                </td>
              </tr>
            )
          })}

          {totales && (
            <tr className="border-t-2 border-borde bg-velo">
              <td className="sticky left-0 z-10 bg-velo px-3 py-2 font-bold text-tinta">Total</td>
              {totales.map((v, i) => (
                <td key={horas[i] ?? i} className="cifra px-1.5 py-2 text-right font-semibold text-tinta">
                  {v === 0 ? '' : v}
                </td>
              ))}
              <td className="cifra px-3 py-2 text-right font-bold text-tinta">
                {miles(totales.reduce((s, v) => s + v, 0))}
              </td>
            </tr>
          )}
        </tbody>
      </table>

      <p className="flex flex-wrap items-center gap-2 border-t border-borde px-3 py-2 text-[11px] text-tinta-suave">
        <span>Más color, más {unidad}:</span>
        <span className="flex items-center gap-0.5" aria-hidden="true">
          {[0.08, 0.16, 0.24, 0.32, 0.38].map((n) => (
            <span
              key={n}
              className="h-3 w-5 rounded-sm border border-borde"
              style={{
                backgroundColor: `color-mix(in oklab, var(--marca) ${n * 100}%, transparent)`,
              }}
            />
          ))}
        </span>
        <span>de poco a mucho</span>
        {divergente && (
          <>
            <span className="ml-2 h-3 w-5 rounded-sm border border-borde" style={{ backgroundColor: 'color-mix(in oklab, var(--alerta) 30%, transparent)' }} aria-hidden="true" />
            <span>por debajo de la meta</span>
          </>
        )}
      </p>
    </div>
  )
}
