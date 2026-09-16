/**
 * DECORADORES DE AUTENTICACIÓN
 * ============================
 *
 * Tres decoradores que se usan en los controladores:
 *
 *   @Publico()                       la ruta no exige token
 *   @RequierePermisos('remision.crear')   exige uno o más permisos
 *   @UsuarioActual()                 inyecta el usuario autenticado
 *
 * Los dos primeros solo "etiquetan" la ruta con metadatos; quienes los
 * leen y actúan son los guards (`JwtAuthGuard`, `PermisosGuard`).
 */

import {
  createParamDecorator,
  type ExecutionContext,
  SetMetadata,
} from '@nestjs/common';
import type { Request } from 'express';

import type { Usuario } from '../../domain/usuario/usuario.entity.js';

export const CLAVE_PUBLICO = 'auth:publico';
export const CLAVE_PERMISOS = 'auth:permisos';

/** Marca una ruta como accesible sin token (p. ej. el login). */
export const Publico = () => SetMetadata(CLAVE_PUBLICO, true);

/** Exige que el usuario tenga TODOS los permisos indicados. */
export const RequierePermisos = (...permisos: string[]) =>
  SetMetadata(CLAVE_PERMISOS, permisos);

/** Petición de Express con el usuario que adjuntó `JwtAuthGuard`. */
export interface RequestAutenticada extends Request {
  usuario?: Usuario;
}

/**
 * Inyecta el `Usuario` autenticado como parámetro del handler.
 * Solo tiene sentido en rutas protegidas; en una `@Publico()` sería
 * `undefined`.
 */
export const UsuarioActual = createParamDecorator(
  (_datos: unknown, contexto: ExecutionContext): Usuario => {
    const peticion = contexto.switchToHttp().getRequest<RequestAutenticada>();
    if (!peticion.usuario) {
      throw new Error(
        '@UsuarioActual() se usó en una ruta sin JwtAuthGuard o marcada @Publico().',
      );
    }
    return peticion.usuario;
  },
);
