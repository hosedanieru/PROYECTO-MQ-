/**
 * Llamadas HTTP del módulo de autenticación. Solo traducen
 * "función → endpoint"; no guardan estado ni saben de React.
 */

import { http } from '../../../services/http'
import type { PerfilUsuario, SesionIniciada } from '../../../shared/types/api'

export const authApi = {
  async login(documento: string, contrasena: string): Promise<SesionIniciada> {
    const { data } = await http.post<SesionIniciada>('/auth/login', {
      documento,
      contrasena,
    })
    return data
  },

  async perfil(): Promise<PerfilUsuario> {
    const { data } = await http.get<PerfilUsuario>('/auth/perfil')
    return data
  },
}
