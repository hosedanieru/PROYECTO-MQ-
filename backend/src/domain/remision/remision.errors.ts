/**
 * Errores del dominio de Remisión.
 *
 * Son errores de NEGOCIO, no de infraestructura: no saben nada de HTTP,
 * de códigos de estado ni de Prisma. La capa de presentación los traduce
 * a respuestas HTTP; el dominio solo describe qué regla se violó.
 */

import { ErrorDominio } from '../shared/errores.js';

/** Base de todos los errores de negocio de remisiones. */
export abstract class ErrorRemision extends ErrorDominio {}

/** Un dato obligatorio falta o tiene un valor imposible. */
export class DatosRemisionInvalidosError extends ErrorRemision {
  readonly codigo = 'REMISION_DATOS_INVALIDOS';
}

/** Se intentó un cambio de estado que el flujo no permite. */
export class TransicionEstadoInvalidaError extends ErrorRemision {
  readonly codigo = 'REMISION_TRANSICION_INVALIDA';

  constructor(
    readonly estadoActual: string,
    readonly estadoDestino: string,
  ) {
    super(
      `No se puede pasar una remisión de ${estadoActual} a ${estadoDestino}.`,
    );
  }
}

/** Falta información requerida para ejecutar el cambio de estado. */
export class InformacionIncompletaError extends ErrorRemision {
  readonly codigo = 'REMISION_INFORMACION_INCOMPLETA';
}

/** Se intentó modificar una remisión que ya salió a entrega. */
export class RemisionNoEditableError extends ErrorRemision {
  readonly codigo = 'REMISION_NO_EDITABLE';

  constructor(readonly estadoActual: string) {
    super(
      `Una remisión en estado ${estadoActual} no se puede editar. ` +
        'Solo se editan en BORRADOR o EN_RECTIFICACION.',
    );
  }
}

/** La remisión solicitada no existe. */
export class RemisionNoEncontradaError extends ErrorRemision {
  readonly codigo = 'REMISION_NO_ENCONTRADA';
}

/** El día operativo no tiene programación (DPP) cargada: no se sabe cuánto se puede remisionar. */
export class SinProgramacionDelDiaError extends ErrorRemision {
  readonly codigo = 'REMISION_SIN_PROGRAMACION';

  constructor(fecha: string) {
    super(
      `El ${fecha} no tiene programación (DPP) cargada. Cargue la programación del día antes de remisionar, ` +
        'o marque la remisión como extraoficial con su motivo.',
    );
  }
}

/** El producto no aparece en el DPP del día (o no se le puede calcular el programado). */
export class ProductoNoProgramadoError extends ErrorRemision {
  readonly codigo = 'REMISION_PRODUCTO_NO_PROGRAMADO';
}

/** Con esta remisión, lo aprobado del SKU en el día superaría lo programado por PepsiCo. */
export class RemisionExcedeProgramacionError extends ErrorRemision {
  readonly codigo = 'REMISION_EXCEDE_PROGRAMACION';

  constructor(
    readonly codigoProducto: string,
    readonly programadoCajas: number,
    readonly aprobadasCajas: number,
    readonly cajasNuevas: number,
  ) {
    super(
      `El producto ${codigoProducto} tiene programadas ${programadoCajas} cajas hoy; ya hay ${aprobadasCajas} aprobadas ` +
        `y esta remisión pide ${cajasNuevas}: sobran ${aprobadasCajas + cajasNuevas - programadoCajas}. ` +
        'Si es un pedido de emergencia, márquela como extraoficial con su motivo.',
    );
  }
}