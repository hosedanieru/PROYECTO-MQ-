import { SelectorFecha } from '../mfr/components/SelectorFecha'
import { PERIODOS, type PeriodoTablero } from './usePeriodoTablero'

/**
 * Periodo y día sobre la banda de un tablero. `soloDia`: tableros que por
 * naturaleza son de un día (ritmo por hora, metas y personal).
 */
export function SelectorPeriodo({ estado, soloDia = false }: { estado: PeriodoTablero; soloDia?: boolean }) {
  return (
    <>
      {!soloDia && (
        <div className="vidrio flex gap-1 rounded-2xl p-1" role="group" aria-label="Periodo">
          {PERIODOS.map((p) => (
            <button
              key={p.valor}
              type="button"
              aria-pressed={estado.periodo === p.valor}
              onClick={() => estado.cambiarPeriodo(p.valor)}
              className={`h-10 rounded-xl px-3 text-sm font-bold transition ${
                estado.periodo === p.valor ? 'bg-white text-marina' : 'text-white hover:bg-white/15'
              }`}
            >
              {p.texto}
            </button>
          ))}
        </div>
      )}
      <SelectorFecha fecha={estado.fecha} onCambiar={estado.cambiarFecha} variante="vidrio" />
    </>
  )
}
