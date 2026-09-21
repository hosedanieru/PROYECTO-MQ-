/**
 * CÁLCULO DE INDICADORES MFR
 * ==========================
 *
 * Funciones puras: reciben datos ya cargados y devuelven números. Sin
 * base de datos, sin fechas del sistema. Así se prueban en milisegundos
 * y la regla vive en un solo lugar.
 *
 * Fórmulas del DPP de PepsiCo (verificadas contra el schedule del
 * 2026-09-16, los 20 bloques cuadran exactamente). El PDF trae el ritmo
 * en BPM (bolsas/minuto); el área decidió manejarlo en CAJAS POR HORA
 * (2026-09-19): cajas/h = BPM ÷ unidadesPorCaja × 60 = Mx ÷ horas.
 *
 *   Mx (Max)       = cajasPorHora × horas                    cajas al 100 %
 *   T  (Trgt)      = Mx × E                                  cajas esperadas
 *   Instant kg/h   = Mx × pesoNetoKg ÷ horas
 *   Target kg/h    = T  × pesoNetoKg ÷ horas
 *   Capacity kg/h  = capacidad nominal de la línea
 *   Pct Overpull   = Instant ÷ Capacity
 *
 * Indicadores:
 *
 *   MFR (Manufacturing Fill Rate)
 *     producido / Σ T del día por SKU. Responde "¿cumplimos con lo que
 *     PepsiCo programó?". Meta 95 % (decisión del área, 2026-09-17).
 *
 *   Por turno
 *     eficiencia planeada = T / Mx (la E del DPP), eficiencia real =
 *     producido / Mx, cumplimiento = producido / T. Responde "¿el turno
 *     rindió lo que podía?".
 *
 * Decisiones del área:
 *   - Todo en CAJAS; los kilos se derivan del peso neto por caja.
 *   - Una remisión cuenta como producida cuando el OPA la APRUEBA
 *     (APROBADA o VALIDADA, porque VALIDADA implica aprobada).
 *   - La remisión NO registra línea (2026-09-18): la producción real se
 *     conoce por turno y SKU, no por línea.
 */

import { rangoOperativo, type EstadoPersistidoBloque } from './bloque-programacion.js';
import type { EstandarProducto } from './estandar-produccion.js';

/** Estados de remisión que cuentan como producción entregada. */
export const ESTADOS_QUE_CUENTAN = ['APROBADA', 'VALIDADA'] as const;

/** Meta de cumplimiento (semáforo). Decisión del área. */
export const META_MFR_PORCENTAJE = 95;

/**
 * Cajas producidas agrupadas por turno y producto (salen de las
 * remisiones). Las EXTRAOFICIALES (pedidos de emergencia fuera del DPP,
 * decisión del área 2026-09-18) no cuentan para el MFR ni para la
 * eficiencia; se informan aparte.
 */
export interface ProduccionAgrupada {
  turnoId: string;
  productoId: string;
  cajas: number;
  extraoficial?: boolean;
}

/** Solo lo que cuenta para el MFR. */
export function sinExtraoficiales(produccion: ProduccionAgrupada[]): ProduccionAgrupada[] {
  return produccion.filter((p) => !p.extraoficial);
}

export type Semaforo = 'VERDE' | 'AMARILLO' | 'ROJO';

/** Verde: cumple la meta. Amarillo: a menos de 10 puntos. Rojo: por debajo. */
export function semaforo(porcentaje: number | null, meta = META_MFR_PORCENTAJE): Semaforo | null {
  if (porcentaje === null) return null;
  if (porcentaje >= meta) return 'VERDE';
  if (porcentaje >= meta - 10) return 'AMARILLO';
  return 'ROJO';
}

function porcentaje(numerador: number, denominador: number): number | null {
  if (denominador <= 0) return null;
  return Math.round((numerador / denominador) * 1000) / 10; // un decimal
}

function kg(cajas: number | null, pesoNetoKg: number | null): number | null {
  if (cajas === null || pesoNetoKg === null) return null;
  return Math.round(cajas * pesoNetoKg * 10) / 10;
}

