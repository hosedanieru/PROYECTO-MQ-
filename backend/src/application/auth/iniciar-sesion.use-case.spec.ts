import { beforeEach, describe, expect, it } from 'vitest';

import { Usuario } from '../../domain/usuario/usuario.entity.js';
import {
  CredencialesInvalidasError,
  UsuarioInactivoError,
} from '../../domain/usuario/usuario.errors.js';
import {
  EmisorTokenFalso,
  HashFalso,
  UsuarioRepositorioFalso,
} from '../pruebas/dobles-en-memoria.js';
import { IniciarSesionUseCase } from './iniciar-sesion.use-case.js';

function usuario(sobrescribir: { activo?: boolean } = {}): Usuario {
  return Usuario.desdePersistencia({
    id: 'user-1',
    documento: '1020304050',
    nombre: 'Ana Coordinadora',
    email: null,
    passwordHash: 'hash(secreta123)',
    activo: sobrescribir.activo ?? true,
    rolId: 'rol-coord',
    rolCodigo: 'COORDINADOR_MQ',
    permisos: ['remision.crear', 'remision.consultar'],
  });
}

describe('IniciarSesionUseCase', () => {
  let usuarios: UsuarioRepositorioFalso;
  let tokens: EmisorTokenFalso;
  let useCase: IniciarSesionUseCase;

  beforeEach(() => {
    usuarios = new UsuarioRepositorioFalso();
    tokens = new EmisorTokenFalso();
    useCase = new IniciarSesionUseCase(usuarios, new HashFalso(), tokens);
  });

  it('devuelve token y perfil con credenciales correctas', async () => {
    usuarios.agregar(usuario());

    const sesion = await useCase.ejecutar({
      documento: '1020304050',
      contrasena: 'secreta123',
    });

    expect(sesion.token).toBe('token-user-1');
    expect(sesion.usuario).toMatchObject({
      id: 'user-1',
      documento: '1020304050',
      rolCodigo: 'COORDINADOR_MQ',
      permisos: ['remision.crear', 'remision.consultar'],
    });
  });

  it('el perfil devuelto no incluye el hash de la contraseña', async () => {
    usuarios.agregar(usuario());

    const sesion = await useCase.ejecutar({
      documento: '1020304050',
      contrasena: 'secreta123',
    });

    expect(sesion.usuario).not.toHaveProperty('passwordHash');
  });

  it('el token solo lleva la identidad, no los permisos', async () => {
    usuarios.agregar(usuario());

    await useCase.ejecutar({ documento: '1020304050', contrasena: 'secreta123' });

    expect(tokens.emitidos).toEqual([
      { usuarioId: 'user-1', documento: '1020304050' },
    ]);
  });

  it('tolera espacios alrededor del documento', async () => {
    usuarios.agregar(usuario());

    await expect(
      useCase.ejecutar({ documento: '  1020304050 ', contrasena: 'secreta123' }),
    ).resolves.toBeDefined();
  });

  describe('rechazos', () => {
    it('falla si el documento no existe', async () => {
      await expect(
        useCase.ejecutar({ documento: '999', contrasena: 'secreta123' }),
      ).rejects.toThrow(CredencialesInvalidasError);
    });

    it('falla si la contraseña es incorrecta', async () => {
      usuarios.agregar(usuario());

      await expect(
        useCase.ejecutar({ documento: '1020304050', contrasena: 'otra' }),
      ).rejects.toThrow(CredencialesInvalidasError);
    });

    it('usa el mismo error para documento inexistente y contraseña mala', async () => {
      usuarios.agregar(usuario());

      const sinDocumento = useCase
        .ejecutar({ documento: '999', contrasena: 'x' })
        .catch((e: Error) => e.message);
      const sinContrasena = useCase
        .ejecutar({ documento: '1020304050', contrasena: 'x' })
        .catch((e: Error) => e.message);

      expect(await sinDocumento).toBe(await sinContrasena);
    });

    it('falla si el usuario está inactivo aunque la contraseña sea correcta', async () => {
      usuarios.agregar(usuario({ activo: false }));

      await expect(
        useCase.ejecutar({ documento: '1020304050', contrasena: 'secreta123' }),
      ).rejects.toThrow(UsuarioInactivoError);
    });

    it('no revela que un usuario está inactivo si la contraseña es incorrecta', async () => {
      usuarios.agregar(usuario({ activo: false }));

      await expect(
        useCase.ejecutar({ documento: '1020304050', contrasena: 'mala' }),
      ).rejects.toThrow(CredencialesInvalidasError);
    });

    it('no emite token cuando falla', async () => {
      usuarios.agregar(usuario({ activo: false }));

      await useCase
        .ejecutar({ documento: '1020304050', contrasena: 'secreta123' })
        .catch(() => undefined);

      expect(tokens.emitidos).toHaveLength(0);
    });
  });
});
