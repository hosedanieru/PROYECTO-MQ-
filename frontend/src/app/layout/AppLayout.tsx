/**
 * MARCO DE LAS PANTALLAS AUTENTICADAS
 * ===================================
 *
 * Barra lateral fija + barra superior + contenido. El layout no sabe
 * nada de negocio: solo arma el marco y deja el hueco del `<Outlet />`.
 *
 * En móvil el cajón del menú se cierra desde el propio enlace que se
 * pulsa (y desde el velo), no desde un efecto que vigile la ruta: la
 * causa del cierre es el clic, no el cambio de URL.
 */

import { useState } from 'react'
import { Outlet, useLocation } from 'react-router-dom'

import { useAparecer } from '../../shared/animacion/useAnimacion'
import { BarraLateral } from './BarraLateral'
import { BarraSuperior } from './BarraSuperior'

export function AppLayout() {
  const { pathname } = useLocation()
  const [menuAbierto, setMenuAbierto] = useState(false)
  // Cada cambio de ruta relanza la entrada del contenido.
  const contenido = useAparecer<HTMLDivElement>(pathname)

  return (
    <div className="min-h-screen bg-fondo lg:grid lg:grid-cols-[16rem_minmax(0,1fr)]">
      <BarraLateral abierta={menuAbierto} cerrar={() => setMenuAbierto(false)} />

      <div className="flex min-h-screen flex-col">
        <BarraSuperior abrirMenu={() => setMenuAbierto(true)} />
        <main className="flex-1 px-4 py-6 sm:px-6 sm:py-8">
          <div ref={contenido} className="mx-auto max-w-7xl">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  )
}
