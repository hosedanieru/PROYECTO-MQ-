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
