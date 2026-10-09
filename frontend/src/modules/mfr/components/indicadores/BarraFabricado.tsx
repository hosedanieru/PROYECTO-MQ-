import { motion, RESORTE_GRAFICA } from '../../../../shared/animacion/movimiento'
import type { MedidaFabricado } from '../../../../shared/types/mfr'
import { miles } from '../../../../shared/utils/numeros'

/*
 * Tres tramos de lo que pasó por la línea. El morado (--acento) es el
 * mismo de "Emergencia" en el tablero MFR: extraoficial se ve igual en
 * todo el aplicativo.
 */
const TRAMOS = [
  { clave: 'oficial', texto: 'Fabricado', color: 'bg-marca' },
  { clave: 'extraoficial', texto: 'Extraoficial (emergencia)', color: 'bg-acento' },
  { clave: 'averiado', texto: 'Averiado', color: 'bg-critico' },
] as const

function valores(m: MedidaFabricado) {
  return {
    oficial: m.fabricadoUnidades - m.extraoficialUnidades,
    extraoficial: m.extraoficialUnidades,
    averiado: m.averiadasUnidades,
  }
}

/**
 * Barra apilada: fabricado oficial · extraoficial · averiado.
 * Las extraoficiales suman como fabricado, pero se distinguen con su
 * propio color (usuario, 2026-10-07).
 */
export function BarraFabricado({ medida, grande = false }: { medida: MedidaFabricado; grande?: boolean }) {
  const v = valores(medida)
  const total = v.oficial + v.extraoficial + v.averiado
  if (total === 0) return null
  const descripcion = TRAMOS.map((t) => `${t.texto}: ${miles(v[t.clave])}`).join(', ')

  return (
    <div
      role="img"
      aria-label={descripcion}
      title={descripcion}
      className={`flex w-full overflow-hidden rounded-full bg-velo ${grande ? 'h-3 max-w-2xl' : 'h-2 max-w-md'}`}
    >
      {TRAMOS.map((t, i) =>
        v[t.clave] > 0 ? (
          // Un mínimo de 2 % para que un tramo pequeño (unas pocas averías) no desaparezca.
          // Los tramos entran uno tras otro, de izquierda a derecha, con resorte (Motion).
          <motion.div
            key={t.clave}
            className={t.color}
            initial={{ width: '0%' }}
            animate={{ width: `${Math.max((v[t.clave] / total) * 100, 2)}%` }}
            transition={{ ...RESORTE_GRAFICA, delay: i * 0.12 }}
          />
        ) : null,
      )}
    </div>
  )
}

/** Leyenda de los tres colores, con las cifras del total. */
export function LeyendaFabricado({ medida }: { medida: MedidaFabricado }) {
  const v = valores(medida)
  return (
    <ul className="flex flex-wrap gap-x-6 gap-y-1 text-sm text-tinta-suave">
      {TRAMOS.map((t) => (
        <li key={t.clave} className="flex items-center gap-2">
          <span className={`h-3 w-3 rounded-sm ${t.color}`} aria-hidden="true" />
          {t.texto} <span className="cifra font-bold text-tinta">{miles(v[t.clave])}</span>
        </li>
      ))}
    </ul>
  )
}
