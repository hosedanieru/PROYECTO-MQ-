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
  AsignacionExcedeAsistenciaError,
  AsignacionNoEncontradaError,
  AsignacionSinAsistenciaError,
  AsistenciaMenorQueAsignadasError,
  BloqueNoEncontradoError,
  BloquesSolapadosError,
  CodigoLineaDuplicadoError,
  DatosMfrInvalidosError,
  DiaConProgramacionError,
  DppNoReconocidoError,
  FaltanteSinMotivoError,
  LineaNoEncontradaError,
  MotivoObligatorioError,
  TurnoCerradoError,
} from '../../../domain/mfr/mfr.errors.js';
import {
  CodigoGrupoDuplicadoError,
  DatosGrupoInvalidosError,
  GrupoNoEncontradoError,
} from '../../../domain/grupo/grupo.errors.js';
import {
  CodigoProductoDuplicadoError,
  DatosProductoInvalidosError,
  ProductoNoEncontradoError,
} from '../../../domain/producto/producto.errors.js';
import {
  DatosRemisionInvalidosError,
  InformacionIncompletaError,
  ProductoNoProgramadoError,
  RemisionExcedeProgramacionError,
  RemisionNoEditableError,
  RemisionNoEncontradaError,
  SinProgramacionDelDiaError,
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
  [RemisionNoEditableError, HttpStatus.CONFLICT],
  // Tope del DPP: los datos están bien, pero el día no admite esa remisión.
  [SinProgramacionDelDiaError, HttpStatus.CONFLICT],
  [ProductoNoProgramadoError, HttpStatus.CONFLICT],
  [RemisionExcedeProgramacionError, HttpStatus.CONFLICT],
  [RemisionNoEncontradaError, HttpStatus.NOT_FOUND],

  // --- Usuarios / autenticación ---
  // 401: no sabemos quién eres. 403: sabemos quién eres y no puedes.
  [CredencialesInvalidasError, HttpStatus.UNAUTHORIZED],
  [UsuarioInactivoError, HttpStatus.FORBIDDEN],
  [PermisoDenegadoError, HttpStatus.FORBIDDEN],
  [DatosUsuarioInvalidosError, HttpStatus.BAD_REQUEST],
  [DocumentoDuplicadoError, HttpStatus.CONFLICT],
  [UsuarioNoEncontradoError, HttpStatus.NOT_FOUND],

  // --- Catálogo de productos ---
  [DatosProductoInvalidosError, HttpStatus.BAD_REQUEST],
  [CodigoProductoDuplicadoError, HttpStatus.CONFLICT],
  [ProductoNoEncontradoError, HttpStatus.NOT_FOUND],

  // --- Grupos ---
  [DatosGrupoInvalidosError, HttpStatus.BAD_REQUEST],
  [CodigoGrupoDuplicadoError, HttpStatus.CONFLICT],
  [GrupoNoEncontradoError, HttpStatus.NOT_FOUND],

  // --- MFR ---
  [DatosMfrInvalidosError, HttpStatus.BAD_REQUEST],
  [MotivoObligatorioError, HttpStatus.BAD_REQUEST],
  [DppNoReconocidoError, HttpStatus.BAD_REQUEST],
  [FaltanteSinMotivoError, HttpStatus.BAD_REQUEST],
  [TurnoCerradoError, HttpStatus.CONFLICT],
  [BloquesSolapadosError, HttpStatus.CONFLICT],
  // Trazabilidad del personal: los datos están bien, pero contradicen la asistencia.
  [AsignacionSinAsistenciaError, HttpStatus.CONFLICT],
  [AsignacionExcedeAsistenciaError, HttpStatus.CONFLICT],
  [AsistenciaMenorQueAsignadasError, HttpStatus.CONFLICT],
  [DiaConProgramacionError, HttpStatus.CONFLICT],
  [CodigoLineaDuplicadoError, HttpStatus.CONFLICT],
  [BloqueNoEncontradoError, HttpStatus.NOT_FOUND],
  [AsignacionNoEncontradaError, HttpStatus.NOT_FOUND],
  [LineaNoEncontradaError, HttpStatus.NOT_FOUND],
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
      // Algunos errores traen datos para que el cliente actúe (p. ej. los
      // faltantes al cerrar un turno). Se exponen solo si el error los define.
      ...('faltantes' in error ? { faltantes: (error as { faltantes: unknown }).faltantes } : {}),
    });
  }

  private aEstadoHttp(error: ErrorDominio): HttpStatus {
    const fila = TRADUCCION.find(([Tipo]) => error instanceof Tipo);
    return fila ? fila[1] : HttpStatus.BAD_REQUEST;
  }
}