// ------------------------------------------------------------
// Bloque
// ------------------------------------------------------------

export interface BloqueCalculado {
  id: string;
  lineaId: string;
  turnoId: string;
  productoId: string;
  horaInicio: string;
  horaFin: string;
  horas: number;
  cajasPorHora: number;
  eficienciaPorcentaje: number;
  loop: string | null;
  personasAsignadas: number | null;
  origen: EstadoPersistidoBloque['origen'];
  cerrado: boolean;
  pesoNetoKg: number | null;
  maxCajas: number;
  targetCajas: number;
  /** null cuando el producto no tiene peso neto por caja. */
  maxKg: number | null;
  targetKg: number | null;
}

export function calcularBloque(b: EstadoPersistidoBloque, estandar: EstandarProducto | undefined): BloqueCalculado {
  const { inicio, fin } = rangoOperativo(b);
  const horas = (fin - inicio) / 60;
  const pesoNetoKg = estandar?.pesoNetoKg ?? null;
  const maxCajas = Math.round(b.cajasPorHora * horas);
  const targetCajas = Math.round(maxCajas * (b.eficienciaPorcentaje / 100));
  return {
    id: b.id,
    lineaId: b.lineaId,
    turnoId: b.turnoId,
    productoId: b.productoId,
    horaInicio: b.horaInicio,
    horaFin: b.horaFin,
    horas,
    cajasPorHora: b.cajasPorHora,
    eficienciaPorcentaje: b.eficienciaPorcentaje,
    loop: b.loop,
    personasAsignadas: b.personasAsignadas,
    origen: b.origen,
    cerrado: b.cerradoEn !== null,
    pesoNetoKg,
    maxCajas,
    targetCajas,
    maxKg: kg(maxCajas, pesoNetoKg),
    targetKg: kg(targetCajas, pesoNetoKg),
  };
}

export function calcularBloques(bloques: EstadoPersistidoBloque[], estandares: EstandarProducto[]): BloqueCalculado[] {
  const estandarDe = new Map(estandares.map((e) => [e.productoId, e]));
  return bloques.map((b) => calcularBloque(b, estandarDe.get(b.productoId)));
}

// ------------------------------------------------------------
// MFR del día (contra PepsiCo)
// ------------------------------------------------------------

export interface MfrPorProducto {
  productoId: string;
  programadoCajas: number;
  producidoCajas: number;
  programadoKg: number | null;
  producidoKg: number | null;
  cumplimiento: number | null;
  semaforo: Semaforo | null;
}

export interface MfrDia {
  programadoCajas: number;
  producidoCajas: number;
  programadoKg: number;
  producidoKg: number;
  cumplimiento: number | null;
  semaforo: Semaforo | null;
  porProducto: MfrPorProducto[];
  /** Producido sin programación ese día: se remisionó algo que PepsiCo no pidió. */
  producidoSinProgramar: Array<{ productoId: string; cajas: number }>;
  /** Pedidos de emergencia fuera del DPP: no entran en el MFR. */
  extraoficiales: Array<{ productoId: string; cajas: number }>;
  extraoficialesCajas: number;
}

