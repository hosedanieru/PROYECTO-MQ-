import { beforeEach, describe, expect, it } from 'vitest';

import { Usuario } from '../../domain/usuario/usuario.entity.js';
import {
  DatosUsuarioInvalidosError,
  DocumentoDuplicadoError,
} from '../../domain/usuario/usuario.errors.js';
import {
  AuditoriaRepositorioFalso,
  HashFalso,
  REMISIONES_SIN_USO,
  UnidadDeTrabajoFalsa,
  UsuarioRepositorioFalso,
} from '../pruebas/dobles-en-memoria.js';
import {
  CrearUsuarioUseCase,
  type CrearUsuarioComando,
} from './crear-usuario.use-case.js';

function comando(
  sobrescribir: Partial<CrearUsuarioComando> = {},
): CrearUsuarioComando {
  return {
    documento: '1020304050',
    nombre: 'Ana Coordinadora',
    email: 'Ana@Inlotrans.com',
    contrasena: 'secreta123',
    rolId: 'rol-coord',
    creadoPorId: 'user-admin',
    ...sobrescribir,
  };
}

describe('CrearUsuarioUseCase', () => {
  let usuarios: UsuarioRepositorioFalso;
  let auditoria: AuditoriaRepositorioFalso;
  let useCase: CrearUsuarioUseCase;

  beforeEach(() => {
    usuarios = new UsuarioRepositorioFalso();
    usuarios.permisosPorRol.set('rol-coord', {
      codigo: 'COORDINADOR_MQ',
      permisos: ['remision.crear'],
    });
    auditoria = new AuditoriaRepositorioFalso();

    useCase = new CrearUsuarioUseCase(
      new UnidadDeTrabajoFalsa({
        remisiones: REMISIONES_SIN_USO,
        usuarios,
        auditoria,
      }),
      new HashFalso(),
    );
  });

  it('crea el usuario activo con los permisos de su rol', async () => {
    const creado = await useCase.ejecutar(comando());

    expect(creado.id).toBe('usuario-1');
    expect(creado.activo).toBe(true);
    expect(creado.rolCodigo).toBe('COORDINADOR_MQ');
    expect(creado.tienePermiso('remision.crear')).toBe(true);
    expect(creado.tienePermiso('admin.usuarios')).toBe(false);
  });

  it('pasa la contraseña por el hash antes de guardar', async () => {
    const creado = await useCase.ejecutar(comando());

    // HashFalso es legible a propósito: así se ve que sí pasó por él.
    expect(creado.passwordHash).toBe('hash(secreta123)');
  });

  it('normaliza el correo a minúsculas', async () => {
    const creado = await useCase.ejecutar(comando());

    expect(creado.aPerfil().email).toBe('ana@inlotrans.com');
  });

  it('audita la creación sin incluir el hash', async () => {
    const creado = await useCase.ejecutar(comando());

    expect(auditoria.entradas).toHaveLength(1);
    expect(auditoria.entradas[0]).toMatchObject({
      entidad: 'usuario',
      entidadId: creado.id,
      accion: 'CREAR',
      usuarioId: 'user-admin',
    });
    expect(auditoria.entradas[0].valorNuevo).not.toHaveProperty('passwordHash');
  });

  describe('validaciones', () => {
    it('rechaza contraseñas de menos de 8 caracteres', async () => {
      await expect(
        useCase.ejecutar(comando({ contrasena: 'corta1' })),
      ).rejects.toThrow(DatosUsuarioInvalidosError);
    });

    it('rechaza un documento vacío', async () => {
      await expect(
        useCase.ejecutar(comando({ documento: '   ' })),
      ).rejects.toThrow(DatosUsuarioInvalidosError);
    });

    it('rechaza un correo mal formado', async () => {
      await expect(
        useCase.ejecutar(comando({ email: 'no-es-correo' })),
      ).rejects.toThrow(DatosUsuarioInvalidosError);
    });

    it('acepta usuario sin correo', async () => {
      const creado = await useCase.ejecutar(comando({ email: null }));

      expect(creado.aPerfil().email).toBeNull();
    });

    it('rechaza un documento ya registrado', async () => {
      usuarios.agregar(
        Usuario.desdePersistencia({
          id: 'user-0',
          documento: '1020304050',
          nombre: 'Otro',
          email: null,
          passwordHash: 'hash(x)',
          activo: true,
          rolId: 'rol-coord',
          rolCodigo: 'COORDINADOR_MQ',
          permisos: [],
        }),
      );

      await expect(useCase.ejecutar(comando())).rejects.toThrow(
        DocumentoDuplicadoError,
      );
    });

    it('no guarda ni audita nada cuando la validación falla', async () => {
      await useCase
        .ejecutar(comando({ contrasena: 'corta' }))
        .catch(() => undefined);

      expect(usuarios.guardados).toHaveLength(0);
      expect(auditoria.entradas).toHaveLength(0);
    });
  });
});
