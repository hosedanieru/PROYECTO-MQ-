/**
 * CONTROLADOR DE AUTENTICACIÓN
 * ============================
 *
 *   POST /api/auth/login    público — entrega token + perfil
 *   GET  /api/auth/perfil   protegido — devuelve el usuario del token
 *
 * `perfil` existe para que el frontend pueda, al recargar la página,
 * saber quién está logueado y con qué permisos sin volver a pedir la
 * contraseña: guarda el token, llama a `perfil`, y reconstruye la sesión.
 */

import { Body, Controller, Get, HttpCode, HttpStatus, Post } from '@nestjs/common';

import { IniciarSesionUseCase } from '../../application/auth/iniciar-sesion.use-case.js';
import type { Usuario } from '../../domain/usuario/usuario.entity.js';
import { Publico, UsuarioActual } from '../../infrastructure/auth/decoradores.js';
import { LoginDto } from './dto/auth.dto.js';

@Controller('auth')
export class AuthController {
  constructor(private readonly iniciarSesion: IniciarSesionUseCase) {}

  @Publico()
  @Post('login')
  @HttpCode(HttpStatus.OK)
  login(@Body() dto: LoginDto) {
    return this.iniciarSesion.ejecutar({
      documento: dto.documento,
      contrasena: dto.contrasena,
    });
  }

  @Get('perfil')
  perfil(@UsuarioActual() usuario: Usuario) {
    return usuario.aPerfil();
  }
}
