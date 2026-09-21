import { readFileSync } from 'node:fs';
import path from 'node:path';

import { beforeEach, describe, expect, it } from 'vitest';

import type { CatalogoRepository } from '../../domain/catalogo/catalogo.repository.js';
import {
  AsignacionExcedeAsistenciaError,
  AsignacionNoEncontradaError,
  AsignacionSinAsistenciaError,
  BloqueNoEncontradoError,
  BloquesSolapadosError,
  DatosMfrInvalidosError,
  DiaConProgramacionError,
  DppNoReconocidoError,
  FaltanteSinMotivoError,
  LineaNoEncontradaError,
  MotivoObligatorioError,
  TurnoCerradoError,
} from '../../domain/mfr/mfr.errors.js';
import type { RemisionRepository } from '../../domain/remision/remision.repository.js';
import {
  AuditoriaRepositorioFalso,
  ProductoRepositorioFalso,
  REMISIONES_SIN_USO,
  UnidadDeTrabajoFalsa,
} from '../pruebas/dobles-en-memoria.js';
import {
  AsignacionRepositorioFalso,
  AsistenciaRepositorioFalso,
  BloqueRepositorioFalso,
  EstandarRepositorioFalso,
  GrupoRepositorioFalso,
  HorarioRepositorioFalso,
  LineaRepositorioFalso,
  horariosDpp,
} from '../pruebas/dobles-mfr.js';
import { GrupoNoEncontradoError } from '../../domain/grupo/grupo.errors.js';
import { evaluarLineasTurno } from '../../domain/mfr/asignacion-linea.js';
import { evaluarPersonalTurno } from '../../domain/mfr/asistencia-turno.js';
import { AnalizarDppUseCase } from './analizar-dpp.use-case.js';
import { AsignarGrupoLineaUseCase, QuitarAsignacionUseCase } from './asignacion.use-cases.js';
import { RegistrarAsistenciaUseCase } from './asistencia.use-case.js';
import {
  CargarDiaUseCase,
  CerrarTurnoUseCase,
  CopiarDiaUseCase,
  EliminarBloqueUseCase,
  GuardarBloqueUseCase,
} from './bloques.use-cases.js';
import { ActualizarEstandarUseCase } from './catalogos-mfr.use-cases.js';
import { IndicadoresDiaUseCase } from './indicadores-dia.use-case.js';

const FECHA = new Date('2026-09-16T00:00:00.000Z'); // miércoles
const MANANA = new Date('2026-09-17T00:00:00.000Z');
const RELOJ = { ahora: () => new Date('2026-09-16T12:00:00.000Z') };

