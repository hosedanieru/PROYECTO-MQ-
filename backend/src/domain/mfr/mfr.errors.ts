import { ErrorDominio } from '../shared/errores.js';

export abstract class ErrorMfr extends ErrorDominio {}

export class DatosMfrInvalidosError extends ErrorMfr {
  readonly codigo = 'MFR_DATOS_INVALIDOS';
}

/** Un turno cerrado no admite cambios en sus bloques. */
export class TurnoCerradoError extends ErrorMfr {
  readonly codigo = 'MFR_TURNO_CERRADO';

  constructor() {
    super('El turno ya fue cerrado; su programación no se puede modificar.');
  }
}

export class BloqueNoEncontradoError extends ErrorMfr {
  readonly codigo = 'MFR_BLOQUE_NO_ENCONTRADO';
}

/** Dos bloques de la misma línea comparten minutos del día. */
export class BloquesSolapadosError extends ErrorMfr {
  readonly codigo = 'MFR_BLOQUES_SOLAPADOS';

  constructor(
    readonly lineaId: string,
    a: { horaInicio: string; horaFin: string },
    b: { horaInicio: string; horaFin: string },
  ) {
    super(`En la línea hay dos bloques que se solapan: ${a.horaInicio}–${a.horaFin} y ${b.horaInicio}–${b.horaFin}.`);
  }
}

/** Copiar o importar sobre un día que ya tiene bloques exige decidir qué hacer con ellos. */
export class DiaConProgramacionError extends ErrorMfr {
  readonly codigo = 'MFR_DIA_CON_PROGRAMACION';

  constructor(cantidad: number) {
    super(`El día ya tiene ${cantidad} bloque(s) programado(s). Indique "reemplazar" con motivo, o elimínelos antes.`);
  }
}

export class LineaNoEncontradaError extends ErrorMfr {
  readonly codigo = 'MFR_LINEA_NO_ENCONTRADA';
}

export class AsignacionNoEncontradaError extends ErrorMfr {
  readonly codigo = 'MFR_ASIGNACION_NO_ENCONTRADA';
}

/** Para asignar un grupo a una línea primero hay que registrar cuántas personas llegaron. */
export class AsignacionSinAsistenciaError extends ErrorMfr {
  readonly codigo = 'MFR_ASIGNACION_SIN_ASISTENCIA';

  constructor(grupoId: string, turnoId: string) {
    super(`Registre primero la asistencia del grupo "${grupoId}" en el turno "${turnoId}"; sin ella no se sabe cuántas personas llegaron.`);
  }
}

/** Lo asignado a líneas no puede superar las personas que llegaron del grupo. */
export class AsignacionExcedeAsistenciaError extends ErrorMfr {
  readonly codigo = 'MFR_ASIGNACION_EXCEDE_ASISTENCIA';

  constructor(
    readonly llegaron: number,
    readonly enOtrasLineas: number,
    readonly solicitadas: number,
  ) {
    super(
      `Del grupo llegaron ${llegaron} persona(s) y ya hay ${enOtrasLineas} en otras líneas: ` +
        `solo quedan ${Math.max(0, llegaron - enOtrasLineas)} por asignar, no ${solicitadas}.`,
    );
  }
}

/** La asistencia no puede corregirse por debajo de lo ya asignado en líneas. */
export class AsistenciaMenorQueAsignadasError extends ErrorMfr {
  readonly codigo = 'MFR_ASISTENCIA_MENOR_QUE_ASIGNADAS';

  constructor(
    readonly personasLlegaron: number,
    readonly asignadas: number,
  ) {
    super(`El grupo ya tiene ${asignadas} persona(s) asignadas en líneas; primero baje las asignaciones antes de registrar ${personasLlegaron}.`);
  }
}

export class CodigoLineaDuplicadoError extends ErrorMfr {
  readonly codigo = 'MFR_LINEA_CODIGO_DUPLICADO';

  constructor(readonly codigoLinea: string) {
    super(`Ya existe una línea con el código "${codigoLinea}".`);
  }
}

/** Editar un estándar o corregir programación exige explicar por qué. */
export class MotivoObligatorioError extends ErrorMfr {
  readonly codigo = 'MFR_MOTIVO_OBLIGATORIO';

  constructor() {
    super('Se requiere el motivo del cambio.');
  }
}

/** El turno se cierra con SKU por debajo de su target: hay que explicarlo. */
export class FaltanteSinMotivoError extends ErrorMfr {
  readonly codigo = 'MFR_FALTANTE_SIN_MOTIVO';

  constructor(readonly faltantes: Array<{ productoId: string; programadoCajas: number; producidoCajas: number; faltanteCajas: number }>) {
    super(
      `El turno cierra con ${faltantes.length} SKU por debajo de lo programado (faltan ` +
        `${faltantes.reduce((s, f) => s + f.faltanteCajas, 0)} cajas). Indique el motivo del faltante para cerrar.`,
    );
  }
}

/** El archivo subido no es un DPP de PepsiCo reconocible. */
export class DppNoReconocidoError extends ErrorMfr {
  readonly codigo = 'MFR_DPP_NO_RECONOCIDO';
}
