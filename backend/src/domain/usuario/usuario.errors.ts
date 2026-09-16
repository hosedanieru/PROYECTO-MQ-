/**
 * Errores del dominio de Usuario y autenticación.
 *
 * Igual que los de remisión: describen la regla violada, no la respuesta
 * HTTP. El filtro de presentación decide el código de estado.
 */

import { ErrorDominio } from '../shared/errores.js';

/** Base de los errores de negocio de usuarios y sesión. */
export abstract class ErrorUsuario extends ErrorDominio {}

/**
 * Documento o contraseña incorrectos.
 *
 * A propósito NO distingue cuál de los dos falló: decir "el documento no
 * existe" le confirmaría a un atacante qué documentos son válidos.
 */
export class CredencialesInvalidasError extends ErrorUsuario {
  readonly codigo = 'AUTH_CREDENCIALES_INVALIDAS';

  constructor() {
    super('Documento o contraseña incorrectos.');
  }
}

/** El usuario existe pero fue desactivado; no puede iniciar sesión. */
export class UsuarioInactivoError extends ErrorUsuario {
  readonly codigo = 'AUTH_USUARIO_INACTIVO';

  constructor() {
    super('El usuario está inactivo. Contacte al administrador.');
  }
}

/** El usuario está autenticado pero no tiene el permiso requerido. */
export class PermisoDenegadoError extends ErrorUsuario {
  readonly codigo = 'AUTH_PERMISO_DENEGADO';

  constructor(readonly permiso: string) {
    super(`No tiene el permiso "${permiso}" para realizar esta acción.`);
  }
}

/** Un dato obligatorio del usuario falta o es inválido. */
export class DatosUsuarioInvalidosError extends ErrorUsuario {
  readonly codigo = 'USUARIO_DATOS_INVALIDOS';
}

/** Ya existe un usuario con ese documento. */
export class DocumentoDuplicadoError extends ErrorUsuario {
  readonly codigo = 'USUARIO_DOCUMENTO_DUPLICADO';

  constructor(readonly documento: string) {
    super(`Ya existe un usuario con el documento "${documento}".`);
  }
}

/** El usuario solicitado no existe. */
export class UsuarioNoEncontradoError extends ErrorUsuario {
  readonly codigo = 'USUARIO_NO_ENCONTRADO';
}
