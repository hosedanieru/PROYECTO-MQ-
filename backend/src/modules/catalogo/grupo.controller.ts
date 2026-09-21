/**
 * CONTROLADOR DE GRUPOS (antes "proveedores")
 * ===========================================
 *
 *   GET   /api/grupos        catalogo.consultar   todos (activos e inactivos; el cliente decide)
 *   POST  /api/grupos        catalogo.editar
 *   PATCH /api/grupos/:id    catalogo.editar      (datos, activo)
 */

import { Body, Controller, Get, HttpCode, HttpStatus, Inject, Param, Patch, Post } from '@nestjs/common';

import { ActualizarGrupoUseCase, CrearGrupoUseCase } from '../../application/catalogo/grupo.use-cases.js';
import { GRUPO_REPOSITORY, type GrupoRepository } from '../../domain/grupo/grupo.repository.js';
import type { Usuario } from '../../domain/usuario/usuario.entity.js';
import { RequierePermisos, UsuarioActual } from '../../infrastructure/auth/decoradores.js';
import { ActualizarGrupoDto, CrearGrupoDto } from './dto/grupo.dto.js';

@Controller('grupos')
export class GrupoController {
  constructor(
    private readonly crearGrupo: CrearGrupoUseCase,
    private readonly actualizarGrupo: ActualizarGrupoUseCase,
    @Inject(GRUPO_REPOSITORY) private readonly grupos: GrupoRepository,
  ) {}

  @Get()
  @RequierePermisos('catalogo.consultar')
  listar() {
    return this.grupos.listar();
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @RequierePermisos('catalogo.editar')
  crear(@Body() dto: CrearGrupoDto, @UsuarioActual() actual: Usuario) {
    return this.crearGrupo.ejecutar({
      codigo: dto.codigo,
      nombre: dto.nombre,
      descripcion: dto.descripcion ?? null,
      personasEsperadas: dto.personasEsperadas ?? null,
      usuarioId: actual.id,
    });
  }

  @Patch(':id')
  @RequierePermisos('catalogo.editar')
  actualizar(@Param('id') id: string, @Body() dto: ActualizarGrupoDto, @UsuarioActual() actual: Usuario) {
    return this.actualizarGrupo.ejecutar({ grupoId: id, cambios: dto, usuarioId: actual.id });
  }
}
