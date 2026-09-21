/**
 * CONTROLADOR MFR
 * ===============
 *
 *   GET    /mfr/dia?fecha=YYYY-MM-DD        mfr.consultar             tablero del día (bloques, MFR, turnos, líneas, horario)
 *   GET    /mfr/bloques?fecha=              mfr.consultar             bloques del día con Mx/T/kg calculados
 *   PUT    /mfr/bloques                     mfr.cargar_programacion   crea o corrige un bloque (corregir exige motivo)
 *   DELETE /mfr/bloques/:id                 mfr.cargar_programacion   { motivo }
 *   POST   /mfr/bloques/dia                 mfr.cargar_programacion   carga un día completo (manual o importado)
 *   POST   /mfr/bloques/copiar              mfr.cargar_programacion   copia la programación de otro día
 *   POST   /mfr/dpp/analizar  (multipart)   mfr.cargar_programacion   PDF del DPP → propuesta de bloques
 *   POST   /mfr/turno/cerrar                mfr.configurar_turno      { fechaOperativa, turnoId, motivoFaltante? } (400 MFR_FALTANTE_SIN_MOTIVO con `faltantes` si hay SKU bajo target)
 *   GET    /mfr/asistencia?fecha=           mfr.consultar             asistencia registrada por turno y grupo
 *   PUT    /mfr/asistencia                  mfr.configurar_turno      { fechaOperativa, turnoId, grupoId, personasLlegaron, observacion? } crea o corrige
 *   GET    /mfr/asignaciones?fecha=         mfr.consultar             grupos asignados a líneas por turno
 *   PUT    /mfr/asignaciones                mfr.configurar_turno      { fechaOperativa, turnoId, lineaId, grupoId, personas } crea o corrige
 *   DELETE /mfr/asignaciones/:id            mfr.configurar_turno
 *   GET    /mfr/lineas                      mfr.consultar
 *   POST   /mfr/lineas                      catalogo.editar
 *   PATCH  /mfr/lineas/:id                  catalogo.editar
 *   GET    /mfr/estandares                  mfr.consultar             incluye pesoSugeridoKg
 *   PUT    /mfr/estandares/:productoId      catalogo.editar_estandares { cajasPorHora?, pesoNetoKg?, motivo }
 *
 * Las fechas llegan como YYYY-MM-DD y se convierten a medianoche UTC,
 * igual que la fecha operativa de las remisiones.
 */

import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Inject,
  Param,
  Patch,
  Post,
  Put,
  Query,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';

import { AnalizarDppUseCase } from '../../application/mfr/analizar-dpp.use-case.js';
import {
  CargarDiaUseCase,
  CerrarTurnoUseCase,
  CopiarDiaUseCase,
  EliminarBloqueUseCase,
  GuardarBloqueUseCase,
} from '../../application/mfr/bloques.use-cases.js';
import {
  ActualizarEstandarUseCase,
  ActualizarLineaUseCase,
  CrearLineaUseCase,
} from '../../application/mfr/catalogos-mfr.use-cases.js';
import { AsignarGrupoLineaUseCase, QuitarAsignacionUseCase } from '../../application/mfr/asignacion.use-cases.js';
import { RegistrarAsistenciaUseCase } from '../../application/mfr/asistencia.use-case.js';
import { IndicadoresDiaUseCase } from '../../application/mfr/indicadores-dia.use-case.js';
import {
  ASIGNACION_REPOSITORY,
  type AsignacionLinea,
  type AsignacionRepository,
} from '../../domain/mfr/asignacion-linea.js';
import {
  ASISTENCIA_REPOSITORY,
  type AsistenciaRepository,
  type AsistenciaTurno,
} from '../../domain/mfr/asistencia-turno.js';
import type { BloqueProgramacion } from '../../domain/mfr/bloque-programacion.js';
import {
  ESTANDAR_REPOSITORY,
  pesoNetoSugeridoKg,
  type EstandarRepository,
} from '../../domain/mfr/estandar-produccion.js';
import { LINEA_REPOSITORY, type LineaRepository } from '../../domain/mfr/linea-produccion.js';
import { DatosMfrInvalidosError, DppNoReconocidoError } from '../../domain/mfr/mfr.errors.js';
import { fechaOperativaADate } from '../../domain/shared/fecha-operativa.js';
import type { Usuario } from '../../domain/usuario/usuario.entity.js';
import { RequierePermisos, UsuarioActual } from '../../infrastructure/auth/decoradores.js';
import { LectorPdfService } from '../../infrastructure/dpp/lector-pdf.js';
import {
  ActualizarEstandarDto,
  ActualizarLineaDto,
  AsignarGrupoLineaDto,
  CargarDiaDto,
  CerrarTurnoDto,
  CopiarDiaDto,
  CrearLineaDto,
  GuardarBloqueDto,
  MotivoDto,
  RegistrarAsistenciaDto,
} from './dto/mfr.dto.js';

