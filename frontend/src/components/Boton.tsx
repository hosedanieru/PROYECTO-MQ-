import type { ButtonHTMLAttributes } from 'react'

type Variante = 'primario' | 'secundario' | 'peligro' | 'sutil' | 'claro' | 'vidrio'
type Tamano = 'md' | 'sm'

interface Props extends ButtonHTMLAttributes<HTMLButtonElement> {
  variante?: Variante
  tamano?: Tamano
  cargando?: boolean
}

const ESTILOS: Record<Variante, string> = {
  // Degradado + resplandor del propio azul + destello al pasar el cursor.
  primario:
    'destello bg-linear-to-br from-marca-relleno to-marca-relleno-hover text-white shadow-[0_8px_22px_-10px_var(--color-marca)] hover:-translate-y-0.5 hover:shadow-[0_12px_28px_-10px_var(--color-marca)] active:scale-[0.98]',
  secundario: 'border border-borde bg-base text-tinta-suave hover:border-marca/40 hover:bg-marca-claro/40 hover:text-marca-texto',
  peligro: 'bg-critico text-white shadow-sm hover:bg-critico/90 active:scale-[0.98]',
  // Para acciones de cabecera ("Ver detalle", "Ver todas"), sin peso visual.
  sutil: 'text-marca hover:bg-marca-claro/60',
  // Sobre la banda oscura del hero: la acción principal, blanca para que salte a la vista.
  claro: 'destello bg-white text-marina shadow-[0_10px_30px_-10px_rgb(255_255_255/0.6)] hover:-translate-y-0.5 active:scale-[0.98]',
  // Sobre la banda oscura del hero: acciones secundarias, translúcidas.
  vidrio: 'vidrio text-white hover:bg-white/20',
}

/*
 * `pointer-coarse:` solo aplica con pantalla táctil (tablet o celular en
 * piso): el dedo necesita ~44 px de blanco. Con mouse el botón conserva
 * su tamaño y la pantalla del computador no se agranda por gusto.
 */
const TAMANOS: Record<Tamano, string> = {
  md: 'px-4 py-2 text-sm pointer-coarse:min-h-11',
  sm: 'px-3 py-1.5 text-xs pointer-coarse:min-h-9',
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
