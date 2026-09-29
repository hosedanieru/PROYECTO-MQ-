/**
 * INDICADOR DE AVERÍAS
 * ====================
 *
 * Por contrato con PepsiCo las averías no pueden pasar del 1 % de lo
 * programado en el DPP (usuario, 2026-09-28). Se mide siempre contra el
 * DPP, sumando los días del periodo que se revisa:
 *
 *   % averías = unidades averiadas (reportes vigentes)
 *               ─────────────────────────────────────────────  × 100
 *               Σ T del DPP (cajas) × unidades por caja del SKU
 *
 *   T = la meta de cada bloque del DPP (Mx × E), la misma que el MFR
 *   llama "programado".
 *
 * Reglas:
 *   - Los reportes ANULADOS no cuentan.
 *   - Todas las averías cuentan, aunque su producto no estuviera en el
 *     DPP ese día (lo conservador frente al contrato); se marcan aparte.
 *     "Fuera del DPP" se juzga por el día de la avería: que el producto
 *     estuviera programado otro día del periodo no la vuelve "dentro".
 *   - Las bolsas no suman mientras no se defina su equivalencia
 *     (PENDIENTE DE DEFINIR): se informan aparte.
 *   - Por grupo, el denominador es el mismo DPP: el % de cada grupo es
 *     su aporte al % del periodo (la suma da el total).
 *
 * Función pura: recibe datos, devuelve el indicador y sus alertas.
 */

import { totalizarUnidades } from './registro-averia.js';
import type { ReporteAveria } from './reporte-averia.js';

/** Máximo de averías permitido por contrato, en % de lo programado. */
export const MAXIMO_AVERIAS_PORCENTAJE = 1;

/** T de un bloque del DPP, ya calculado. */
export interface ProgramadoBloque {
  /** YYYY-MM-DD */
  fechaOperativa: string;
  turnoId: string;
  productoId: string;
  cajas: number;
}

export interface ProductoIndicador {
  id: string;
  codigo: string;
  descripcion: string;
  unidadesPorCaja: number | null;
}

export interface Medida {
  programadoUnidades: number;
  averiadasUnidades: number;
  /** null si no hubo nada programado (no se puede dividir). */
  porcentaje: number | null;
  excede: boolean;
}

export interface IndicadorAverias {
  maximoPorcentaje: number;
  total: Medida;
  porDia: Array<Medida & { fechaOperativa: string }>;
  porTurno: Array<Medida & { turnoId: string }>;
  /** El % de cada grupo es su aporte al % del periodo (mismo denominador). */
  porGrupo: Array<{ grupoId: string; averiadasUnidades: number; porcentaje: number | null }>;
  porProducto: Array<
    Medida & {
      productoId: string;
      codigo: string;
      descripcion: string;
      /** Estuvo programado algún día del periodo. */
      enDpp: boolean;
      /** Unidades averiadas en días en que el producto NO estaba en el DPP. */
      unidadesFueraDelDpp: number;
    }
  >;
  bolsasSinConvertir: number;
  /** Productos del DPP sin unidades por caja: su programado no se pudo sumar. */
  productosSinUnidadesPorCaja: string[];
  alertas: string[];
}

function medida(programadoUnidades: number, averiadasUnidades: number): Medida {
  const porcentaje = programadoUnidades > 0 ? (averiadasUnidades / programadoUnidades) * 100 : null;
  return {
    programadoUnidades,
    averiadasUnidades,
    porcentaje,
    excede: porcentaje !== null && porcentaje > MAXIMO_AVERIAS_PORCENTAJE,
  };
}

const sumar = (mapa: Map<string, number>, clave: string, valor: number) => mapa.set(clave, (mapa.get(clave) ?? 0) + valor);
const dia = (fecha: Date) => fecha.toISOString().slice(0, 10);
const pct = (n: number) => `${n.toLocaleString('es-CO', { maximumFractionDigits: 2 })} %`;

