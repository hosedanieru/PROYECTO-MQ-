import { ErrorDominio } from '../shared/errores.js';

export abstract class ErrorProducto extends ErrorDominio {}

export class DatosProductoInvalidosError extends ErrorProducto {
  readonly codigo = 'PRODUCTO_DATOS_INVALIDOS';
}

export class CodigoProductoDuplicadoError extends ErrorProducto {
  readonly codigo = 'PRODUCTO_CODIGO_DUPLICADO';

  constructor(readonly codigoProducto: string) {
    super(`Ya existe un producto con el código "${codigoProducto}".`);
  }
}

export class ProductoNoEncontradoError extends ErrorProducto {
  readonly codigo = 'PRODUCTO_NO_ENCONTRADO';
}
