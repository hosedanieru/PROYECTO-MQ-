/**
 * CONTROLADOR DE REMISIONES
 * =========================
 *
 * Capa de presentación. Sus responsabilidades se limitan a:
 *   - recibir la petición HTTP
 *   - traducir el DTO al comando del caso de uso
 *   - devolver la respuesta
 *
 * No contiene reglas de negocio ni consultas a base de datos.
 *
 * Seguridad: toda ruta exige token (guard global) y, además, el permiso
 * declarado con `@RequierePermisos`. Quién ejecuta cada acción sale del
 * token vía `@UsuarioActual()`, nunca del cuerpo de la petición.
 */

import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpException,
  HttpStatus,
  Inject,
  Logger,
  NotFoundException,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Query,
  Res,
  ServiceUnavailableException,
} from '@nestjs/common';
import type { Response } from 'express';

import { CrearRemisionUseCase } from '../../application/remision/crear-remision.use-case.js';
import { EditarRemisionUseCase } from '../../application/remision/editar-remision.use-case.js';
import { ExportarRemisionesUseCase } from '../../application/remision/exportar-remisiones.use-case.js';
import { ImprimirRemisionesUseCase } from '../../application/remision/imprimir-remisiones.use-case.js';
import {
  AprobarRemisionUseCase,
  EntregarRemisionUseCase,
  RechazarRemisionUseCase,
  RectificarRemisionUseCase,
  ValidarRemisionUseCase,
} from '../../application/remision/flujo-remision.use-cases.js';
import {
  ESTADOS_REMISION,
  type EstadoRemision,
  type Remision,
} from '../../domain/remision/remision.entity.js';
import {
  HISTORIAL_REMISION_REPOSITORY,
  type HistorialRemisionRepository,
} from '../../domain/remision/historial.repository.js';
import {
  REMISION_REPOSITORY,
  type RemisionRepository,
} from '../../domain/remision/remision.repository.js';
import { ErrorDominio } from '../../domain/shared/errores.js';
import type { Usuario } from '../../domain/usuario/usuario.entity.js';
import {
  RequierePermisos,
  UsuarioActual,
} from '../../infrastructure/auth/decoradores.js';
import { CrearRemisionDto } from './dto/crear-remision.dto.js';
import { EditarRemisionDto } from './dto/editar-remision.dto.js';
import {
  AprobarRemisionDto,
  RechazarRemisionDto,
  ValidarRemisionDto,
} from './dto/flujo-remision.dto.js';

/** Forma de la remisión hacia el cliente. */
function presentar(remision: Remision) {
  const datos = remision.aObjeto();

  return {
    id: datos.id,
    consecutivo: remision.consecutivo,
    anio: datos.anio,
    numero: datos.numero,
    version: datos.version,
    estado: datos.estado,
    fechaOperativa: datos.fechaOperativa.toISOString().slice(0, 10),
    fechaHoraRegistro: datos.fechaHoraRegistro.toISOString(),
    turnoId: datos.turnoId,
    grupoId: datos.grupoId,
    lugarId: datos.lugarId,
    producto: {
      id: datos.productoId,
      codigo: datos.codigoSnapshot,
      descripcion: datos.descripcionSnapshot,
    },
    fechaVencimiento: datos.fechaVencimiento.toISOString().slice(0, 10),
    cantidadCajas: datos.cantidadCajas,
    cantidadUnidades: datos.cantidadUnidades,
    estibasCompletas: datos.estibasCompletas,
    cajasSueltas: datos.cajasSueltas,
    // Texto calculado, equivalente a lo que antes se escribía a mano
    // en el Excel ("2 ESTIBAS+ 21 CAJAS").
    descripcionEstibas: remision.descripcionEstibas,
    numerosEstiba: datos.numerosEstiba,
    observaciones: datos.observaciones,
    extraoficial: datos.extraoficial,
    motivoExtraoficial: datos.motivoExtraoficial,
    entrega: {
      entregadaPorId: datos.entregadaPorId ?? null,
      fecha: datos.fechaEntrega?.toISOString() ?? null,
    },
    aprobacion: {
      opaNombre: datos.opaNombre ?? null,
      opaCargo: datos.opaCargo ?? null,
      fecha: datos.fechaAprobacion?.toISOString() ?? null,
    },
    validacion: {
      validadaPorId: datos.validadaPorId ?? null,
      conciliadoCon: datos.conciliadoCon ?? null,
      fecha: datos.fechaValidacion?.toISOString() ?? null,
    },
    motivoUltimoRechazo: remision.motivoUltimoRechazo,
    esEditable: remision.esEditable,
    estaPendienteDeConciliar: remision.estaPendienteDeConciliar,
  };
}

