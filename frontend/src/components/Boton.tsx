import type { ButtonHTMLAttributes } from 'react'

type Variante = 'primario' | 'secundario' | 'peligro' | 'sutil'
type Tamano = 'md' | 'sm'

interface Props extends ButtonHTMLAttributes<HTMLButtonElement> {
  variante?: Variante
  tamano?: Tamano
  cargando?: boolean
}

const ESTILOS: Record<Variante, string> = {
  primario: 'bg-marca text-white shadow-sm hover:bg-marca-hover active:scale-[0.98]',
  secundario: 'border border-borde bg-base text-tinta-suave hover:border-marca/40 hover:bg-marca-claro/40 hover:text-marca-texto',
  peligro: 'bg-critico text-white shadow-sm hover:bg-critico/90 active:scale-[0.98]',
  // Para acciones de cabecera ("Ver detalle", "Ver todas"), sin peso visual.
  sutil: 'text-marca hover:bg-marca-claro/60',
}

const TAMANOS: Record<Tamano, string> = {
  md: 'px-4 py-2 text-sm',
  sm: 'px-3 py-1.5 text-xs',
}

export function Boton({
  variante = 'primario',
  tamano = 'md',
  cargando = false,
  disabled,
  className = '',
  children,
  ...resto
}: Props) {
  return (
    <button
      disabled={disabled || cargando}
      className={`inline-flex items-center justify-center gap-2 rounded-lg font-semibold transition duration-150 disabled:cursor-not-allowed disabled:opacity-60 disabled:active:scale-100 ${ESTILOS[variante]} ${TAMANOS[tamano]} ${className}`}
      {...resto}
    >
      {cargando ? 'Procesando…' : children}
    </button>
  )
}