export function calcularMfrDia(
  bloques: BloqueCalculado[],
  produccion: ProduccionAgrupada[],
  meta = META_MFR_PORCENTAJE,
): MfrDia {
  const producidoPorProducto = new Map<string, number>();
  for (const p of sinExtraoficiales(produccion)) {
    producidoPorProducto.set(p.productoId, (producidoPorProducto.get(p.productoId) ?? 0) + p.cajas);
  }
  const extraoficialPorProducto = new Map<string, number>();
  for (const p of produccion.filter((x) => x.extraoficial)) {
    extraoficialPorProducto.set(p.productoId, (extraoficialPorProducto.get(p.productoId) ?? 0) + p.cajas);
  }

  // Programado por SKU = Σ target de sus bloques (en todas las líneas y turnos).
  const programado = new Map<string, { cajas: number; kg: number | null; peso: number | null }>();
  for (const b of bloques) {
    const acumulado = programado.get(b.productoId) ?? { cajas: 0, kg: 0, peso: b.pesoNetoKg };
    acumulado.cajas += b.targetCajas;
    acumulado.kg = acumulado.kg === null || b.targetKg === null ? null : acumulado.kg + b.targetKg;
    programado.set(b.productoId, acumulado);
  }

  const porProducto: MfrPorProducto[] = [...programado].map(([productoId, pr]) => {
    const producido = producidoPorProducto.get(productoId) ?? 0;
    const cumplimiento = porcentaje(producido, pr.cajas);
    return {
      productoId,
      programadoCajas: pr.cajas,
      producidoCajas: producido,
      programadoKg: pr.kg === null ? null : Math.round(pr.kg * 10) / 10,
      producidoKg: kg(producido, pr.peso),
      cumplimiento,
      semaforo: semaforo(cumplimiento, meta),
    };
  });

  const producidoSinProgramar = [...producidoPorProducto]
    .filter(([productoId]) => !programado.has(productoId))
    .map(([productoId, cajas]) => ({ productoId, cajas }));

  const programadoCajas = porProducto.reduce((s, p) => s + p.programadoCajas, 0);
  // Solo cuenta hacia el MFR lo que estaba programado: producir de más
  // en un SKU no compensa faltar en otro.
  const producidoCajas = porProducto.reduce((s, p) => s + Math.min(p.producidoCajas, p.programadoCajas), 0);
  const cumplimiento = porcentaje(producidoCajas, programadoCajas);

  return {
    programadoCajas,
    producidoCajas,
    programadoKg: redondear1(porProducto.reduce((s, p) => s + (p.programadoKg ?? 0), 0)),
    producidoKg: redondear1(porProducto.reduce((s, p) => s + (p.producidoKg ?? 0), 0)),
    cumplimiento,
    semaforo: semaforo(cumplimiento, meta),
    porProducto,
    producidoSinProgramar,
    extraoficiales: [...extraoficialPorProducto].map(([productoId, cajas]) => ({ productoId, cajas })),
    extraoficialesCajas: [...extraoficialPorProducto.values()].reduce((s, v) => s + v, 0),
  };
}

// ------------------------------------------------------------
// Turno: capacidad planeada vs producción real
// ------------------------------------------------------------

export interface ResumenTurno {
  turnoId: string;
  bloques: BloqueCalculado[];
  maxCajas: number;
  targetCajas: number;
  maxKg: number;
  targetKg: number;
  producidoCajas: number;
  producidoKg: number;
  personasAsignadas: number;
  /** T / Mx: la eficiencia que PepsiCo espera del turno. */
  eficienciaPlaneada: number | null;
  /** producido / Mx: lo que realmente rindió. */
  eficienciaReal: number | null;
  /** producido / T: cumplimiento del target; es lo que colorea el semáforo. */
  cumplimiento: number | null;
  semaforo: Semaforo | null;
  cerrado: boolean;
}

export function calcularTurno(
  turnoId: string,
  bloques: BloqueCalculado[],
  produccion: ProduccionAgrupada[],
  estandares: EstandarProducto[],
  meta = META_MFR_PORCENTAJE,
): ResumenTurno {
  const propios = bloques.filter((b) => b.turnoId === turnoId);
  const pesoDe = new Map(estandares.map((e) => [e.productoId, e.pesoNetoKg]));

  const delTurno = sinExtraoficiales(produccion).filter((p) => p.turnoId === turnoId);
  const producidoCajas = delTurno.reduce((s, p) => s + p.cajas, 0);
  const producidoKg = redondear1(delTurno.reduce((s, p) => s + (kg(p.cajas, pesoDe.get(p.productoId) ?? null) ?? 0), 0));

  const maxCajas = propios.reduce((s, b) => s + b.maxCajas, 0);
  const targetCajas = propios.reduce((s, b) => s + b.targetCajas, 0);
  const cumplimiento = porcentaje(producidoCajas, targetCajas);

  return {
    turnoId,
    bloques: propios,
    maxCajas,
    targetCajas,
    maxKg: redondear1(propios.reduce((s, b) => s + (b.maxKg ?? 0), 0)),
    targetKg: redondear1(propios.reduce((s, b) => s + (b.targetKg ?? 0), 0)),
    producidoCajas,
    producidoKg,
    personasAsignadas: propios.reduce((s, b) => s + (b.personasAsignadas ?? 0), 0),
    eficienciaPlaneada: porcentaje(targetCajas, maxCajas),
    eficienciaReal: porcentaje(producidoCajas, maxCajas),
    cumplimiento,
    semaforo: semaforo(cumplimiento, meta),
    cerrado: propios.length > 0 && propios.every((b) => b.cerrado),
  };
}

