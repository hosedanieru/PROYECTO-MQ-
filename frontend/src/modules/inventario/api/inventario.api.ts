import { http } from '../../../services/http'
import {
  RUTA_MATERIAL,
  type AlertasInventarioDia,
  type ComponenteReceta,
  type DatosAjuste,
  type DatosEntrada,
  type DatosMaterial,
  type DatosMovimiento,
  type EntradaMercancia,
  type ItemInventario,
  type LineaEntradaRegistrada,
  type Material,
  type MovimientoInventario,
  type RecetaConHistorial,
  type RecetaPt,
  type ResumenReceta,
  type TipoItem,
  type TipoMaterial,
  type UnidadMedida,
} from '../../../shared/types/inventario'

type ResultadoMovimiento = { movimiento: MovimientoInventario; item: ItemInventario }
export type EntradaConLineas = EntradaMercancia & { lineas: LineaEntradaRegistrada[] }

export const inventarioApi = {
  // Existencias y kardex
  items: (filtro: { tipo?: TipoItem; texto?: string; soloActivos?: boolean } = {}) =>
    http
      .get<ItemInventario[]>('/inventario/items', {
        params: { tipo: filtro.tipo, texto: filtro.texto || undefined, soloActivos: filtro.soloActivos ? 'true' : undefined },
      })
      .then((r) => r.data),
  item: (id: string) => http.get<ItemInventario>(`/inventario/items/${id}`).then((r) => r.data),
  kardex: (id: string, limite = 200) =>
    http.get<MovimientoInventario[]>(`/inventario/items/${id}/movimientos`, { params: { limite } }).then((r) => r.data),

  // Catálogo: unidades, PI e insumos (el PT se crea en /productos)
  unidades: () => http.get<UnidadMedida[]>('/inventario/unidades').then((r) => r.data),
  crearUnidad: (datos: { codigo: string; nombre: string }) => http.post<UnidadMedida>('/inventario/unidades', datos).then((r) => r.data),
  actualizarUnidad: (id: string, cambios: Partial<{ codigo: string; nombre: string; activo: boolean }>) =>
    http.patch<UnidadMedida>(`/inventario/unidades/${id}`, cambios).then((r) => r.data),
  materiales: (tipo: TipoMaterial) => http.get<Material[]>(`/inventario/catalogo/${RUTA_MATERIAL[tipo]}`).then((r) => r.data),
  crearMaterial: (tipo: TipoMaterial, datos: DatosMaterial) =>
    http.post<Material>(`/inventario/catalogo/${RUTA_MATERIAL[tipo]}`, datos).then((r) => r.data),
  actualizarMaterial: (tipo: TipoMaterial, id: string, cambios: Partial<DatosMaterial> & { activo?: boolean }) =>
    http.patch<Material>(`/inventario/catalogo/${RUTA_MATERIAL[tipo]}/${id}`, cambios).then((r) => r.data),

  // Alertas del día (fase D)
  alertas: (fecha: string) => http.get<AlertasInventarioDia>('/inventario/alertas', { params: { fecha } }).then((r) => r.data),

  // Receta del PT (versionada: guardar crea una versión nueva)
  resumenRecetas: () => http.get<ResumenReceta[]>('/inventario/recetas').then((r) => r.data),
  receta: (productoId: string) => http.get<RecetaConHistorial>(`/inventario/recetas/${productoId}`).then((r) => r.data),
  guardarReceta: (productoId: string, componentes: ComponenteReceta[]) =>
    http.put<RecetaPt>(`/inventario/recetas/${productoId}`, { componentes }).then((r) => r.data),

  // Movimientos y entradas
  registrarMovimiento: (datos: DatosMovimiento) =>
    http.post<ResultadoMovimiento>('/inventario/movimientos', datos).then((r) => r.data),
  registrarAjuste: (datos: DatosAjuste) => http.post<ResultadoMovimiento>('/inventario/ajustes', datos).then((r) => r.data),
  registrarEntrada: (datos: DatosEntrada) => http.post<EntradaConLineas>('/inventario/entradas', datos).then((r) => r.data),
  entradas: (desde: string, hasta: string) =>
    http.get<EntradaMercancia[]>('/inventario/entradas', { params: { desde, hasta } }).then((r) => r.data),
  entrada: (id: string) => http.get<EntradaConLineas>(`/inventario/entradas/${id}`).then((r) => r.data),
}
