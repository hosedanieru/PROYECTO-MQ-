import { http } from '../../../services/http'
import type { PerfilUsuario } from '../../../shared/types/api'

export interface CrearUsuarioDatos {
  documento: string
  nombre: string
  email?: string
  contrasena: string
  rolId: string
}

export interface ActualizarUsuarioDatos {
  nombre?: string
  email?: string | null
  rolId?: string
  activo?: boolean
  contrasena?: string
}

export const usuariosApi = {
  listar: () => http.get<PerfilUsuario[]>('/usuarios').then((r) => r.data),
  crear: (datos: CrearUsuarioDatos) =>
    http.post<PerfilUsuario>('/usuarios', datos).then((r) => r.data),
  actualizar: (id: string, cambios: ActualizarUsuarioDatos) =>
    http.patch<PerfilUsuario>(`/usuarios/${id}`, cambios).then((r) => r.data),
}
