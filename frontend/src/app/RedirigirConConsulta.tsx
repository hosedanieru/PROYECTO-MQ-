import { Navigate, useLocation } from 'react-router-dom'

/**
 * Redirige a otra ruta conservando la consulta (`?fecha=…`). Para las
 * rutas que cambiaron de lugar: un enlace guardado o compartido con la
 * dirección vieja sigue abriendo el mismo día.
 */
export function RedirigirConConsulta({ a }: { a: string }) {
  const { search } = useLocation()
  return <Navigate to={`${a}${search}`} replace />
}
