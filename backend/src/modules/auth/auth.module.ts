/**
 * MÓDULO DE AUTENTICACIÓN
 * =======================
 *
 * Wiring de:
 *   - los puertos del dominio (`HashContrasena`, `EmisorDeToken`) con
 *     sus implementaciones (bcrypt, JWT),
 *   - los dos casos de uso,
 *   - y los guards GLOBALES: `JwtAuthGuard` primero (¿quién eres?),
 *     `PermisosGuard` después (¿puedes hacer esto?).
 *
 * `APP_GUARD` es el token de NestJS para registrar guards que aplican a
 * toda la aplicación. Se registran aquí, y no en `main.ts`, porque así
 * pueden recibir dependencias por inyección (el repositorio, el emisor).
 *
 * Configuración por variables de entorno (ver `.env.example`):
 *   JWT_SECRET       obligatorio; sin él la app no arranca
 *   JWT_EXPIRES_IN   opcional; por defecto 12h (cubre el turno más largo)
 */

import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { JwtModule, type JwtSignOptions } from '@nestjs/jwt';

import { ActualizarUsuarioUseCase } from '../../application/auth/actualizar-usuario.use-case.js';
import { CrearUsuarioUseCase } from '../../application/auth/crear-usuario.use-case.js';
import { IniciarSesionUseCase } from '../../application/auth/iniciar-sesion.use-case.js';
import {
  UNIDAD_DE_TRABAJO,
  type UnidadDeTrabajo,
} from '../../domain/shared/unidad-de-trabajo.js';
import {
  HASH_CONTRASENA,
  type HashContrasena,
} from '../../domain/usuario/contrasena.js';
import {
  EMISOR_DE_TOKEN,
  type EmisorDeToken,
} from '../../domain/usuario/emisor-token.js';
import {
  USUARIO_REPOSITORY,
  type UsuarioRepository,
} from '../../domain/usuario/usuario.repository.js';
import { BcryptHashService } from '../../infrastructure/auth/bcrypt-hash.service.js';
import { JwtAuthGuard } from '../../infrastructure/auth/jwt-auth.guard.js';
import { JwtEmisorTokenService } from '../../infrastructure/auth/jwt-emisor-token.service.js';
import { PermisosGuard } from '../../infrastructure/auth/permisos.guard.js';
import { PersistenciaModule } from '../../infrastructure/persistence/persistencia.module.js';
import { AuthController } from './auth.controller.js';
import { UsuariosController } from './usuarios.controller.js';

const JWT_EXPIRACION_POR_DEFECTO = '12h';

type DuracionJwt = NonNullable<JwtSignOptions['expiresIn']>;

/** Acepta el formato de la librería `ms`: "12h", "30m", "7d", "3600s". */
function leerExpiracionJwt(): DuracionJwt {
  const valor = process.env.JWT_EXPIRES_IN ?? JWT_EXPIRACION_POR_DEFECTO;
  if (!/^\d+(ms|s|m|h|d)$/.test(valor)) {
    throw new Error(
      `JWT_EXPIRES_IN="${valor}" no es válido. Usa un número con unidad: 12h, 30m, 7d.`,
    );
  }
  return valor as DuracionJwt;
}

function leerSecretoJwt(): string {
  const secreto = process.env.JWT_SECRET;
  if (!secreto || secreto.length < 32) {
    // Fallar al arrancar es mejor que emitir tokens firmados con un
    // secreto débil o vacío que cualquiera podría falsificar.
    throw new Error(
      'JWT_SECRET no está definido o tiene menos de 32 caracteres. ' +
        'Defínelo en .env (ver .env.example).',
    );
  }
  return secreto;
}

@Module({
  imports: [
    PersistenciaModule,
    JwtModule.register({
      secret: leerSecretoJwt(),
      signOptions: { expiresIn: leerExpiracionJwt() },
    }),
  ],
  controllers: [AuthController, UsuariosController],
  providers: [
    // ------------------------------------------------------
    // Implementaciones de los puertos
    // ------------------------------------------------------
    { provide: HASH_CONTRASENA, useClass: BcryptHashService },
    { provide: EMISOR_DE_TOKEN, useClass: JwtEmisorTokenService },

    // ------------------------------------------------------
    // Casos de uso
    // ------------------------------------------------------
    {
      provide: IniciarSesionUseCase,
      inject: [USUARIO_REPOSITORY, HASH_CONTRASENA, EMISOR_DE_TOKEN],
      useFactory: (
        usuarios: UsuarioRepository,
        hash: HashContrasena,
        tokens: EmisorDeToken,
      ) => new IniciarSesionUseCase(usuarios, hash, tokens),
    },
    {
      provide: CrearUsuarioUseCase,
      inject: [UNIDAD_DE_TRABAJO, HASH_CONTRASENA],
      useFactory: (uow: UnidadDeTrabajo, hash: HashContrasena) =>
        new CrearUsuarioUseCase(uow, hash),
    },
    {
      provide: ActualizarUsuarioUseCase,
      inject: [UNIDAD_DE_TRABAJO, HASH_CONTRASENA],
      useFactory: (uow: UnidadDeTrabajo, hash: HashContrasena) =>
        new ActualizarUsuarioUseCase(uow, hash),
    },

    // ------------------------------------------------------
    // Guards globales (el orden importa)
    // ------------------------------------------------------
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: PermisosGuard },
  ],
})
export class AuthModule {}
