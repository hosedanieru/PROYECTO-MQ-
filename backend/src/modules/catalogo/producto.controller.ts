/**
 * CONTROLADOR DE PRODUCTOS
 * ========================
 *
 *   GET   /api/productos?texto=&soloActivos=   catalogo.consultar
 *   GET   /api/productos/:id                   catalogo.consultar
 *   POST  /api/productos                       catalogo.editar
 *   PATCH /api/productos/:id                   catalogo.editar
 *
 * No hay DELETE: un producto referenciado por remisiones no puede
 * desaparecer. Se desactiva (`activo: false`) y deja de ofrecerse.
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
  Query,
} from '@nestjs/common';

import {
  ActualizarProductoUseCase,
  CrearProductoUseCase,
} from '../../application/catalogo/producto.use-cases.js';
import { ProductoNoEncontradoError } from '../../domain/producto/producto.errors.js';
import {
  PRODUCTO_REPOSITORY,
  type ProductoRepository,
} from '../../domain/producto/producto.repository.js';
import type { Usuario } from '../../domain/usuario/usuario.entity.js';
import {
  RequierePermisos,
  UsuarioActual,
} from '../../infrastructure/auth/decoradores.js';
import { ActualizarProductoDto, CrearProductoDto } from './dto/producto.dto.js';

@Controller('productos')
export class ProductoController {
  constructor(
    private readonly crearProducto: CrearProductoUseCase,
    private readonly actualizarProducto: ActualizarProductoUseCase,
    @Inject(PRODUCTO_REPOSITORY)
    private readonly productos: ProductoRepository,
  ) {}

  @Get()
  @RequierePermisos('catalogo.consultar')
  listar(
    @Query('texto') texto?: string,
    @Query('soloActivos') soloActivos?: string,
  ) {
    return this.productos.listar({
      texto,
      soloActivos: soloActivos === 'true',
    });
  }

  @Get(':id')
  @RequierePermisos('catalogo.consultar')
  async obtener(@Param('id') id: string) {
    const producto = await this.productos.buscarPorId(id);
    if (!producto) {
      throw new ProductoNoEncontradoError(`No existe el producto "${id}".`);
    }
    return producto;
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @RequierePermisos('catalogo.editar')
  crear(@Body() dto: CrearProductoDto, @UsuarioActual() actual: Usuario) {
    return this.crearProducto.ejecutar({
      codigo: dto.codigo,
      descripcion: dto.descripcion,
      proceso: dto.proceso ?? null,
      unidadesPorCaja: dto.unidadesPorCaja ?? null,
      cajasPorEstiba: dto.cajasPorEstiba ?? null,
      personasIdeal: dto.personasIdeal ?? null,
      subdescripcion: dto.subdescripcion ?? null,
      cajasPorHora: dto.cajasPorHora ?? null,
      pesoNetoKg: dto.pesoNetoKg ?? null,
      usuarioId: actual.id,
    });
  }

  @Patch(':id')
  @RequierePermisos('catalogo.editar')
  actualizar(
    @Param('id') id: string,
    @Body() dto: ActualizarProductoDto,
    @UsuarioActual() actual: Usuario,
  ) {
    return this.actualizarProducto.ejecutar({
      productoId: id,
      cambios: dto,
      usuarioId: actual.id,
    });
  }
}
