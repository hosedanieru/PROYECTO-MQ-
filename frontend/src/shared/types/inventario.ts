/** Tipos del módulo de inventario, espejo de `/api/inventario`. */

export const TIPOS_ITEM = ['INSUMO', 'PI', 'PT'] as const
export type TipoItem = (typeof TIPOS_ITEM)[number]

export const NOMBRE_TIPO_ITEM: Record<TipoItem, string> = {
  INSUMO: 'Insumo',
  PI: 'PI · Producto intermedio',
  PT: 'PT · Producto terminado',
}

export type TipoMovimiento = 'ENTRADA' | 'SALIDA' | 'AJUSTE'

export interface ItemInventario {
  id: string
  tipo: TipoItem
  /** En PT sale del producto enlazado. */
  codigo: string
  descripcion: string
  unidadMedida: string
  productoId: string | null
  existencia: number
  activo: boolean
}

export interface DatosNuevoItem {
  tipo: TipoItem
  codigo?: string
  descripcion?: string
  unidadMedida: string
  productoId?: string
}

export interface CambiosItem {
  codigo?: string
  descripcion?: string
  unidadMedida?: string
  activo?: boolean
}

export interface MovimientoInventario {
  id: string
  itemId: string
  tipo: TipoMovimiento
  /** Con signo: lo que sumó o restó. */
  cantidad: number
  /** Existencia después del movimiento. */
  saldo: number
  fechaHoraRegistro: string
  fechaOperativa: string
  turnoId: string
  usuarioId: string
  usuarioNombre: string
  referencia: string | null
  observacion: string | null
  motivo: string | null
  /** Entrada de mercancía a la que pertenece. */
  entradaId: string | null
}

/** Tipos que recibe la entrada de mercancía (el PT no llega de afuera). */
export const TIPOS_ITEM_ENTRADA: readonly TipoItem[] = ['INSUMO', 'PI']

export interface EntradaMercancia {
  id: string
  documento: string
  remitente: string | null
  observacion: string | null
  fechaHoraRegistro: string
  fechaOperativa: string
  turnoId: string
  usuarioId: string
  usuarioNombre: string
}

export interface LineaEntradaRegistrada {
  movimientoId: string
  itemId: string
  codigo: string
  descripcion: string
  unidadMedida: string
  cantidad: number
  saldo: number
}

export interface DatosEntrada {
  documento: string
  remitente?: string
  observacion?: string
  lineas: Array<{ itemId: string; cantidad: number }>
}

export interface DatosMovimiento {
  itemId: string
  tipo: 'ENTRADA' | 'SALIDA'
  cantidad: number
  referencia?: string
  observacion?: string
}

export interface DatosAjuste {
  itemId: string
  /** + suma, − resta. */
  cantidad: number
  motivo: string
  observacion?: string
}
