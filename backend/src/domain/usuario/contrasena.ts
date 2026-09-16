/**
 * CONTRASEÑAS
 * ===========
 *
 * Dos cosas viven aquí:
 *
 *  1. La regla de negocio sobre cómo debe ser una contraseña nueva.
 *  2. El puerto `HashContrasena`, que abstrae el algoritmo de hash. El
 *     dominio no sabe si por debajo es bcrypt, argon2 u otro; solo sabe
 *     que puede hashear y verificar.
 *
 * PENDIENTE DE DEFINIR con el área: complejidad (mayúsculas, números),
 * rotación periódica y bloqueo por intentos fallidos. Hasta entonces se
 * aplica únicamente la longitud mínima.
 */

import { DatosUsuarioInvalidosError } from './usuario.errors.js';

export const LONGITUD_MINIMA_CONTRASENA = 8;

/** Valida una contraseña en claro antes de hashearla. */
export function validarContrasenaNueva(contrasena: string): void {
  if (typeof contrasena !== 'string' || contrasena.length < LONGITUD_MINIMA_CONTRASENA) {
    throw new DatosUsuarioInvalidosError(
      `La contraseña debe tener al menos ${LONGITUD_MINIMA_CONTRASENA} caracteres.`,
    );
  }
}

export interface HashContrasena {
  hashear(contrasena: string): Promise<string>;
  verificar(contrasena: string, hash: string): Promise<boolean>;
}

export const HASH_CONTRASENA = Symbol('HashContrasena');
