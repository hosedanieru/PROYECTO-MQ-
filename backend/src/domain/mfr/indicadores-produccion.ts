/**
 * INDICADORES DE PRODUCCIÓN (Ciclo 2, fase 1)
 * ===========================================
 *
 * Funciones puras: reciben datos ya cargados y devuelven números. Las
 * definiciones las dio el usuario el 2026-10-06 (ver
 * `docs/modules/mfr.md` → "Indicadores nuevos"):
 *
 *   FR      total aprobado ÷ total programado (T), SIN tope por SKU: lo que
 *           sobra en un SKU compensa lo que falta en otro. El "pedido" es el
 *           DPP (no hay pedidos aparte). El MFR, en cambio, sí topa por SKU.
 *
 *   OTIF    por SKU del DPP y día: COMPLETO si lo aprobado alcanza su T;
 *           A TIEMPO si lo alcanzó antes del fin de su ÚLTIMO bloque del
 *           día. OTIF = SKU a tiempo y completos ÷ SKU programados.
 *
 *   Averías vs lo fabricado
 *           unidades averiadas ÷ (unidades fabricadas + unidades averiadas).
 *           El % contra el DPP con el límite del 1 % sigue aparte
 *           (`domain/averia/indicador-averias.ts`).
 *
 *   Ranking de PT
 *           cajas aprobadas por PT en el periodo; el de menos producción se
 *           busca entre TODOS los programados, incluidos los que sacaron 0.
 *
 *   Productividad
 *           cajas aprobadas ÷ (personas que llegaron × horas del turno),
 *           por turno y por grupo (las 7,5 h del turno son productivas).
 *
 * Qué cuenta como "producido": lo APROBADO por el OPA y sin las
 * extraoficiales, igual que el MFR (`ESTADOS_QUE_CUENTAN`). Excepción:
 * en "averías vs lo fabricado" las extraoficiales sí suman, porque
 * también se fabricaron (criterio aplicado, a confirmar con el usuario).
 *
 * El ritmo por hora vive aparte, en `ritmo-produccion.ts`.
 */

import { totalizarUnidades } from '../averia/registro-averia.js';
import type { ReporteAveria } from '../averia/reporte-averia.js';
import { ESTADOS_QUE_CUENTAN } from './calculo-mfr.js';

// ------------------------------------------------------------
// Datos de entrada (los arma el caso de uso)
// ------------------------------------------------------------

/** Un bloque del DPP ya calculado, con su día. */
export interface BloqueIndicador {
  /** YYYY-MM-DD */
  fechaOperativa: string;
  turnoId: string;
  productoId: string;
  /** Minutos desde las 06:00 del día operativo en que termina (puede pasar de 1440 si cruza el corte). */
  finMinutos: number;
  targetCajas: number;
}

/** Lo que los indicadores necesitan de una remisión. */
export interface RemisionIndicador {
  /** YYYY-MM-DD */
  fechaOperativa: string;
  turnoId: string;
  grupoId: string;
  productoId: string;
  cajas: number;
  unidades: number;
  estado: string;
  extraoficial: boolean;
  /** Cuándo se registró (alimenta el ritmo). */
  creada: Date;
  /** Cuándo la aprobó el OPA; null si no está aprobada. */
  aprobada: Date | null;
}

export interface AsistenciaIndicador {
  /** YYYY-MM-DD */
  fechaOperativa: string;
  turnoId: string;
  grupoId: string;
  personas: number;
}

/** Horas productivas de un turno un día (null: ese día el turno no opera). */
export interface HorasTurnoDia {
  /** YYYY-MM-DD */
  fechaOperativa: string;
  turnoId: string;
  horas: number | null;
}

// ------------------------------------------------------------
// Utilidades
// ------------------------------------------------------------

const ESTADOS_APROBADOS: readonly string[] = ESTADOS_QUE_CUENTAN;

/** Producción que cuenta: aprobada por el OPA y no extraoficial. */
export function esProduccionAprobada(r: RemisionIndicador): boolean {
  return ESTADOS_APROBADOS.includes(r.estado) && !r.extraoficial;
}

/** Porcentaje con un decimal; null si no hay base para dividir. */
export function porcentaje(numerador: number, denominador: number): number | null {
  if (denominador <= 0) return null;
  return Math.round((numerador / denominador) * 1000) / 10;
}

