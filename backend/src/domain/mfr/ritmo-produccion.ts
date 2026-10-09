/**
 * RITMO DE PRODUCCIÓN POR HORA (Ciclo 2, fase 1)
 * ==============================================
 *
 * ¿Van adelantados, en línea o retrasados? (usuario, 2026-10-06)
 *
 *   esperado a la hora t = Σ T de cada bloque × parte del bloque ya
 *                          transcurrida a t (reparto parejo: las 7,5 h del
 *                          turno son productivas, sin pausas)
 *   real a la hora t     = Σ cajas de las remisiones CREADAS hasta t, en
 *                          cualquier estado y sin las extraoficiales (el
 *                          ritmo mide producción; la aprobación llega después)
 *
 *   desviación = (real − esperado) ÷ esperado
 *   EN_LINEA si está dentro de ±5 %; por encima ADELANTADO, por debajo RETRASADO.
 *
 * Por turno se usa el turno que el coordinador puso en la remisión. Es
 * función pura: "ahora" llega como parámetro (el caso de uso lo toma del
 * Reloj), para poder probar cualquier hora.
 */

import { instanteOperativo } from './indicadores-produccion.js';

/** Tolerancia de "en línea", en % de lo esperado. Decisión del usuario (2026-10-06). */
export const TOLERANCIA_RITMO_PORCENTAJE = 5;

export type EstadoRitmo = 'ADELANTADO' | 'EN_LINEA' | 'RETRASADO' | 'SIN_DATO';

export interface BloqueRitmo {
  turnoId: string;
  /** Minutos desde las 06:00 del día operativo. */
  inicioMinutos: number;
  finMinutos: number;
  targetCajas: number;
}

export interface RemisionRitmo {
  turnoId: string;
  cajas: number;
  creada: Date;
  extraoficial: boolean;
}

export interface PuntoRitmo {
  /** Fin de la hora: "07:00" es lo acumulado de 06:00 a 07:00. */
  hora: string;
  esperadoCajas: number;
  /** null en las horas que todavía no llegan. */
  realCajas: number | null;
}

export interface MedidaRitmo {
  /** Meta total (Σ T) del día o del turno. */
  metaCajas: number;
  esperadoAhoraCajas: number;
  realAhoraCajas: number;
  /** (real − esperado) ÷ esperado × 100, un decimal; null sin esperado. */
  desviacionPorcentaje: number | null;
  estado: EstadoRitmo;
  /** Cajas de más (positivo) o de menos (negativo) frente a lo esperado ahora. */
  diferenciaCajas: number;
  serie: PuntoRitmo[];
}

export interface RitmoDia extends MedidaRitmo {
  /** Minutos desde las 06:00 que ya pasaron (0 si el día no empieza, 1440 si terminó). */
  minutoActual: number;
  tolerancia: number;
  porTurno: Array<MedidaRitmo & { turnoId: string; empezo: boolean }>;
}

const MINUTOS_DIA = 24 * 60;

export function estadoRitmo(real: number, esperado: number, tolerancia = TOLERANCIA_RITMO_PORCENTAJE): EstadoRitmo {
  if (esperado <= 0) return 'SIN_DATO';
  const desviacion = ((real - esperado) / esperado) * 100;
  if (desviacion > tolerancia) return 'ADELANTADO';
  if (desviacion < -tolerancia) return 'RETRASADO';
  return 'EN_LINEA';
}

/** Lo esperado acumulado hasta el minuto t, repartiendo el T de cada bloque en parejo. */
export function esperadoHasta(bloques: BloqueRitmo[], t: number): number {
  let total = 0;
  for (const b of bloques) {
    const duracion = b.finMinutos - b.inicioMinutos;
    if (duracion <= 0) continue;
    const transcurrido = Math.min(Math.max(t - b.inicioMinutos, 0), duracion);
    total += b.targetCajas * (transcurrido / duracion);
  }
  return total;
}

function etiquetaHora(minutosDesdeLasSeis: number): string {
  const h = (6 + Math.floor(minutosDesdeLasSeis / 60)) % 24;
  return `${String(h).padStart(2, '0')}:00`;
}

function medir(fechaOperativa: string, bloques: BloqueRitmo[], remisiones: RemisionRitmo[], minutoActual: number, minutoEsperado: number, tolerancia: number): MedidaRitmo {
  const realHasta = (t: number) => {
    const limite = instanteOperativo(fechaOperativa, t).getTime();
    return remisiones.filter((r) => r.creada.getTime() <= limite).reduce((s, r) => s + r.cajas, 0);
  };
  const serie: PuntoRitmo[] = Array.from({ length: 24 }, (_, i) => {
    const t = (i + 1) * 60;
    return {
      hora: etiquetaHora(t),
      esperadoCajas: Math.round(esperadoHasta(bloques, t)),
      // La hora en curso también se muestra (con lo que va); las futuras no.
      realCajas: t - 60 < minutoActual ? realHasta(Math.min(t, minutoActual)) : null,
    };
  });
  const esperado = Math.round(esperadoHasta(bloques, minutoEsperado));
  const real = realHasta(minutoActual);
  return {
    metaCajas: bloques.reduce((s, b) => s + b.targetCajas, 0),
    esperadoAhoraCajas: esperado,
    realAhoraCajas: real,
    desviacionPorcentaje: esperado > 0 ? Math.round(((real - esperado) / esperado) * 1000) / 10 : null,
    estado: estadoRitmo(real, esperado, tolerancia),
    diferenciaCajas: real - esperado,
    serie,
  };
}

export function calcularRitmo(
  fechaOperativa: string,
  bloques: BloqueRitmo[],
  remisiones: RemisionRitmo[],
  ahora: Date,
  tolerancia = TOLERANCIA_RITMO_PORCENTAJE,
): RitmoDia {
  const inicio = instanteOperativo(fechaOperativa, 0).getTime();
  const minutoActual = Math.min(Math.max((ahora.getTime() - inicio) / 60_000, 0), MINUTOS_DIA);
  const validas = remisiones.filter((r) => !r.extraoficial);

  const turnos = [...new Set(bloques.map((b) => b.turnoId))];
  const porTurno = turnos
    .map((turnoId) => {
      const propios = bloques.filter((b) => b.turnoId === turnoId);
      const inicioTurno = Math.min(...propios.map((b) => b.inicioMinutos));
      const finTurno = Math.max(...propios.map((b) => b.finMinutos));
      // Lo esperado se congela al terminar el turno; lo real sigue sumando registros tardíos.
      const medida = medir(fechaOperativa, propios, validas.filter((r) => r.turnoId === turnoId), minutoActual, Math.min(minutoActual, finTurno), tolerancia);
      return { turnoId, empezo: minutoActual > inicioTurno, ...medida, _inicio: inicioTurno };
    })
    .sort((a, b) => a._inicio - b._inicio)
    .map(({ _inicio, ...t }) => t);

  return {
    ...medir(fechaOperativa, bloques, validas, minutoActual, minutoActual, tolerancia),
    minutoActual: Math.round(minutoActual),
    tolerancia,
    porTurno,
  };
}
