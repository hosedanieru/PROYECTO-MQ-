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
 * Sin lote (usuario, 2026-09-29: no tiene relevancia). Cantidades en la
 * unidad base, con hasta 3 decimales (ver cantidad.ts); el PT en cajas
 * enteras.
 */

import { DECIMALES_CANTIDAD, redondear, tieneDecimalesValidos } from './cantidad.js';
import { DatosInventarioInvalidosError, ExistenciaInsuficienteError } from './inventario.errors.js';

export const TIPOS_MOVIMIENTO = ['ENTRADA', 'SALIDA', 'AJUSTE'] as const;
export type TipoMovimiento = (typeof TIPOS_MOVIMIENTO)[number];

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
  /** Remisión cuya aprobación descontó este consumo (receta del PT). */
  remisionId: string | null;
  /** Lo que se digitó si fue un conteo mixto: "10 ROLLO (1 ROLLO = 50 METRO)". */
  conteoTexto: string | null;
  /** Cierre del día cuyo conteo físico originó este ajuste (merma o sobrante). */
  cierreId: string | null;
}

export type NuevoMovimiento = Omit<MovimientoInventario, 'id'>;

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
 * mensaje de error ("hay 12 CAJA…"). `soloEnteros`: el PT se mueve en
 * cajas enteras; PI e insumos admiten decimales.
 */
export function aplicarMovimiento(existencia: number, datos: DatosMovimiento, unidad: string, soloEnteros = false): MovimientoCalculado {
  const exigir = (condicion: boolean, mensaje: string): void => {
    if (!condicion) throw new DatosInventarioInvalidosError(mensaje);
  };

  exigir(TIPOS_MOVIMIENTO.includes(datos.tipo), `El tipo de movimiento debe ser uno de: ${TIPOS_MOVIMIENTO.join(', ')}.`);
  if (soloEnteros) {
    exigir(Number.isInteger(datos.cantidad), 'El PT se mueve en cajas enteras.');
  } else {
    exigir(tieneDecimalesValidos(datos.cantidad), `La cantidad admite máximo ${DECIMALES_CANTIDAD} decimales.`);
  }

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
