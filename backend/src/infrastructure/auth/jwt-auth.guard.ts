/**
 * GUARD DE AUTENTICACIÓN
 * ======================
 *
 * Se registra como guard GLOBAL: toda ruta exige token salvo que esté
 * marcada con `@Publico()`. "Protegido por defecto" evita el error más
 * común, que es olvidar proteger una ruta nueva.
 *
 * Por cada petición:
 *   1. Lee `Authorization: Bearer <token>`.
 *   2. Verifica firma y vigencia (vía el puerto `EmisorDeToken`).
 *   3. Carga el usuario desde la base de datos, con sus permisos.
 *   4. Comprueba que siga activo.
 *   5. Lo adjunta a la petición para `@UsuarioActual()` y `PermisosGuard`.
 *
 * El paso 3 es deliberado: los permisos NO se leen del token sino de la
 * base. Si a alguien le cambian el rol o lo desactivan, aplica en la
 * siguiente petición, no cuando el token expire 12 horas después.
 */

import {
  type CanActivate,
  type ExecutionContext,
  Inject,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';

import {
  EMISOR_DE_TOKEN,
  type EmisorDeToken,
} from '../../domain/usuario/emisor-token.js';
import {
  USUARIO_REPOSITORY,
  type UsuarioRepository,
} from '../../domain/usuario/usuario.repository.js';
import { CLAVE_PUBLICO, type RequestAutenticada } from './decoradores.js';

@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    @Inject(EMISOR_DE_TOKEN) private readonly tokens: EmisorDeToken,
    @Inject(USUARIO_REPOSITORY) private readonly usuarios: UsuarioRepository,
  ) {}

  async canActivate(contexto: ExecutionContext): Promise<boolean> {
    // getAllAndOverride: el decorador en el método manda sobre el de la clase.
    const esPublica = this.reflector.getAllAndOverride<boolean>(CLAVE_PUBLICO, [
      contexto.getHandler(),
      contexto.getClass(),
    ]);
    if (esPublica) {
      return true;
    }

    const peticion = contexto.switchToHttp().getRequest<RequestAutenticada>();
    const token = this.extraerToken(peticion);
    if (!token) {
      throw new UnauthorizedException('Falta el token de autenticación.');
    }

    const contenido = await this.tokens.verificar(token);
    if (!contenido) {
      throw new UnauthorizedException('Token inválido o expirado.');
    }

    const usuario = await this.usuarios.buscarPorId(contenido.usuarioId);
    if (!usuario || !usuario.activo) {
      throw new UnauthorizedException('El usuario ya no tiene acceso.');
    }

    peticion.usuario = usuario;
    return true;
  }

  private extraerToken(peticion: RequestAutenticada): string | null {
    const cabecera = peticion.headers.authorization;
    if (!cabecera) {
      return null;
    }
    const [tipo, token] = cabecera.split(' ');
    return tipo === 'Bearer' && token ? token : null;
  }
}
