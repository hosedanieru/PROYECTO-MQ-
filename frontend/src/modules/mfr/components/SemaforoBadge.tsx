import type { Semaforo } from '../../../shared/types/mfr'

const COLOR: Record<Semaforo, string> = {
  VERDE: 'bg-green-100 text-green-800',
  AMARILLO: 'bg-amber-100 text-amber-800',
  ROJO: 'bg-red-100 text-red-800',
}

export function SemaforoBadge({ valor, porcentaje }: { valor: Semaforo | null; porcentaje: number | null }) {
  if (valor === null || porcentaje === null) {
    return <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-xs text-slate-500">sin dato</span>
  }
  return (
    <span className={`rounded-full px-2.5 py-0.5 text-sm font-semibold ${COLOR[valor]}`}>
      {porcentaje.toFixed(1)} %
    </span>
  )
}