export function calcularIndicadorAverias(
  programado: ProgramadoBloque[],
  reportes: ReporteAveria[],
  productos: ProductoIndicador[],
): IndicadorAverias {
  const producto = new Map(productos.map((p) => [p.id, p]));
  const sinUnidades = new Set<string>();

  // Denominador: T en unidades.
  const progDia = new Map<string, number>();
  const progTurno = new Map<string, number>();
  const progProducto = new Map<string, number>();
  // "Fuera del DPP" se juzga por el día de la avería, no por el periodo.
  const programadoEseDia = new Set(programado.map((b) => `${b.fechaOperativa}|${b.productoId}`));
  for (const b of programado) {
    const p = producto.get(b.productoId);
    if (!p?.unidadesPorCaja) {
      sinUnidades.add(p?.codigo ?? b.productoId);
      progProducto.set(b.productoId, progProducto.get(b.productoId) ?? 0);
      continue;
    }
    const unidades = b.cajas * p.unidadesPorCaja;
    sumar(progDia, b.fechaOperativa, unidades);
    sumar(progTurno, b.turnoId, unidades);
    sumar(progProducto, b.productoId, unidades);
  }

  // Numerador: averías de reportes vigentes.
  const avDia = new Map<string, number>();
  const avTurno = new Map<string, number>();
  const avGrupo = new Map<string, number>();
  const avProducto = new Map<string, number>();
  const fueraProducto = new Map<string, number>();
  let bolsas = 0;
  for (const r of reportes) {
    if (r.estado !== 'REGISTRADO') continue;
    for (const reg of r.registros) {
      const { unidades, sinConvertir } = totalizarUnidades([reg]);
      bolsas += sinConvertir.BOLSA ?? 0;
      sumar(avDia, dia(r.fechaOperativa), unidades);
      sumar(avTurno, r.turnoId, unidades);
      sumar(avGrupo, r.grupoId, unidades);
      sumar(avProducto, reg.productoId, unidades);
      if (!programadoEseDia.has(`${dia(r.fechaOperativa)}|${reg.productoId}`)) {
        sumar(fueraProducto, reg.productoId, unidades + (sinConvertir.BOLSA ?? 0));
      }
    }
  }

  const programadoTotal = [...progDia.values()].reduce((s, v) => s + v, 0);
  const averiadasTotal = [...avDia.values()].reduce((s, v) => s + v, 0);
  const claves = (a: Map<string, number>, b: Map<string, number>) => [...new Set([...a.keys(), ...b.keys()])].sort();

  const porDia = claves(progDia, avDia).map((f) => ({ fechaOperativa: f, ...medida(progDia.get(f) ?? 0, avDia.get(f) ?? 0) }));
  const porTurno = claves(progTurno, avTurno).map((t) => ({ turnoId: t, ...medida(progTurno.get(t) ?? 0, avTurno.get(t) ?? 0) }));
  const porGrupo = [...avGrupo.entries()]
    .map(([grupoId, unidades]) => ({
      grupoId,
      averiadasUnidades: unidades,
      porcentaje: programadoTotal > 0 ? (unidades / programadoTotal) * 100 : null,
    }))
    .sort((a, b) => b.averiadasUnidades - a.averiadasUnidades);
  const porProducto = claves(progProducto, avProducto)
    .map((id) => ({
      productoId: id,
      codigo: producto.get(id)?.codigo ?? id,
      descripcion: producto.get(id)?.descripcion ?? '',
      enDpp: progProducto.has(id),
      unidadesFueraDelDpp: fueraProducto.get(id) ?? 0,
      ...medida(progProducto.get(id) ?? 0, avProducto.get(id) ?? 0),
    }))
    .sort((a, b) => b.averiadasUnidades - a.averiadasUnidades);
  const total = medida(programadoTotal, averiadasTotal);

  // Alertas: cada día que se pasa, el periodo completo y averías sin DPP.
  const alertas: string[] = [];
  if (total.excede && porDia.length > 1) {
    alertas.push(`En el periodo las averías suman ${pct(total.porcentaje!)} de lo programado: superan el máximo del ${MAXIMO_AVERIAS_PORCENTAJE} % del contrato.`);
  }
  for (const d of porDia) {
    if (d.excede) {
      alertas.push(`El ${d.fechaOperativa} las averías fueron ${pct(d.porcentaje!)} de lo programado (máximo ${MAXIMO_AVERIAS_PORCENTAJE} %).`);
    } else if (d.porcentaje === null && d.averiadasUnidades > 0) {
      alertas.push(`El ${d.fechaOperativa} hay ${d.averiadasUnidades} unidades averiadas pero no hay DPP cargado: no se puede calcular el %.`);
    }
  }
  const fuera = porProducto.filter((p) => p.unidadesFueraDelDpp > 0);
  if (fuera.length > 0) {
    alertas.push(
      `Averías de productos que no estaban en el DPP del día en que se reportaron: ${fuera.map((p) => p.codigo).join(', ')}. Cuentan en el total.`,
    );
  }

  return {
    maximoPorcentaje: MAXIMO_AVERIAS_PORCENTAJE,
    total,
    porDia,
    porTurno,
    porGrupo,
    porProducto,
    bolsasSinConvertir: bolsas,
    productosSinUnidadesPorCaja: [...sinUnidades].sort(),
    alertas,
  };
}
