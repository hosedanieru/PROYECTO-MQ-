/**
 * MÓDULO DE INVENTARIO — un solo apartado
 * =======================================
 *
 * Usuario, 2026-09-29: productos e inventario son un solo módulo, y hay
 * una tabla por cada tipo (PT, PI, insumos). En pestañas:
 *
 *   Existencias      cuánto hay de cada PT, PI e insumo; movimientos; kardex
 *   Entradas         entradas de mercancía (lo que llega en un documento)
 *   PT               catálogo de PT (el mismo de remisiones y del DPP;
 *                    por dentro la tabla sigue llamándose `producto`)
 *   PI · Insumos     catálogo de cada uno, con unidad base y equivalencias
 *   Unidades         la lista desplegable de unidades base
 *
 * Las Alertas salieron a su tablero (/tableros/alertas-inventario;
 * usuario, 2026-10-06): aquí queda la operación.
 *
 * Crear un PT, PI o insumo crea su existencia. Cada pestaña se muestra
 * solo con su permiso (hoy: el administrador).
 */

import { NavLink, Outlet } from 'react-router-dom'

import { EncabezadoPagina } from '../../components/EncabezadoPagina'
import { IconoInventario } from '../../components/Iconos'

import { useSesion } from '../auth/useSesion'

const PESTANAS = [
  {
    a: '/inventario',
    texto: 'Existencias',
    permiso: 'inventario.consultar',
    exacta: true,
  },
  {
    a: '/inventario/entradas',
    texto: 'Entradas de mercancía',
    permiso: 'inventario.consultar',
  },
  {
    a: '/inventario/cierre',
    texto: 'Cierre del día',
    permiso: 'inventario.consultar',
  },
  { a: '/inventario/pt', texto: 'PT', permiso: 'catalogo.editar' },
  { a: '/inventario/pi', texto: 'PI', permiso: 'inventario.catalogo' },
  {
    a: '/inventario/insumos',
    texto: 'Insumos',
    permiso: 'inventario.catalogo',
  },
  {
    a: '/inventario/unidades',
    texto: 'Unidades',
    permiso: 'inventario.catalogo',
  },
]

export function InventarioLayout() {
  const { tienePermiso } = useSesion()
  const visibles = PESTANAS.filter((p) => tienePermiso(p.permiso))

  return (
    <div className="mx-auto max-w-6xl space-y-5">
      <EncabezadoPagina
        Icono={IconoInventario}
        escena="inventario"
        titulo="Inventario"
        descripcion="PT, PI e insumos: catálogo, entradas, existencias y kardex en un solo lugar."
      />

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
