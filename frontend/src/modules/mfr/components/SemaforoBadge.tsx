import type { Semaforo } from '../../../shared/types/mfr'

const COLOR: Record<Semaforo, string> = {
  VERDE: 'bg-exito-claro text-exito',
  AMARILLO: 'bg-alerta-claro text-alerta',
  ROJO: 'bg-critico-claro text-critico',
}

export function SemaforoBadge({ valor, porcentaje }: { valor: Semaforo | null; porcentaje: number | null }) {
  if (valor === null || porcentaje === null) {
    return <span className="rounded-full bg-velo px-2.5 py-0.5 text-xs text-tinta-suave">sin dato</span>
  }
  return (
    <span className={`rounded-full px-2.5 py-0.5 text-sm font-semibold ${COLOR[valor]}`}>
      {porcentaje.toFixed(1)} %
    </span>
  )
}
