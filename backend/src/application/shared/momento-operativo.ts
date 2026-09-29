/**
 * MOMENTO OPERATIVO DE UN REGISTRO
 * ================================
 *
 * Fecha y hora reales, día operativo (corte 06:00) y turno, todo lo pone
 * el servidor: el usuario no los escribe (decisión del área para
 * averías, 2026-09-28; aplica igual a los movimientos de inventario).
 *
 * El turno sale de la hora de Bogotá con los horarios configurados
 * (`turnoDeHora`); la pausa entre turnos queda con el turno anterior.
 */

import { SinTurnoConfiguradoError } from '../../domain/shared/errores.js';
import { turnoDeHora, type HorarioRepository } from '../../domain/mfr/horas-turno.js';
import { horaLocalDe, registroActual } from '../../domain/shared/fecha-operativa.js';
import type { Reloj } from '../remision/crear-remision.use-case.js';

export interface MomentoOperativo {
  fechaHoraRegistro: Date;
  fechaOperativa: Date;
  turnoId: string;
}

export async function momentoOperativo(reloj: Reloj, horarios: HorarioRepository): Promise<MomentoOperativo> {
  const ahora = reloj.ahora();
  const { fechaHoraRegistro, fechaOperativa } = registroActual(ahora);
  const turnoId = turnoDeHora(await horarios.vigentesEn(fechaOperativa), fechaOperativa, horaLocalDe(ahora));
  if (!turnoId) {
    throw new SinTurnoConfiguradoError('No hay un turno configurado para esta hora; revise los horarios de los turnos.');
  }
  return { fechaHoraRegistro, fechaOperativa, turnoId };
}
