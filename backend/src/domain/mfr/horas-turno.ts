/**
 * HORAS Y TURNOS
 * ==============
 *
 * Los horarios salen de `turno_horario` (configuración por día de la
 * semana), nunca de una constante. Decisión del 2026-09-18: se usan los
 * horarios del DPP de PepsiCo (T1 06:00–13:30, T2 14:00–21:30,
 * T3 22:00–05:30) para todos los días.
 *
 * El día operativo va de 06:00 a 06:00. Para comparar horas dentro de
 * él se usan "minutos operativos": minutos transcurridos desde las
 * 06:00, de modo que 22:00 (960) es anterior a 05:30 (1410) aunque el
 * reloj diga lo contrario.
 *
 * El día de la semana es el de la FECHA OPERATIVA (un T3 del lunes que
 * termina el martes a las 06:00 usa el horario del lunes).
 */

export type DiaSemana = 'LUNES' | 'MARTES' | 'MIERCOLES' | 'JUEVES' | 'VIERNES' | 'SABADO' | 'DOMINGO';

const DIAS: DiaSemana[] = ['DOMINGO', 'LUNES', 'MARTES', 'MIERCOLES', 'JUEVES', 'VIERNES', 'SABADO'];

/** Hora a la que empieza el día operativo. */
export const INICIO_DIA_OPERATIVO = '06:00';

/** Día de la semana de una fecha operativa (guardada a medianoche UTC). */
export function diaSemanaDe(fechaOperativa: Date): DiaSemana {
  return DIAS[fechaOperativa.getUTCDay()];
}

export interface HorarioTurno {
  turnoId: string;
  diaSemana: DiaSemana;
  /** "HH:mm" */
  horaInicio: string;
  horaFin: string;
  cruzaMedianoche: boolean;
}

export function esHoraValida(texto: string): boolean {
  return /^([01]\d|2[0-3]):[0-5]\d$/.test(texto);
}

/** "22:00" → 1320 minutos del reloj. */
export function minutosDeReloj(hora: string): number {
  const [h, m] = hora.split(':').map(Number);
  return h * 60 + m;
}

/** Minutos desde las 06:00 del día operativo: "06:00" → 0, "05:30" → 1410. */
export function minutosOperativos(hora: string): number {
  return (minutosDeReloj(hora) - minutosDeReloj(INICIO_DIA_OPERATIVO) + 24 * 60) % (24 * 60);
}

/** Duración en horas (decimal) de un rango. "22:00"→"06:00" = 8; "14:00"→"15:45" = 1,75. */
export function horasDeHorario(h: { horaInicio: string; horaFin: string }): number {
  let minutos = minutosDeReloj(h.horaFin) - minutosDeReloj(h.horaInicio);
  if (minutos <= 0) minutos += 24 * 60; // cruza la medianoche
  return minutos / 60;
}

/** Horarios de todos los turnos para el día de la semana de la fecha operativa. */
export function horariosDelDia(horarios: HorarioTurno[], fechaOperativa: Date): HorarioTurno[] {
  const dia = diaSemanaDe(fechaOperativa);
  return horarios
    .filter((h) => h.diaSemana === dia)
    .sort((a, b) => minutosOperativos(a.horaInicio) - minutosOperativos(b.horaInicio));
}

/**
 * Horas del turno para la fecha operativa dada, o `null` si ese día el
 * turno no opera (p. ej. T3 el sábado).
 */
export function horasTurnoEn(horarios: HorarioTurno[], turnoId: string, fechaOperativa: Date): number | null {
  const horario = horariosDelDia(horarios, fechaOperativa).find((h) => h.turnoId === turnoId);
  return horario ? horasDeHorario(horario) : null;
}

/**
 * Turno al que pertenece un bloque que empieza a `horaInicio`: el
 * último turno que arranca en o antes de esa hora (en minutos
 * operativos). La pausa entre turnos (13:30–14:00) queda con el turno
 * anterior. `null` si el día no tiene horarios.
 */
export function turnoDeHora(horarios: HorarioTurno[], fechaOperativa: Date, horaInicio: string): string | null {
  const delDia = horariosDelDia(horarios, fechaOperativa);
  if (delDia.length === 0) return null;
  const inicio = minutosOperativos(horaInicio);
  let turno = delDia[delDia.length - 1]; // antes del primero → el último (circular)
  for (const h of delDia) {
    if (minutosOperativos(h.horaInicio) <= inicio) turno = h;
  }
  return turno.turnoId;
}

export interface HorarioRepository {
  /** Horarios vigentes en la fecha indicada, de todos los turnos. */
  vigentesEn(fechaOperativa: Date): Promise<HorarioTurno[]>;
}

export const HORARIO_REPOSITORY = Symbol('HorarioRepository');
