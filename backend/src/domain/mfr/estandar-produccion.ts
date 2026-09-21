/**
 * ESTÁNDAR DE PRODUCCIÓN DE UN PRODUCTO
 * =====================================
 *
 * Dos datos por SKU:
 *
 *   cajasPorHora   ritmo al 100 % con que una línea produce ese SKU
 *                  (columna CAJAS POR HORA de la hoja TIEMPOS). Es el
 *                  valor POR DEFECTO al armar un bloque a mano; cuando
 *                  se importa el DPP manda el del PDF (Mx ÷ horas).
 *                  Decisión del área (2026-09-19): por hora, no por
 *                  minuto.
 *   pesoNetoKg     kilos netos de una CAJA. Con él se pasan las cajas a
 *                  kilogramos (Target/Instant Kilograms del DPP).
 *
 * Se pueden indicar al crear el producto; después los edita solo el
 * administrador (`catalogo.editar_estandares`) y siempre con motivo.
 * Se guardan en `producto`.
 */

import { DatosMfrInvalidosError } from './mfr.errors.js';

export interface EstandarProducto {
  productoId: string;
  codigo: string;
  descripcion: string;
  /** Familia (SUBDESCRIPCION); agrupa el "Flavor Breakdown". Solo lectura aquí. */
  subdescripcion: string | null;
  unidadesPorCaja: number | null;
  cajasPorHora: number | null;
  pesoNetoKg: number | null;
}

export interface DatosEstandar {
  cajasPorHora: number | null;
  pesoNetoKg: number | null;
}

export function validarEstandar(datos: DatosEstandar): DatosEstandar {
  const positivoONulo = (v: number | null, nombre: string): void => {
    if (v !== null && !(Number.isFinite(v) && v > 0)) {
      throw new DatosMfrInvalidosError(`${nombre} debe ser un número mayor que cero.`);
    }
  };
  positivoONulo(datos.cajasPorHora, 'Cajas por hora');
  positivoONulo(datos.pesoNetoKg, 'El peso neto por caja');
  return { cajasPorHora: datos.cajasPorHora, pesoNetoKg: datos.pesoNetoKg };
}

/**
 * Peso neto por caja deducido de la descripción de PepsiCo, para
 * PROPONERLO al administrador (nunca se guarda solo). Formatos vistos
 * en el DPP del 2026-09-16, todos verificados contra sus kilos:
 *
 *   "SURT MG LNC 586GX4X1 BX22"        586 g × 4  = 2,344 kg
 *   "MULTI PAPA 225X6X1 BX9"           225 g × 6  = 1,350 kg
 *   "MRGPLL5X1BX12X25GGTX2X25G"        5 × (12×25 g + 2×25 g) = 1,750 kg
 *   "MARGARITA MIXTA 100GX18X1"        100 g × 18 = 1,800 kg
 *
 * Devuelve null cuando la descripción no sigue ninguno de esos patrones.
 */
export function pesoNetoSugeridoKg(descripcion: string): number | null {
  const texto = descripcion.toUpperCase();

  // "586GX4X1" / "225X6X1": gramos por unidad × unidades por caja.
  const simple = /(\d+(?:[.,]\d+)?)G?X(\d+)X1\b/.exec(texto);
  // "5X1BX12X25GGTX2X25G": unidades por caja × Σ (bolsas × gramos).
  const compuesto = /(\d+)X1\s*(?:BX|GTX)/.exec(texto);

  if (compuesto) {
    const unidades = Number(compuesto[1]);
    let gramosPorUnidad = 0;
    for (const m of texto.matchAll(/(?:BX|GTX)(\d+)X(\d+(?:[.,]\d+)?)G/g)) {
      gramosPorUnidad += Number(m[1]) * Number(m[2].replace(',', '.'));
    }
    if (unidades > 0 && gramosPorUnidad > 0) return redondear3((unidades * gramosPorUnidad) / 1000);
  }

  if (simple) {
    const gramos = Number(simple[1].replace(',', '.'));
    const unidades = Number(simple[2]);
    if (gramos > 0 && unidades > 0) return redondear3((gramos * unidades) / 1000);
  }

  return null;
}

function redondear3(valor: number): number {
  return Math.round(valor * 1000) / 1000;
}

export interface EstandarRepository {
  listar(): Promise<EstandarProducto[]>;
  buscarPorProducto(productoId: string): Promise<EstandarProducto | null>;
  actualizar(productoId: string, datos: DatosEstandar): Promise<EstandarProducto>;
}

export const ESTANDAR_REPOSITORY = Symbol('EstandarRepository');
