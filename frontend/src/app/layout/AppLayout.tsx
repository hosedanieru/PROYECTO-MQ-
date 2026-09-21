/**
 * Marco común de las pantallas autenticadas: cabecera con navegación,
 * usuario actual y "Cerrar sesión" siempre visible (equipos compartidos).
 *
 * Los enlaces del menú se filtran por permiso: quien no puede consultar
 * remisiones no ve el enlace. Es comodidad visual; la autorización real
 * la hace el backend.
 */

import { NavLink, Outlet } from 'react-router-dom'

import { useSesion } from '../../modules/auth/useSesion'

interface Enlace {
  a: string
  texto: string
  permiso: string
}

const ENLACES: Enlace[] = [
  { a: '/remisiones', texto: 'Remisiones', permiso: 'remision.consultar' },
  { a: '/mfr', texto: 'MFR', permiso: 'mfr.consultar' },
  { a: '/admin/productos', texto: 'Productos', permiso: 'catalogo.editar' },
  { a: '/admin/lineas', texto: 'Líneas', permiso: 'catalogo.editar' },
  { a: '/admin/usuarios', texto: 'Usuarios', permiso: 'admin.usuarios' },
]

export function AppLayout() {
  const { usuario, cerrarSesion, tienePermiso } = useSesion()

  return (
    <div className="min-h-screen">
      <header className="bg-white shadow-sm">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-3">
          <div className="flex items-center gap-6">
            <NavLink to="/" className="text-lg font-semibold text-slate-900">
              Maquila MQ
            </NavLink>
            <nav className="flex gap-4 text-sm">
              {ENLACES.filter((e) => tienePermiso(e.permiso)).map((e) => (
                <NavLink
                  key={e.a}
                  to={e.a}
                  className={({ isActive }) =>
                    isActive
                      ? 'font-medium text-marca'
                      : 'text-slate-600 hover:text-slate-900'
                  }
                >
                  {e.texto}
                </NavLink>
              ))}
            </nav>
          </div>

          <div className="flex items-center gap-3 text-sm">
            <span className="text-slate-600">
              {usuario?.nombre}
              <span className="ml-1 text-slate-400">({usuario?.rolCodigo})</span>
            </span>
            <button
              type="button"
              onClick={cerrarSesion}
              className="rounded-md border border-slate-300 px-3 py-1 text-slate-700 hover:bg-slate-50"
            >
              Cerrar sesión
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 py-6">
        <Outlet />
      </main>
    </div>
  )
}
