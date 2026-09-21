/**
 * DTOs DE AUTENTICACIÓN Y USUARIOS
 * ================================
 *
 * Validan la forma. La longitud mínima de la contraseña se valida
 * también aquí (además de en el dominio) solo para dar un mensaje
 * temprano; la regla de verdad vive en `domain/usuario/contrasena.ts`.
 */

import {
  IsBoolean,
  IsEmail,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  MinLength,
  ValidateIf,
} from 'class-validator';

import { EsId } from '../../../infrastructure/http/validadores.js';

import { LONGITUD_MINIMA_CONTRASENA } from '../../../domain/usuario/contrasena.js';

export class LoginDto {
  @IsString()
  @MinLength(1)
  @MaxLength(20)
  documento!: string;

  @IsString()
  @MinLength(1)
  contrasena!: string;
}

export class CrearUsuarioDto {
  @IsString()
  @Matches(/^[A-Za-z0-9-]{4,20}$/, {
    message: 'documento debe tener entre 4 y 20 caracteres alfanuméricos',
  })
  documento!: string;

  @IsString()
  @MinLength(3)
  @MaxLength(120)
  nombre!: string;

  @IsOptional()
  @IsEmail()
  @MaxLength(120)
  email?: string;

  @IsString()
  @MinLength(LONGITUD_MINIMA_CONTRASENA)
  @MaxLength(72) // límite de bcrypt: ignora todo lo que pase de 72 bytes
  contrasena!: string;

  @EsId()
  rolId!: string;
}

export class ActualizarUsuarioDto {
  @IsOptional()
  @IsString()
  @MinLength(3)
  @MaxLength(120)
  nombre?: string;

  /** `null` explícito borra el correo. */
  @ValidateIf((_, v) => v !== null && v !== undefined)
  @IsEmail()
  @MaxLength(120)
  email?: string | null;

  @IsOptional()
  @EsId()
  rolId?: string;

  @IsOptional()
  @IsBoolean()
  activo?: boolean;

  /** Restablecer contraseña. Solo el administrador; el usuario no la elige aquí. */
  @IsOptional()
  @IsString()
  @MinLength(LONGITUD_MINIMA_CONTRASENA)
  @MaxLength(72)
  contrasena?: string;
}
