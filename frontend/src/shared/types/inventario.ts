/** Tipos del módulo de inventario, espejo de `/api/inventario`. */

export const TIPOS_ITEM = ['INSUMO', 'PI', 'PT'] as const
export type TipoItem = (typeof TIPOS_ITEM)[number]

export const NOMBRE_TIPO_ITEM: Record<TipoItem, string> = {
  INSUMO: 'Insumo',
  PI: 'PI · Producto intermedio',
  PT: 'PT · Producto terminado',
}

export type TipoMovimiento = 'ENTRADA' | 'SALIDA' | 'AJUSTE'

/**
 * Existencia de un PT, PI o insumo. Código, descripción, unidad y "activo"
 * vienen de su catálogo (cada tipo tiene su tabla). Cantidades en enteros.
 */
export interface ItemInventario {
  id: string
  tipo: TipoItem
  /** Id en su catálogo (producto, PI o insumo). */
  referenciaId: string
  codigo: string
  descripcion: string
  /** CAJA en el PT; la unidad base en PI e insumos. */
  unidadMedida: string
  existencia: number
  activo: boolean
  /** Escalones para contar como viene (rollos, cajas, estibas); null en el PT. */
  equivalencias: Equivalencias | null
}

export interface Equivalencias {
  presentacion: string | null
  contenidoPresentacion: number | null
  unidadesPorCaja: number | null
  cajasPorEstiba: number | null
}

/**
 * Conteo mixto: lo que se digita como viene ("2 estibas + 5 cajas + 3
 * rollos + 12,5 metros"). El backend lo convierte a la medida del ítem.
 */
export interface Conteo {
  estibas: number
  cajas: number
  presentaciones: number
  medida: number
}

/** Unidad base en que se cuenta un PI o insumo (la lista desplegable). */
export interface UnidadMedida {
  id: string
  codigo: string
  nombre: string
  activo: boolean
}

export type TipoMaterial = 'PI' | 'INSUMO'

/** Segmento de la ruta de la API de cada tipo. */
export const RUTA_MATERIAL: Record<TipoMaterial, string> = { PI: 'pi', INSUMO: 'insumos' }

/**
 * PI o insumo. `unidadBase` es la MEDIDA en que se lleva y se descuenta
 * (METRO, UNIDAD…, con decimales); `presentacion` + `contenidoPresentacion`
 * dicen cómo viene (ROLLO de 50 METRO). Escalones: estiba → caja → presentación.
 */
export interface Material {
  id: string
  tipo: TipoMaterial
  codigo: string
  descripcion: string
  unidadBaseId: string
  unidadBase: string
  presentacionId: string | null
  presentacion: string | null
  contenidoPresentacion: number | null
  /** Presentaciones por caja (o unidades de la medida, si no hay presentación). */
  unidadesPorCaja: number | null
  cajasPorEstiba: number | null
  activo: boolean
}

export interface DatosMaterial {
  codigo: string
  descripcion: string
  unidadBaseId: string
  presentacionId: string | null
  contenidoPresentacion: number | null
  unidadesPorCaja: number | null
  cajasPorEstiba: number | null
}

/** Cantidades de PI e insumos: hasta 3 decimales. El PT, en cajas enteras. */
export const DECIMALES_CANTIDAD = 3

/**
 * Un PI o insumo de la receta del PT: `cantidad` que gasta UNA caja de PT,
 * en la medida del componente (hasta 3 decimales). Ej.: 12 UNIDAD; 1,8 METRO.
 */
export interface ComponenteReceta {
  itemId: string
  cantidad: number
}

export interface ComponenteDetallado extends ComponenteReceta {
  tipo: TipoItem | null
  codigo: string
  descripcion: string
  unidadMedida: string
  activo: boolean
  existencia: number
}

/** Una versión de la receta. Nunca se edita: guardar crea la siguiente. */
export interface RecetaPt {
  id: string
  productoId: string
  version: number
  vigenteDesde: string
  creadaPorId: string
  creadaPorNombre: string
  componentes: ComponenteDetallado[]
}

export interface RecetaConHistorial {
  vigente: RecetaPt | null
  /** La más reciente primero (incluye la vigente). */
  versiones: RecetaPt[]
}

export interface ResumenReceta {
  productoId: string
  version: number
  vigenteDesde: string
  componentes: number
}

export const MAXIMO_COMPONENTES_RECETA = 30

/**
 * Cierre del día (2026-10-01): conteo físico de los materiales de las
 * recetas. esperado = sistema − en tránsito; merma = esperado − contado
 * (negativa = sobrante).
 */
export interface LineaCierre {
  itemId: string
  codigo: string
  descripcion: string
  unidad: string
  existenciaSistema: number
  enTransito: number
  esperado: number
  contado: number
  merma: number
  consumoTeorico: number
  mermaPorcentaje: number | null
  conteoTexto: string | null
}

export interface CierreInventario {
  id: string
  fechaOperativa: string
  fechaHoraRegistro: string
  usuarioNombre: string
  observacion: string | null
  lineas: LineaCierre[]
}

/** Lo que hay que contar ese día, o el cierre ya registrado. */
export interface CierrePreparado {
  fechaOperativa: string
  cierre: CierreInventario | null
  materiales: Array<{
    itemId: string
    codigo: string
    descripcion: string
    unidad: string
    equivalencias: Equivalencias | null
    existenciaSistema: number
    enTransito: number
    esperado: number
    consumoTeorico: number
  }>
}

export interface DatosCierre {
  fechaOperativa: string
  lineas: Array<{ itemId: string } & ({ conteo: Conteo } | { cantidad: number })>
  observacion?: string
}

/** Fase D. Se calculan en el momento con existencias, recetas, DPP y aprobadas del día. */
export type TipoAlertaInventario = 'PT_SIN_RECETA' | 'COMPONENTE_INACTIVO' | 'AGOTADO' | 'NO_ALCANZA_DPP'

export interface AlertaInventario {
  tipo: TipoAlertaInventario
  gravedad: 'CRITICA' | 'ADVERTENCIA'
  /** El PT (sin receta, componente inactivo) o el PI/insumo (agotado, no alcanza). */
  itemId: string
  codigo: string
  descripcion: string
  mensaje: string
  necesita?: number
  hay?: number
  falta?: number
  unidad?: string
}

export interface AlertasInventarioDia {
  fechaOperativa: string
  hayDpp: boolean
  alertas: AlertaInventario[]
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
  /** Remisión cuya aprobación descontó este consumo (receta del PT). */
  remisionId: string | null
  /** Lo que se digitó si fue un conteo mixto. */
  conteoTexto: string | null
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
  conteoTexto: string | null
}

/** Una de dos: cantidad directa en la medida, o el conteo como viene. */
export type CantidadOConteo = { cantidad: number; conteo?: never } | { conteo: Conteo; cantidad?: never }

export interface DatosEntrada {
  documento: string
  remitente?: string
  observacion?: string
  lineas: Array<{ itemId: string } & CantidadOConteo>
}

export type DatosMovimiento = {
  itemId: string
  tipo: 'ENTRADA' | 'SALIDA'
  referencia?: string
  observacion?: string
} & CantidadOConteo

/** `cantidad`: + suma, − resta. `conteo`: lo contado físicamente (el backend calcula la diferencia). */
export type DatosAjuste = {
  itemId: string
  motivo: string
  observacion?: string
} & CantidadOConteo
