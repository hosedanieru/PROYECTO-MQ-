/**
 * CONTROLADOR DE USUARIOS
 * =======================
 *
 *   GET   /api/usuarios        admin.usuarios
 *   GET   /api/usuarios/:id    admin.usuarios
 *   POST  /api/usuarios        admin.usuarios
 *   PATCH /api/usuarios/:id    admin.usuarios  (datos, rol, activo, contraseña)
 *
 * No hay DELETE: un usuario con remisiones o auditoría a su nombre no
 * puede desaparecer. Se desactiva.
 *
 * Quién ejecuta la acción sale del token, nunca del cuerpo.
 */

import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Inject,
  Param,
  Patch,
  Post,
} from '@nestjs/common';

import { ActualizarUsuarioUseCase } from '../../application/auth/actualizar-usuario.use-case.js';
import { CrearUsuarioUseCase } from '../../application/auth/crear-usuario.use-case.js';
import type { Usuario } from '../../domain/usuario/usuario.entity.js';
import { UsuarioNoEncontradoError } from '../../domain/usuario/usuario.errors.js';
import {
  USUARIO_REPOSITORY,
  type UsuarioRepository,
} from '../../domain/usuario/usuario.repository.js';
import {
  RequierePermisos,
  UsuarioActual,
} from '../../infrastructure/auth/decoradores.js';
import { ActualizarUsuarioDto, CrearUsuarioDto } from './dto/auth.dto.js';

@Controller('usuarios')
@RequierePermisos('admin.usuarios')
export class UsuariosController {
  constructor(
    private readonly crearUsuario: CrearUsuarioUseCase,
    private readonly actualizarUsuario: ActualizarUsuarioUseCase,
    @Inject(USUARIO_REPOSITORY)
    private readonly usuarios: UsuarioRepository,
  ) {}

  @Get()
  async listar() {
    const lista = await this.usuarios.listar();
    return lista.map((u) => u.aPerfil());
  }

  @Get(':id')
  async obtener(@Param('id') id: string) {
    const usuario = await this.usuarios.buscarPorId(id);
    if (!usuario) {
      throw new UsuarioNoEncontradoError(`No existe el usuario "${id}".`);
    }
    return usuario.aPerfil();
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
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

  @Patch(':id')
  async actualizar(
    @Param('id') id: string,
    @Body() dto: ActualizarUsuarioDto,
    @UsuarioActual() actual: Usuario,
  ) {
    const actualizado = await this.actualizarUsuario.ejecutar({
      usuarioId: id,
      cambios: dto,
      ejecutadoPorId: actual.id,
    });
    return actualizado.aPerfil();
  }
}
