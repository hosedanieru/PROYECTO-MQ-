import type { ReactNode } from 'react'

import { IconoCerrar } from './Iconos'

interface Props {
  cantidad: number
  /** Frase en singular y plural, con su género: ["remisión seleccionada", "remisiones seleccionadas"]. */
  unidad: [string, string]
  quitar: () => void
  /** Botones que actúan sobre lo seleccionado. */
  children: ReactNode
}

/**
 * Barra flotante con las acciones sobre lo seleccionado.
 *
 * Antes, "Enviar por correo" y "Ver PDF" estaban siempre arriba y casi
 * siempre desactivados: el usuario no sabía que primero había que marcar
 * filas. Ahora la barra aparece SOLO cuando hay algo marcado, y dice
 * cuántas son: el botón aparece justo cuando se puede usar.
 */
export function BarraSeleccion({ cantidad, unidad, quitar, children }: Props) {
  if (cantidad === 0) return null

  return (
    <div className="hero subir-rebote fixed inset-x-4 bottom-4 z-30 mx-auto flex max-w-3xl flex-wrap items-center justify-between gap-3 rounded-2xl px-4 py-3 text-white shadow-[0_20px_50px_-12px_var(--color-marca)] ring-1 ring-white/15 lg:left-[17rem]">
      <div className="flex items-center gap-3">
        {/* `key` relanza el rebote del contador cada vez que cambia la cantidad. */}
        <span
          key={cantidad}
          className="subir-rebote cifra grid h-10 min-w-10 place-items-center rounded-full bg-white px-2 text-[1rem] font-black text-marina"
        >
          {cantidad}
        </span>
        <span className="text-sm font-semibold">
          {cantidad === 1 ? unidad[0] : unidad[1]}
        </span>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        {children}
        <button
          type="button"
          onClick={quitar}
          title="Quitar la selección"
          aria-label="Quitar la selección"
          className="grid h-9 w-9 place-items-center rounded-lg text-white/90 transition hover:bg-white/10 hover:text-white pointer-coarse:h-11 pointer-coarse:w-11"
        >
          <IconoCerrar />
        </button>
      </div>
    </div>
  )
}
