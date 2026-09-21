import { http } from '../../../services/http'
import type {
  DatosGrupo,
  DatosNuevoProducto,
  DatosProducto,
  Grupo,
  ItemCatalogo,
  Producto,
} from '../../../shared/types/catalogo'

export const catalogoApi = {
  turnos: () => http.get<ItemCatalogo[]>('/catalogos/turnos').then((r) => r.data),
  grupos: () => http.get<Grupo[]>('/grupos').then((r) => r.data),
  crearGrupo: (datos: DatosGrupo) => http.post<Grupo>('/grupos', datos).then((r) => r.data),
  actualizarGrupo: (id: string, cambios: Partial<DatosGrupo> & { activo?: boolean }) =>
    http.patch<Grupo>(`/grupos/${id}`, cambios).then((r) => r.data),
  lugares: () => http.get<ItemCatalogo[]>('/catalogos/lugares').then((r) => r.data),
  roles: () => http.get<ItemCatalogo[]>('/catalogos/roles').then((r) => r.data),

  productos: (params: { texto?: string; soloActivos?: boolean } = {}) =>
    http
      .get<Producto[]>('/productos', {
        params: {
          texto: params.texto || undefined,
          soloActivos: params.soloActivos ? 'true' : undefined,
        },
      })
      .then((r) => r.data),
  crearProducto: (datos: DatosNuevoProducto) =>
    http.post<Producto>('/productos', datos).then((r) => r.data),
  actualizarProducto: (id: string, cambios: Partial<DatosProducto> & { activo?: boolean }) =>
    http.patch<Producto>(`/productos/${id}`, cambios).then((r) => r.data),
}