describe('MFR — casos de uso', () => {
  let productos: ProductoRepositorioFalso;
  let bloques: BloqueRepositorioFalso;
  let lineas: LineaRepositorioFalso;
  let estandares: EstandarRepositorioFalso;
  let horarios: HorarioRepositorioFalso;
  let auditoria: AuditoriaRepositorioFalso;
  let grupos: GrupoRepositorioFalso;
  let asistencias: AsistenciaRepositorioFalso;
  let asignaciones: AsignacionRepositorioFalso;
  let uow: UnidadDeTrabajoFalsa;

  const bloqueBase = (extra: Record<string, unknown> = {}) => ({
    fechaOperativa: FECHA, lineaId: 'L1', productoId: 'LNC', horaInicio: '06:00', horaFin: '13:30',
    cajasPorHora: 150, eficienciaPorcentaje: 87, loop: 'LOOP1', personasAsignadas: null, usuarioId: 'coord', ...extra,
  });

  beforeEach(() => {
    productos = new ProductoRepositorioFalso();
    productos.agregar({ id: 'LNC', codigo: '300066770', descripcion: 'SURT MG LNC 586GX4X1 BX22', proceso: 'AUTOMATICA', activo: true, unidadesPorCaja: 4, cajasPorEstiba: 22, personasIdeal: 13, subdescripcion: 'SURTIDO', cajasPorHora: 150, pesoNetoKg: 2.344 });
    productos.agregar({ id: 'SPR', codigo: '300058140', descripcion: 'SRT SPR LNC 271GX7X1 BX12', proceso: 'AUTOMATICA', activo: true, unidadesPorCaja: 7, cajasPorEstiba: 12, personasIdeal: 12, subdescripcion: 'SURTIDO', cajasPorHora: 77.14, pesoNetoKg: null });
    productos.agregar({ id: 'X', codigo: '999', descripcion: 'INACTIVO', proceso: null, activo: false, unidadesPorCaja: null, cajasPorEstiba: null, personasIdeal: null, subdescripcion: null, cajasPorHora: null, pesoNetoKg: null });
    bloques = new BloqueRepositorioFalso();
    lineas = new LineaRepositorioFalso();
    lineas.agregar({ id: 'L1', codigo: 'L1', nombre: 'LINEA 1', tipo: 'MULTIPACK', capacidadKgHora: 306, orden: 1, activo: true });
    lineas.agregar({ id: 'L2', codigo: 'L2', nombre: 'LINEA 2', tipo: 'MULTIPACK', capacidadKgHora: 306, orden: 2, activo: true });
    estandares = new EstandarRepositorioFalso();
    estandares.agregar({ productoId: 'LNC', codigo: '300066770', descripcion: 'SURT MG LNC 586GX4X1 BX22', subdescripcion: 'SURTIDO', unidadesPorCaja: 4, cajasPorHora: 150, pesoNetoKg: 2.344 });
    estandares.agregar({ productoId: 'SPR', codigo: '300058140', descripcion: 'SRT SPR LNC 271GX7X1 BX12', subdescripcion: 'SURTIDO', unidadesPorCaja: 7, cajasPorHora: 77.14, pesoNetoKg: null });
    horarios = new HorarioRepositorioFalso(horariosDpp());
    auditoria = new AuditoriaRepositorioFalso();
    grupos = new GrupoRepositorioFalso();
    grupos.agregar({ id: 'G1', codigo: 'LOGICMARD', nombre: 'LOGICMARD', descripcion: null, personasEsperadas: 10, activo: true });
    grupos.agregar({ id: 'G2', codigo: 'MIX', nombre: 'MIX', descripcion: null, personasEsperadas: null, activo: true });
    grupos.agregar({ id: 'G3', codigo: 'VIEJO', nombre: 'VIEJO', descripcion: null, personasEsperadas: 5, activo: false });
    asistencias = new AsistenciaRepositorioFalso();
    asignaciones = new AsignacionRepositorioFalso();
    uow = new UnidadDeTrabajoFalsa({ productos, bloques, lineas, estandares, auditoria, grupos, asistencias, asignaciones });
  });

  describe('GuardarBloqueUseCase', () => {
    it('crea un bloque y le asigna el turno según la hora de inicio', async () => {
      const useCase = new GuardarBloqueUseCase(uow, productos, horarios, RELOJ);

      const t1 = await useCase.ejecutar(bloqueBase());
      const t2 = await useCase.ejecutar(bloqueBase({ horaInicio: '14:00', horaFin: '21:30' }));
      const t3 = await useCase.ejecutar(bloqueBase({ horaInicio: '22:00', horaFin: '05:30' }));

      // Sin personas indicadas se toma la "línea ideal" del producto (13 para LNC).
      expect(t1.aObjeto()).toMatchObject({ turnoId: 'T1', origen: 'MANUAL', creadoPorId: 'coord', loop: 'LOOP1', personasAsignadas: 13 });
      expect(t2.aObjeto().turnoId).toBe('T2');
      expect(t3.aObjeto().turnoId).toBe('T3');
      expect(auditoria.entradas.map((e) => e.accion)).toEqual(['CREAR', 'CREAR', 'CREAR']);
    });

    it('rechaza solapamientos en la misma línea, línea o producto inválidos y días sin horarios', async () => {
      const useCase = new GuardarBloqueUseCase(uow, productos, horarios, RELOJ);
      await useCase.ejecutar(bloqueBase());

      await expect(useCase.ejecutar(bloqueBase({ horaInicio: '13:00', horaFin: '15:00' }))).rejects.toThrow(BloquesSolapadosError);
      await expect(useCase.ejecutar(bloqueBase({ lineaId: 'L2', horaInicio: '13:00', horaFin: '15:00' }))).resolves.toBeDefined();
      await expect(useCase.ejecutar(bloqueBase({ lineaId: 'L9', horaInicio: '14:00', horaFin: '15:00' }))).rejects.toThrow();
      await expect(useCase.ejecutar(bloqueBase({ productoId: 'X', horaInicio: '14:00', horaFin: '15:00' }))).rejects.toThrow(DatosMfrInvalidosError);

      const sinHorarios = new GuardarBloqueUseCase(uow, productos, new HorarioRepositorioFalso([]), RELOJ);
      await expect(sinHorarios.ejecutar(bloqueBase({ horaInicio: '14:00', horaFin: '15:00' }))).rejects.toThrow(DatosMfrInvalidosError);
    });

    it('corregir exige motivo, audita el valor anterior y recalcula el turno', async () => {
      const useCase = new GuardarBloqueUseCase(uow, productos, horarios, RELOJ);
      const creado = await useCase.ejecutar(bloqueBase());

      await expect(useCase.ejecutar(bloqueBase({ id: creado.id, eficienciaPorcentaje: 80 }))).rejects.toThrow(MotivoObligatorioError);
      await expect(useCase.ejecutar(bloqueBase({ id: 'nadie', motivo: 'Cambio de PepsiCo' }))).rejects.toThrow(BloqueNoEncontradoError);
      await expect(useCase.ejecutar(bloqueBase({ id: creado.id, lineaId: 'L2', motivo: 'Cambio de PepsiCo' }))).rejects.toThrow(DatosMfrInvalidosError);

      const corregido = await useCase.ejecutar(
        bloqueBase({ id: creado.id, horaInicio: '14:00', horaFin: '21:30', eficienciaPorcentaje: 80, motivo: 'PepsiCo movió el bloque al T2' }),
      );
      expect(corregido.aObjeto()).toMatchObject({ turnoId: 'T2', eficienciaPorcentaje: 80, horaInicio: '14:00' });
      expect(auditoria.entradas[1]).toMatchObject({
        accion: 'ACTUALIZAR',
        motivo: 'PepsiCo movió el bloque al T2',
        valorAnterior: { eficienciaPorcentaje: 87, turnoId: 'T1' },
        valorNuevo: { eficienciaPorcentaje: 80, turnoId: 'T2' },
      });
    });
  });

  describe('EliminarBloqueUseCase y CerrarTurnoUseCase', () => {
    it('elimina con motivo; cerrar congela el turno y después nada se toca', async () => {
      const guardar = new GuardarBloqueUseCase(uow, productos, horarios, RELOJ);
      const a = await guardar.ejecutar(bloqueBase());
      const b = await guardar.ejecutar(bloqueBase({ lineaId: 'L2', productoId: 'SPR', cajasPorHora: 77.14, eficienciaPorcentaje: 84 }));
      await guardar.ejecutar(bloqueBase({ horaInicio: '14:00', horaFin: '21:30' })); // T2

      const eliminar = new EliminarBloqueUseCase(uow);
      await expect(eliminar.ejecutar(a.id, '', 'coord')).rejects.toThrow(MotivoObligatorioError);
      await eliminar.ejecutar(a.id, 'Error de digitación', 'coord');
      expect(bloques.items.has(a.id)).toBe(false);

      const cerrar = new CerrarTurnoUseCase(uow, RELOJ);
      // "Ni menos": no hay remisiones aprobadas → el T1 cierra con faltante y exige motivo.
      await expect(cerrar.ejecutar({ fechaOperativa: FECHA, turnoId: 'T1', usuarioId: 'coord' })).rejects.toThrow(FaltanteSinMotivoError);
      await expect(cerrar.ejecutar({ fechaOperativa: FECHA, turnoId: 'T1', usuarioId: 'coord' })).rejects.toMatchObject({
        faltantes: [{ productoId: 'SPR', programadoCajas: 486, producidoCajas: 0, faltanteCajas: 486 }],
      });
      const cerrados = await cerrar.ejecutar({ fechaOperativa: FECHA, turnoId: 'T1', motivoFaltante: 'Parada de línea por falta de material', usuarioId: 'coord' });
      expect(cerrados.map((c) => c.id)).toEqual([b.id]);
      expect(cerrados[0].estaCerrado).toBe(true);
      expect(auditoria.entradas.at(-1)).toMatchObject({ accion: 'CAMBIO_ESTADO', motivo: 'Parada de línea por falta de material' });

      await expect(guardar.ejecutar(bloqueBase({ id: b.id, lineaId: 'L2', productoId: 'SPR', cajasPorHora: 77.14, eficienciaPorcentaje: 50, motivo: 'intento' }))).rejects.toThrow(TurnoCerradoError);
      await expect(eliminar.ejecutar(b.id, 'intento tardío', 'coord')).rejects.toThrow(TurnoCerradoError);
      await expect(cerrar.ejecutar({ fechaOperativa: FECHA, turnoId: 'T1', usuarioId: 'coord' })).rejects.toThrow(TurnoCerradoError);
      await expect(cerrar.ejecutar({ fechaOperativa: FECHA, turnoId: 'T3', usuarioId: 'coord' })).rejects.toThrow(BloqueNoEncontradoError);
      // T2 sigue abierto (también con faltante: exige motivo).
      await expect(cerrar.ejecutar({ fechaOperativa: FECHA, turnoId: 'T2', motivoFaltante: 'Sin producción en T2', usuarioId: 'coord' })).resolves.toHaveLength(1);
    });
  });

  describe('CargarDiaUseCase y CopiarDiaUseCase', () => {
    const filas = [
      { lineaId: 'L1', productoId: 'LNC', horaInicio: '06:00', horaFin: '13:30', cajasPorHora: 150, eficienciaPorcentaje: 87, loop: 'LOOP1', personasAsignadas: null },
      { lineaId: 'L2', productoId: 'SPR', horaInicio: '06:00', horaFin: '13:30', cajasPorHora: 77.14, eficienciaPorcentaje: 84, loop: null, personasAsignadas: null },
    ];

    it('carga el día completo en una transacción y se niega a pisar sin "reemplazar" + motivo', async () => {
      const cargar = new CargarDiaUseCase(uow, productos, horarios, RELOJ);

      const creados = await cargar.ejecutar({ fechaOperativa: FECHA, bloques: filas, origen: 'DPP', reemplazar: false, usuarioId: 'coord' });
      expect(creados).toHaveLength(2);
      expect(creados.every((b) => b.aObjeto().origen === 'DPP')).toBe(true);

      await expect(cargar.ejecutar({ fechaOperativa: FECHA, bloques: filas, origen: 'DPP', reemplazar: false, usuarioId: 'coord' })).rejects.toThrow(DiaConProgramacionError);
      await expect(cargar.ejecutar({ fechaOperativa: FECHA, bloques: filas, origen: 'DPP', reemplazar: true, usuarioId: 'coord' })).rejects.toThrow(MotivoObligatorioError);

      const nuevos = await cargar.ejecutar({ fechaOperativa: FECHA, bloques: [filas[0]], origen: 'DPP', reemplazar: true, motivo: 'PepsiCo reenvió el DPP', usuarioId: 'coord' });
      expect(nuevos).toHaveLength(1);
      expect(bloques.items.size).toBe(1);
      expect(auditoria.entradas.filter((e) => e.accion === 'ELIMINAR')).toHaveLength(2);

      await expect(cargar.ejecutar({ fechaOperativa: FECHA, bloques: [], origen: 'DPP', reemplazar: true, motivo: 'x', usuarioId: 'coord' })).rejects.toThrow(DatosMfrInvalidosError);
      await expect(
        cargar.ejecutar({ fechaOperativa: MANANA, bloques: [filas[0], { ...filas[0], horaInicio: '10:00', horaFin: '12:00' }], origen: 'DPP', reemplazar: false, usuarioId: 'coord' }),
      ).rejects.toThrow(BloquesSolapadosError);
    });

    it('copia la programación de un día a otro con origen COPIA', async () => {
      const cargar = new CargarDiaUseCase(uow, productos, horarios, RELOJ);
      await cargar.ejecutar({ fechaOperativa: FECHA, bloques: filas, origen: 'DPP', reemplazar: false, usuarioId: 'coord' });

      const copiar = new CopiarDiaUseCase(cargar, bloques);
      await expect(copiar.ejecutar({ desde: FECHA, hacia: FECHA, reemplazar: false, usuarioId: 'coord' })).rejects.toThrow(DatosMfrInvalidosError);
      await expect(copiar.ejecutar({ desde: MANANA, hacia: FECHA, reemplazar: false, usuarioId: 'coord' })).rejects.toThrow(BloqueNoEncontradoError);

      const copiados = await copiar.ejecutar({ desde: FECHA, hacia: MANANA, reemplazar: false, usuarioId: 'coord' });
      expect(copiados).toHaveLength(2);
      expect(copiados.every((b) => b.aObjeto().origen === 'COPIA' && b.aObjeto().fechaOperativa.getTime() === MANANA.getTime())).toBe(true);
      expect(bloques.items.size).toBe(4);
    });
  });

  describe('AnalizarDppUseCase', () => {
    const texto = readFileSync(path.join(import.meta.dirname, '../../domain/mfr/dpp-ejemplo-2026-09-16.txt'), 'utf8');

    it('cruza líneas y productos con el catálogo; el ritmo sale del PDF (Mx ÷ horas)', async () => {
      const propuesta = await new AnalizarDppUseCase(lineas, estandares).ejecutar(texto);

      expect(propuesta.fechaOperativa).toBe('2026-09-16');
      expect(propuesta.bloques).toHaveLength(20);

      const l1 = propuesta.bloques[0];
      expect(l1).toMatchObject({ lineaId: 'L1', productoId: 'LNC', productoCodigo: '300066770', cajasPorHora: 150, bpm: 10, cajasPorHoraCatalogo: 150, pesoNetoKg: 2.344, pesoSugeridoKg: 2.344 });
      expect(l1.advertencias).toEqual([]);

      const l2 = propuesta.bloques.find((b) => b.linea === 'L2')!;
      expect(l2).toMatchObject({ lineaId: 'L2', productoId: 'SPR', cajasPorHora: 77.2, pesoNetoKg: null, pesoSugeridoKg: 1.897 });
      expect(l2.advertencias).toEqual([]); // 77,2 vs 77,14 del catálogo: dentro de la tolerancia

      const manual = propuesta.bloques.find((b) => b.linea === 'MANUAL 1')!;
      expect(manual.lineaId).toBeNull();
      expect(manual.productoId).toBeNull();
      expect(manual.advertencias.join(' ')).toContain('Línea "MANUAL 1" no existe');

      expect(propuesta.listos).toBe(3); // L1 y los dos bloques de L2
      expect(propuesta.advertencias.some((a) => a.includes('peso neto') && a.includes('300058140'))).toBe(true);
      expect(propuesta.advertencias.some((a) => a.includes('Crear la línea "MANUAL 1"'))).toBe(true);
    });

    it('cruza la línea por nombre aunque el código sea distinto', async () => {
      lineas.agregar({ id: 'M1', codigo: 'MANUAL-1', nombre: 'Manual 1', tipo: 'MANUAL', capacidadKgHora: 249, orden: 5, activo: true });
      const propuesta = await new AnalizarDppUseCase(lineas, estandares).ejecutar(texto);
      expect(propuesta.bloques.filter((b) => b.linea === 'MANUAL 1').every((b) => b.lineaId === 'M1')).toBe(true);
    });

    it('rechaza un texto que no es un DPP', async () => {
      await expect(new AnalizarDppUseCase(lineas, estandares).ejecutar('cualquier cosa')).rejects.toThrow(DppNoReconocidoError);
    });
  });

  describe('ActualizarEstandarUseCase', () => {
    it('exige motivo y audita el cambio de BPM y peso', async () => {
      const useCase = new ActualizarEstandarUseCase(uow);

      await expect(useCase.ejecutar({ productoId: 'SPR', cajasPorHora: 77.14, pesoNetoKg: 1.897, motivo: '', usuarioId: 'admin' })).rejects.toThrow(MotivoObligatorioError);
      await expect(useCase.ejecutar({ productoId: 'SPR', cajasPorHora: -1, pesoNetoKg: null, motivo: 'x', usuarioId: 'admin' })).rejects.toThrow(DatosMfrInvalidosError);

      const actualizado = await useCase.ejecutar({ productoId: 'SPR', cajasPorHora: 77.14, pesoNetoKg: 1.897, motivo: 'Peso tomado del DPP del 16/09', usuarioId: 'admin' });
      expect(actualizado.pesoNetoKg).toBe(1.897);
      expect(auditoria.entradas[0]).toMatchObject({ entidad: 'producto', motivo: 'Peso tomado del DPP del 16/09', valorAnterior: { cajasPorHora: 77.14, pesoNetoKg: null } });
    });
  });

  describe('IndicadoresDiaUseCase', () => {
    it('arma el tablero del día: bloques, MFR, turnos, líneas y vista horaria', async () => {
      const cargar = new CargarDiaUseCase(uow, productos, horarios, RELOJ);
      await cargar.ejecutar({
        fechaOperativa: FECHA,
        bloques: [
          { lineaId: 'L1', productoId: 'LNC', horaInicio: '06:00', horaFin: '13:30', cajasPorHora: 150, eficienciaPorcentaje: 87, loop: null, personasAsignadas: null },
          { lineaId: 'L2', productoId: 'SPR', horaInicio: '06:00', horaFin: '13:30', cajasPorHora: 77.14, eficienciaPorcentaje: 84, loop: null, personasAsignadas: null },
          { lineaId: 'L2', productoId: 'SPR', horaInicio: '14:00', horaFin: '21:30', cajasPorHora: 77.14, eficienciaPorcentaje: 84, loop: null, personasAsignadas: null },
        ],
        origen: 'DPP',
        reemplazar: false,
        usuarioId: 'coord',
      });

      const remisiones: RemisionRepository = {
        ...REMISIONES_SIN_USO,
        totalizarCajas: () => Promise.resolve([
          { turnoId: 'T1', productoId: 'LNC', extraoficial: false, cajas: 940 },
          { turnoId: 'T1', productoId: 'SPR', extraoficial: false, cajas: 486 },
          { turnoId: 'T1', productoId: 'LNC', extraoficial: true, cajas: 300 }, // emergencia: fuera del MFR
        ]),
      };
      const catalogos = {
        listarTurnos: () => Promise.resolve([
          { id: 'T1', codigo: 'T1', nombre: 'Turno 1', activo: true },
          { id: 'T2', codigo: 'T2', nombre: 'Turno 2', activo: true },
          { id: 'T3', codigo: 'T3', nombre: 'Turno 3', activo: true },
        ]),
      } as unknown as CatalogoRepository;

      const asistencia = new RegistrarAsistenciaUseCase(uow, RELOJ);
      await asistencia.ejecutar({ fechaOperativa: FECHA, turnoId: 'T1', grupoId: 'G1', personasLlegaron: 8, observacion: null, usuarioId: 'coord' });
      await asistencia.ejecutar({ fechaOperativa: FECHA, turnoId: 'T1', grupoId: 'G2', personasLlegaron: 8, observacion: null, usuarioId: 'coord' });
      const asignar = new AsignarGrupoLineaUseCase(uow, RELOJ);
      await asignar.ejecutar({ fechaOperativa: FECHA, turnoId: 'T1', lineaId: 'L1', grupoId: 'G1', personas: 5, usuarioId: 'coord' });
      await asignar.ejecutar({ fechaOperativa: FECHA, turnoId: 'T1', lineaId: 'L2', grupoId: 'G1', personas: 3, usuarioId: 'coord' });
      await asignar.ejecutar({ fechaOperativa: FECHA, turnoId: 'T1', lineaId: 'L1', grupoId: 'G2', personas: 8, usuarioId: 'coord' });

      const tablero = await new IndicadoresDiaUseCase(bloques, lineas, estandares, horarios, remisiones, catalogos, asistencias, grupos, asignaciones).ejecutar(FECHA);

      expect(tablero.meta).toBe(95);
      // Personal: LOGICMARD esperaba 10 y llegaron 8 → afectada; MIX (sin esperadas) llegaron 8. Referencia DPP: L1 13 + L2 12 = 25.
      expect(t1Personal(tablero)).toMatchObject({ esperadas: 10, llegaron: 16, faltante: 2, requeridasDpp: 25, estado: 'AFECTADA' });
      // LOGICMARD tiene 5 + 3 = 8 personas repartidas en líneas; MIX no tiene esperadas (sin dato) pero sí 8 en L1.
      expect(t1Personal(tablero).grupos.map((g) => [g.codigo, g.llegaron, g.asignadas, g.estado])).toEqual([
        ['LOGICMARD', 8, 8, 'AFECTADA'],
        ['MIX', 8, 8, 'SIN_DATO'],
      ]);
      // L1 necesita 13 (LNC) y tiene 5 + 8 = 13 → cubierta; L2 necesita 12 y tiene 3 → incompleta.
      expect(t1Personal(tablero).lineas.map((l) => [l.codigo, l.personas, l.requeridasDpp, l.estado])).toEqual([
        ['L1', 13, 13, 'CUBIERTA'],
        ['L2', 3, 12, 'INCOMPLETA'],
      ]);
      expect(t1Personal(tablero).lineas[0].grupos.map((g) => `${g.nombre}:${g.personas}`)).toEqual(['LOGICMARD:5', 'MIX:8']);
      expect(tablero.turnos.find((t) => t.codigo === 'T2')!.personal).toMatchObject({ estado: 'SIN_DATO' });
      expect(tablero.turnos.find((t) => t.codigo === 'T2')!.personal.lineas).toMatchObject([{ codigo: 'L2', personas: 0, estado: 'SIN_DATO' }]);
      expect(tablero.bloques.map((b) => `${b.lineaId} ${b.horaInicio}`)).toEqual(['L1 06:00', 'L2 06:00', 'L2 14:00']);
      // LNC: 979 programadas / 940; SPR: 972 / 486 → total (940 + 486) / 1951
      expect(tablero.mfr).toMatchObject({ programadoCajas: 1951, producidoCajas: 1426, cumplimiento: 73.1, semaforo: 'ROJO', extraoficialesCajas: 300 });
      expect(tablero.mfr.extraoficiales).toEqual([{ productoId: 'LNC', cajas: 300 }]);
      const t1 = tablero.turnos.find((t) => t.codigo === 'T1')!;
      expect(t1).toMatchObject({ horasTurno: 7.5, maxCajas: 1704, targetCajas: 1465, producidoCajas: 1426, cumplimiento: 97.3, semaforo: 'VERDE', cerrado: false });
      expect(tablero.turnos.find((t) => t.codigo === 'T3')).toMatchObject({ targetCajas: 0, cumplimiento: null });
      expect(tablero.lineas.map((l) => [l.codigo, l.horasProgramadas, l.targetCajas])).toEqual([['L1', 7.5, 979], ['L2', 15, 972]]);
      expect(tablero.horario.lineas[0].targetKg[0]).toBe(306);
      expect(tablero.horario.lineas[1].targetKg[0]).toBe(0); // SPR sin peso
      expect(tablero.advertencias).toEqual(['El producto 300058140 no tiene peso neto por caja: sin kilogramos.']);
    });
  });

  describe('Asistencia del turno', () => {
    const comando = (extra: Record<string, unknown> = {}) => ({
      fechaOperativa: FECHA, turnoId: 'T1', grupoId: 'G1', personasLlegaron: 9, observacion: null, usuarioId: 'coord', ...extra,
    });

    it('registra la asistencia y la corrige auditando el valor anterior', async () => {
      const useCase = new RegistrarAsistenciaUseCase(uow, RELOJ);

      const primera = await useCase.ejecutar(comando({ observacion: '  llegaron tarde  ' }));
      const corregida = await useCase.ejecutar(comando({ personasLlegaron: 10 }));

      expect(primera).toMatchObject({ personasLlegaron: 9, observacion: 'llegaron tarde', registradaPorId: 'coord' });
      expect(corregida.id).toBe(primera.id);
      expect(asistencias.items).toHaveLength(1);
      expect(auditoria.entradas.map((e) => e.accion)).toEqual(['CREAR', 'ACTUALIZAR']);
      expect(auditoria.entradas[1].valorAnterior).toEqual({ personasLlegaron: 9, observacion: 'llegaron tarde' });
    });

    it('rechaza grupos inexistentes o inactivos y datos inválidos', async () => {
      const useCase = new RegistrarAsistenciaUseCase(uow, RELOJ);

      await expect(useCase.ejecutar(comando({ grupoId: 'NOEXISTE' }))).rejects.toBeInstanceOf(GrupoNoEncontradoError);
      await expect(useCase.ejecutar(comando({ grupoId: 'G3' }))).rejects.toBeInstanceOf(GrupoNoEncontradoError);
      await expect(useCase.ejecutar(comando({ personasLlegaron: -1 }))).rejects.toBeInstanceOf(DatosMfrInvalidosError);
      await expect(useCase.ejecutar(comando({ personasLlegaron: 2.5 }))).rejects.toBeInstanceOf(DatosMfrInvalidosError);
      await expect(useCase.ejecutar(comando({ observacion: 'x'.repeat(301) }))).rejects.toBeInstanceOf(DatosMfrInvalidosError);
      expect(asistencias.items).toHaveLength(0);
    });

    it('evalúa el personal solo contra las personas esperadas del grupo', () => {
      const registro = (turnoId: string, grupoId: string, personasLlegaron: number) => ({
        id: `${turnoId}-${grupoId}`, fechaOperativa: FECHA, turnoId, grupoId, personasLlegaron, observacion: null, registradaPorId: 'coord', fechaRegistro: FECHA,
      });
      const catalogoGrupos = grupos.items;

      // Nada registrado → sin dato.
      expect(evaluarPersonalTurno('T1', [], catalogoGrupos, [])).toMatchObject({ estado: 'SIN_DATO', esperadas: 0, llegaron: 0 });

      // Un grupo cumple y otro no tiene esperadas definidas → a fin (no se castiga lo que no se puede comparar).
      const aFin = evaluarPersonalTurno('T1', [registro('T1', 'G1', 10), registro('T1', 'G2', 4), registro('T2', 'G1', 3)], catalogoGrupos, []);
      expect(aFin).toMatchObject({ estado: 'A_FIN', esperadas: 10, llegaron: 14, faltante: 0 });
      expect(aFin.grupos.map((g) => g.estado)).toEqual(['A_FIN', 'SIN_DATO']);

      // Un grupo por debajo basta para marcar el turno como afectado; llegar de más no compensa.
      const afectada = evaluarPersonalTurno('T1', [registro('T1', 'G1', 7)], catalogoGrupos, []);
      expect(afectada).toMatchObject({ estado: 'AFECTADA', faltante: 3 });
      expect(evaluarPersonalTurno('T1', [registro('T1', 'G1', 12)], catalogoGrupos, [])).toMatchObject({ estado: 'A_FIN', faltante: 0, llegaron: 12 });
    });
  });

  describe('Asignación de grupos a líneas', () => {
    const comando = (extra: Record<string, unknown> = {}) => ({
      fechaOperativa: FECHA, turnoId: 'T1', lineaId: 'L1', grupoId: 'G1', personas: 6, usuarioId: 'coord', ...extra,
    });

    const llegaron = (grupoId: string, personasLlegaron: number) =>
      new RegistrarAsistenciaUseCase(uow, RELOJ).ejecutar({ fechaOperativa: FECHA, turnoId: 'T1', grupoId, personasLlegaron, observacion: null, usuarioId: 'coord' });

    it('asigna, corrige y quita con auditoría', async () => {
      await llegaron('G1', 10);
      auditoria.entradas.length = 0;
      const asignar = new AsignarGrupoLineaUseCase(uow, RELOJ);

      const primera = await asignar.ejecutar(comando());
      const corregida = await asignar.ejecutar(comando({ personas: 7 }));
      const otraLinea = await asignar.ejecutar(comando({ lineaId: 'L2', personas: 2 }));
      await new QuitarAsignacionUseCase(uow).ejecutar(otraLinea.id, 'coord');

      expect(corregida.id).toBe(primera.id);
      expect(asignaciones.items).toEqual([expect.objectContaining({ lineaId: 'L1', grupoId: 'G1', personas: 7 })]);
      expect(auditoria.entradas.map((e) => e.accion)).toEqual(['CREAR', 'ACTUALIZAR', 'CREAR', 'ELIMINAR']);
      expect(auditoria.entradas[1].valorAnterior).toEqual({ personas: 6 });
    });

    it('no deja asignar sin asistencia ni más personas de las que llegaron (trazabilidad)', async () => {
      const asignar = new AsignarGrupoLineaUseCase(uow, RELOJ);

      // 1. Sin asistencia registrada no se sabe cuántas llegaron → bloqueo.
      await expect(asignar.ejecutar(comando())).rejects.toBeInstanceOf(AsignacionSinAsistenciaError);

      // 2. Llegaron 10: 6 en L1 caben; 5 más en L2 ya no (6 + 5 > 10).
      await llegaron('G1', 10);
      await asignar.ejecutar(comando({ lineaId: 'L1', personas: 6 }));
      await expect(asignar.ejecutar(comando({ lineaId: 'L2', personas: 5 }))).rejects.toMatchObject({
        codigo: 'MFR_ASIGNACION_EXCEDE_ASISTENCIA', llegaron: 10, enOtrasLineas: 6, solicitadas: 5,
      });
      await asignar.ejecutar(comando({ lineaId: 'L2', personas: 4 }));

      // 3. Corregir la misma línea no cuenta contra sí misma: L1 puede pasar de 6 a 6 (no a 7).
      await asignar.ejecutar(comando({ lineaId: 'L1', personas: 6 }));
      await expect(asignar.ejecutar(comando({ lineaId: 'L1', personas: 7 }))).rejects.toBeInstanceOf(AsignacionExcedeAsistenciaError);

      // 4. La asistencia no puede bajar por debajo de lo asignado (10) sin ajustar líneas antes.
      await expect(llegaron('G1', 9)).rejects.toMatchObject({ codigo: 'MFR_ASISTENCIA_MENOR_QUE_ASIGNADAS', personasLlegaron: 9, asignadas: 10 });
      await new QuitarAsignacionUseCase(uow).ejecutar(asignaciones.items.find((a) => a.lineaId === 'L2')!.id, 'coord');
      await expect(llegaron('G1', 9)).resolves.toMatchObject({ personasLlegaron: 9 });
    });

    it('rechaza grupo inactivo, línea inexistente, personas inválidas y quitar lo que no existe', async () => {
      await llegaron('G1', 10);
      const asignar = new AsignarGrupoLineaUseCase(uow, RELOJ);

      await expect(asignar.ejecutar(comando({ grupoId: 'G3' }))).rejects.toBeInstanceOf(GrupoNoEncontradoError);
      await expect(asignar.ejecutar(comando({ lineaId: 'L9' }))).rejects.toBeInstanceOf(LineaNoEncontradaError);
      await expect(asignar.ejecutar(comando({ personas: 0 }))).rejects.toBeInstanceOf(DatosMfrInvalidosError);
      await expect(new QuitarAsignacionUseCase(uow).ejecutar('nada', 'coord')).rejects.toBeInstanceOf(AsignacionNoEncontradaError);
      expect(asignaciones.items).toHaveLength(0);
    });

    it('evalúa cada línea contra la línea ideal del DPP', () => {
      const asignacion = (turnoId: string, lineaId: string, grupoId: string, personas: number) => ({
        id: `${turnoId}-${lineaId}-${grupoId}`, fechaOperativa: FECHA, turnoId, lineaId, grupoId, personas, registradaPorId: 'coord', fechaRegistro: FECHA,
      });
      const bloque = (lineaId: string, personasAsignadas: number | null) =>
        ({ turnoId: 'T1', lineaId, personasAsignadas }) as unknown as Parameters<typeof evaluarLineasTurno>[2][number];
      const orden = (id: string) => Number(id.slice(1));

      // Sin bloques ni asignaciones: nada que evaluar.
      expect(evaluarLineasTurno('T1', [], [], orden)).toEqual([]);

      const lineas = evaluarLineasTurno(
        'T1',
        [asignacion('T1', 'L1', 'G1', 10), asignacion('T1', 'L1', 'G2', 3), asignacion('T1', 'L3', 'G1', 4), asignacion('T2', 'L2', 'G1', 9)],
        [bloque('L1', 13), bloque('L1', 9), bloque('L2', 12), bloque('L3', null)],
        orden,
      );
      expect(lineas.map((l) => [l.lineaId, l.personas, l.requeridasDpp, l.faltante, l.estado])).toEqual([
        ['L1', 13, 13, 0, 'CUBIERTA'], // manda el bloque más exigente (13, no 9)
        ['L2', 0, 12, 12, 'SIN_DATO'], // nadie asignado todavía
        ['L3', 4, 0, 0, 'SIN_DATO'], // el DPP no trae línea ideal: no se puede comparar
      ]);
    });
  });
});

function t1Personal(tablero: Awaited<ReturnType<IndicadoresDiaUseCase['ejecutar']>>) {
  return tablero.turnos.find((t) => t.codigo === 'T1')!.personal;
}
