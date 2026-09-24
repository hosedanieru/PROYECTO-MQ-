import { http } from '../../../services/http'
import type {
  AsignacionLinea,
  AsistenciaTurno,
  BloqueCalculado,
  CambioEstandarLote,
  DatosAsignacion,
  DatosAsistencia,
  DatosBloque,
  EstandarProducto,
  IndicadoresDia,
  LineaProduccion,
  PropuestaDpp,
  ResultadoLoteEstandares,
  ResultadoPeriodo,
  TipoLinea,
} from '../../../shared/types/mfr'

export const mfrApi = {
  dia: (fecha: string) =>
    http.get<IndicadoresDia>('/mfr/dia', { params: { fecha } }).then((r) => r.data),

  guardarBloque: (datos: DatosBloque & { fechaOperativa: string; id?: string; motivo?: string }) =>
    http.put<BloqueCalculado>('/mfr/bloques', datos).then((r) => r.data),
  eliminarBloque: (id: string, motivo: string) =>
    http.delete(`/mfr/bloques/${id}`, { data: { motivo } }).then(() => undefined),
  cargarDia: (datos: {
    fechaOperativa: string
    bloques: DatosBloque[]
    origen: 'MANUAL' | 'DPP'
    reemplazar: boolean
    motivo?: string
  }) => http.post<BloqueCalculado[]>('/mfr/bloques/dia', datos).then((r) => r.data),
  /**
   * Carga de N días: cada bloque lleva su propio día y el backend los agrupa.
   *
   * Timeout largo a propósito: un DPP semanal son ~170 bloques en 12
   * transacciones (una por día), y cada una escribe el bloque más su
   * auditoría. Con los 15 s por defecto el navegador abandonaba a mitad
   * de camino mientras el servidor seguía escribiendo.
   */
  cargarPeriodo: (datos: {
    bloques: Array<DatosBloque & { fechaOperativa: string }>
    origen: 'MANUAL' | 'DPP'
    reemplazar: boolean
    motivo?: string
  }) => http.post<ResultadoPeriodo>('/mfr/bloques/periodo', datos, { timeout: 180_000 }).then((r) => r.data),
  copiarDia: (datos: { desde: string; hacia: string; reemplazar: boolean; motivo?: string }) =>
    http.post<BloqueCalculado[]>('/mfr/bloques/copiar', datos).then((r) => r.data),
  cerrarTurno: (fechaOperativa: string, turnoId: string, motivoFaltante?: string) =>
    http.post<BloqueCalculado[]>('/mfr/turno/cerrar', { fechaOperativa, turnoId, motivoFaltante }).then((r) => r.data),

  registrarAsistencia: (datos: DatosAsistencia) =>
    http.put<AsistenciaTurno>('/mfr/asistencia', datos).then((r) => r.data),
  asignarGrupoLinea: (datos: DatosAsignacion) =>
    http.put<AsignacionLinea>('/mfr/asignaciones', datos).then((r) => r.data),
  quitarAsignacion: (id: string) => http.delete(`/mfr/asignaciones/${id}`).then(() => undefined),

  analizarDpp: (archivo: File) => {
    const form = new FormData()
    form.append('archivo', archivo)
    // Leer un PDF de varias páginas puede tardar más que una petición normal.
    return http.post<PropuestaDpp>('/mfr/dpp/analizar', form, { timeout: 60_000 }).then((r) => r.data)
  },

  lineas: () => http.get<LineaProduccion[]>('/mfr/lineas').then((r) => r.data),
  crearLinea: (datos: { codigo: string; nombre: string; tipo: TipoLinea; capacidadKgHora: number | null; orden: number }) =>
    http.post<LineaProduccion>('/mfr/lineas', datos).then((r) => r.data),
  actualizarLinea: (
    id: string,
    cambios: Partial<{ codigo: string; nombre: string; tipo: TipoLinea; capacidadKgHora: number | null; orden: number; activo: boolean }>,
  ) => http.patch<LineaProduccion>(`/mfr/lineas/${id}`, cambios).then((r) => r.data),

  estandares: () => http.get<EstandarProducto[]>('/mfr/estandares').then((r) => r.data),
  actualizarEstandar: (productoId: string, datos: { cajasPorHora: number | null; pesoNetoKg: number | null; motivo: string }) =>
    http.put<EstandarProducto>(`/mfr/estandares/${productoId}`, datos).then((r) => r.data),
  /** Carga en lote: todo el lote entra en una transacción, o no entra nada. */
  actualizarEstandaresEnLote: (datos: { cambios: CambioEstandarLote[]; motivo: string }) =>
    http.put<ResultadoLoteEstandares>('/mfr/estandares', datos).then((r) => r.data),
}
