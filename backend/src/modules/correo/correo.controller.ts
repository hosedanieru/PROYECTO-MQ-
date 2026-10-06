/**
 * CONTROLADOR DE CORREO
 * =====================
 *
 *   GET   /api/correos/listas            remision.enviar_correo  listas (para elegir al enviar)
 *   POST  /api/correos/listas            admin.correos
 *   PATCH /api/correos/listas/:id        admin.correos           nombre, recibe (REMISIONES|RESUMEN|AMBOS), turno, incluirEnCierres, correos, activo
 *   POST  /api/correos/remisiones        remision.enviar_correo  { remisionIds, listaIds, correos } → PDF adjunto
 *   GET   /api/correos/envios?desde=&hasta=  admin.correos       registro de envíos (máx. 93 días)
 *
 * Por ahora todo es del administrador (usuario: los roles se reparten al final).
 */

import { Body, Controller, Get, HttpCode, HttpStatus, Inject, Param, Patch, Post, Query } from '@nestjs/common';

import { ActualizarListaUseCase, CrearListaUseCase, EnviarRemisionesUseCase } from '../../application/correo/correo.use-cases.js';
import {
  ENVIO_CORREO_REPOSITORY,
  LISTA_DISTRIBUCION_REPOSITORY,
  type EnvioCorreo,
  type EnvioCorreoRepository,
  type ListaDistribucionRepository,
} from '../../domain/correo/correo.js';
import { fechaOperativaADate } from '../../domain/shared/fecha-operativa.js';
import { validarRango } from '../../domain/shared/rango-fechas.js';
import type { Usuario } from '../../domain/usuario/usuario.entity.js';
import { RequierePermisos, UsuarioActual } from '../../infrastructure/auth/decoradores.js';
import { ActualizarListaDto, CrearListaDto, EnviarRemisionesDto, RangoEnviosDto } from './dto/correo.dto.js';

const presentarEnvio = (e: EnvioCorreo) => ({ ...e, fechaOperativa: e.fechaOperativa.toISOString().slice(0, 10) });

@Controller('correos')
export class CorreoController {
  constructor(
    private readonly crearLista: CrearListaUseCase,
    private readonly actualizarLista: ActualizarListaUseCase,
    private readonly enviarRemisiones: EnviarRemisionesUseCase,
    @Inject(LISTA_DISTRIBUCION_REPOSITORY) private readonly listas: ListaDistribucionRepository,
    @Inject(ENVIO_CORREO_REPOSITORY) private readonly envios: EnvioCorreoRepository,
  ) {}

  @Get('listas')
  @RequierePermisos('remision.enviar_correo')
  listarListas() {
    return this.listas.listar();
  }

  @Post('listas')
  @HttpCode(HttpStatus.CREATED)
  @RequierePermisos('admin.correos')
  nuevaLista(@Body() dto: CrearListaDto, @UsuarioActual() actual: Usuario) {
    return this.crearLista.ejecutar({
      nombre: dto.nombre,
      recibe: dto.recibe ?? 'REMISIONES',
      turnoId: dto.turnoId ?? null,
      incluirEnCierres: dto.incluirEnCierres ?? false,
      correos: dto.correos,
      usuarioId: actual.id,
    });
  }

  @Patch('listas/:id')
  @RequierePermisos('admin.correos')
  editarLista(@Param('id') id: string, @Body() dto: ActualizarListaDto, @UsuarioActual() actual: Usuario) {
    return this.actualizarLista.ejecutar({ listaId: id, cambios: dto, usuarioId: actual.id });
  }

  @Post('remisiones')
  @HttpCode(HttpStatus.CREATED)
  @RequierePermisos('remision.enviar_correo')
  async enviar(@Body() dto: EnviarRemisionesDto, @UsuarioActual() actual: Usuario) {
    return presentarEnvio(await this.enviarRemisiones.ejecutar({ ...dto, usuarioId: actual.id }));
  }

  @Get('envios')
  @RequierePermisos('admin.correos')
  async listarEnvios(@Query() rango: RangoEnviosDto) {
    const desde = fechaOperativaADate(rango.desde);
    const hasta = fechaOperativaADate(rango.hasta);
    validarRango(desde, hasta);
    return (await this.envios.listar(desde, hasta)).map(presentarEnvio);
  }
}
