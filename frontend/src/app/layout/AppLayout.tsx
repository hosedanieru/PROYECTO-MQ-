/**
 * MARCO DE LAS PANTALLAS AUTENTICADAS
 * ===================================
 *
 * Barra superior (con toda la navegación) + contenido. El layout no
 * sabe nada de negocio: solo arma el marco y deja el hueco del `<Outlet />`.
 *
 * Decisión del usuario (2026-10-05): sin barra lateral. Todo el ancho de
 * la pantalla es para el contenido; la navegación vive arriba.
 *
 * En celular el panel del menú se cierra desde el propio enlace que se
 * pulsa (y desde el velo), no desde un efecto que vigile la ruta: la
 * causa del cierre es el clic, no el cambio de URL.
 */

import { useCallback, useState } from 'react'
import { Outlet, useLocation } from 'react-router-dom'

import { useAparecer } from '../../shared/animacion/useAnimacion'
import { BarraSuperior } from './BarraSuperior'

export function AppLayout() {
  const { pathname } = useLocation()
  const [menuAbierto, setMenuAbierto] = useState(false)
  // Estable: el panel del menú lo usa en un efecto (Escape) y no debe reiniciarse en cada render.
  const cerrarMenu = useCallback(() => setMenuAbierto(false), [])
  // Cada cambio de ruta relanza la entrada del contenido.
  const contenido = useAparecer<HTMLDivElement>(pathname)

  return (
    <div className="lienzo flex min-h-screen flex-col">
      <BarraSuperior menuAbierto={menuAbierto} alternarMenu={() => setMenuAbierto((a) => !a)} cerrarMenu={cerrarMenu} />
      <main className="flex-1 px-4 py-6 sm:px-6 sm:py-8">
        <div ref={contenido} className="mx-auto max-w-[96rem]">
          <Outlet />
        </div>
      </main>
    </div>
  )
}
