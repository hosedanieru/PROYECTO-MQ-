/**
 * FILTRO DE ERRORES DE DOMINIO
 * ============================
 *
 * Traduce los errores de negocio a respuestas HTTP.
 *
 * Esta pieza es la que permite que el dominio no sepa nada de HTTP. La
 * entidad lanza `TransicionEstadoInvalidaError`; aquí se decide que eso
 * es un 409 Conflict. Si mañana el mismo caso de uso se invoca desde una
 * cola de mensajes o un script, el dominio sigue igual y este filtro
 * simplemente no participa.
 *
 * Captura la base común `ErrorDominio`, así que sirve para todos los
 * módulos: remisiones, usuarios y los que se agreguen. Cada módulo suma
 * sus tipos a la tabla de traducción de abajo.
 */

import {
  type ArgumentsHost,
  Catch,
  type ExceptionFilter,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import type { Response } from 'express';

import {
  DatosRemisionInvalidosError,
  InformacionIncompletaError,
  RemisionNoEncontradaError,
  TransicionEstadoInvalidaError,
} from '../../../domain/remision/remision.errors.js';
import { ErrorDominio } from '../../../domain/shared/errores.js';
import {
  CredencialesInvalidasError,
  DatosUsuarioInvalidosError,
  DocumentoDuplicadoError,
  PermisoDenegadoError,
  UsuarioInactivoError,
  UsuarioNoEncontradoError,
} from '../../../domain/usuario/usuario.errors.js';

/**
 * Tabla de traducción: tipo de error → código HTTP.
 *
 * Es una lista y no un `switch` para que agregar un módulo nuevo sea
 * añadir filas, no tocar lógica. Se evalúa en orden; si ningún tipo
 * coincide, se responde 400.
 */
const TRADUCCION: Array<[new (...args: never[]) => ErrorDominio, HttpStatus]> = [
  // --- Remisiones ---
  // Datos inválidos o incompletos → el cliente envió algo mal.
  [DatosRemisionInvalidosError, HttpStatus.BAD_REQUEST],
  [InformacionIncompletaError, HttpStatus.BAD_REQUEST],
  // Transición inválida → los datos están bien, pero el estado actual
  // del recurso no permite la operación. Conflicto, no validación.
  [TransicionEstadoInvalidaError, HttpStatus.CONFLICT],
  [RemisionNoEncontradaError, HttpStatus.NOT_FOUND],

  // --- Usuarios / autenticación ---
  // 401: no sabemos quién eres. 403: sabemos quién eres y no puedes.
  [CredencialesInvalidasError, HttpStatus.UNAUTHORIZED],
  [UsuarioInactivoError, HttpStatus.FORBIDDEN],
  [PermisoDenegadoError, HttpStatus.FORBIDDEN],
  [DatosUsuarioInvalidosError, HttpStatus.BAD_REQUEST],
  [DocumentoDuplicadoError, HttpStatus.CONFLICT],
  [UsuarioNoEncontradoError, HttpStatus.NOT_FOUND],
];

@Catch(ErrorDominio)
export class ErrorDominioFilter implements ExceptionFilter {
  private readonly logger = new Logger(ErrorDominioFilter.name);

  catch(error: ErrorDominio, host: ArgumentsHost): void {
    const respuesta = host.switchToHttp().getResponse<Response>();
    const estado = this.aEstadoHttp(error);

    this.logger.warn(`${error.codigo}: ${error.message}`);

    respuesta.status(estado).json({
      codigo: error.codigo,
      mensaje: error.message,
    });
  }

  private aEstadoHttp(error: ErrorDominio): HttpStatus {
    const fila = TRADUCCION.find(([Tipo]) => error instanceof Tipo);
    return fila ? fila[1] : HttpStatus.BAD_REQUEST;
  }
}