/**
 * "Ni menos": al cerrar el turno, los SKU cuyo target no se alcanzó.
 * No se puede impedir producir de menos; se exige explicarlo (motivo
 * al cerrar). Solo cuenta lo aprobado, sin extraoficiales.
 */
export interface FaltanteSku {
  productoId: string;
  programadoCajas: number;
  producidoCajas: number;
  faltanteCajas: number;
}

export function faltantesDelTurno(turnoId: string, bloques: BloqueCalculado[], produccion: ProduccionAgrupada[]): FaltanteSku[] {
  const programado = new Map<string, number>();
  for (const b of bloques.filter((x) => x.turnoId === turnoId)) {
    programado.set(b.productoId, (programado.get(b.productoId) ?? 0) + b.targetCajas);
  }
  const producido = new Map<string, number>();
  for (const p of sinExtraoficiales(produccion).filter((x) => x.turnoId === turnoId)) {
    producido.set(p.productoId, (producido.get(p.productoId) ?? 0) + p.cajas);
  }
  return [...programado]
    .map(([productoId, programadoCajas]) => {
      const producidoCajas = producido.get(productoId) ?? 0;
      return { productoId, programadoCajas, producidoCajas, faltanteCajas: programadoCajas - producidoCajas };
    })
    .filter((f) => f.faltanteCajas > 0);
}

// ------------------------------------------------------------
// Línea: lo planeado (la producción real no se conoce por línea)
// ------------------------------------------------------------

export interface ResumenLinea {
  lineaId: string;
  bloques: BloqueCalculado[];
  horasProgramadas: number;
  maxCajas: number;
  targetCajas: number;
  maxKg: number;
  targetKg: number;
}

export function calcularLinea(lineaId: string, bloques: BloqueCalculado[]): ResumenLinea {
  const propios = bloques.filter((b) => b.lineaId === lineaId);
  return {
    lineaId,
    bloques: propios,
    horasProgramadas: propios.reduce((s, b) => s + b.horas, 0),
    maxCajas: propios.reduce((s, b) => s + b.maxCajas, 0),
    targetCajas: propios.reduce((s, b) => s + b.targetCajas, 0),
    maxKg: redondear1(propios.reduce((s, b) => s + (b.maxKg ?? 0), 0)),
    targetKg: redondear1(propios.reduce((s, b) => s + (b.targetKg ?? 0), 0)),
  };
}

// ------------------------------------------------------------
// Vista horaria (las filas de kilogramos del DPP)
// ------------------------------------------------------------

/** Las 24 horas del día operativo: "06:00", "07:00", …, "05:00". */
export const HORAS_DIA_OPERATIVO: readonly string[] = Array.from({ length: 24 }, (_, i) => {
  const h = (6 + i) % 24;
  return `${String(h).padStart(2, '0')}:00`;
});

export interface FilaHoraria {
  lineaId: string;
  /** Target Kilograms por hora (T en kg). */
  targetKg: number[];
  /** Instant Kilograms por hora (Mx en kg). */
  instantKg: number[];
  /** Capacity: capacidad nominal de la línea, prorrateada si el bloque cubre parte de la hora. */
  capacidadKg: number[];
  /** Pct Overpull = instant ÷ capacidad; null cuando no hay capacidad. */
  overpull: Array<number | null>;
}

