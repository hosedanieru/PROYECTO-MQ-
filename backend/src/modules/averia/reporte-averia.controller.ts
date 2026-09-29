/**
 * CONTROLADOR DE REPORTES DE AVERÍAS
 * ==================================
 *
 *   GET   /api/averias?desde=&hasta=&turnoId=&grupoId=&estado=      averia.consultar
 *   GET   /api/averias/indicador?desde=&hasta=                      averia.consultar (% contra el DPP, máx. 1 %)
 *   GET   /api/averias/:id                                          averia.consultar
 *   GET   /api/averias/:id/registros/:registroId/fotos/:tipo        averia.consultar (la imagen)
 *   POST  /api/averias                                              averia.reportar  (multipart)
 *   PATCH /api/averias/:id/registros/:registroId                    averia.corregir
 *   POST  /api/averias/:id/anular                                   averia.corregir  { motivo }
 *
 * POST es multipart: el campo `datos` lleva el JSON del reporte y cada
 * foto va como archivo `foto_{fila}_{TIPO}` (fila desde 0; TIPO: UNIDAD,
 * LOTE_FECHA, CONJUNTO). Fecha, hora, turno y quién reporta NO se
 * reciben: los pone el servidor.
 *
 * Las rutas de las fotos no salen en las respuestas; el cliente pide la
 * imagen por reporte, registro y tipo (así el permiso se verifica igual).
 */

import {
  BadRequestException,
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Inject,
  NotFoundException,
  Param,
  Patch,
  Post,
  Query,
  Res,
  UploadedFiles,
  UseInterceptors,
} from '@nestjs/common';
import { AnyFilesInterceptor } from '@nestjs/platform-express';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import type { Response } from 'express';

import {
  AnularReporteAveriaUseCase,
  CorregirRegistroAveriaUseCase,
  CrearReporteAveriaUseCase,
  type RegistroNuevoAveria,
} from '../../application/averia/reporte-averia.use-cases.js';
import { IndicadorAveriasUseCase } from '../../application/averia/indicador-averias.use-case.js';
import {
  ALMACEN_DE_EVIDENCIAS,
  TAMANO_MAXIMO_FOTO,
  type AlmacenDeEvidencias,
  type ArchivoEvidencia,
} from '../../domain/averia/almacen-evidencias.js';
import { DatosAveriaInvalidosError, ReporteAveriaNoEncontradoError } from '../../domain/averia/averia.errors.js';
import { TIPOS_EVIDENCIA, totalizarUnidades, type TipoEvidencia } from '../../domain/averia/registro-averia.js';
import {
  MAXIMO_REGISTROS_POR_REPORTE,
  REPORTE_AVERIA_REPOSITORY,
  type ReporteAveria,
  type ReporteAveriaRepository,
} from '../../domain/averia/reporte-averia.js';
import { fechaOperativaADate } from '../../domain/shared/fecha-operativa.js';
import { validarRango } from '../../domain/shared/rango-fechas.js';
import type { Usuario } from '../../domain/usuario/usuario.entity.js';
import { RequierePermisos, UsuarioActual } from '../../infrastructure/auth/decoradores.js';
import {
  AnularReporteAveriaDto,
  CorregirRegistroAveriaDto,
  CrearReporteAveriaDto,
  FiltroReportesAveriaDto,
  RangoIndicadorDto,
} from './dto/reporte-averia.dto.js';

/** Lo que entrega multer; se tipa aquí para no depender de @types/multer. */
interface ArchivoSubido {
  fieldname: string;
  mimetype: string;
  size: number;
  buffer: Buffer;
}

const dia = (fecha: Date) => fecha.toISOString().slice(0, 10);

function presentar(r: ReporteAveria) {
  return {
    ...r,
    fechaOperativa: dia(r.fechaOperativa),
    total: totalizarUnidades(r.registros),
    registros: r.registros.map((x) => ({
      ...x,
      fechaVencimiento: dia(x.fechaVencimiento),
      // Sin la ruta interna del archivo: solo qué fotos tiene.
      evidencias: x.evidencias.map((e) => ({ tipo: e.tipo })),
    })),
  };
}

@Controller('averias')
export class ReporteAveriaController {
  constructor(
    private readonly crearReporte: CrearReporteAveriaUseCase,
    private readonly corregirRegistro: CorregirRegistroAveriaUseCase,
    private readonly anularReporte: AnularReporteAveriaUseCase,
    private readonly indicadorAverias: IndicadorAveriasUseCase,
    @Inject(REPORTE_AVERIA_REPOSITORY) private readonly reportes: ReporteAveriaRepository,
    @Inject(ALMACEN_DE_EVIDENCIAS) private readonly almacen: AlmacenDeEvidencias,
  ) {}

  @Get()
  @RequierePermisos('averia.consultar')
  async listar(@Query() filtro: FiltroReportesAveriaDto) {
    const desde = fechaOperativaADate(filtro.desde);
    const hasta = fechaOperativaADate(filtro.hasta);
    validarRango(desde, hasta);
    const reportes = await this.reportes.listar({
      desde,
      hasta,
      turnoId: filtro.turnoId,
      grupoId: filtro.grupoId,
      estado: filtro.estado,
    });
    return reportes.map(presentar);
  }

