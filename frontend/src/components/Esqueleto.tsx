import type { CSSProperties, ReactNode } from 'react'

import { motion, useReducedMotion } from '../shared/animacion/movimiento'

/**
 * ESQUELETO CON BRILLO — mientras la pantalla carga
 * =================================================
 *
 * Basado en el ejemplo de Motion `react-skeleton-shimmer` (usuario,
 * 2026-10-08): bloques grises ("huesos") con la forma de lo que va a
 * aparecer y un brillo que los recorre de izquierda a derecha, una y otra
 * vez. Dice "ya viene" mejor que un "Cargando…": el usuario ve DÓNDE va a
 * estar cada cosa antes de que llegue.
 *
 *   Hueso   un bloque de un tamaño dado (tarjeta, línea de texto, círculo)
 *   Brillo  envuelve contenido real INVISIBLE: el hueso mide exactamente lo
 *           que medirá el dato (truco del ejemplo, `visibility: hidden`)
 *
 * Colores: del velo del tema hacia el texto, mezclados con `color-mix`, así
 * funciona en claro y en oscuro sin colores en crudo. Con "reducir
 * movimiento" el brillo no se mueve; el hueso se queda quieto y gris.
 */

/** Del ejemplo: el degradado mide el doble del bloque y se desliza de -200 % a 200 %. */
const DEGRADADO =
  'linear-gradient(90deg, var(--color-velo) 25%, color-mix(in srgb, var(--color-velo), var(--color-tinta) 9%) 50%, var(--color-velo) 75%)'
const RECORRIDO = { backgroundPosition: ['-200% 0', '200% 0'] }
/** Segundos que tarda el brillo en cruzar (como el ejemplo). */
const DURACION_BRILLO = 1.5

function useBrillo() {
  const quieto = useReducedMotion()
  return {
    animate: quieto ? undefined : RECORRIDO,
    transition: { duration: DURACION_BRILLO, ease: 'easeInOut' as const, repeat: Infinity },
    style: { background: DEGRADADO, backgroundSize: '200% 100%' } satisfies CSSProperties,
  }
}

interface HuesoProps {
  /** Clases de tamaño y forma: `h-4 w-40`, `h-28 rounded-tarjeta`, `h-12 w-12 rounded-full`… */
  className?: string
}

/** Un bloque del esqueleto. El tamaño y la forma van en `className` (por defecto, una línea de texto). */
export function Hueso({ className = 'h-4 w-full rounded-md' }: HuesoProps) {
  const brillo = useBrillo()
  return <motion.div aria-hidden="true" className={`shrink-0 ${className}`} {...brillo} />
}

/**
 * Envuelve contenido real que se dibuja invisible: el hueso toma su tamaño
 * exacto. Útil cuando la forma del dato ya se conoce (títulos, botones).
 */
export function Brillo({ className = 'rounded-md', children }: { className?: string; children: ReactNode }) {
  const brillo = useBrillo()
  return (
    <motion.div aria-hidden="true" className={`overflow-hidden ${className}`} {...brillo}>
      <div className="invisible">{children}</div>
    </motion.div>
  )
}
