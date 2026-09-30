/**
 * CONTROLADOR DEL CATÁLOGO DE INVENTARIO
 * ======================================
 *
 *   GET   /api/inventario/unidades                    inventario.consultar  unidades de medida (lista desplegable)
 *   POST  /api/inventario/unidades                    inventario.catalogo
 *   PATCH /api/inventario/unidades/:id                inventario.catalogo   (codigo, nombre, activo)
 *   GET   /api/inventario/catalogo/:tipo              inventario.consultar  tipo = pi | insumos
 *   POST  /api/inventario/catalogo/:tipo              inventario.catalogo   crea el PI o insumo Y su existencia (0)
 *   PATCH /api/inventario/catalogo/:tipo/:id          inventario.catalogo   datos, equivalencias, activo
 *   GET   /api/inventario/recetas                     inventario.consultar  versión vigente de cada PT con receta (resumen)
 *   GET   /api/inventario/recetas/:productoId         inventario.consultar  vigente + historial, con datos de cada componente
 *   PUT   /api/inventario/recetas/:productoId         inventario.catalogo   { componentes } → VERSIÓN NUEVA (nunca edita encima)
 *
 * El PT se crea en el catálogo de productos (`/api/productos`), que también
 * crea su existencia. Cada tipo vive en su tabla; la ruta dice cuál.
 */

import { Body, Controller, Get, HttpCode, HttpStatus, Inject, Param, ParseEnumPipe, Patch, Post, Put } from '@nestjs/common';

import {
  ActualizarMaterialUseCase,
  ActualizarUnidadUseCase,
  CrearMaterialUseCase,
  CrearUnidadUseCase,
} from '../../application/inventario/catalogo-inventario.use-cases.js';
import { ConsultarRecetaUseCase, GuardarRecetaUseCase } from '../../application/inventario/receta.use-cases.js';
import { MATERIAL_REPOSITORY, type MaterialRepository, type TipoMaterial } from '../../domain/inventario/material.js';
import { RECETA_REPOSITORY, type RecetaRepository } from '../../domain/inventario/receta.js';
import { UNIDAD_MEDIDA_REPOSITORY, type UnidadMedidaRepository } from '../../domain/inventario/unidad-medida.js';
import type { Usuario } from '../../domain/usuario/usuario.entity.js';
import { RequierePermisos, UsuarioActual } from '../../infrastructure/auth/decoradores.js';
import { ActualizarMaterialDto, ActualizarUnidadDto, CrearMaterialDto, CrearUnidadDto, GuardarRecetaDto } from './dto/inventario.dto.js';

/** Segmento de la ruta → tipo del dominio. */
enum RutaMaterial {
  pi = 'pi',
  insumos = 'insumos',
}
const TIPO: Record<RutaMaterial, TipoMaterial> = { [RutaMaterial.pi]: 'PI', [RutaMaterial.insumos]: 'INSUMO' };
const rutaTipo = new ParseEnumPipe(RutaMaterial);

@Controller('inventario')
export class CatalogoInventarioController {
  constructor(
    private readonly crearUnidad: CrearUnidadUseCase,
    private readonly actualizarUnidad: ActualizarUnidadUseCase,
    private readonly crearMaterial: CrearMaterialUseCase,
    private readonly actualizarMaterial: ActualizarMaterialUseCase,
    @Inject(UNIDAD_MEDIDA_REPOSITORY) private readonly unidades: UnidadMedidaRepository,
    @Inject(MATERIAL_REPOSITORY) private readonly materiales: MaterialRepository,
    private readonly guardarReceta: GuardarRecetaUseCase,
    private readonly consultarReceta: ConsultarRecetaUseCase,
    @Inject(RECETA_REPOSITORY) private readonly recetas: RecetaRepository,
  ) {}

  @Get('unidades')
  @RequierePermisos('inventario.consultar')
  listarUnidades() {
    return this.unidades.listar();
  }

  @Post('unidades')
  @HttpCode(HttpStatus.CREATED)
  @RequierePermisos('inventario.catalogo')
  nuevaUnidad(@Body() dto: CrearUnidadDto, @UsuarioActual() actual: Usuario) {
    return this.crearUnidad.ejecutar({ ...dto, usuarioId: actual.id });
  }

  @Patch('unidades/:id')
  @RequierePermisos('inventario.catalogo')
  editarUnidad(@Param('id') id: string, @Body() dto: ActualizarUnidadDto, @UsuarioActual() actual: Usuario) {
    return this.actualizarUnidad.ejecutar({ unidadId: id, cambios: dto, usuarioId: actual.id });
  }

  @Get('catalogo/:tipo')
  @RequierePermisos('inventario.consultar')
  listarMateriales(@Param('tipo', rutaTipo) ruta: RutaMaterial) {
    return this.materiales.listar(TIPO[ruta]);
  }

  @Post('catalogo/:tipo')
  @HttpCode(HttpStatus.CREATED)
  @RequierePermisos('inventario.catalogo')
  nuevoMaterial(@Param('tipo', rutaTipo) ruta: RutaMaterial, @Body() dto: CrearMaterialDto, @UsuarioActual() actual: Usuario) {
    return this.crearMaterial.ejecutar({
      tipo: TIPO[ruta],
      codigo: dto.codigo,
      descripcion: dto.descripcion,
      unidadBaseId: dto.unidadBaseId,
      presentacionId: dto.presentacionId ?? null,
      contenidoPresentacion: dto.contenidoPresentacion ?? null,
      unidadesPorCaja: dto.unidadesPorCaja ?? null,
      cajasPorEstiba: dto.cajasPorEstiba ?? null,
      usuarioId: actual.id,
    });
  }

  @Patch('catalogo/:tipo/:id')
  @RequierePermisos('inventario.catalogo')
  editarMaterial(
    @Param('tipo', rutaTipo) ruta: RutaMaterial,
    @Param('id') id: string,
    @Body() dto: ActualizarMaterialDto,
    @UsuarioActual() actual: Usuario,
  ) {
    return this.actualizarMaterial.ejecutar({ tipo: TIPO[ruta], materialId: id, cambios: dto, usuarioId: actual.id });
  }

  @Get('recetas')
  @RequierePermisos('inventario.consultar')
  resumenRecetas() {
    return this.recetas.resumenVigentes();
  }

  @Get('recetas/:productoId')
  @RequierePermisos('inventario.consultar')
  receta(@Param('productoId') productoId: string) {
    return this.consultarReceta.ejecutar(productoId);
  }

  @Put('recetas/:productoId')
  @RequierePermisos('inventario.catalogo')
  nuevaVersionReceta(@Param('productoId') productoId: string, @Body() dto: GuardarRecetaDto, @UsuarioActual() actual: Usuario) {
    return this.guardarReceta.ejecutar({ productoId, componentes: dto.componentes, usuarioId: actual.id });
  }
}
