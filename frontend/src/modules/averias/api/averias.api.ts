import { http } from '../../../services/http'
import type {
  CambiosRegistroAveria,
  CausalAveria,
  DatosCausal,
  FiltroAverias,
  RegistroNuevoAveria,
  ReporteAveria,
  TipoEvidencia,
} from '../../../shared/types/averia'

/** Un reporte con fotos puede tardar en subir desde un celular con mala señal. */
const TIEMPO_ENVIO_MS = 120_000

export const averiasApi = {
  causales: () => http.get<CausalAveria[]>('/averias/causales').then((r) => r.data),
  crearCausal: (datos: DatosCausal) => http.post<CausalAveria>('/averias/causales', datos).then((r) => r.data),
  actualizarCausal: (id: string, cambios: Partial<DatosCausal> & { activo?: boolean }) =>
    http.patch<CausalAveria>(`/averias/causales/${id}`, cambios).then((r) => r.data),

  listar: (filtro: FiltroAverias) => http.get<ReporteAveria[]>('/averias', { params: filtro }).then((r) => r.data),
  detalle: (id: string) => http.get<ReporteAveria>(`/averias/${id}`).then((r) => r.data),

  /**
   * Multipart: `datos` lleva el JSON y cada foto va como `foto_{fila}_{TIPO}`.
   * Fecha, hora, turno y quién reporta los pone el servidor.
   */
  crear: (grupoId: string, registros: RegistroNuevoAveria[]) => {
    const cuerpo = new FormData()
    cuerpo.append(
      'datos',
      JSON.stringify({
        grupoId,
        registros: registros.map(({ fotos: _f, productoEtiqueta: _e, ...r }) => r),
      }),
    )
    registros.forEach((r, fila) => {
      for (const [tipo, archivo] of Object.entries(r.fotos)) {
        cuerpo.append(`foto_${fila}_${tipo}`, archivo, archivo.name)
      }
    })
    return http.post<ReporteAveria>('/averias', cuerpo, { timeout: TIEMPO_ENVIO_MS }).then((r) => r.data)
  },

  corregirRegistro: (id: string, registroId: string, cambios: CambiosRegistroAveria) =>
    http.patch<ReporteAveria>(`/averias/${id}/registros/${registroId}`, cambios).then((r) => r.data),
  anular: (id: string, motivo: string) => http.post<ReporteAveria>(`/averias/${id}/anular`, { motivo }).then((r) => r.data),

  /** La foto como Blob: un <img src="/api/..."> no enviaría el token. */
  foto: (id: string, registroId: string, tipo: TipoEvidencia) =>
    http.get<Blob>(`/averias/${id}/registros/${registroId}/fotos/${tipo}`, { responseType: 'blob' }).then((r) => r.data),
}
