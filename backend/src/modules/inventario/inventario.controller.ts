/**
 * CONTROLADOR DE INVENTARIO
 * =========================
 *
 *   GET   /api/inventario/items?tipo=&texto=&soloActivos=     inventario.consultar  existencias
 *   GET   /api/inventario/items/:id                           inventario.consultar
 *   GET   /api/inventario/items/:id/movimientos?limite=       inventario.consultar  kardex (más reciente primero)
 *   POST  /api/inventario/items                               inventario.catalogo
 *   PATCH /api/inventario/items/:id                           inventario.catalogo
 *   POST  /api/inventario/movimientos                         inventario.registrar  entrada / salida
 *   POST  /api/inventario/ajustes                             inventario.ajustar    ajuste con motivo
 *   GET   /api/inventario/movimientos?desde=&hasta=&tipo=     inventario.consultar  todos los movimientos del rango
 *   POST  /api/inventario/entradas                            inventario.registrar  entrada de mercancía (varias líneas)
 *   GET   /api/inventario/entradas?desde=&hasta=              inventario.consultar
 *   GET   /api/inventario/entradas/:id                        inventario.consultar  encabezado + líneas
 *
 * Entradas/salidas y ajustes van por rutas distintas para que el permiso
 * se verifique en la ruta: el patinador no puede "colar" un ajuste.
 * Fecha, hora, turno y quién registra los pone el servidor.
 */

import { Body, Controller, Get, HttpCode, HttpStatus, Inject, Param, Patch, Post, Query } from '@nestjs/common';

import {
  ActualizarItemUseCase,
  CrearItemUseCase,
  RegistrarEntradaMercanciaUseCase,
  RegistrarMovimientoUseCase,
} from '../../application/inventario/inventario.use-cases.js';
import {
  ENTRADA_MERCANCIA_REPOSITORY,
  type EntradaMercancia,
  type EntradaMercanciaRepository,
} from '../../domain/inventario/entrada-mercancia.js';
import { EntradaMercanciaNoEncontradaError, ItemInventarioNoEncontradoError } from '../../domain/inventario/inventario.errors.js';
import { ITEM_INVENTARIO_REPOSITORY, type ItemInventarioRepository } from '../../domain/inventario/item-inventario.js';
import {
  MOVIMIENTO_INVENTARIO_REPOSITORY,
  type MovimientoInventario,
  type MovimientoInventarioRepository,
} from '../../domain/inventario/movimiento-inventario.js';
import { fechaOperativaADate } from '../../domain/shared/fecha-operativa.js';
import { validarRango } from '../../domain/shared/rango-fechas.js';
import type { Usuario } from '../../domain/usuario/usuario.entity.js';
import { RequierePermisos, UsuarioActual } from '../../infrastructure/auth/decoradores.js';
import {
  ActualizarItemDto,
  CrearItemDto,
  FiltroItemsDto,
  FiltroMovimientosDto,
  KardexDto,
  RangoFechasDto,
  RegistrarAjusteDto,
  RegistrarEntradaDto,
  RegistrarMovimientoDto,
} from './dto/inventario.dto.js';

const KARDEX_POR_DEFECTO = 100;

const presentarMovimiento = (m: MovimientoInventario) => ({ ...m, fechaOperativa: m.fechaOperativa.toISOString().slice(0, 10) });
const presentarEntrada = <T extends EntradaMercancia>(e: T) => ({ ...e, fechaOperativa: e.fechaOperativa.toISOString().slice(0, 10) });

@Controller('inventario')
export class InventarioController {
  constructor(
    private readonly crearItem: CrearItemUseCase,
    private readonly actualizarItem: ActualizarItemUseCase,
    private readonly registrarMovimiento: RegistrarMovimientoUseCase,
    private readonly registrarEntrada: RegistrarEntradaMercanciaUseCase,
    @Inject(ITEM_INVENTARIO_REPOSITORY) private readonly items: ItemInventarioRepository,
    @Inject(ENTRADA_MERCANCIA_REPOSITORY) private readonly entradasMercancia: EntradaMercanciaRepository,
    @Inject(MOVIMIENTO_INVENTARIO_REPOSITORY) private readonly movimientos: MovimientoInventarioRepository,
  ) {}

  @Get('items')
  @RequierePermisos('inventario.consultar')
  listarItems(@Query() filtro: FiltroItemsDto) {
    return this.items.listar(filtro);
  }

  @Get('items/:id')
  @RequierePermisos('inventario.consultar')
  async item(@Param('id') id: string) {
    const item = await this.items.buscarPorId(id);
    if (!item) throw new ItemInventarioNoEncontradoError(`No existe el ítem de inventario "${id}".`);
    return item;
  }

