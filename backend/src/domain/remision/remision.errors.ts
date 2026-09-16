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

/** La remisión solicitada no existe. */
export class RemisionNoEncontradaError extends ErrorRemision {
  readonly codigo = 'REMISION_NO_ENCONTRADA';
}