/** Porcentaje con dos decimales (averías: valores pequeños). */
function porcentaje2(numerador: number, denominador: number): number | null {
  if (denominador <= 0) return null;
  return Math.round((numerador / denominador) * 10000) / 100;
}

const sumar = (mapa: Map<string, number>, clave: string, valor: number) => mapa.set(clave, (mapa.get(clave) ?? 0) + valor);

/**
 * Bogotá está en UTC−5 todo el año (Colombia no usa horario de verano).
 * Las 06:00 de un día operativo son las 11:00 UTC de esa fecha.
 */
const INICIO_DIA_OPERATIVO_UTC_HORAS = 11;

/** Instante real de "día operativo + minutos desde las 06:00". */
export function instanteOperativo(fechaOperativa: string, minutosDesdeLasSeis: number): Date {
  const [a, m, d] = fechaOperativa.split('-').map(Number);
  return new Date(Date.UTC(a, m - 1, d, INICIO_DIA_OPERATIVO_UTC_HORAS) + minutosDesdeLasSeis * 60_000);
}

// ------------------------------------------------------------
// FR
// ------------------------------------------------------------

export interface MedidaFr {
  programadoCajas: number;
  aprobadoCajas: number;
  porcentaje: number | null;
}

export interface Fr extends MedidaFr {
  porDia: Array<MedidaFr & { fechaOperativa: string }>;
}

export function calcularFr(bloques: BloqueIndicador[], remisiones: RemisionIndicador[]): Fr {
  const programado = new Map<string, number>();
  const aprobado = new Map<string, number>();
  for (const b of bloques) sumar(programado, b.fechaOperativa, b.targetCajas);
  for (const r of remisiones.filter(esProduccionAprobada)) sumar(aprobado, r.fechaOperativa, r.cajas);

  const dias = [...new Set([...programado.keys(), ...aprobado.keys()])].sort();
  const porDia = dias.map((fechaOperativa) => {
    const p = programado.get(fechaOperativa) ?? 0;
    const a = aprobado.get(fechaOperativa) ?? 0;
    return { fechaOperativa, programadoCajas: p, aprobadoCajas: a, porcentaje: porcentaje(a, p) };
  });
  const programadoCajas = porDia.reduce((s, d) => s + d.programadoCajas, 0);
  const aprobadoCajas = porDia.reduce((s, d) => s + d.aprobadoCajas, 0);
  return { programadoCajas, aprobadoCajas, porcentaje: porcentaje(aprobadoCajas, programadoCajas), porDia };
}

// ------------------------------------------------------------
// OTIF
// ------------------------------------------------------------

export interface SkuOtif {
  fechaOperativa: string;
  productoId: string;
  programadoCajas: number;
  aprobadoCajas: number;
  /** Fin del último bloque del SKU ese día: la hora límite. */
  limite: Date;
  /** Momento en que lo aprobado alcanzó lo programado; null si no lo alcanzó. */
  completoEn: Date | null;
  completo: boolean;
  /** Completo antes (o justo en) la hora límite. Implica `completo`. */
  aTiempo: boolean;
  /** Alguna remisión aprobada sin fecha de aprobación: no se puede juzgar la hora. */
  sinFechaAprobacion: boolean;
}

export interface Otif {
  skus: number;
  completos: number;
  /** A tiempo y completos: el numerador del OTIF. */
  cumplen: number;
  porcentaje: number | null;
  /** Solo "completos" (In Full), para ver qué parte falla. */
  completosPorcentaje: number | null;
  detalle: SkuOtif[];
}

