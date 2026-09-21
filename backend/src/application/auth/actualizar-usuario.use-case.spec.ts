import { beforeEach, describe, expect, it } from 'vitest';

import { Usuario } from '../../domain/usuario/usuario.entity.js';
import {
  DatosUsuarioInvalidosError,
  UsuarioNoEncontradoError,
} from '../../domain/usuario/usuario.errors.js';
import {
  AuditoriaRepositorioFalso,
  HashFalso,
  ProductoRepositorioFalso,
  REMISIONES_SIN_USO,
  UnidadDeTrabajoFalsa,
  UsuarioRepositorioFalso,
} from '../pruebas/dobles-en-memoria.js';
import { ActualizarUsuarioUseCase } from './actualizar-usuario.use-case.js';

const ADMIN_ID = 'user-admin';

function usuario(id: string, rolId = 'rol-coord'): Usuario {
  return Usuario.desdePersistencia({
    id,
    documento: `doc-${id}`,
    nombre: 'Ana',
    email: null,
    passwordHash: 'hash(vieja1234)',
    activo: true,
    rolId,
    rolCodigo: '',
    permisos: [],
  });
}

describe('ActualizarUsuarioUseCase', () => {
  let usuarios: UsuarioRepositorioFalso;
  let auditoria: AuditoriaRepositorioFalso;
  let useCase: ActualizarUsuarioUseCase;

  beforeEach(() => {
    usuarios = new UsuarioRepositorioFalso();
    usuarios.permisosPorRol.set('rol-coord', {
      codigo: 'COORDINADOR_MQ',
      permisos: ['remision.crear'],
    });
    usuarios.permisosPorRol.set('rol-pat', {
      codigo: 'PATINADOR',
      permisos: ['remision.entregar'],
    });
    usuarios.agregar(usuario(ADMIN_ID));
    usuarios.agregar(usuario('user-1'));
    auditoria = new AuditoriaRepositorioFalso();

    useCase = new ActualizarUsuarioUseCase(
      new UnidadDeTrabajoFalsa({
        remisiones: REMISIONES_SIN_USO,
        usuarios,
        productos: new ProductoRepositorioFalso(),
        auditoria,
      }),
      new HashFalso(),
    );
  });

  it('cambia el rol y los permisos se re-resuelven', async () => {
    const actualizado = await useCase.ejecutar({
      usuarioId: 'user-1',
      cambios: { rolId: 'rol-pat' },
      ejecutadoPorId: ADMIN_ID,
    });

    expect(actualizado.rolCodigo).toBe('PATINADOR');
    expect(actualizado.tienePermiso('remision.entregar')).toBe(true);
    expect(actualizado.tienePermiso('remision.crear')).toBe(false);
  });

  it('desactiva a otro usuario', async () => {
    const actualizado = await useCase.ejecutar({
      usuarioId: 'user-1',
      cambios: { activo: false },
      ejecutadoPorId: ADMIN_ID,
    });

    expect(actualizado.activo).toBe(false);
  });

  it('no permite que el administrador se desactive a sí mismo', async () => {
    await expect(
      useCase.ejecutar({
        usuarioId: ADMIN_ID,
        cambios: { activo: false },
        ejecutadoPorId: ADMIN_ID,
      }),
    ).rejects.toThrow(DatosUsuarioInvalidosError);
  });

  it('restablece la contraseña pasando por el hash', async () => {
    const actualizado = await useCase.ejecutar({
      usuarioId: 'user-1',
      cambios: { contrasena: 'nueva12345' },
      ejecutadoPorId: ADMIN_ID,
    });

    expect(actualizado.passwordHash).toBe('hash(nueva12345)');
  });

  it('rechaza contraseñas cortas', async () => {
    await expect(
      useCase.ejecutar({
        usuarioId: 'user-1',
        cambios: { contrasena: 'corta' },
        ejecutadoPorId: ADMIN_ID,
      }),
    ).rejects.toThrow(DatosUsuarioInvalidosError);
  });

  it('audita sin el hash y deja constancia del cambio de clave', async () => {
    await useCase.ejecutar({
      usuarioId: 'user-1',
      cambios: { nombre: 'Ana María', contrasena: 'nueva12345' },
      ejecutadoPorId: ADMIN_ID,
    });

    const entrada = auditoria.entradas[0];
    expect(entrada).toMatchObject({
      entidad: 'usuario',
      accion: 'ACTUALIZAR',
      usuarioId: ADMIN_ID,
      valorAnterior: { nombre: 'Ana' },
      valorNuevo: { nombre: 'Ana María', contrasenaRestablecida: true },
    });
    expect(JSON.stringify(entrada)).not.toContain('hash(');
  });

  it('borra el correo con null y lo valida si viene', async () => {
    const conCorreo = await useCase.ejecutar({
      usuarioId: 'user-1',
      cambios: { email: 'Ana@Inlotrans.com' },
      ejecutadoPorId: ADMIN_ID,
    });
    expect(conCorreo.aPerfil().email).toBe('ana@inlotrans.com');

    const sinCorreo = await useCase.ejecutar({
      usuarioId: 'user-1',
      cambios: { email: null },
      ejecutadoPorId: ADMIN_ID,
    });
    expect(sinCorreo.aPerfil().email).toBeNull();

    await expect(
      useCase.ejecutar({
        usuarioId: 'user-1',
        cambios: { email: 'no-es-correo' },
        ejecutadoPorId: ADMIN_ID,
      }),
    ).rejects.toThrow(DatosUsuarioInvalidosError);
  });

  it('falla si el usuario no existe', async () => {
    await expect(
      useCase.ejecutar({
        usuarioId: 'nadie',
        cambios: { nombre: 'X' },
        ejecutadoPorId: ADMIN_ID,
      }),
    ).rejects.toThrow(UsuarioNoEncontradoError);
  });
});
