/**
 * CASO DE USO: INICIAR SESIÓN
 * ===========================
 *
 * Secuencia:
 *   1. Busca el usuario por documento.
 *   2. Verifica la contraseña contra el hash.
 *   3. Comprueba que el usuario esté activo.
 *   4. Emite el token.
 *
 * Detalle importante en el orden: la contraseña se verifica ANTES de
 * mirar si el usuario está activo. Si se hiciera al revés, alguien que
 * no conoce la contraseña podría averiguar qué usuarios están inactivos.
 *
 * Es una lectura: no pasa por la unidad de trabajo ni deja auditoría.
 * PENDIENTE DE DEFINIR con el área si los inicios de sesión (exitosos o
 * fallidos) deben quedar registrados.
 */

import type { HashContrasena } from '../../domain/usuario/contrasena.js';
import type { EmisorDeToken } from '../../domain/usuario/emisor-token.js';
import type { PerfilUsuario } from '../../domain/usuario/usuario.entity.js';
import {
  CredencialesInvalidasError,
  UsuarioInactivoError,
} from '../../domain/usuario/usuario.errors.js';
import type { UsuarioRepository } from '../../domain/usuario/usuario.repository.js';

export interface IniciarSesionComando {
  documento: string;
  contrasena: string;
}

export interface SesionIniciada {
  token: string;
  usuario: PerfilUsuario;
}

export class IniciarSesionUseCase {
  constructor(
    private readonly usuarios: UsuarioRepository,
    private readonly hash: HashContrasena,
    private readonly tokens: EmisorDeToken,
  ) {}

  async ejecutar(comando: IniciarSesionComando): Promise<SesionIniciada> {
    const usuario = await this.usuarios.buscarPorDocumento(
      comando.documento.trim(),
    );

    if (!usuario) {
      throw new CredencialesInvalidasError();
    }

    const coincide = await this.hash.verificar(
      comando.contrasena,
      usuario.passwordHash,
    );
    if (!coincide) {
      throw new CredencialesInvalidasError();
    }

    if (!usuario.activo) {
      throw new UsuarioInactivoError();
    }

    const token = await this.tokens.emitir({
      usuarioId: usuario.id,
      documento: usuario.documento,
    });

    return { token, usuario: usuario.aPerfil() };
  }
}