export function calcularOtif(bloques: BloqueIndicador[], remisiones: RemisionIndicador[]): Otif {
  // Programado y hora límite por (día, SKU).
  const pedidos = new Map<string, { fechaOperativa: string; productoId: string; cajas: number; finMinutos: number }>();
  for (const b of bloques) {
    if (b.targetCajas <= 0) continue;
    const clave = `${b.fechaOperativa}|${b.productoId}`;
    const p = pedidos.get(clave) ?? { fechaOperativa: b.fechaOperativa, productoId: b.productoId, cajas: 0, finMinutos: 0 };
    p.cajas += b.targetCajas;
    p.finMinutos = Math.max(p.finMinutos, b.finMinutos);
    pedidos.set(clave, p);
  }

  const aprobadasDe = new Map<string, RemisionIndicador[]>();
  for (const r of remisiones.filter(esProduccionAprobada)) {
    const clave = `${r.fechaOperativa}|${r.productoId}`;
    aprobadasDe.set(clave, [...(aprobadasDe.get(clave) ?? []), r]);
  }

  const detalle: SkuOtif[] = [...pedidos.entries()]
    .map(([clave, p]) => {
      const limite = instanteOperativo(p.fechaOperativa, p.finMinutos);
      const aprobadas = aprobadasDe.get(clave) ?? [];
      const aprobadoCajas = aprobadas.reduce((s, r) => s + r.cajas, 0);
      const sinFechaAprobacion = aprobadas.some((r) => r.aprobada === null);

      // En orden de aprobación, ¿cuándo se llegó a lo programado?
      let acumulado = 0;
      let completoEn: Date | null = null;
      for (const r of aprobadas.filter((x) => x.aprobada !== null).sort((x, y) => x.aprobada!.getTime() - y.aprobada!.getTime())) {
        acumulado += r.cajas;
        if (acumulado >= p.cajas) {
          completoEn = r.aprobada;
          break;
        }
      }
      const completo = aprobadoCajas >= p.cajas;
      return {
        fechaOperativa: p.fechaOperativa,
        productoId: p.productoId,
        programadoCajas: p.cajas,
        aprobadoCajas,
        limite,
        completoEn,
        completo,
        aTiempo: completo && completoEn !== null && completoEn.getTime() <= limite.getTime(),
        sinFechaAprobacion,
      };
    })
    .sort((a, b) => a.fechaOperativa.localeCompare(b.fechaOperativa) || a.productoId.localeCompare(b.productoId));

  const completos = detalle.filter((d) => d.completo).length;
  const cumplen = detalle.filter((d) => d.aTiempo).length;
  return {
    skus: detalle.length,
    completos,
    cumplen,
    porcentaje: porcentaje(cumplen, detalle.length),
    completosPorcentaje: porcentaje(completos, detalle.length),
    detalle,
  };
}

// ------------------------------------------------------------
// Ranking de PT
// ------------------------------------------------------------

export interface FilaRanking {
  productoId: string;
  programadoCajas: number;
  producidoCajas: number;
  cumplimiento: number | null;
  /** Estuvo en el DPP en el periodo. */
  programado: boolean;
}

export interface RankingPt {
  /** De mayor a menor producción. */
  filas: FilaRanking[];
  mayor: FilaRanking | null;
  /** El de menos producción entre los PROGRAMADOS (incluidos los de 0 cajas). */
  menor: FilaRanking | null;
}

export function calcularRankingPt(bloques: BloqueIndicador[], remisiones: RemisionIndicador[]): RankingPt {
  const programado = new Map<string, number>();
  const producido = new Map<string, number>();
  for (const b of bloques) sumar(programado, b.productoId, b.targetCajas);
  for (const r of remisiones.filter(esProduccionAprobada)) sumar(producido, r.productoId, r.cajas);

  const filas: FilaRanking[] = [...new Set([...programado.keys(), ...producido.keys()])]
    .map((productoId) => {
      const p = programado.get(productoId) ?? 0;
      const h = producido.get(productoId) ?? 0;
      return { productoId, programadoCajas: p, producidoCajas: h, cumplimiento: porcentaje(h, p), programado: programado.has(productoId) };
    })
    .sort((a, b) => b.producidoCajas - a.producidoCajas || a.productoId.localeCompare(b.productoId));

  const programados = filas.filter((f) => f.programado);
  // Empate en cajas: va primero el que peor cumplió frente a lo programado.
  const menor =
    [...programados].sort(
      (a, b) => a.producidoCajas - b.producidoCajas || (a.cumplimiento ?? 0) - (b.cumplimiento ?? 0) || a.productoId.localeCompare(b.productoId),
    )[0] ?? null;

  return { filas, mayor: filas.find((f) => f.producidoCajas > 0) ?? null, menor };
}

// ------------------------------------------------------------
// Averías vs lo fabricado
// ------------------------------------------------------------