/** Lo que entrega multer; se tipa aquí para no depender de @types/multer. */
interface ArchivoSubido {
  originalname: string;
  size: number;
  buffer: Buffer;
}

const TAMANO_MAXIMO_PDF = 5 * 1024 * 1024;

function fecha(texto: string | undefined): Date {
  if (!texto) {
    throw new DatosMfrInvalidosError('Falta el parámetro fecha (YYYY-MM-DD).');
  }
  return fechaOperativaADate(texto);
}

function presentarBloque(b: BloqueProgramacion) {
  const d = b.aObjeto();
  return { ...d, fechaOperativa: d.fechaOperativa.toISOString().slice(0, 10), horas: b.horas, cerrado: b.estaCerrado };
}

function presentarConFecha<T extends { fechaOperativa: Date }>(a: T) {
  return { ...a, fechaOperativa: a.fechaOperativa.toISOString().slice(0, 10) };
}
const presentarAsistencia = (a: AsistenciaTurno) => presentarConFecha(a);
const presentarAsignacion = (a: AsignacionLinea) => presentarConFecha(a);

@Controller('mfr')
export class MfrController {
  constructor(
    private readonly indicadoresDia: IndicadoresDiaUseCase,
    private readonly guardarBloque: GuardarBloqueUseCase,
    private readonly eliminarBloque: EliminarBloqueUseCase,
    private readonly cargarDia: CargarDiaUseCase,
    private readonly copiarDia: CopiarDiaUseCase,
    private readonly cerrarTurno: CerrarTurnoUseCase,
    private readonly registrarAsistencia: RegistrarAsistenciaUseCase,
    private readonly asignarGrupoLinea: AsignarGrupoLineaUseCase,
    private readonly quitarAsignacion: QuitarAsignacionUseCase,
    private readonly analizarDpp: AnalizarDppUseCase,
    private readonly lectorPdf: LectorPdfService,
    private readonly crearLinea: CrearLineaUseCase,
    private readonly actualizarLinea: ActualizarLineaUseCase,
    private readonly actualizarEstandar: ActualizarEstandarUseCase,
    @Inject(LINEA_REPOSITORY) private readonly lineas: LineaRepository,
    @Inject(ESTANDAR_REPOSITORY) private readonly estandares: EstandarRepository,
    @Inject(ASISTENCIA_REPOSITORY) private readonly asistencias: AsistenciaRepository,
    @Inject(ASIGNACION_REPOSITORY) private readonly asignaciones: AsignacionRepository,
  ) {}

  // ---------- Tablero ----------

  @Get('dia')
  @RequierePermisos('mfr.consultar')
  async dia(@Query('fecha') f?: string) {
    const tablero = await this.indicadoresDia.ejecutar(fecha(f));
    return { ...tablero, fechaOperativa: tablero.fechaOperativa.toISOString().slice(0, 10) };
  }

  // ---------- Bloques ----------

