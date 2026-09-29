import { ErrorDominio } from '../shared/errores.js';

export abstract class ErrorInventario extends ErrorDominio {}

export class DatosInventarioInvalidosError extends ErrorInventario {
  readonly codigo = 'INVENTARIO_DATOS_INVALIDOS';
}

export class ItemInventarioNoEncontradoError extends ErrorInventario {
  readonly codigo = 'INVENTARIO_ITEM_NO_ENCONTRADO';
}

export class EntradaMercanciaNoEncontradaError extends ErrorInventario {
  readonly codigo = 'INVENTARIO_ENTRADA_NO_ENCONTRADA';
}

export class ItemInventarioDuplicadoError extends ErrorInventario {
  readonly codigo = 'INVENTARIO_ITEM_DUPLICADO';
}

/** Una salida (o un ajuste negativo) dejaría la existencia por debajo de cero. */
export class ExistenciaInsuficienteError extends ErrorInventario {
  readonly codigo = 'INVENTARIO_EXISTENCIA_INSUFICIENTE';

  constructor(
    readonly existencia: number,
    readonly solicitado: number,
    unidad: string,
  ) {
    super(`No hay suficiente existencia: hay ${existencia} ${unidad} y se intentan sacar ${solicitado}. Si el conteo físico no coincide, registre un ajuste.`);
  }
}