@Controller('remisiones')
export class RemisionController {
  private readonly logger = new Logger(RemisionController.name);

  constructor(
    private readonly crearRemision: CrearRemisionUseCase,
    private readonly editarRemision: EditarRemisionUseCase,
    private readonly imprimirRemisiones: ImprimirRemisionesUseCase,
    private readonly exportarRemisiones: ExportarRemisionesUseCase,
    private readonly entregarRemision: EntregarRemisionUseCase,
    private readonly aprobarRemision: AprobarRemisionUseCase,
    private readonly rechazarRemision: RechazarRemisionUseCase,
    private readonly rectificarRemision: RectificarRemisionUseCase,
    private readonly validarRemision: ValidarRemisionUseCase,
    @Inject(REMISION_REPOSITORY)
    private readonly remisiones: RemisionRepository,
    @Inject(HISTORIAL_REMISION_REPOSITORY)
    private readonly historial: HistorialRemisionRepository,
  ) { }

  // ==========================================================
  // CREACIÓN
  // ==========================================================

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @RequierePermisos('remision.crear')
  async crear(@Body() dto: CrearRemisionDto, @UsuarioActual() actual: Usuario) {
    const remision = await this.crearRemision.ejecutar({
      turnoId: dto.turnoId,
      grupoId: dto.grupoId,
      lugarId: dto.lugarId,
      productoId: dto.productoId,
      fechaVencimiento: dto.fechaVencimiento,
      cantidadCajas: dto.cantidadCajas,
      cantidadUnidades: dto.cantidadUnidades,
      estibasCompletas: dto.estibasCompletas,
      cajasSueltas: dto.cajasSueltas,
      numerosEstiba: dto.numerosEstiba,
      observaciones: dto.observaciones ?? null,
      extraoficial: dto.extraoficial ?? false,
      motivoExtraoficial: dto.motivoExtraoficial ?? null,
      creadaPorId: actual.id,
    });

    return presentar(remision);
  }

  // ==========================================================
  // EDICIÓN (solo BORRADOR o EN_RECTIFICACION; lo decide la entidad)
  // ==========================================================

  @Patch(':id')
  @RequierePermisos('remision.editar')
  async editar(
    @Param('id') id: string,
    @Body() dto: EditarRemisionDto,
    @UsuarioActual() actual: Usuario,
  ) {
    const remision = await this.editarRemision.ejecutar({
      remisionId: id,
      cambios: dto,
      editadaPorId: actual.id,
    });

    return presentar(remision);
  }

  // ==========================================================
  // FLUJO DE ESTADOS
  // ==========================================================

  /** El patinador entrega la remisión al OPA. */
  @Post(':id/entregar')
  @HttpCode(HttpStatus.OK)
  @RequierePermisos('remision.entregar')
  async entregar(@Param('id') id: string, @UsuarioActual() actual: Usuario) {
    const remision = await this.entregarRemision.ejecutar({
      remisionId: id,
      entregadaPorId: actual.id,
    });

    return presentar(remision);
  }

  /** El OPA de PepsiCo acepta la entrega. */
  @Post(':id/aprobar')
  @HttpCode(HttpStatus.OK)
  @RequierePermisos('remision.registrar_aprobacion')
  async aprobar(
    @Param('id') id: string,
    @Body() dto: AprobarRemisionDto,
    @UsuarioActual() actual: Usuario,
  ) {
    const remision = await this.aprobarRemision.ejecutar({
      remisionId: id,
      opaNombre: dto.opaNombre,
      opaCargo: dto.opaCargo ?? null,
      registradaPorId: actual.id,
    });

    return presentar(remision);
  }

  /** El OPA no acepta: debe verificarse y rectificarse. */
  @Post(':id/rechazar')
  @HttpCode(HttpStatus.OK)
  @RequierePermisos('remision.registrar_aprobacion')
  async rechazar(
    @Param('id') id: string,
    @Body() dto: RechazarRemisionDto,
    @UsuarioActual() actual: Usuario,
  ) {
    const remision = await this.rechazarRemision.ejecutar({
      remisionId: id,
      motivo: dto.motivo,
      registradaPorId: actual.id,
    });

    return presentar(remision);
  }