  @Get('bloques')
  @RequierePermisos('mfr.consultar')
  async bloques(@Query('fecha') f?: string) {
    return (await this.indicadoresDia.ejecutar(fecha(f))).bloques;
  }

  @Put('bloques')
  @RequierePermisos('mfr.cargar_programacion')
  async guardarBloqueHttp(@Body() dto: GuardarBloqueDto, @UsuarioActual() actual: Usuario) {
    const bloque = await this.guardarBloque.ejecutar({
      id: dto.id ?? null,
      fechaOperativa: fechaOperativaADate(dto.fechaOperativa),
      lineaId: dto.lineaId,
      productoId: dto.productoId,
      horaInicio: dto.horaInicio,
      horaFin: dto.horaFin,
      cajasPorHora: dto.cajasPorHora,
      eficienciaPorcentaje: dto.eficienciaPorcentaje,
      loop: dto.loop ?? null,
      personasAsignadas: dto.personasAsignadas ?? null,
      motivo: dto.motivo ?? null,
      usuarioId: actual.id,
    });
    return presentarBloque(bloque);
  }

  @Delete('bloques/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @RequierePermisos('mfr.cargar_programacion')
  async eliminarBloqueHttp(@Param('id') id: string, @Body() dto: MotivoDto, @UsuarioActual() actual: Usuario) {
    await this.eliminarBloque.ejecutar(id, dto.motivo, actual.id);
  }

  @Post('bloques/dia')
  @RequierePermisos('mfr.cargar_programacion')
  async cargarDiaHttp(@Body() dto: CargarDiaDto, @UsuarioActual() actual: Usuario) {
    const creados = await this.cargarDia.ejecutar({
      fechaOperativa: fechaOperativaADate(dto.fechaOperativa),
      bloques: dto.bloques.map((b) => ({ ...b, loop: b.loop ?? null, personasAsignadas: b.personasAsignadas ?? null })),
      origen: dto.origen,
      reemplazar: dto.reemplazar,
      motivo: dto.motivo ?? null,
      usuarioId: actual.id,
    });
    return creados.map(presentarBloque);
  }

  @Post('bloques/copiar')
  @RequierePermisos('mfr.cargar_programacion')
  async copiarDiaHttp(@Body() dto: CopiarDiaDto, @UsuarioActual() actual: Usuario) {
    const creados = await this.copiarDia.ejecutar({
      desde: fechaOperativaADate(dto.desde),
      hacia: fechaOperativaADate(dto.hacia),
      reemplazar: dto.reemplazar,
      motivo: dto.motivo ?? null,
      usuarioId: actual.id,
    });
    return creados.map(presentarBloque);
  }

  // ---------- Importación del DPP ----------

  @Post('dpp/analizar')
  @RequierePermisos('mfr.cargar_programacion')
  @UseInterceptors(FileInterceptor('archivo', { limits: { fileSize: TAMANO_MAXIMO_PDF } }))
  async analizarDppHttp(@UploadedFile() archivo?: ArchivoSubido) {
    if (!archivo) {
      throw new DppNoReconocidoError('Adjunte el PDF del DPP en el campo "archivo".');
    }
    const texto = await this.lectorPdf.extraerTexto(archivo.buffer);
    const propuesta = await this.analizarDpp.ejecutar(texto);
    return { archivo: archivo.originalname, ...propuesta };
  }

  // ---------- Turno ----------

  @Post('turno/cerrar')
  @RequierePermisos('mfr.configurar_turno')
  async cerrar(@Body() dto: CerrarTurnoDto, @UsuarioActual() actual: Usuario) {
    const cerrados = await this.cerrarTurno.ejecutar({
      fechaOperativa: fechaOperativaADate(dto.fechaOperativa),
      turnoId: dto.turnoId,
      motivoFaltante: dto.motivoFaltante ?? null,
      usuarioId: actual.id,
    });
    return cerrados.map(presentarBloque);
  }

  // ---------- Asistencia (personal del turno) ----------

  @Get('asistencia')
  @RequierePermisos('mfr.consultar')
  async asistenciaDia(@Query('fecha') f?: string) {
    return (await this.asistencias.listarPorFecha(fecha(f))).map(presentarAsistencia);
  }

  @Put('asistencia')
  @RequierePermisos('mfr.configurar_turno')
  async registrarAsistenciaHttp(@Body() dto: RegistrarAsistenciaDto, @UsuarioActual() actual: Usuario) {
    const guardada = await this.registrarAsistencia.ejecutar({
      fechaOperativa: fechaOperativaADate(dto.fechaOperativa),
      turnoId: dto.turnoId,
      grupoId: dto.grupoId,
      personasLlegaron: dto.personasLlegaron,
      observacion: dto.observacion ?? null,
      usuarioId: actual.id,
    });
    return presentarAsistencia(guardada);
  }

  // ---------- Asignación de grupos a líneas ----------

  @Get('asignaciones')
  @RequierePermisos('mfr.consultar')
  async asignacionesDia(@Query('fecha') f?: string) {
    return (await this.asignaciones.listarPorFecha(fecha(f))).map(presentarAsignacion);
  }

  @Put('asignaciones')
  @RequierePermisos('mfr.configurar_turno')
  async asignarHttp(@Body() dto: AsignarGrupoLineaDto, @UsuarioActual() actual: Usuario) {
    const guardada = await this.asignarGrupoLinea.ejecutar({
      fechaOperativa: fechaOperativaADate(dto.fechaOperativa),
      turnoId: dto.turnoId,
      lineaId: dto.lineaId,
      grupoId: dto.grupoId,
      personas: dto.personas,
      usuarioId: actual.id,
    });
    return presentarAsignacion(guardada);
  }

  @Delete('asignaciones/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @RequierePermisos('mfr.configurar_turno')
  async quitarAsignacionHttp(@Param('id') id: string, @UsuarioActual() actual: Usuario) {
    await this.quitarAsignacion.ejecutar(id, actual.id);
  }

  // ---------- Líneas ----------

  @Get('lineas')
  @RequierePermisos('mfr.consultar')
  listarLineas() {
    return this.lineas.listar();
  }

  @Post('lineas')
  @HttpCode(HttpStatus.CREATED)
  @RequierePermisos('catalogo.editar')
  crearLineaHttp(@Body() dto: CrearLineaDto, @UsuarioActual() actual: Usuario) {
    return this.crearLinea.ejecutar(
      { codigo: dto.codigo, nombre: dto.nombre, tipo: dto.tipo, capacidadKgHora: dto.capacidadKgHora ?? null, orden: dto.orden ?? 0 },
      actual.id,
    );
  }

  @Patch('lineas/:id')
  @RequierePermisos('catalogo.editar')
  actualizarLineaHttp(@Param('id') id: string, @Body() dto: ActualizarLineaDto, @UsuarioActual() actual: Usuario) {
    return this.actualizarLinea.ejecutar(id, dto, actual.id);
  }

  // ---------- Estándares ----------

  @Get('estandares')
  @RequierePermisos('mfr.consultar')
  async listarEstandares() {
    return (await this.estandares.listar()).map((e) => ({ ...e, pesoSugeridoKg: pesoNetoSugeridoKg(e.descripcion) }));
  }

  @Put('estandares/:productoId')
  @RequierePermisos('catalogo.editar_estandares')
  actualizarEstandarHttp(
    @Param('productoId') productoId: string,
    @Body() dto: ActualizarEstandarDto,
    @UsuarioActual() actual: Usuario,
  ) {
    return this.actualizarEstandar.ejecutar({
      productoId,
      cajasPorHora: dto.cajasPorHora ?? null,
      pesoNetoKg: dto.pesoNetoKg ?? null,
      motivo: dto.motivo,
      usuarioId: actual.id,
    });
  }
}
