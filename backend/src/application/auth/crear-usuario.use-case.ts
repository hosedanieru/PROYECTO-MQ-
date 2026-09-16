/**
 * CASO DE USO: CREAR USUARIO
 * ==========================
 *
 * Solo lo ejecuta un administrador. Esa comprobación NO está aquí: la
 * hace el guard de permisos en la capa HTTP (`admin.usuarios`), igual
 * que ocurre con los endpoints de remisiones. El caso de uso recibe
 * quién lo ejecuta únicamente para dejarlo en la auditoría.
 *
 * Secuencia:
 *   1. Valida la contraseña en claro (regla de dominio).
 *   2. Hashea.
 *   3. Construye la entidad (valida el resto de los datos).
 *   4. Dentro de la unidad de trabajo: verifica que el documento no
 *      exista, guarda y audita.
 */

import {
  validarContrasenaNueva,
  type HashContrasena,
} from '../../domain/usuario/contrasena.js';
import { Usuario } from '../../domain/usuario/usuario.entity.js';
import { DocumentoDuplicadoError } from '../../domain/usuario/usuario.errors.js';
import type { UnidadDeTrabajo } from '../../domain/shared/unidad-de-trabajo.js';

export interface CrearUsuarioComando {
  documento: string;
  nombre: string;
  email?: string | null;
  contrasena: string;
  rolId: string;
  /** Administrador que ejecuta la acción; va a la auditoría. */
  creadoPorId: string;
}

export class CrearUsuarioUseCase {
  constructor(
    private readonly uow: UnidadDeTrabajo,
    private readonly hash: HashContrasena,
  ) {}

  async ejecutar(comando: CrearUsuarioComando): Promise<Usuario> {
    validarContrasenaNueva(comando.contrasena);
    const passwordHash = await this.hash.hashear(comando.contrasena);

    const nuevo = Usuario.crear({
      documento: comando.documento,
      nombre: comando.nombre,
      email: comando.email,
      passwordHash,
      rolId: comando.rolId,
    });

    return this.uow.ejecutar(async ({ usuarios, auditoria }) => {
      const existente = await usuarios.buscarPorDocumento(nuevo.documento);
      if (existente) {
        throw new DocumentoDuplicadoError(nuevo.documento);
      }

      const guardado = await usuarios.crear(nuevo);

      await auditoria.registrar({
        entidad: 'usuario',
        entidadId: guardado.id,
        accion: 'CREAR',
        // El perfil, no el estado completo: el hash jamás va a la auditoría.
        valorNuevo: guardado.aPerfil(),
        usuarioId: comando.creadoPorId,
      });

      return guardado;
    });
  }
}