export interface VistaHoraria {
  horas: readonly string[];
  lineas: FilaHoraria[];
  totalTargetKg: number[];
  totalInstantKg: number[];
}

export function calcularVistaHoraria(
  bloques: BloqueCalculado[],
  lineas: Array<{ id: string; capacidadKgHora: number | null }>,
): VistaHoraria {
  const filas: FilaHoraria[] = lineas.map((linea) => {
    const targetKg = new Array<number>(24).fill(0);
    const instantKg = new Array<number>(24).fill(0);
    const capacidadKg = new Array<number>(24).fill(0);

    for (const b of bloques.filter((x) => x.lineaId === linea.id)) {
      const { inicio, fin } = rangoOperativo(b);
      for (let hora = 0; hora < 24; hora++) {
        const desde = Math.max(inicio, hora * 60);
        const hasta = Math.min(fin, hora * 60 + 60);
        if (hasta <= desde) continue;
        const fraccion = (hasta - desde) / 60; // parte de la hora que el bloque ocupa
        if (b.targetKg !== null) targetKg[hora] += (b.targetKg / b.horas) * fraccion;
        if (b.maxKg !== null) instantKg[hora] += (b.maxKg / b.horas) * fraccion;
        if (linea.capacidadKgHora !== null) capacidadKg[hora] += linea.capacidadKgHora * fraccion;
      }
    }

    return {
      lineaId: linea.id,
      targetKg: targetKg.map(Math.round),
      instantKg: instantKg.map(Math.round),
      capacidadKg: capacidadKg.map(Math.round),
      overpull: instantKg.map((v, i) => (capacidadKg[i] > 0 ? Math.round((v / capacidadKg[i]) * 100) : null)),
    };
  });

  return {
    horas: HORAS_DIA_OPERATIVO,
    lineas: filas,
    totalTargetKg: HORAS_DIA_OPERATIVO.map((_, i) => filas.reduce((s, f) => s + f.targetKg[i], 0)),
    totalInstantKg: HORAS_DIA_OPERATIVO.map((_, i) => filas.reduce((s, f) => s + f.instantKg[i], 0)),
  };
}

// ------------------------------------------------------------
// "Flavor Breakdown": target en kg por hora, por familia de producto
// ------------------------------------------------------------

export const FAMILIA_SIN_DEFINIR = 'SIN FAMILIA';

export interface FilaFamilia {
  familia: string;
  targetKg: number[];
  totalKg: number;
}

/**
 * La fila "Flavor Breakdown" del DPP: los kilos target de cada hora
 * agrupados por la familia del producto (SUBDESCRIPCION: SURTIDO,
 * OFERTA, REEMPAQUE, MULTIPACK…). Los productos sin familia van juntos
 * en "SIN FAMILIA" para que nada se pierda de la suma.
 */
export function calcularFamiliasHorarias(bloques: BloqueCalculado[], estandares: EstandarProducto[]): FilaFamilia[] {
  const familiaDe = new Map(estandares.map((e) => [e.productoId, e.subdescripcion?.trim() || FAMILIA_SIN_DEFINIR]));
  const filas = new Map<string, number[]>();

  for (const b of bloques) {
    if (b.targetKg === null) continue;
    const familia = familiaDe.get(b.productoId) ?? FAMILIA_SIN_DEFINIR;
    const fila = filas.get(familia) ?? new Array<number>(24).fill(0);
    const { inicio, fin } = rangoOperativo(b);
    for (let hora = 0; hora < 24; hora++) {
      const desde = Math.max(inicio, hora * 60);
      const hasta = Math.min(fin, hora * 60 + 60);
      if (hasta > desde) fila[hora] += (b.targetKg / b.horas) * ((hasta - desde) / 60);
    }
    filas.set(familia, fila);
  }

  return [...filas]
    .map(([familia, kg]) => ({ familia, targetKg: kg.map(Math.round), totalKg: Math.round(kg.reduce((s, v) => s + v, 0)) }))
    .sort((a, b) => b.totalKg - a.totalKg);
}

function redondear1(valor: number): number {
  return Math.round(valor * 10) / 10;
}
