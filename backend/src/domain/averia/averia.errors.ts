import { ErrorDominio } from '../shared/errores.js';

export abstract class ErrorAveria extends ErrorDominio {}

export class DatosCausalInvalidosError extends ErrorAveria {
  readonly codigo = 'CAUSAL_DATOS_INVALIDOS';
}

export class CodigoCausalDuplicadoError extends ErrorAveria {
  readonly codigo = 'CAUSAL_CODIGO_DUPLICADO';

  constructor(readonly codigoCausal: string) {
    super(`Ya existe una causal de avería con el código "${codigoCausal}".`);
  }
}

export class CausalNoEncontradaError extends ErrorAveria {
  readonly codigo = 'CAUSAL_NO_ENCONTRADA';
}

export class DatosAveriaInvalidosError extends ErrorAveria {
  readonly codigo = 'AVERIA_DATOS_INVALIDOS';
}

export class ReporteAveriaNoEncontradoError extends ErrorAveria {
  readonly codigo = 'AVERIA_NO_ENCONTRADA';
}

/** El reporte está anulado: los datos están bien, pero su estado no permite el cambio. */
export class ReporteAveriaNoModificableError extends ErrorAveria {
  readonly codigo = 'AVERIA_NO_MODIFICABLE';
}
