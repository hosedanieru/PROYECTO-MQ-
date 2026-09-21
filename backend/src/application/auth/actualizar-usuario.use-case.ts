/**
 * CASO DE USO: ACTUALIZAR USUARIO
 * ===============================
 *
 * El administrador edita nombre, correo, rol, estado activo y, si hace
 * falta, restablece la contraseña. Todo en una unidad de trabajo con
 * auditoría (sin el hash en los valores registrados).
 *
 * Regla: un administrador no puede desactivarse a sí mismo. Si lo
 * hiciera por error, nadie podría volver a entrar a administrar.
 */

import {
  validarContrasenaNueva,
  type HashContrasena,
} from '../../domain/usuario/contrasena.js';
import type { Usuario } from '../../domain/usuario/usuario.entity.js';
import {
  DatosUsuarioInvalidosError,
  UsuarioNoEncontradoError,
} from '../../domain/usuario/usuario.errors.js';
import type { UnidadDeTrabajo } from '../../domain/shared/unidad-de-trabajo.js';

export interface ActualizarUsuarioComando {
  usuarioId: string;
  cambios: {
    nombre?: string;
    email?: string | null;
    rolId?: string;
    activo?: boolean;
    contrasena?: string;
  };
  /** Administrador que ejecuta la acción. */
  ejecutadoPorId: string;
}

export class ActualizarUsuarioUseCase {
  constructor(
    private readonly uow: UnidadDeTrabajo,
    private readonly hash: HashContrasena,
  ) {}

  async ejecutar(comando: ActualizarUsuarioComando): Promise<Usuario> {
    const { cambios } = comando;

    if (cambios.activo === false && comando.usuarioId === comando.ejecutadoPorId) {
      throw new DatosUsuarioInvalidosError(
        'No puede desactivar su propio usuario.',
      );
    }

    // El hash se calcula fuera de la transacción: bcrypt tarda ~100 ms y
    // no tiene sentido mantener la conexión ocupada mientras tanto.
    let nuevoHash: string | undefined;
    if (cambios.contrasena !== undefined) {
      validarContrasenaNueva(cambios.contrasena);
      nuevoHash = await this.hash.hashear(cambios.contrasena);
    }

    return this.uow.ejecutar(async ({ usuarios, auditoria }) => {
      const usuario = await usuarios.buscarPorId(comando.usuarioId);
      if (!usuario) {
        throw new UsuarioNoEncontradoError(
          `No existe el usuario "${comando.usuarioId}".`,
        );
      }

      const anterior = usuario.aPerfil();

      usuario.actualizarDatos({
        nombre: cambios.nombre,
        email: cambios.email,
        rolId: cambios.rolId,
      });
      if (cambios.activo !== undefined) {
        usuario.cambiarActivo(cambios.activo);
      }
      if (nuevoHash) {
        usuario.cambiarContrasena(nuevoHash);
      }

      const guardado = await usuarios.actualizar(usuario);

      await auditoria.registrar({
        entidad: 'usuario',
        entidadId: guardado.id,
        accion: 'ACTUALIZAR',
        valorAnterior: anterior,
        valorNuevo: {
          ...guardado.aPerfil(),
          // Se deja constancia de que hubo cambio de clave, sin el valor.
          ...(nuevoHash ? { contrasenaRestablecida: true } : {}),
        },
        usuarioId: comando.ejecutadoPorId,
      });

      return guardado;
    });
  }
}