  @Get('items/:id/movimientos')
  @RequierePermisos('inventario.consultar')
  async kardex(@Param('id') id: string, @Query() q: KardexDto) {
    const movimientos = await this.movimientos.listarPorItem(id, q.limite ?? KARDEX_POR_DEFECTO);
    return movimientos.map(presentarMovimiento);
  }

  @Post('items')
  @HttpCode(HttpStatus.CREATED)
  @RequierePermisos('inventario.catalogo')
  crear(@Body() dto: CrearItemDto, @UsuarioActual() actual: Usuario) {
    return this.crearItem.ejecutar({
      tipo: dto.tipo,
      codigo: dto.codigo ?? null,
      descripcion: dto.descripcion ?? null,
      unidadMedida: dto.unidadMedida,
      productoId: dto.productoId ?? null,
      usuarioId: actual.id,
    });
  }

  @Patch('items/:id')
  @RequierePermisos('inventario.catalogo')
  actualizar(@Param('id') id: string, @Body() dto: ActualizarItemDto, @UsuarioActual() actual: Usuario) {
    return this.actualizarItem.ejecutar({ itemId: id, cambios: dto, usuarioId: actual.id });
  }

  @Post('movimientos')
  @HttpCode(HttpStatus.CREATED)
  @RequierePermisos('inventario.registrar')
  async movimiento(@Body() dto: RegistrarMovimientoDto, @UsuarioActual() actual: Usuario) {
    const r = await this.registrarMovimiento.ejecutar({
      itemId: dto.itemId,
      tipo: dto.tipo,
      cantidad: dto.cantidad,
      referencia: dto.referencia ?? null,
      observacion: dto.observacion ?? null,
      motivo: null,
      usuarioId: actual.id,
    });
    return { movimiento: presentarMovimiento(r.movimiento), item: r.item };
  }

  @Post('ajustes')
  @HttpCode(HttpStatus.CREATED)
  @RequierePermisos('inventario.ajustar')
  async ajuste(@Body() dto: RegistrarAjusteDto, @UsuarioActual() actual: Usuario) {
    const r = await this.registrarMovimiento.ejecutar({
      itemId: dto.itemId,
      tipo: 'AJUSTE',
      cantidad: dto.cantidad,
      referencia: null,
      observacion: dto.observacion ?? null,
      motivo: dto.motivo,
      usuarioId: actual.id,
    });
    return { movimiento: presentarMovimiento(r.movimiento), item: r.item };
  }

  @Post('entradas')
  @HttpCode(HttpStatus.CREATED)
  @RequierePermisos('inventario.registrar')
  async entrada(@Body() dto: RegistrarEntradaDto, @UsuarioActual() actual: Usuario) {
    const entrada = await this.registrarEntrada.ejecutar({
      documento: dto.documento,
      remitente: dto.remitente ?? null,
      observacion: dto.observacion ?? null,
      lineas: dto.lineas,
      usuarioId: actual.id,
    });
    return presentarEntrada(entrada);
  }

  @Get('entradas')
  @RequierePermisos('inventario.consultar')
  async entradas(@Query() rango: RangoFechasDto) {
    const desde = fechaOperativaADate(rango.desde);
    const hasta = fechaOperativaADate(rango.hasta);
    validarRango(desde, hasta);
    return (await this.entradasMercancia.listar(desde, hasta)).map(presentarEntrada);
  }

  /** Encabezado y líneas (los movimientos enlazados, con los datos de su ítem). */
  @Get('entradas/:id')
  @RequierePermisos('inventario.consultar')
  async detalleEntrada(@Param('id') id: string) {
    const entrada = await this.entradasMercancia.buscarPorId(id);
    if (!entrada) throw new EntradaMercanciaNoEncontradaError(`No existe la entrada de mercancía "${id}".`);
    const movimientos = await this.movimientos.listarPorEntrada(id);
    const lineas = await Promise.all(
      movimientos.map(async (m) => {
        const item = await this.items.buscarPorId(m.itemId);
        return {
          movimientoId: m.id,
          itemId: m.itemId,
          codigo: item?.codigo ?? '',
          descripcion: item?.descripcion ?? '',
          unidadMedida: item?.unidadMedida ?? '',
          cantidad: m.cantidad,
          saldo: m.saldo,
        };
      }),
    );
    return presentarEntrada({ ...entrada, lineas: lineas.sort((a, b) => a.codigo.localeCompare(b.codigo)) });
  }

  @Get('movimientos')
  @RequierePermisos('inventario.consultar')
  async listarMovimientos(@Query() filtro: FiltroMovimientosDto) {
    const desde = fechaOperativaADate(filtro.desde);
    const hasta = fechaOperativaADate(filtro.hasta);
    validarRango(desde, hasta);
    return (await this.movimientos.listar({ desde, hasta, tipo: filtro.tipo })).map(presentarMovimiento);
  }
}
