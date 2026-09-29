import { http } from '../../../services/http'
import type {
  CambiosItem,
  DatosAjuste,
  DatosEntrada,
  DatosMovimiento,
  DatosNuevoItem,
  EntradaMercancia,
  ItemInventario,
  LineaEntradaRegistrada,
  MovimientoInventario,
  TipoItem,
} from '../../../shared/types/inventario'

type ResultadoMovimiento = { movimiento: MovimientoInventario; item: ItemInventario }
export type EntradaConLineas = EntradaMercancia & { lineas: LineaEntradaRegistrada[] }

export const inventarioApi = {
  items: (filtro: { tipo?: TipoItem; texto?: string; soloActivos?: boolean } = {}) =>
    http
      .get<ItemInventario[]>('/inventario/items', {
        params: { tipo: filtro.tipo, texto: filtro.texto || undefined, soloActivos: filtro.soloActivos ? 'true' : undefined },
      })
      .then((r) => r.data),
  item: (id: string) => http.get<ItemInventario>(`/inventario/items/${id}`).then((r) => r.data),
  kardex: (id: string, limite = 200) =>
    http.get<MovimientoInventario[]>(`/inventario/items/${id}/movimientos`, { params: { limite } }).then((r) => r.data),

  crearItem: (datos: DatosNuevoItem) => http.post<ItemInventario>('/inventario/items', datos).then((r) => r.data),
  actualizarItem: (id: string, cambios: CambiosItem) =>
    http.patch<ItemInventario>(`/inventario/items/${id}`, cambios).then((r) => r.data),

  registrarMovimiento: (datos: DatosMovimiento) =>
    http.post<ResultadoMovimiento>('/inventario/movimientos', datos).then((r) => r.data),
  registrarAjuste: (datos: DatosAjuste) => http.post<ResultadoMovimiento>('/inventario/ajustes', datos).then((r) => r.data),

  registrarEntrada: (datos: DatosEntrada) =>
    http.post<EntradaConLineas>('/inventario/entradas', datos).then((r) => r.data),
  entradas: (desde: string, hasta: string) =>
    http.get<EntradaMercancia[]>('/inventario/entradas', { params: { desde, hasta } }).then((r) => r.data),
  entrada: (id: string) => http.get<EntradaConLineas>(`/inventario/entradas/${id}`).then((r) => r.data),
}
