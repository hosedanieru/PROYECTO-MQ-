/**
 * CONTEO MIXTO: estibas + cajas + presentaciones + medida suelta
 * ==============================================================
 *
 * Fase B del inventario (usuario, 2026-09-29): lo que llega o se cuenta
 * se digita como viene —"10 rollos", "2 estibas + 5 cajas + 3 rollos +
 * 12,5 metros"— y el sistema lo convierte a la MEDIDA del ítem (metros),
 * que es en lo que se lleva la existencia y en lo que descuenta la receta.
 *
 *   1 estiba      = cajasPorEstiba cajas
 *   1 caja        = unidadesPorCaja presentaciones (o medidas, si no hay presentación)
 *   1 presentación = contenidoPresentacion medidas (1 ROLLO = 50 METRO)
 *
 * Solo se puede usar un escalón que el ítem tenga definido. Estibas,
 * cajas y presentaciones van en enteros (se cuentan cerradas); la medida
 * suelta admite hasta 3 decimales (lo que queda de un rollo abierto).
 *
 * Se guarda en el kardex el TEXTO de lo digitado junto al total: si mañana
 * cambia cuánto trae un rollo, el movimiento sigue diciendo con qué
 * equivalencia se calculó.
 */

import { DECIMALES_CANTIDAD, redondear, tieneDecimalesValidos } from './cantidad.js';
import { DatosInventarioInvalidosError } from './inventario.errors.js';

/** Lo que el usuario digitó; lo que no se usa va en 0. */
export interface Conteo {
  estibas: number;
  cajas: number;
  /** Rollos, bolsas… según la presentación del ítem. */
  presentaciones: number;
  /** Medida suelta (metros, unidades), con decimales. */
  medida: number;
}

/** Escalones del ítem, copiados de su catálogo (PI o insumo). */
export interface Equivalencias {
  presentacion: string | null;
  contenidoPresentacion: number | null;
  unidadesPorCaja: number | null;
  cajasPorEstiba: number | null;
}

export interface ConteoConvertido {
  /** En la medida del ítem. */
  total: number;
  /** "2 estibas + 5 cajas + 3 ROLLO + 12,5 METRO" (con la equivalencia usada). */
  texto: string;
}

const enteroNoNegativo = (n: number) => Number.isInteger(n) && n >= 0;
/** 12.5 → "12,5"; 1500 → "1.500" (formato de Colombia, sin librerías). */
const num = (n: number) => n.toLocaleString('es-CO', { maximumFractionDigits: DECIMALES_CANTIDAD });

/** `permitirCero`: en un conteo físico (ajuste) haber contado 0 es un dato válido. */
export function convertirConteo(conteo: Conteo, eq: Equivalencias | null, medida: string, permitirCero = false): ConteoConvertido {
  const exigir = (condicion: boolean, mensaje: string): void => {
    if (!condicion) throw new DatosInventarioInvalidosError(mensaje);
  };
  const { estibas, cajas, presentaciones, medida: suelta } = conteo;

  exigir(
    enteroNoNegativo(estibas) && enteroNoNegativo(cajas) && enteroNoNegativo(presentaciones),
    'Estibas, cajas y presentaciones se cuentan en enteros (cero o más).',
  );
  exigir(tieneDecimalesValidos(suelta) && suelta >= 0, `La medida suelta admite máximo ${DECIMALES_CANTIDAD} decimales.`);
  exigir(permitirCero || estibas + cajas + presentaciones + suelta > 0, 'El conteo está vacío.');

  // Cuánto de la medida trae cada escalón (null = el ítem no lo maneja).
  const porPresentacion = eq?.presentacion && eq.contenidoPresentacion ? eq.contenidoPresentacion : null;
  const porCaja = eq?.unidadesPorCaja ? eq.unidadesPorCaja * (porPresentacion ?? 1) : null;
  const porEstiba = porCaja !== null && eq?.cajasPorEstiba ? eq.cajasPorEstiba * porCaja : null;

  exigir(presentaciones === 0 || porPresentacion !== null, 'Este ítem no tiene presentación definida (ej.: ROLLO con 50 metros).');
  exigir(cajas === 0 || porCaja !== null, 'Este ítem no tiene definido cuánto trae una caja.');
  exigir(estibas === 0 || porEstiba !== null, 'Este ítem no tiene definido cuántas cajas trae una estiba.');

  const total = redondear(estibas * (porEstiba ?? 0) + cajas * (porCaja ?? 0) + presentaciones * (porPresentacion ?? 0) + suelta);

  const partes = [
    estibas > 0 ? `${num(estibas)} ${estibas === 1 ? 'estiba' : 'estibas'}` : null,
    cajas > 0 ? `${num(cajas)} ${cajas === 1 ? 'caja' : 'cajas'}` : null,
    presentaciones > 0 ? `${num(presentaciones)} ${eq!.presentacion}` : null,
    suelta > 0 ? `${num(suelta)} ${medida}` : null,
  ].filter(Boolean);
  const usada = porPresentacion !== null && presentaciones + cajas + estibas > 0 ? ` (1 ${eq!.presentacion} = ${num(porPresentacion)} ${medida})` : '';
  return { total, texto: partes.length > 0 ? `${partes.join(' + ')}${usada}` : `0 ${medida}` };
}