  /** Abre la rectificación: nueva versión, mismo consecutivo. */
  @Post(':id/rectificar')
  @HttpCode(HttpStatus.OK)
  @RequierePermisos('remision.rectificar')
  async rectificar(@Param('id') id: string, @UsuarioActual() actual: Usuario) {
    const remision = await this.rectificarRemision.ejecutar({
      remisionId: id,
      rectificadaPorId: actual.id,
    });

    return presentar(remision);
  }

  /** Conciliación interna (cuaderno virtual). */
  @Post(':id/validar')
  @HttpCode(HttpStatus.OK)
  @RequierePermisos('remision.validar')
  async validar(
    @Param('id') id: string,
    @Body() dto: ValidarRemisionDto,
    @UsuarioActual() actual: Usuario,
  ) {
    const remision = await this.validarRemision.ejecutar({
      remisionId: id,
      validadaPorId: actual.id,
      concilidadoCon: dto.concilidadoCon,
    });

    return presentar(remision);
  }

  // ==========================================================
  // CONSULTAS — todas con `remision.consultar`
  // ==========================================================

  @Get()
  @RequierePermisos('remision.consultar')
  async listar(
    @Query('anio') anio?: string,
    @Query('turnoId') turnoId?: string,
    @Query('grupoId') grupoId?: string,
    @Query('productoId') productoId?: string,
    @Query('estado') estado?: string,
    @Query('desde') desde?: string,
    @Query('hasta') hasta?: string,
    @Query('pagina') pagina?: string,
    @Query('porPagina') porPagina?: string,
  ) {
    const resultado = await this.remisiones.listar({
      anio: anio ? Number(anio) : undefined,
      turnoId,
      grupoId,
      productoId,
      estado: this.validarEstado(estado),
      // Los rangos se interpretan como fechas operativas, no
      // calendario: es la regla del corte 06:00 a 06:00.
      fechaOperativaDesde: desde ? new Date(`${desde}T00:00:00.000Z`) : undefined,
      fechaOperativaHasta: hasta ? new Date(`${hasta}T00:00:00.000Z`) : undefined,
      pagina: pagina ? Number(pagina) : undefined,
      porPagina: porPagina ? Number(porPagina) : undefined,
    });

    return {
      items: resultado.items.map(presentar),
      total: resultado.total,
      pagina: resultado.pagina,
      porPagina: resultado.porPagina,
    };
  }

  /**
   * Cuántas remisiones hay de cada estado en un rango de días
   * operativos. Devuelve seis números, no documentos.
   *
   * Existe para el tablero de inicio, que antes pedía seis listados
   * (uno por estado) solo para leer sus totales: seis veces el trabajo
   * del servidor y, en Firestore, seis lecturas completas del día.
   *
   * Va ANTES de `GET /:id`, como el resto de rutas con nombre; si no,
   * NestJS interpretaría "resumen" como un identificador.
   */
  @Get('resumen')
  @RequierePermisos('remision.consultar')
  async resumen(
    @Query('desde') desde?: string,
    @Query('hasta') hasta?: string,
    @Query('anio') anio?: string,
    @Query('turnoId') turnoId?: string,
    @Query('grupoId') grupoId?: string,
    @Query('productoId') productoId?: string,
  ) {
    const porEstado = await this.remisiones.contarPorEstado({
      anio: anio ? Number(anio) : undefined,
      turnoId,
      grupoId,
      productoId,
      fechaOperativaDesde: desde ? new Date(`${desde}T00:00:00.000Z`) : undefined,
      fechaOperativaHasta: hasta ? new Date(`${hasta}T00:00:00.000Z`) : undefined,
    });

    return {
      porEstado,
      total: Object.values(porEstado).reduce((suma, n) => suma + n, 0),
    };
  }

  // ==========================================================
  // DOCUMENTOS — van antes de `:id` para que no se confundan con un id
  // ==========================================================

  /**
   * PDF por lote: `?ids=a,b,c`. Dos remisiones por hoja, en el orden
   * pedido. Para imprimir una sola, `GET /:id/pdf` (abajo).
   */
  @Get('pdf')
  @RequierePermisos('remision.consultar')
  async pdfLote(@Query('ids') ids: string | undefined, @Res() res: Response) {
    const lista = (ids ?? '').split(',').map((s) => s.trim()).filter(Boolean);
    const pdf = await this.generarPdf(() => this.imprimirRemisiones.ejecutar(lista));
    this.responderArchivo(res, pdf, 'application/pdf', 'remisiones.pdf');
  }

