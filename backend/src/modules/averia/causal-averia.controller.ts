/**
 * CONTROLADOR DE CAUSALES DE AVERÍA
 * =================================
 *
 *   GET   /api/averias/causales        catalogo.consultar   todas (activas e inactivas; el cliente decide)
 *   POST  /api/averias/causales        catalogo.editar
 *   PATCH /api/averias/causales/:id    catalogo.editar      (codigo, nombre, orden, activo)
 */

import { Body, Controller, Get, HttpCode, HttpStatus, Inject, Param, Patch, Post } from '@nestjs/common';

import { ActualizarCausalUseCase, CrearCausalUseCase } from '../../application/averia/causal-averia.use-cases.js';
import { CAUSAL_AVERIA_REPOSITORY, type CausalAveriaRepository } from '../../domain/averia/causal-averia.js';
import type { Usuario } from '../../domain/usuario/usuario.entity.js';
import { RequierePermisos, UsuarioActual } from '../../infrastructure/auth/decoradores.js';
import { ActualizarCausalDto, CrearCausalDto } from './dto/causal-averia.dto.js';

@Controller('averias/causales')
export class CausalAveriaController {
  constructor(
    private readonly crearCausal: CrearCausalUseCase,
    private readonly actualizarCausal: ActualizarCausalUseCase,
    @Inject(CAUSAL_AVERIA_REPOSITORY) private readonly causales: CausalAveriaRepository,
  ) {}

  @Get()
  @RequierePermisos('catalogo.consultar')
  listar() {
    return this.causales.listar();
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @RequierePermisos('catalogo.editar')
  crear(@Body() dto: CrearCausalDto, @UsuarioActual() actual: Usuario) {
    return this.crearCausal.ejecutar({ codigo: dto.codigo, nombre: dto.nombre, orden: dto.orden, usuarioId: actual.id });
  }

  @Patch(':id')
  @RequierePermisos('catalogo.editar')
  actualizar(@Param('id') id: string, @Body() dto: ActualizarCausalDto, @UsuarioActual() actual: Usuario) {
    return this.actualizarCausal.ejecutar({ causalId: id, cambios: dto, usuarioId: actual.id });
  }
}
