import { UnauthorizedException, type ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { beforeEach, describe, expect, it } from 'vitest';

import {
  EmisorTokenFalso,
  UsuarioRepositorioFalso,
} from '../../application/pruebas/dobles-en-memoria.js';
import { Usuario } from '../../domain/usuario/usuario.entity.js';
import { PermisoDenegadoError } from '../../domain/usuario/usuario.errors.js';
import {
  Publico,
  RequierePermisos,
  type RequestAutenticada,
} from './decoradores.js';
import { JwtAuthGuard } from './jwt-auth.guard.js';
import { PermisosGuard } from './permisos.guard.js';

// ============================================================
// AYUDANTES
// ============================================================

function usuario(sobrescribir: Partial<{ activo: boolean; permisos: string[] }> = {}) {
  return Usuario.desdePersistencia({
    id: 'user-1',
    documento: '1020304050',
    nombre: 'Ana',
    email: null,
    passwordHash: 'hash(x)',
    activo: sobrescribir.activo ?? true,
    rolId: 'rol-coord',
    rolCodigo: 'COORDINADOR_MQ',
    permisos: sobrescribir.permisos ?? ['remision.crear'],
  });
}

/**
 * Simula lo mínimo que los guards leen de un `ExecutionContext`: el
 * handler y la clase (para los metadatos) y la petición HTTP.
 */
function contexto(
  peticion: Partial<RequestAutenticada>,
  handler: (...args: unknown[]) => unknown = () => undefined,
): ExecutionContext {
  class ControladorFalso {}
  return {
    getHandler: () => handler,
    getClass: () => ControladorFalso,
    switchToHttp: () => ({ getRequest: () => peticion }),
  } as unknown as ExecutionContext;
}

/** Aplica un decorador de método a una función suelta. */
function conDecorador(decorador: MethodDecorator): () => void {
  const handler = () => undefined;
  decorador({}, 'handler', { value: handler });
  return handler;
}

// ============================================================
// JwtAuthGuard
// ============================================================

describe('JwtAuthGuard', () => {
  let usuarios: UsuarioRepositorioFalso;
  let tokens: EmisorTokenFalso;
  let guard: JwtAuthGuard;

  beforeEach(() => {
    usuarios = new UsuarioRepositorioFalso();
    tokens = new EmisorTokenFalso();
    guard = new JwtAuthGuard(new Reflector(), tokens, usuarios);
  });

  it('deja pasar rutas marcadas @Publico() sin token', async () => {
    const ctx = contexto({ headers: {} }, conDecorador(Publico()));

    await expect(guard.canActivate(ctx)).resolves.toBe(true);
  });

  it('rechaza sin cabecera Authorization', async () => {
    await expect(guard.canActivate(contexto({ headers: {} }))).rejects.toThrow(
      UnauthorizedException,
    );
  });

  it('rechaza un esquema distinto de Bearer', async () => {
    const ctx = contexto({ headers: { authorization: 'Basic abc' } });

    await expect(guard.canActivate(ctx)).rejects.toThrow(UnauthorizedException);
  });

  it('rechaza un token que el emisor no reconoce', async () => {
    const ctx = contexto({ headers: { authorization: 'Bearer falso' } });

    await expect(guard.canActivate(ctx)).rejects.toThrow(UnauthorizedException);
  });

  it('rechaza si el usuario del token ya no existe', async () => {
    await tokens.emitir({ usuarioId: 'user-1', documento: '1020304050' });
    const ctx = contexto({ headers: { authorization: 'Bearer token-user-1' } });

    await expect(guard.canActivate(ctx)).rejects.toThrow(UnauthorizedException);
  });

  it('rechaza si el usuario fue desactivado después de emitir el token', async () => {
    usuarios.agregar(usuario({ activo: false }));
    await tokens.emitir({ usuarioId: 'user-1', documento: '1020304050' });
    const ctx = contexto({ headers: { authorization: 'Bearer token-user-1' } });

    await expect(guard.canActivate(ctx)).rejects.toThrow(UnauthorizedException);
  });

  it('con token válido adjunta el usuario a la petición', async () => {
    usuarios.agregar(usuario());
    await tokens.emitir({ usuarioId: 'user-1', documento: '1020304050' });
    const peticion: Partial<RequestAutenticada> = {
      headers: { authorization: 'Bearer token-user-1' },
    };

    await expect(guard.canActivate(contexto(peticion))).resolves.toBe(true);
    expect(peticion.usuario?.id).toBe('user-1');
  });
});

// ============================================================
// PermisosGuard
// ============================================================

describe('PermisosGuard', () => {
  const guard = new PermisosGuard(new Reflector());

  it('deja pasar si la ruta no exige permisos', () => {
    expect(guard.canActivate(contexto({ usuario: usuario() }))).toBe(true);
  });

  it('deja pasar si el usuario tiene el permiso', () => {
    const ctx = contexto(
      { usuario: usuario() },
      conDecorador(RequierePermisos('remision.crear')),
    );

    expect(guard.canActivate(ctx)).toBe(true);
  });

  it('exige TODOS los permisos declarados', () => {
    const ctx = contexto(
      { usuario: usuario({ permisos: ['remision.crear'] }) },
      conDecorador(RequierePermisos('remision.crear', 'admin.usuarios')),
    );

    expect(() => guard.canActivate(ctx)).toThrow(PermisoDenegadoError);
  });

  it('el error indica cuál permiso falta', () => {
    const ctx = contexto(
      { usuario: usuario() },
      conDecorador(RequierePermisos('admin.usuarios')),
    );

    expect(() => guard.canActivate(ctx)).toThrow('"admin.usuarios"');
  });

  it('el administrador pasa aunque no tenga el permiso listado', () => {
    const admin = Usuario.desdePersistencia({
      ...usuario().aObjeto(),
      rolCodigo: 'ADMINISTRADOR',
      permisos: [],
    });
    const ctx = contexto(
      { usuario: admin },
      conDecorador(RequierePermisos('mfr.permiso_futuro', 'admin.auditoria')),
    );

    expect(guard.canActivate(ctx)).toBe(true);
  });

  it('rechaza si no hay usuario en la petición', () => {
    const ctx = contexto({}, conDecorador(RequierePermisos('remision.crear')));

    expect(() => guard.canActivate(ctx)).toThrow(PermisoDenegadoError);
  });
});
