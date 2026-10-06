/**
 * RESUMEN DEL TURNO / DEL DÍA — HTTP
 * ==================================
 *
 *   GET /api/resumenes?fecha=AAAA-MM-DD   resumen.consultar  los del día (sin los datos)
 *   GET /api/resumenes/:id                resumen.consultar  la foto completa
 *   GET /api/resumenes/:id/pdf            resumen.consultar  el PDF
 *
 * Los resúmenes se crean al cerrar el turno (POST /mfr/turno/cerrar); aquí
 * solo se consultan. Por ahora solo el administrador (roles al final).
 */

import { BadRequestException, Controller, Get, HttpException, Inject, Logger, Param, Query, Res, ServiceUnavailableException } from '@nestjs/common';
import type { Response } from 'express';

import {
  consecutivoResumen,
  GENERADOR_PDF_RESUMEN,
  RESUMEN_TURNO_REPOSITORY,
  ResumenNoEncontradoError,
  type GeneradorPdfResumen,
  type ResumenTurno,
  type ResumenTurnoRepository,
} from '../../domain/resumen/resumen-turno.js';
import { ErrorDominio } from '../../domain/shared/errores.js';
import { fechaOperativaADate } from '../../domain/shared/fecha-operativa.js';
import { RequierePermisos } from '../../infrastructure/auth/decoradores.js';

/** Lo que se lista: sin la foto, que puede ser grande. */
const encabezado = (r: ResumenTurno) => ({
  id: r.id,
  tipo: r.tipo,
  consecutivo: consecutivoResumen(r.tipo, r.anio, r.numero),
  fechaOperativa: r.fechaOperativa.toISOString().slice(0, 10),
  turnoId: r.turnoId,
  titulo: r.datos.titulo,
  cerradoPorNombre: r.cerradoPorNombre,
  fechaHora: r.fechaHora,
});

@Controller('resumenes')
export class ResumenController {
  private readonly logger = new Logger(ResumenController.name);

  constructor(
    @Inject(RESUMEN_TURNO_REPOSITORY) private readonly resumenes: ResumenTurnoRepository,
    @Inject(GENERADOR_PDF_RESUMEN) private readonly pdf: GeneradorPdfResumen,
  ) {}

  @Get()
  @RequierePermisos('resumen.consultar')
  async listar(@Query('fecha') fecha?: string) {
    if (!fecha || !/^\d{4}-\d{2}-\d{2}$/.test(fecha)) throw new BadRequestException('Indique la fecha operativa (AAAA-MM-DD).');
    return (await this.resumenes.listarPorFecha(fechaOperativaADate(fecha))).map(encabezado);
  }

  @Get(':id/pdf')
  @RequierePermisos('resumen.consultar')
  async verPdf(@Param('id') id: string, @Res() res: Response) {
    const resumen = await this.buscar(id);
    let contenido: Buffer;
    try {
      contenido = await this.pdf.generar(resumen);
    } catch (error) {
      if (error instanceof ErrorDominio || error instanceof HttpException) throw error;
      const detalle = error instanceof Error ? error.message.split('\n')[0] : String(error);
      this.logger.error(`No se pudo generar el PDF del resumen: ${detalle}`);
      throw new ServiceUnavailableException(`No se pudo generar el PDF (${detalle}). Verifique que Chrome esté disponible e intente de nuevo.`);
    }
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename="${consecutivoResumen(resumen.tipo, resumen.anio, resumen.numero)}.pdf"`);
    res.setHeader('Content-Length', String(contenido.length));
    res.end(contenido);
  }

  @Get(':id')
  @RequierePermisos('resumen.consultar')
  async detalle(@Param('id') id: string) {
    const r = await this.buscar(id);
    return { ...encabezado(r), formato: r.formato, datos: r.datos };
  }

  private async buscar(id: string): Promise<ResumenTurno> {
    const resumen = await this.resumenes.buscarPorId(id);
    if (!resumen) throw new ResumenNoEncontradoError(`No existe el resumen "${id}".`);
    return resumen;
  }
}
