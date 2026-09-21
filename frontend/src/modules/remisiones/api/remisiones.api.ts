import { http } from '../../../services/http'
import type {
  CrearRemisionDatos,
  EditarRemisionDatos,
  EntradaAuditoria,
  FiltroRemisiones,
  Remision,
  ResultadoPaginado,
  VersionRemision,
} from '../../../shared/types/remision'

export const remisionesApi = {
  listar: (filtro: FiltroRemisiones) =>
    http
      .get<ResultadoPaginado<Remision>>('/remisiones', { params: filtro })
      .then((r) => r.data),

  obtener: (id: string) => http.get<Remision>(`/remisiones/${id}`).then((r) => r.data),

  versiones: (id: string) =>
    http.get<VersionRemision[]>(`/remisiones/${id}/versiones`).then((r) => r.data),

  auditoria: (id: string) =>
    http.get<EntradaAuditoria[]>(`/remisiones/${id}/auditoria`).then((r) => r.data),

  crear: (datos: CrearRemisionDatos) =>
    http.post<Remision>('/remisiones', datos).then((r) => r.data),

  editar: (id: string, cambios: EditarRemisionDatos) =>
    http.patch<Remision>(`/remisiones/${id}`, cambios).then((r) => r.data),

  entregar: (id: string) =>
    http.post<Remision>(`/remisiones/${id}/entregar`).then((r) => r.data),

  aprobar: (id: string, datos: { opaNombre: string; opaCargo?: string }) =>
    http.post<Remision>(`/remisiones/${id}/aprobar`, datos).then((r) => r.data),

  rechazar: (id: string, datos: { motivo: string }) =>
    http.post<Remision>(`/remisiones/${id}/rechazar`, datos).then((r) => r.data),

  rectificar: (id: string) =>
    http.post<Remision>(`/remisiones/${id}/rectificar`).then((r) => r.data),

  validar: (id: string, datos: { concilidadoCon: string }) =>
    http.post<Remision>(`/remisiones/${id}/validar`, datos).then((r) => r.data),
}
