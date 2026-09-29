/**
 * MOVIMIENTO DE INVENTARIO (kardex)
 * =================================
 *
 * Cada entrada, salida o ajuste queda registrado con quién, cuándo
 * (fecha, hora, día operativo y turno, que pone el servidor) y el saldo
 * que dejó. Nunca se borra: un error se corrige con un AJUSTE con motivo.
 *
 *   ENTRADA   suma      (cantidad > 0)
 *   SALIDA    resta     (cantidad > 0)
 *   AJUSTE    suma o resta (cantidad con signo, ≠ 0); motivo obligatorio.
 *             Es la corrección tras un conteo físico o un error.
 *
 * Regla del usuario (2026-09-29): la existencia nunca queda negativa. Si
 * el sistema dice que hay 100, no deja sacar 120: así se ve al momento
 * que algo no se registró, en vez de descubrirlo días después.
 *
 * Sin lote (usuario, 2026-09-29: no tiene relevancia).
 */

import { DatosInventarioInvalidosError, ExistenciaInsuficienteError } from './inventario.errors.js';

export const TIPOS_MOVIMIENTO = ['ENTRADA', 'SALIDA', 'AJUSTE'] as const;
export type TipoMovimiento = (typeof TIPOS_MOVIMIENTO)[number];

/** Admite cantidades con hasta 3 decimales (kilos, metros); el PT va en cajas enteras. */
export const DECIMALES_CANTIDAD = 3;

export interface DatosMovimiento {
  tipo: TipoMovimiento;
  /** ENTRADA / SALIDA: positiva. AJUSTE: con signo (+ suma, − resta). */
  cantidad: number;
  /** Documento de soporte en texto libre: remisión de PepsiCo, orden, etc. */
  referencia: string | null;
  observacion: string | null;
  /** Obligatorio en AJUSTE. */
  motivo: string | null;
}

export interface MovimientoInventario {
  id: string;
  itemId: string;
  tipo: TipoMovimiento;
  /** Con signo: lo que el movimiento sumó o restó. */
  cantidad: number;
  /** Existencia que quedó después del movimiento. */
  saldo: number;
  fechaHoraRegistro: Date;
  fechaOperativa: Date;
  turnoId: string;
  usuarioId: string;
  /** Copia del nombre al registrar. */
  usuarioNombre: string;
  referencia: string | null;
  observacion: string | null;
  motivo: string | null;
  /** Entrada de mercancía a la que pertenece (si llegó en un documento). */
  entradaId: string | null;
}

export type NuevoMovimiento = Omit<MovimientoInventario, 'id'>;

const redondear = (n: number) => Math.round(n * 10 ** DECIMALES_CANTIDAD) / 10 ** DECIMALES_CANTIDAD;

function textoOpcional(valor: string | null | undefined, maximo: number, nombre: string): string | null {
  const t = valor?.trim() || null;
  if (t && t.length > maximo) throw new DatosInventarioInvalidosError(`${nombre}: máximo ${maximo} caracteres.`);
  return t;
}

export interface MovimientoCalculado {
  datos: DatosMovimiento;
  /** Con signo. */
  cantidad: number;
  saldo: number;
}

/**
 * Valida el movimiento y calcula lo que deja. `unidad` solo se usa en el
 * mensaje de error ("hay 12 CAJA…").
 */
export function aplicarMovimiento(existencia: number, datos: DatosMovimiento, unidad: string): MovimientoCalculado {
  const exigir = (condicion: boolean, mensaje: string): void => {
    if (!condicion) throw new DatosInventarioInvalidosError(mensaje);
  };

  exigir(TIPOS_MOVIMIENTO.includes(datos.tipo), `El tipo de movimiento debe ser uno de: ${TIPOS_MOVIMIENTO.join(', ')}.`);
  exigir(Number.isFinite(datos.cantidad), 'La cantidad debe ser un número.');
  exigir(redondear(datos.cantidad) === datos.cantidad, `La cantidad admite máximo ${DECIMALES_CANTIDAD} decimales.`);

  const motivo = textoOpcional(datos.motivo, 500, 'El motivo');
  if (datos.tipo === 'AJUSTE') {
    exigir(datos.cantidad !== 0, 'El ajuste debe sumar o restar algo (cantidad distinta de cero).');
    exigir(motivo !== null, 'El ajuste exige un motivo.');
  } else {
    exigir(datos.cantidad > 0, 'La cantidad debe ser mayor que cero.');
  }

  const cantidad = datos.tipo === 'SALIDA' ? -datos.cantidad : datos.cantidad;
  const saldo = redondear(existencia + cantidad);
  if (saldo < 0) {
    throw new ExistenciaInsuficienteError(existencia, Math.abs(cantidad), unidad);
  }

  return {
    datos: {
      tipo: datos.tipo,
      cantidad: datos.cantidad,
      referencia: textoOpcional(datos.referencia, 100, 'La referencia'),
      observacion: textoOpcional(datos.observacion, 500, 'La observación'),
      motivo,
    },
    cantidad,
    saldo,
  };
}

export interface FiltroMovimientos {
  /** Fechas operativas, inclusive. */
  desde: Date;
  hasta: Date;
  tipo?: TipoMovimiento;
}

export interface MovimientoInventarioRepository {
  crear(movimiento: NuevoMovimiento): Promise<MovimientoInventario>;
  /** Kardex de un ítem, del más reciente al más antiguo. */
  listarPorItem(itemId: string, limite: number): Promise<MovimientoInventario[]>;
  /** Las líneas de una entrada de mercancía. */
  listarPorEntrada(entradaId: string): Promise<MovimientoInventario[]>;
  /** Todos los movimientos de un rango, más recientes primero. */
  listar(filtro: FiltroMovimientos): Promise<MovimientoInventario[]>;
}

export const MOVIMIENTO_INVENTARIO_REPOSITORY = Symbol('MovimientoInventarioRepository');
