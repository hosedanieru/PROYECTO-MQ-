/**
 * DÍA OPERATIVO
 * =============
 *
 * La operación corre de 06:00 a 06:00 (hora de Bogotá). Todo lo que
 * ocurre antes de las 06:00 pertenece al día operativo anterior.
 * Es la fecha por la que se agrupan todos los reportes.
 */

const ZONA_HORARIA = 'America/Bogota';

const HORA_CORTE = 6;

const MILISEGUNDOS_POR_HORA = 60 * 60 * 1000;

/** Devuelve el día operativo como texto `YYYY-MM-DD`. */
export function calcularFechaOperativa(instante: Date): string {
  if (!(instante instanceof Date) || Number.isNaN(instante.getTime())) {
    throw new Error('calcularFechaOperativa: se recibio una fecha invalida');
  }

  const desplazado = new Date(
    instante.getTime() - HORA_CORTE * MILISEGUNDOS_POR_HORA,
  );

  return extraerFechaLocal(desplazado);
}

/**
 * Convierte el texto `YYYY-MM-DD` a un `Date` a medianoche UTC.
 *
 * Es la representación que espera una columna `DATE` (sin hora ni zona):
 * el día se conserva exacto sin importar la zona horaria del servidor.
 */
export function fechaOperativaADate(fechaOperativa: string): Date {
  const coincidencia = /^(\d{4})-(\d{2})-(\d{2})$/.exec(fechaOperativa);
  if (!coincidencia) {
    throw new Error(
      `fechaOperativaADate: formato inválido "${fechaOperativa}", se esperaba YYYY-MM-DD`,
    );
  }

  const [, anio, mes, dia] = coincidencia;
  return new Date(Date.UTC(Number(anio), Number(mes) - 1, Number(dia)));
}

/**
 * Instante real de un registro junto con el día operativo al que
 * pertenece. Es lo que necesita cualquier documento que se fecha: la
 * hora exacta para la trazabilidad y el día operativo para los reportes.
 */
export interface RegistroFechado {
  fechaHoraRegistro: Date;
  fechaOperativa: Date;
}

export function registroActual(instante: Date = new Date()): RegistroFechado {
  return {
    fechaHoraRegistro: instante,
    fechaOperativa: fechaOperativaADate(calcularFechaOperativa(instante)),
  };
}

function extraerFechaLocal(instante: Date): string {
  const partes = new Intl.DateTimeFormat('en-CA', {
    timeZone: ZONA_HORARIA,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(instante);

  const valor = (tipo: Intl.DateTimeFormatPartTypes): string => {
    const parte = partes.find((p) => p.type === tipo);
    if (!parte) {
      throw new Error(`extraerFechaLocal: no se pudo obtener "${tipo}"`);
    }
    return parte.value;
  };

  return `${valor('year')}-${valor('month')}-${valor('day')}`;
}