export interface MedidaFabricado {
  fabricadoUnidades: number;
  /**
   * Parte de `fabricadoUnidades` que viene de remisiones extraoficiales.
   * Suman como fabricado, pero se identifican aparte en las estadísticas
   * (usuario, 2026-10-07).
   */
  extraoficialUnidades: number;
  averiadasUnidades: number;
  /** averiadas ÷ (fabricadas + averiadas) × 100, dos decimales. */
  porcentaje: number | null;
}

export interface AveriasVsFabricado {
  total: MedidaFabricado;
  porDia: Array<MedidaFabricado & { fechaOperativa: string }>;
  porTurno: Array<MedidaFabricado & { turnoId: string }>;
  porProducto: Array<MedidaFabricado & { productoId: string }>;
  /** Bolsas sin equivalencia definida: no suman (PENDIENTE DE DEFINIR), se informan. */
  bolsasSinConvertir: number;
}

function medidaFabricado(fabricadoUnidades: number, extraoficialUnidades: number, averiadasUnidades: number): MedidaFabricado {
  return {
    fabricadoUnidades,
    extraoficialUnidades,
    averiadasUnidades,
    porcentaje: porcentaje2(averiadasUnidades, fabricadoUnidades + averiadasUnidades),
  };
}

export function calcularAveriasVsFabricado(remisiones: RemisionIndicador[], reportes: ReporteAveria[]): AveriasVsFabricado {
  const fab = { dia: new Map<string, number>(), turno: new Map<string, number>(), producto: new Map<string, number>() };
  const extra = { dia: new Map<string, number>(), turno: new Map<string, number>(), producto: new Map<string, number>() };
  const av = { dia: new Map<string, number>(), turno: new Map<string, number>(), producto: new Map<string, number>() };

  // Fabricado: aprobado, incluidas las extraoficiales (también se fabricaron;
  // confirmado por el usuario 2026-10-07), que además se cuentan aparte.
  for (const r of remisiones.filter((x) => ESTADOS_APROBADOS.includes(x.estado))) {
    sumar(fab.dia, r.fechaOperativa, r.unidades);
    sumar(fab.turno, r.turnoId, r.unidades);
    sumar(fab.producto, r.productoId, r.unidades);
    if (r.extraoficial) {
      sumar(extra.dia, r.fechaOperativa, r.unidades);
      sumar(extra.turno, r.turnoId, r.unidades);
      sumar(extra.producto, r.productoId, r.unidades);
    }
  }

  let bolsas = 0;
  for (const reporte of reportes) {
    if (reporte.estado !== 'REGISTRADO') continue;
    const dia = reporte.fechaOperativa.toISOString().slice(0, 10);
    for (const reg of reporte.registros) {
      const { unidades, sinConvertir } = totalizarUnidades([reg]);
      bolsas += sinConvertir.BOLSA ?? 0;
      sumar(av.dia, dia, unidades);
      sumar(av.turno, reporte.turnoId, unidades);
      sumar(av.producto, reg.productoId, unidades);
    }
  }

  const claves = (a: Map<string, number>, b: Map<string, number>) => [...new Set([...a.keys(), ...b.keys()])].sort();
  const suma = (m: Map<string, number>) => [...m.values()].reduce((s, v) => s + v, 0);
  const medida = (corte: keyof typeof fab, k: string) =>
    medidaFabricado(fab[corte].get(k) ?? 0, extra[corte].get(k) ?? 0, av[corte].get(k) ?? 0);
  const total = medidaFabricado(suma(fab.dia), suma(extra.dia), suma(av.dia));
  return {
    total,
    porDia: claves(fab.dia, av.dia).map((k) => ({ fechaOperativa: k, ...medida('dia', k) })),
    porTurno: claves(fab.turno, av.turno).map((k) => ({ turnoId: k, ...medida('turno', k) })),
    porProducto: claves(fab.producto, av.producto)
      .map((k) => ({ productoId: k, ...medida('producto', k) }))
      .filter((p) => p.averiadasUnidades > 0)
      .sort((a, b) => (b.porcentaje ?? 0) - (a.porcentaje ?? 0)),
    bolsasSinConvertir: bolsas,
  };
}

// ------------------------------------------------------------
// Productividad: cajas por persona-hora
// ------------------------------------------------------------