  /**
   * Un fallo del generador (Chromium caído, sin memoria, ruta de Chrome
   * mal configurada) no es culpa del cliente ni un error de negocio: se
   * responde 503 con el motivo, y el detalle completo queda en el log.
   */
  private async generarPdf(generar: () => Promise<Buffer>): Promise<Buffer> {
    try {
      return await generar();
    } catch (error) {
      if (error instanceof ErrorDominio || error instanceof HttpException) {
        throw error;
      }
      const detalle = error instanceof Error ? error.message.split('\n')[0] : String(error);
      this.logger.error(`No se pudo generar el PDF: ${detalle}`, error instanceof Error ? error.stack : undefined);
      throw new ServiceUnavailableException(
        `No se pudo generar el PDF (${detalle}). Verifique que Chrome esté disponible (PUPPETEER_EXECUTABLE_PATH) e intente de nuevo.`,
      );
    }
  }

  /** Excel con los mismos filtros del listado, sin paginación. */
  @Get('exportar')
  @RequierePermisos('remision.exportar')
  async exportar(
    @Res() res: Response,
    @Query('anio') anio?: string,
    @Query('turnoId') turnoId?: string,
    @Query('grupoId') grupoId?: string,
    @Query('productoId') productoId?: string,
    @Query('estado') estado?: string,
    @Query('desde') desde?: string,
    @Query('hasta') hasta?: string,
  ) {
    const excel = await this.exportarRemisiones.ejecutar({
      anio: anio ? Number(anio) : undefined,
      turnoId,
      grupoId,
      productoId,
      estado: this.validarEstado(estado),
      fechaOperativaDesde: desde ? new Date(`${desde}T00:00:00.000Z`) : undefined,
      fechaOperativaHasta: hasta ? new Date(`${hasta}T00:00:00.000Z`) : undefined,
    });
    const nombre = `remisiones${desde ? `_${desde}` : ''}${hasta ? `_${hasta}` : ''}.xlsx`;
    this.responderArchivo(
      res,
      excel,
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      nombre,
    );
  }

  @Get(':id/pdf')
  @RequierePermisos('remision.consultar')
  async pdf(@Param('id') id: string, @Res() res: Response) {
    const remision = await this.remisiones.buscarPorId(id);
    if (!remision) {
      throw new NotFoundException(`No existe la remisión "${id}".`);
    }
    const pdf = await this.generarPdf(() => this.imprimirRemisiones.ejecutar([id]));
    this.responderArchivo(res, pdf, 'application/pdf', `remision_${remision.consecutivo}.pdf`);
  }

  private responderArchivo(res: Response, contenido: Buffer, tipo: string, nombre: string): void {
    res.setHeader('Content-Type', tipo);
    // `inline` para que el navegador lo muestre (PDF) y el nombre sirva al guardar.
    res.setHeader('Content-Disposition', `inline; filename="${nombre}"`);
    res.setHeader('Content-Length', String(contenido.length));
    res.end(contenido);
  }

  @Get('consecutivo/:anio/:numero')
  @RequierePermisos('remision.consultar')
  async porConsecutivo(
    @Param('anio', ParseIntPipe) anio: number,
    @Param('numero', ParseIntPipe) numero: number,
  ) {
    const remision = await this.remisiones.buscarPorConsecutivo(anio, numero);

    if (!remision) {
      throw new NotFoundException(
        `No existe la remisión ${anio}-${String(numero).padStart(4, '0')}.`,
      );
    }

    return presentar(remision);
  }

  /** Versiones anteriores del documento (una por rectificación). */
  @Get(':id/versiones')
  @RequierePermisos('remision.consultar')
  versiones(@Param('id') id: string) {
    return this.historial.versiones(id);
  }

  /** Rastro de auditoría de la remisión: quién hizo qué y cuándo. */
  @Get(':id/auditoria')
  @RequierePermisos('remision.consultar', 'admin.auditoria')
  auditoria(@Param('id') id: string) {
    return this.historial.auditoria(id);
  }

  /**
   * Va al final a propósito: si estuviera antes de
   * `consecutivo/:anio/:numero`, NestJS interpretaría "consecutivo"
   * como un id y esa ruta nunca se alcanzaría.
   */
  @Get(':id')
  @RequierePermisos('remision.consultar')
  async obtener(@Param('id') id: string) {
    const remision = await this.remisiones.buscarPorId(id);

    if (!remision) {
      throw new NotFoundException(`No existe la remisión "${id}".`);
    }

    return presentar(remision);
  }

  private validarEstado(valor?: string): EstadoRemision | undefined {
    if (!valor) {
      return undefined;
    }
    return ESTADOS_REMISION.includes(valor as EstadoRemision)
      ? (valor as EstadoRemision)
      : undefined;
  }
}