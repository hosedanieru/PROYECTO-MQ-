/**
 * FILTRO DE ERRORES DE PERSISTENCIA
 * =================================
 *
 * Hermano de `ErrorDominioFilter`, pero para lo que falla por debajo:
 * la base de datos no pudo atender la petición.
 *
 * Responde 503 y NO 500, y la diferencia importa: 500 significa "el
 * servidor tiene un fallo"; 503 significa "la petición era correcta,
 * vuelve a intentarlo". Cuando se agota la cuota de Firestore no hay
 * nada que arreglar en el código, y el mensaje tiene que decirlo o se
 * pierden horas buscando un error que no existe.
 */

import {
  type ArgumentsHost,
  Catch,
  type ExceptionFilter,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import type { Response } from 'express';

import { ErrorPersistencia } from '../../firestore/errores-firestore.js';

@Catch(ErrorPersistencia)
export class ErrorPersistenciaFilter implements ExceptionFilter {
  private readonly logger = new Logger(ErrorPersistenciaFilter.name);

  catch(error: ErrorPersistencia, host: ArgumentsHost): void {
    const respuesta = host.switchToHttp().getResponse<Response>();

    // Nivel `error` y no `warn`: la aplicación no puede trabajar.
    this.logger.error(`${error.codigo} (gRPC ${error.codigoOriginal}): ${error.message}`);

    respuesta.status(HttpStatus.SERVICE_UNAVAILABLE).json({
      codigo: error.codigo,
      mensaje: error.message,
    });
  }
}
