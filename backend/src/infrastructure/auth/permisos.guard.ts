/**
 * GUARD DE PERMISOS
 * =================
 *
 * Corre DESPUÉS de `JwtAuthGuard` (NestJS ejecuta los guards globales en
 * el orden en que se registran). Lee los permisos que exige la ruta con
 * `@RequierePermisos(...)` y los compara contra los del usuario.
 *
 * Si la ruta no declara permisos, basta con estar autenticado.
 *
 * Lanza un error de DOMINIO (`PermisoDenegadoError`), no una excepción
 * de NestJS: la regla "sin permiso no se puede" es de negocio, y así el
 * filtro la traduce a 403 igual que a cualquier otro error de dominio.
 */

import {
  type CanActivate,
  type ExecutionContext,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';

import { PermisoDenegadoError } from '../../domain/usuario/usuario.errors.js';
import { CLAVE_PERMISOS, type RequestAutenticada } from './decoradores.js';

@Injectable()
export class PermisosGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(contexto: ExecutionContext): boolean {
    const requeridos = this.reflector.getAllAndOverride<string[] | undefined>(
      CLAVE_PERMISOS,
      [contexto.getHandler(), contexto.getClass()],
    );
    if (!requeridos || requeridos.length === 0) {
      return true;
    }

    const { usuario } = contexto
      .switchToHttp()
      .getRequest<RequestAutenticada>();

    // Ruta pública con @RequierePermisos sería un error de programación;
    // sin usuario no hay contra qué comparar.
    if (!usuario) {
      throw new PermisoDenegadoError(requeridos[0]);
    }

    const faltante = requeridos.find((p) => !usuario.tienePermiso(p));
    if (faltante) {
      throw new PermisoDenegadoError(faltante);
    }

    return true;
  }
}
