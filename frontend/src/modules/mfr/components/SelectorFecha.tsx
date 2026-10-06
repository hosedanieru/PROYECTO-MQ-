import { Campo } from '../../../components/Campo'
import { IconoChevron } from '../../../components/Iconos'
import { fechaOperativaDe } from '../../../shared/utils/fechas'

interface Props {
  fecha: string
  onCambiar: (f: string) => void
  /** `vidrio` para la banda oscura del encabezado: flechas día a día y "Hoy". */
  variante?: 'campo' | 'vidrio'
}

/** YYYY-MM-DD desplazado N días (en UTC: es una fecha de solo día). */
function moverDias(fecha: string, dias: number): string {
  const [anio, mes, dia] = fecha.split('-').map(Number)
  return new Date(Date.UTC(anio, mes - 1, dia + dias)).toISOString().slice(0, 10)
}

/** Selector de día operativo compartido por las pantallas de MFR. */
export function SelectorFecha({ fecha, onCambiar, variante = 'campo' }: Props) {
  if (variante === 'campo') {
    return (
      <div className="w-48">
        <Campo etiqueta="Día operativo" type="date" value={fecha} onChange={(e) => onCambiar(e.target.value)} />
      </div>
    )
  }

  const hoy = fechaOperativaDe(new Date())
  const flecha = 'grid h-10 w-10 place-items-center rounded-xl text-white transition hover:bg-white/15'

  return (
    <div className="vidrio flex items-center gap-1 rounded-2xl p-1" role="group" aria-label="Día operativo">
      <button type="button" className={flecha} onClick={() => onCambiar(moverDias(fecha, -1))} aria-label="Día anterior">
        <IconoChevron className="h-5 w-5 rotate-180" />
      </button>
      <input
        type="date"
        value={fecha}
        onChange={(e) => e.target.value && onCambiar(e.target.value)}
        aria-label="Día operativo"
        className="cifra h-10 rounded-xl bg-transparent px-2 text-sm font-bold text-white [color-scheme:dark]"
      />
      <button type="button" className={flecha} onClick={() => onCambiar(moverDias(fecha, 1))} aria-label="Día siguiente">
        <IconoChevron className="h-5 w-5" />
      </button>
      {fecha !== hoy && (
        <button
          type="button"
          onClick={() => onCambiar(hoy)}
          className="h-10 rounded-xl bg-white px-3 text-xs font-bold text-marina transition hover:-translate-y-0.5"
        >
          Hoy
        </button>
      )}
    </div>
  )
}
