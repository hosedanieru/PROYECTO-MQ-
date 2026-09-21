export interface ItemCatalogo {
  id: string
  codigo: string
  nombre: string
  activo: boolean
}

/** Grupo (antes "proveedor"): quien pone el personal del turno. */
export interface Grupo {
  id: string
  codigo: string
  nombre: string
  /** Texto libre: aquí se escribe el proveedor real. */
  descripcion: string | null
  /** Personas que el grupo debería enviar por turno; null = sin definir. */
  personasEsperadas: number | null
  activo: boolean
}

export interface DatosGrupo {
  codigo: string
  nombre: string
  descripcion: string | null
  personasEsperadas: number | null
}

export const PROCESOS_PRODUCTO = ['MANUAL', 'AUTOMATICA'] as const
export type ProcesoProducto = (typeof PROCESOS_PRODUCTO)[number]

export interface Producto {
  id: string
  codigo: string
  descripcion: string
  proceso: ProcesoProducto | null
  activo: boolean
  unidadesPorCaja: number | null
  cajasPorEstiba: number | null
  /** LINEA IDEAL: personas necesarias en la línea para este SKU. */
  personasIdeal: number | null
  /** SUBDESCRIPCION: familia (SURTIDO, OFERTA, REEMPAQUE, MULTIPACK…). */
  subdescripcion: string | null
  /** Estándar de producción (se edita con motivo desde /mfr/estandares). */
  cajasPorHora: number | null
  pesoNetoKg: number | null
}

export interface DatosProducto {
  codigo: string
  descripcion: string
  proceso: ProcesoProducto | null
  unidadesPorCaja: number | null
  cajasPorEstiba: number | null
  personasIdeal: number | null
  subdescripcion: string | null
}

/** Al crear se pueden indicar los estándares de una vez. */
export interface DatosNuevoProducto extends DatosProducto {
  cajasPorHora?: number | null
  pesoNetoKg?: number | null
}
