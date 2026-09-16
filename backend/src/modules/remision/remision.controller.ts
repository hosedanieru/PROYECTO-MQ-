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
  HttpStatus,
  Inject,
  NotFoundException,
  Param,
  ParseIntPipe,
  Post,
  Query,
} from '@nestjs/common';

import { CrearRemisionUseCase } from '../../application/remision/crear-remision.use-case.js';
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
  REMISION_REPOSITORY,
  type RemisionRepository,
} from '../../domain/remision/remision.repository.js';
import type { Usuario } from '../../domain/usuario/usuario.entity.js';
import {
  RequierePermisos,
  UsuarioActual,
} from '../../infrastructure/auth/decoradores.js';
import { CrearRemisionDto } from './dto/crear-remision.dto.js';
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
    proveedorId: datos.proveedorId,
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
  constructor(
    private readonly crearRemision: CrearRemisionUseCase,
    private readonly entregarRemision: EntregarRemisionUseCase,
    private readonly aprobarRemision: AprobarRemisionUseCase,
    private readonly rechazarRemision: RechazarRemisionUseCase,
    private readonly rectificarRemision: RectificarRemisionUseCase,
    private readonly validarRemision: ValidarRemisionUseCase,
    @Inject(REMISION_REPOSITORY)
    private readonly remisiones: RemisionRepository,
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
      proveedorId: dto.proveedorId,
      lugarId: dto.lugarId,
      productoId: dto.productoId,
      fechaVencimiento: dto.fechaVencimiento,
      cantidadCajas: dto.cantidadCajas,
      cantidadUnidades: dto.cantidadUnidades,
      estibasCompletas: dto.estibasCompletas,
      cajasSueltas: dto.cajasSueltas,
      numerosEstiba: dto.numerosEstiba,
      observaciones: dto.observaciones ?? null,
      creadaPorId: actual.id,
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
    @Query('proveedorId') proveedorId?: string,
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
      proveedorId,
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