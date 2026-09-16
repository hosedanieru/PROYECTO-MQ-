/**
 * CONTROLADOR DE USUARIOS
 * =======================
 *
 *   POST /api/usuarios   requiere `admin.usuarios` (solo ADMINISTRADOR)
 *
 * Quién ejecuta la acción sale del token, nunca del cuerpo.
 */

import { Body, Controller, HttpCode, HttpStatus, Post } from '@nestjs/common';

import { CrearUsuarioUseCase } from '../../application/auth/crear-usuario.use-case.js';
import type { Usuario } from '../../domain/usuario/usuario.entity.js';
import {
  RequierePermisos,
  UsuarioActual,
} from '../../infrastructure/auth/decoradores.js';
import { CrearUsuarioDto } from './dto/auth.dto.js';

@Controller('usuarios')
export class UsuariosController {
  constructor(private readonly crearUsuario: CrearUsuarioUseCase) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @RequierePermisos('admin.usuarios')
  async crear(@Body() dto: CrearUsuarioDto, @UsuarioActual() actual: Usuario) {
    const creado = await this.crearUsuario.ejecutar({
      documento: dto.documento,
      nombre: dto.nombre,
      email: dto.email ?? null,
      contrasena: dto.contrasena,
      rolId: dto.rolId,
      creadoPorId: actual.id,
    });
    return creado.aPerfil();
  }
}
