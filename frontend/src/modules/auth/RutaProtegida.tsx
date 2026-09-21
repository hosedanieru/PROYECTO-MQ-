/**
 * Envuelve las rutas que exigen sesión. Si no hay usuario, redirige al
 * login recordando a dónde quería ir, para volver después de entrar.
 */

import { Navigate, Outlet, useLocation } from 'react-router-dom'

import { PantallaCargando } from '../../components/PantallaCargando'
import { useSesion } from './useSesion'

export function RutaProtegida() {
  const { usuario, cargando } = useSesion()
  const ubicacion = useLocation()

  if (cargando) {
    return <PantallaCargando mensaje="Comprobando sesión…" />
  }

  if (!usuario) {
    return <Navigate to="/login" replace state={{ desde: ubicacion.pathname }} />
  }

  return <Outlet />
}