  /** % de averías contra el DPP del periodo (máximo 1 % por contrato). Va antes de `:id`. */
  @Get('indicador')
  @RequierePermisos('averia.consultar')
  indicador(@Query() rango: RangoIndicadorDto) {
    return this.indicadorAverias.ejecutar(fechaOperativaADate(rango.desde), fechaOperativaADate(rango.hasta));
  }

  @Get(':id')
  @RequierePermisos('averia.consultar')
  async detalle(@Param('id') id: string) {
    const reporte = await this.reportes.buscarPorId(id);
    if (!reporte) throw new ReporteAveriaNoEncontradoError(`No existe el reporte de averías "${id}".`);
    return presentar(reporte);
  }

  @Get(':id/registros/:registroId/fotos/:tipo')
  @RequierePermisos('averia.consultar')
  async foto(
    @Param('id') id: string,
    @Param('registroId') registroId: string,
    @Param('tipo') tipo: string,
    @Res() respuesta: Response,
  ) {
    const reporte = await this.reportes.buscarPorId(id);
    const evidencia = reporte?.registros.find((r) => r.id === registroId)?.evidencias.find((e) => e.tipo === tipo);
    const archivo = evidencia ? await this.almacen.leer(evidencia.ruta) : null;
    if (!archivo) throw new NotFoundException('La foto no existe.');
    respuesta
      .type(archivo.tipoMime)
      .set('Cache-Control', 'private, max-age=86400')
      .send(Buffer.from(archivo.contenido));
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @RequierePermisos('averia.reportar')
  @UseInterceptors(
    AnyFilesInterceptor({
      limits: { fileSize: TAMANO_MAXIMO_FOTO, files: MAXIMO_REGISTROS_POR_REPORTE * TIPOS_EVIDENCIA.length },
    }),
  )
  async crear(
    @Body('datos') datosJson: string | undefined,
    @UploadedFiles() archivos: ArchivoSubido[] | undefined,
    @UsuarioActual() actual: Usuario,
  ) {
    const dto = await leerDatos(datosJson);
    const fotos = agruparFotos(archivos ?? [], dto.registros.length);

    const registros: RegistroNuevoAveria[] = dto.registros.map((r, fila) => ({
      productoId: r.productoId,
      fechaVencimiento: fechaOperativaADate(r.fechaVencimiento),
      lote: r.lote,
      causalId: r.causalId,
      cantidad: r.cantidad,
      unidadMedida: r.unidadMedida,
      fotos: fotos[fila],
    }));
    const creado = await this.crearReporte.ejecutar({ grupoId: dto.grupoId, registros, usuarioId: actual.id });
    return presentar(creado);
  }

  @Patch(':id/registros/:registroId')
  @RequierePermisos('averia.corregir')
  async corregir(
    @Param('id') id: string,
    @Param('registroId') registroId: string,
    @Body() dto: CorregirRegistroAveriaDto,
    @UsuarioActual() actual: Usuario,
  ) {
    const { fechaVencimiento, ...resto } = dto;
    const corregido = await this.corregirRegistro.ejecutar({
      reporteId: id,
      registroId,
      cambios: { ...resto, ...(fechaVencimiento ? { fechaVencimiento: fechaOperativaADate(fechaVencimiento) } : {}) },
      usuarioId: actual.id,
    });
    return presentar(corregido);
  }

  @Post(':id/anular')
  @HttpCode(HttpStatus.OK)
  @RequierePermisos('averia.corregir')
  async anular(@Param('id') id: string, @Body() dto: AnularReporteAveriaDto, @UsuarioActual() actual: Usuario) {
    return presentar(await this.anularReporte.ejecutar({ reporteId: id, motivo: dto.motivo, usuarioId: actual.id }));
  }
}

/**
 * El JSON del multipart no pasa por el ValidationPipe global (llega como
 * texto), así que se valida aquí con las mismas reglas: forma en el DTO,
 * negocio en el dominio.
 */
async function leerDatos(texto: string | undefined): Promise<CrearReporteAveriaDto> {
  let crudo: unknown;
  try {
    crudo = JSON.parse(texto ?? '');
  } catch {
    throw new BadRequestException('El campo "datos" debe traer el reporte en JSON.');
  }
  const dto = plainToInstance(CrearReporteAveriaDto, crudo);
  const errores = await validate(dto, { whitelist: true, forbidNonWhitelisted: true });
  if (errores.length > 0) {
    const mensajes = errores.flatMap(function aplanar(e): string[] {
      return [...Object.values(e.constraints ?? {}), ...(e.children ?? []).flatMap(aplanar)];
    });
    throw new BadRequestException(mensajes);
  }
  return dto;
}

/** `foto_{fila}_{TIPO}` → fotos por fila y tipo. Rechaza nombres que no correspondan. */
function agruparFotos(archivos: ArchivoSubido[], filas: number): Array<Partial<Record<TipoEvidencia, ArchivoEvidencia>>> {
  const porFila = Array.from({ length: filas }, () => ({}) as Partial<Record<TipoEvidencia, ArchivoEvidencia>>);
  for (const a of archivos) {
    const m = /^foto_(\d+)_(UNIDAD|LOTE_FECHA|CONJUNTO)$/.exec(a.fieldname);
    const fila = m ? Number(m[1]) : -1;
    if (!m || fila >= filas) {
      throw new DatosAveriaInvalidosError(`Archivo inesperado: "${a.fieldname}".`);
    }
    porFila[fila][m[2] as TipoEvidencia] = { contenido: a.buffer, tipoMime: a.mimetype };
  }
  return porFila;
}
