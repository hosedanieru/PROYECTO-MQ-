/**
 * MÓDULO DE INVENTARIO — un solo apartado
 * =======================================
 *
 * Usuario, 2026-09-29: "productos e inventario son un solo apartado, un
 * solo módulo; todo se hace desde allí". Aquí se reúnen, en pestañas:
 *
 *   Existencias        cuánto hay de insumos, PI y PT; movimientos; kardex
 *   Entradas           entradas de mercancía (lo que llega en un documento)
 *   Productos (PT)     el catálogo de productos (el mismo de remisiones y
 *                      del DPP). Crear un producto crea su PT en el inventario
 *   PI e insumos       catálogo de lo que se consume para armar el PT
 *
 * Por dentro, productos e ítems de inventario siguen en tablas distintas
 * (remisiones, MFR y averías solo aceptan PT); el usuario ve un módulo.
 * Cada pestaña se muestra solo con su permiso (hoy: el administrador).
 */

import { NavLink, Outlet } from 'react-router-dom'

import { useSesion } from '../auth/useSesion'

const PESTANAS = [
  { a: '/inventario', texto: 'Existencias', permiso: 'inventario.consultar', exacta: true },
  { a: '/inventario/entradas', texto: 'Entradas de mercancía', permiso: 'inventario.consultar' },
  { a: '/inventario/productos', texto: 'Productos (PT)', permiso: 'catalogo.editar' },
  { a: '/inventario/catalogo', texto: 'PI e insumos', permiso: 'inventario.catalogo' },
]

export function InventarioLayout() {
  const { tienePermiso } = useSesion()
  const visibles = PESTANAS.filter((p) => tienePermiso(p.permiso))

  return (
    <div className="mx-auto max-w-6xl space-y-5">
      <header>
        <h1 className="text-2xl font-semibold text-tinta">Inventario</h1>
        <p className="text-sm text-tinta-suave">Productos, PI e insumos: catálogo, entradas, existencias y kardex en un solo lugar.</p>
      </header>

      <nav className="flex gap-1 overflow-x-auto border-b border-borde" aria-label="Secciones de inventario">
        {visibles.map((p) => (
          <NavLink
            key={p.a}
            to={p.a}
            end={p.exacta}
            className={({ isActive }) =>
              `-mb-px whitespace-nowrap border-b-2 px-4 py-2 text-sm font-medium transition ${
                isActive ? 'border-marca text-marca' : 'border-transparent text-tinta-suave hover:text-tinta'
              }`
            }
          >
            {p.texto}
          </NavLink>
        ))}
      </nav>

      <Outlet />
    </div>
  )
}
