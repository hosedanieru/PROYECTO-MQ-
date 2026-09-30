/**
 * ENTRADA DE MERCANCÍA
 * ====================
 *
 * Lo que llega a la planta en un mismo documento (remisión de PepsiCo,
 * guía…): un encabezado y una o más líneas (ítem y cantidad). Usuario,
 * 2026-09-29: "hay que diseñar un formulario para las entradas de
 * mercancía".
 *
 * Cada línea es un movimiento ENTRADA del kardex enlazado a la entrada
 * (`movimiento.entradaId`): no se duplica la información, y desde el
 * kardex se llega al documento y viceversa. Todo o nada: si una línea
 * falla, no queda ninguna.
 *
 * Propuestas (ajustables si el área maneja otra cosa):
 *   - Recibe INSUMOS y PI (lo que llega para reempaque). El PT no llega
 *     de afuera: se produce.
 *   - El documento de soporte es obligatorio: sin él no hay trazabilidad.
 *
 * Fecha, hora, turno y quién recibe los pone el servidor.
 */

import { DECIMALES_CANTIDAD, esCantidadPositiva } from './cantidad.js';
import type { Conteo } from './conteo.js';
import { DatosInventarioInvalidosError } from './inventario.errors.js';
import type { TipoItem } from './item-inventario.js';

export const TIPOS_ITEM_ENTRADA: readonly TipoItem[] = ['INSUMO', 'PI'];

/**
 * Límite técnico: cada línea son 2 escrituras (movimiento y existencia) y
 * una transacción de Firestore admite 500. Si llega más, van dos entradas.
 */
export const MAXIMO_LINEAS_ENTRADA = 50;

/**
 * Una de dos: `cantidad` directa en la medida del ítem, o `conteo` como
 * viene (rollos, cajas, estibas), que el caso de uso convierte con las
 * equivalencias del ítem (ver conteo.ts).
 */
export interface LineaEntrada {
  itemId: string;
  cantidad?: number | null;
  conteo?: Conteo | null;
}

export interface DatosEntrada {
  /** Remisión de PepsiCo, guía, factura… */
  documento: string;
  /** Quién entrega (proveedor, transportador); texto libre. */
  remitente: string | null;
  observacion: string | null;
  lineas: LineaEntrada[];
}

export interface EntradaMercancia {
  id: string;
  documento: string;
  remitente: string | null;
  observacion: string | null;
  fechaHoraRegistro: Date;
  fechaOperativa: Date;
  turnoId: string;
  usuarioId: string;
  /** Copia del nombre de quien recibe. */
  usuarioNombre: string;
}

export type NuevaEntrada = Omit<EntradaMercancia, 'id'>;

export function validarEntrada(datos: DatosEntrada): DatosEntrada {
  const exigir = (condicion: boolean, mensaje: string): void => {
    if (!condicion) throw new DatosInventarioInvalidosError(mensaje);
  };

  const documento = datos.documento?.trim() ?? '';
  exigir(documento.length > 0 && documento.length <= 100, 'El documento de soporte es obligatorio (máx. 100 caracteres).');
  const remitente = datos.remitente?.trim() || null;
  exigir(remitente === null || remitente.length <= 100, 'Quién entrega: máximo 100 caracteres.');
  const observacion = datos.observacion?.trim() || null;
  exigir(observacion === null || observacion.length <= 500, 'La observación: máximo 500 caracteres.');

  const lineas = datos.lineas ?? [];
  exigir(lineas.length > 0, 'La entrada debe tener al menos una línea.');
  exigir(lineas.length <= MAXIMO_LINEAS_ENTRADA, `Una entrada admite máximo ${MAXIMO_LINEAS_ENTRADA} líneas; registre el resto en otra.`);

  const vistos = new Set<string>();
  for (const [i, l] of lineas.entries()) {
    const n = i + 1;
    exigir(!!l.itemId?.trim(), `Línea ${n}: falta el ítem.`);
    exigir(!vistos.has(l.itemId), `Línea ${n}: el ítem está repetido; sume las cantidades en una sola línea.`);
    vistos.add(l.itemId);
    exigir((l.cantidad ?? null) === null || (l.conteo ?? null) === null, `Línea ${n}: envíe la cantidad o el conteo, no los dos.`);
    // El conteo se valida al convertirlo (necesita las equivalencias del ítem).
    exigir(
      (l.conteo ?? null) !== null || esCantidadPositiva(l.cantidad),
      `Línea ${n}: la cantidad debe ser mayor que cero, con máximo ${DECIMALES_CANTIDAD} decimales.`,
    );
  }

  return {
    documento,
    remitente,
    observacion,
    lineas: lineas.map((l) => ({ itemId: l.itemId.trim(), cantidad: l.cantidad ?? null, conteo: l.conteo ?? null })),
  };
}

export interface EntradaMercanciaRepository {
  crear(entrada: NuevaEntrada): Promise<EntradaMercancia>;
  buscarPorId(id: string): Promise<EntradaMercancia | null>;
  /** Fechas operativas, inclusive; más recientes primero. */
  listar(desde: Date, hasta: Date): Promise<EntradaMercancia[]>;
}

export const ENTRADA_MERCANCIA_REPOSITORY = Symbol('EntradaMercanciaRepository');
