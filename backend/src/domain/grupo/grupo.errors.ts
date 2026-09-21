import { ErrorDominio } from '../shared/errores.js';

export abstract class ErrorGrupo extends ErrorDominio {}

export class DatosGrupoInvalidosError extends ErrorGrupo {
  readonly codigo = 'GRUPO_DATOS_INVALIDOS';
}

export class CodigoGrupoDuplicadoError extends ErrorGrupo {
  readonly codigo = 'GRUPO_CODIGO_DUPLICADO';

  constructor(readonly codigoGrupo: string) {
    super(`Ya existe un grupo con el código "${codigoGrupo}".`);
  }
}

export class GrupoNoEncontradoError extends ErrorGrupo {
  readonly codigo = 'GRUPO_NO_ENCONTRADO';
}
