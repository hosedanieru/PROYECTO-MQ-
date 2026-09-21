import { useContext } from 'react'

import { SesionContext, type Sesion } from './sesion-context'

/** Acceso a la sesión actual desde cualquier componente. */
export function useSesion(): Sesion {
  const contexto = useContext(SesionContext)
  if (!contexto) {
    throw new Error('useSesion() debe usarse dentro de <SesionProvider>.')
  }
  return contexto
}
