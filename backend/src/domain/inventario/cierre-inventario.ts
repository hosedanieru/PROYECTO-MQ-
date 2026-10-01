/**
 * CIERRE DEL DÍA: CONTEO FÍSICO Y MERMA
 * =====================================
 *
 * Decisiones del usuario (2026-10-01): el consumo REAL se captura con un
 * conteo físico al cierre de cada día operativo, solo de los PI e insumos
 * que usan las recetas vigentes. La merma es lo que se gastó de más frente
 * a lo que dicen las recetas.
 *
 *   en tránsito = cajas de remisiones producidas pero aún sin aprobar
 *                 (BORRADOR, ENTREGADA, RECHAZADA, EN_RECTIFICACION) ×
 *                 receta vigente. El material ya se gastó, pero el sistema
 *                 lo descuenta recién al aprobar.
 *   esperado    = existencia del sistema − en tránsito
 *   merma       = esperado − contado        (negativa = sobrante)
 *
 * El ajuste que deja el cierre lleva la existencia a CONTADO + EN TRÁNSITO,
 * no a "contado": esas remisiones pendientes van a descontar su consumo al
 * aprobarse, y dejarla en "contado" las descontaría dos veces.
 *
 * % de merma = merma ÷ consumo teórico del periodo (lo que descontaron las
 * recetas desde el cierre anterior).
 *
 * Un cierre por día operativo (no se repite; una corrección posterior es un
 * ajuste normal). Todos los materiales de la lista se cuentan.
 */

import { redondear, tieneDecimalesValidos } from './cantidad.js';
import { DatosInventarioInvalidosError, ErrorInventario } from './inventario.errors.js';
import type { ItemInventario } from './item-inventario.js';
import type { RecetaPt } from './receta.js';

/** Remisiones cuyo material ya se gastó pero aún no se descontó (no aprobadas). */
export const ESTADOS_EN_TRANSITO = ['BORRADOR', 'ENTREGADA', 'RECHAZADA', 'EN_RECTIFICACION'] as const;

/** Límite técnico (Firestore: 500 escrituras por transacción; cada línea son 2-3). */
export const MAXIMO_LINEAS_CIERRE = 150;

export class CierreYaRegistradoError extends ErrorInventario {
  readonly codigo = 'INVENTARIO_CIERRE_YA_REGISTRADO';
}

export class CierreNoEncontradoError extends ErrorInventario {
  readonly codigo = 'INVENTARIO_CIERRE_NO_ENCONTRADO';
}

/** Un material que hay que contar, con lo que dice el sistema. */
export interface MaterialACerrar {
  item: ItemInventario;
  enTransito: number;
  esperado: number;
  /** Lo que descontaron las recetas desde el cierre anterior. */
  consumoTeorico: number;
}

export interface LineaCierre {
  itemId: string;
  codigo: string;
  descripcion: string;
  unidad: string;
  existenciaSistema: number;
  enTransito: number;
  esperado: number;
  contado: number;
  /** esperado − contado; negativa = sobrante. */
  merma: number;
  consumoTeorico: number;
  /** merma ÷ consumo teórico × 100 (1 decimal); null sin consumo teórico. */
  mermaPorcentaje: number | null;
  /** Lo digitado si fue conteo mixto ("9 ROLLO + 37,4 METRO …"). */
  conteoTexto: string | null;
}

export interface CierreInventario {
  id: string;
  /** El día operativo que se cierra. */
  fechaOperativa: Date;
  fechaHoraRegistro: Date;
  usuarioId: string;
  usuarioNombre: string;
  observacion: string | null;
  lineas: LineaCierre[];
}

export type NuevoCierre = Omit<CierreInventario, 'id'>;

/**
 * Qué se cuenta: los componentes de las recetas vigentes de los PT activos,
 * con lo que está en tránsito y lo esperado. Ordenados por código.
 */
export function materialesACerrar(
  items: ItemInventario[],
  recetasVigentes: RecetaPt[],
  cajasEnTransitoPorProducto: Map<string, number>,
  consumoTeoricoPorItem: Map<string, number>,
): MaterialACerrar[] {
  const itemPorId = new Map(items.map((i) => [i.id, i]));
  const ptsActivos = new Set(items.filter((i) => i.tipo === 'PT' && i.activo).map((i) => i.referenciaId));
  const enTransito = new Map<string, number>();

  for (const receta of recetasVigentes) {
    if (!ptsActivos.has(receta.productoId)) continue;
    const cajas = cajasEnTransitoPorProducto.get(receta.productoId) ?? 0;
    for (const c of receta.componentes) {
      enTransito.set(c.itemId, redondear((enTransito.get(c.itemId) ?? 0) + c.cantidad * cajas));
    }
  }

  return [...enTransito.entries()]
    .filter(([itemId]) => itemPorId.has(itemId))
    .map(([itemId, transito]) => {
      const item = itemPorId.get(itemId)!;
      return { item, enTransito: transito, esperado: redondear(item.existencia - transito), consumoTeorico: consumoTeoricoPorItem.get(itemId) ?? 0 };
    })
    .sort((a, b) => a.item.codigo.localeCompare(b.item.codigo));
}

/** Todos los materiales de la lista, una sola vez, y nada que no esté en ella. */
export function exigirCierreCompleto(materiales: MaterialACerrar[], contados: string[]): void {
  const esperados = new Set(materiales.map((m) => m.item.id));
  const vistos = new Set<string>();
  for (const id of contados) {
    if (vistos.has(id)) throw new DatosInventarioInvalidosError('Un material aparece dos veces en el conteo.');
    if (!esperados.has(id)) throw new DatosInventarioInvalidosError('Se contó un material que no usa ninguna receta vigente.');
    vistos.add(id);
  }
  const faltan = materiales.filter((m) => !vistos.has(m.item.id)).map((m) => m.item.codigo);
  if (faltan.length > 0) {
    throw new DatosInventarioInvalidosError(`Faltan por contar: ${faltan.join(', ')}. El cierre se registra con todos los materiales.`);
  }
}

export function calcularLineaCierre(m: MaterialACerrar, contado: number, conteoTexto: string | null): LineaCierre {
  if (!tieneDecimalesValidos(contado) || contado < 0) {
    throw new DatosInventarioInvalidosError(`${m.item.codigo}: lo contado debe ser cero o más, con máximo 3 decimales.`);
  }
  const merma = redondear(m.esperado - contado);
  return {
    itemId: m.item.id,
    codigo: m.item.codigo,
    descripcion: m.item.descripcion,
    unidad: m.item.unidadMedida,
    existenciaSistema: m.item.existencia,
    enTransito: m.enTransito,
    esperado: m.esperado,
    contado,
    merma,
    consumoTeorico: m.consumoTeorico,
    mermaPorcentaje: m.consumoTeorico > 0 ? Math.round((merma / m.consumoTeorico) * 1000) / 10 : null,
    conteoTexto,
  };
}

export interface CierreInventarioRepository {
  buscarPorFecha(fechaOperativa: Date): Promise<CierreInventario | null>;
  /** El cierre más reciente ANTES de esa fecha (define desde cuándo se mide el consumo teórico). */
  anteriorA(fechaOperativa: Date): Promise<CierreInventario | null>;
  /** Fechas operativas, inclusive; más recientes primero. */
  listar(desde: Date, hasta: Date): Promise<CierreInventario[]>;
  /** Escritura pura; falla si ya hay un cierre ese día (restricción única). */
  crear(cierre: NuevoCierre): Promise<CierreInventario>;
}

export const CIERRE_INVENTARIO_REPOSITORY = Symbol('CierreInventarioRepository');
