import { createContext } from 'react'

import type { PerfilUsuario } from '../../shared/types/api'

export interface Sesion {
  usuario: PerfilUsuario | null
  /** `true` mientras se comprueba el token guardado al arrancar. */
  cargando: boolean
  iniciarSesion: (documento: string, contrasena: string, recordar: boolean) => Promise<void>
  cerrarSesion: () => void
  tienePermiso: (codigo: string) => boolean
}

export const SesionContext = createContext<Sesion | null>(null)