export interface MedidaProductividad {
  cajas: number;
  personas: number;
  horasPersona: number;
  cajasPorPersonaHora: number | null;
}

export interface Productividad {
  total: MedidaProductividad;
  porTurno: Array<MedidaProductividad & { turnoId: string }>;
  porGrupo: Array<MedidaProductividad & { grupoId: string }>;
  /**
   * Cajas aprobadas de turnos SIN asistencia registrada: no entran en el
   * indicador (dividirían por cero personas y lo inflarían); se informan.
   */
  cajasSinAsistencia: number;
}

function medidaProductividad(cajas: number, personas: number, horasPersona: number): MedidaProductividad {
  return {
    cajas,
    personas,
    horasPersona: Math.round(horasPersona * 10) / 10,
    cajasPorPersonaHora: horasPersona > 0 ? Math.round((cajas / horasPersona) * 100) / 100 : null,
  };
}

export function calcularProductividad(
  remisiones: RemisionIndicador[],
  asistencias: AsistenciaIndicador[],
  horas: HorasTurnoDia[],
): Productividad {
  const horasDe = new Map(horas.map((h) => [`${h.fechaOperativa}|${h.turnoId}`, h.horas]));
  // (día, turno) con asistencia registrada y horas conocidas: solo esos entran.
  const turnoDiaValido = new Set(
    asistencias.filter((a) => (horasDe.get(`${a.fechaOperativa}|${a.turnoId}`) ?? null) !== null).map((a) => `${a.fechaOperativa}|${a.turnoId}`),
  );

  const personas = { turno: new Map<string, number>(), grupo: new Map<string, number>() };
  const horasPersona = { turno: new Map<string, number>(), grupo: new Map<string, number>() };
  const grupoDiaTurno = new Set<string>();
  for (const a of asistencias) {
    const h = horasDe.get(`${a.fechaOperativa}|${a.turnoId}`) ?? null;
    if (h === null) continue;
    sumar(personas.turno, a.turnoId, a.personas);
    sumar(personas.grupo, a.grupoId, a.personas);
    sumar(horasPersona.turno, a.turnoId, a.personas * h);
    sumar(horasPersona.grupo, a.grupoId, a.personas * h);
    grupoDiaTurno.add(`${a.fechaOperativa}|${a.turnoId}|${a.grupoId}`);
  }

  const cajas = { turno: new Map<string, number>(), grupo: new Map<string, number>() };
  let cajasSinAsistencia = 0;
  for (const r of remisiones.filter(esProduccionAprobada)) {
    if (!turnoDiaValido.has(`${r.fechaOperativa}|${r.turnoId}`)) {
      cajasSinAsistencia += r.cajas;
      continue;
    }
    sumar(cajas.turno, r.turnoId, r.cajas);
    // Por grupo, solo si ESE grupo registró asistencia en ese turno.
    if (grupoDiaTurno.has(`${r.fechaOperativa}|${r.turnoId}|${r.grupoId}`)) sumar(cajas.grupo, r.grupoId, r.cajas);
  }

  const porTurno = [...new Set([...personas.turno.keys(), ...cajas.turno.keys()])]
    .sort()
    .map((turnoId) => ({
      turnoId,
      ...medidaProductividad(cajas.turno.get(turnoId) ?? 0, personas.turno.get(turnoId) ?? 0, horasPersona.turno.get(turnoId) ?? 0),
    }));
  const porGrupo = [...new Set([...personas.grupo.keys(), ...cajas.grupo.keys()])]
    .map((grupoId) => ({
      grupoId,
      ...medidaProductividad(cajas.grupo.get(grupoId) ?? 0, personas.grupo.get(grupoId) ?? 0, horasPersona.grupo.get(grupoId) ?? 0),
    }))
    .sort((a, b) => (b.cajasPorPersonaHora ?? -1) - (a.cajasPorPersonaHora ?? -1));

  return {
    total: medidaProductividad(
      porTurno.reduce((s, t) => s + t.cajas, 0),
      porTurno.reduce((s, t) => s + t.personas, 0),
      [...horasPersona.turno.values()].reduce((s, v) => s + v, 0),
    ),
    porTurno,
    porGrupo,
    cajasSinAsistencia,
  };
}
