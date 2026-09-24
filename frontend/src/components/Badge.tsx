import type { ReactNode } from 'react'

export type TonoBadge = 'neutro' | 'marca' | 'exito' | 'alerta' | 'critico' | 'acento'

const ESTILOS: Record<TonoBadge, string> = {
  neutro: 'bg-velo text-tinta-suave',
  marca: 'bg-marca-claro text-marca-texto',
  exito: 'bg-exito-claro text-exito',
  alerta: 'bg-alerta-claro text-alerta',
  critico: 'bg-critico-claro text-critico',
  acento: 'bg-acento-claro text-acento',
}

const PUNTO: Record<TonoBadge, string> = {
  neutro: 'bg-neutro',
  marca: 'bg-marca',
  exito: 'bg-exito',
  alerta: 'bg-alerta',
  critico: 'bg-critico',
  acento: 'bg-acento',
}

/**
 * El mismo tono, como color de dibujo para SVG.
 *
 * Las gráficas no pueden usar clases de Tailwind cuando el color sale de
 * un dato, así que reciben la variable CSS. Sale de aquí para que una
 * remisión APROBADA tenga el mismo ámbar en la etiqueta y en la dona: el
 * color identifica al estado, no al componente.
 */
export const COLOR_TONO: Record<TonoBadge, string> = {
  neutro: 'var(--color-neutro)',
  marca: 'var(--color-marca)',
  exito: 'var(--color-exito)',
  alerta: 'var(--color-alerta)',
  critico: 'var(--color-critico)',
  acento: 'var(--color-acento)',
}

interface Props {
  tono?: TonoBadge
  /** Muestra un punto de color antes del texto (estado en vivo). */
  punto?: boolean
  children: ReactNode
  className?: string
}

/**
 * Etiqueta de estado. Es la base de `EstadoBadge` (remisiones) y de
 * `SemaforoBadge` (MFR): ellos deciden QUÉ tono corresponde, este solo
 * sabe dibujarlo.
 */
export function Badge({ tono = 'neutro', punto = false, children, className = '' }: Props) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold ${ESTILOS[tono]} ${className}`}
    >
      {punto && <span className={`h-1.5 w-1.5 rounded-full ${PUNTO[tono]}`} aria-hidden="true" />}
      {children}
    </span>
  )
}
