import type { ButtonHTMLAttributes } from 'react'

type Variante = 'primario' | 'secundario' | 'peligro'

interface Props extends ButtonHTMLAttributes<HTMLButtonElement> {
  variante?: Variante
  cargando?: boolean
}

const ESTILOS: Record<Variante, string> = {
  primario: 'bg-marca text-white hover:bg-marca-oscuro',
  secundario: 'bg-white text-slate-700 border border-slate-300 hover:bg-slate-50',
  peligro: 'bg-red-600 text-white hover:bg-red-700',
}

export function Boton({
  variante = 'primario',
  cargando = false,
  disabled,
  className = '',
  children,
  ...resto
}: Props) {
  return (
    <button
      disabled={disabled || cargando}
      className={`inline-flex items-center justify-center rounded-md px-4 py-2 text-sm font-medium transition disabled:cursor-not-allowed disabled:opacity-60 ${ESTILOS[variante]} ${className}`}
      {...resto}
    >
      {cargando ? 'Procesando…' : children}
    </button>
  )
}
