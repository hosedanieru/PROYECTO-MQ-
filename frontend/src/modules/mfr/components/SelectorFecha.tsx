import { Campo } from '../../../components/Campo'

/** Selector de día operativo compartido por las pantallas de MFR. */
export function SelectorFecha({ fecha, onCambiar }: { fecha: string; onCambiar: (f: string) => void }) {
  return (
    <div className="w-48">
      <Campo etiqueta="Día operativo" type="date" value={fecha} onChange={(e) => onCambiar(e.target.value)} />
    </div>
  )
}
