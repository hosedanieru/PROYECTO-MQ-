import type { ReactNode } from 'react'

import { COLOR_TONO, type TonoBadge } from './Badge'

interface Props {
  titulo: ReactNode
  /** Cuántos registros tiene: va junto al título, en grande. */
  contador?: number
  descripcion?: ReactNode
  /** Botón o enlace a la derecha del título. */
  accion?: ReactNode
  /** Color de la franja del título: el estado de lo que hay adentro. */
  tono?: TonoBadge
  children?: ReactNode
}

/**
 * Sección abierta: reemplaza a la `Tarjeta` con título (usuario,
 * 2026-10-05: fuera las tarjetas). No hay caja: el título lleva una
 * franja de color y una línea fina, y el contenido va directo sobre el
 * fondo. Así el ancho completo es para los datos, no para bordes y rellenos.
 */
export function Seccion({ titulo, contador, descripcion, accion, tono = 'marca', children }: Props) {
  return (
    <section className="space-y-3">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="flex min-w-0 items-stretch gap-3">
          <span className="w-1.5 shrink-0 rounded-full" style={{ backgroundColor: COLOR_TONO[tono] }} aria-hidden="true" />
          <div className="min-w-0">
            <h2 className="flex items-baseline gap-2 text-lg font-black tracking-tight text-tinta">
              {titulo}
              {contador !== undefined && <span className="cifra text-[1rem] font-bold text-tinta-suave">{contador}</span>}
            </h2>
            {descripcion && <p className="mt-0.5 max-w-3xl text-sm text-tinta-suave">{descripcion}</p>}
          </div>
        </div>
        {accion && <div className="flex shrink-0 flex-wrap items-center gap-2">{accion}</div>}
      </div>
      {children}
    </section>
  )
}
