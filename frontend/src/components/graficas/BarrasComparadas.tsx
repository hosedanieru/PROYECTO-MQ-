import { motion, RESORTE_GRAFICA } from '../../shared/animacion/movimiento'
import { miles } from '../../shared/utils/numeros'

export interface FilaComparada {
  clave: string
  etiqueta: string
  /** Lo esperado (programado). */
  referencia: number
  /** Lo logrado (fabricado). */
  valor: number
}

interface Props {
  filas: FilaComparada[]
  /** Nombres de las dos series para la leyenda. */
  nombres: { referencia: string; valor: string }
  /** Descripción para lectores de pantalla. */
  titulo: string
}

/**
 * BARRAS COMPARADAS — programado contra fabricado, fila por fila
 * ==============================================================
 *
 * Como "Cumplimiento por producto" del tablero de Power BI del área
 * (`MQ VISUAL J3.pdf`, pág. 5): cada fila tiene dos barras sobre la MISMA
 * escala (la fila más grande ocupa todo el ancho), así se compara entre
 * productos y no solo dentro de cada uno. Azul = programado, verde =
 * fabricado; las cifras van al final de cada barra.
 *
 * Las barras crecen con un resorte de Motion y, al refrescarse el
 * tablero, van del valor anterior al nuevo sin volver a cero.
 */
export function BarrasComparadas({ filas, nombres, titulo }: Props) {
  const maximo = Math.max(1, ...filas.map((f) => Math.max(f.referencia, f.valor)))
  const ancho = (n: number) => `${Math.max(0, (n / maximo) * 100)}%`

  return (
    <figure aria-label={titulo}>
      <figcaption className="mb-3 flex flex-wrap gap-4 text-xs text-tinta-suave">
        <span className="flex items-center gap-1.5">
          <span className="h-2.5 w-5 rounded-sm bg-marca" aria-hidden="true" />
          {nombres.referencia}
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-2.5 w-5 rounded-sm bg-exito" aria-hidden="true" />
          {nombres.valor}
        </span>
      </figcaption>
      <ul className="space-y-3">
        {filas.map((f, i) => (
          <li key={f.clave} className="grid grid-cols-[minmax(0,11rem)_minmax(0,1fr)] items-center gap-3">
            <span className="truncate text-xs font-semibold text-tinta" title={f.etiqueta}>
              {f.etiqueta}
            </span>
            <div className="space-y-1" aria-label={`${f.etiqueta}: ${miles(f.valor)} de ${miles(f.referencia)}`}>
              {[
                { n: f.referencia, color: 'bg-marca' },
                { n: f.valor, color: 'bg-exito' },
              ].map((b, k) => (
                // La barra vive en su pista (100 % = la fila más grande) y la cifra en su columna: al 100 % no se sale.
                <div key={k} className="grid grid-cols-[minmax(0,1fr)_3.5rem] items-center gap-2">
                  <div className="h-2.5">
                    <motion.span
                      className={`block h-full rounded-full ${b.color}`}
                      initial={{ width: '0%' }}
                      animate={{ width: ancho(b.n) }}
                      transition={{ ...RESORTE_GRAFICA, delay: i * 0.04 }}
                    />
                  </div>
                  <span className="cifra text-right text-xs font-bold text-tinta">{miles(b.n)}</span>
                </div>
              ))}
            </div>
          </li>
        ))}
      </ul>
    </figure>
  )
}
