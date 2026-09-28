import { beforeEach, describe, expect, it } from 'vitest';

import {
  CausalNoEncontradaError,
  DatosAveriaInvalidosError,
  ReporteAveriaNoModificableError,
  SinTurnoParaLaHoraError,
} from '../../domain/averia/averia.errors.js';
import type { ArchivoEvidencia } from '../../domain/averia/almacen-evidencias.js';
import { GrupoNoEncontradoError } from '../../domain/grupo/grupo.errors.js';
import { ProductoNoEncontradoError } from '../../domain/producto/producto.errors.js';
import { Usuario } from '../../domain/usuario/usuario.entity.js';
import { AlmacenEvidenciasFalso, CausalRepositorioFalso, ReporteAveriaRepositorioFalso } from '../pruebas/dobles-averia.js';
import {
  AuditoriaRepositorioFalso,
  ProductoRepositorioFalso,
  UnidadDeTrabajoFalsa,
  UsuarioRepositorioFalso,
} from '../pruebas/dobles-en-memoria.js';
import { GrupoRepositorioFalso, HorarioRepositorioFalso, horariosDpp } from '../pruebas/dobles-mfr.js';
import {
  AnularReporteAveriaUseCase,
  CorregirRegistroAveriaUseCase,
  CrearReporteAveriaUseCase,
  type RegistroNuevoAveria,
} from './reporte-averia.use-cases.js';

const JPG = (): ArchivoEvidencia => ({ contenido: new Uint8Array([0xff, 0xd8, 0xff]), tipoMime: 'image/jpeg' });
const FOTOS = () => ({ UNIDAD: JPG(), LOTE_FECHA: JPG(), CONJUNTO: JPG() });
const reloj = (iso: string) => ({ ahora: () => new Date(iso) });

function fila(cambios: Partial<RegistroNuevoAveria> = {}): RegistroNuevoAveria {
  return {
    productoId: 'P1',
    fechaVencimiento: new Date('2026-12-31T00:00:00Z'),
    lote: 'L127 23:33',
    causalId: 'C1',
    cantidad: 3,
    unidadMedida: 'DOCENA',
    fotos: FOTOS(),
    ...cambios,
  };
}

describe('Reporte de averías — casos de uso', () => {
  let reportes: ReporteAveriaRepositorioFalso;
  let auditoria: AuditoriaRepositorioFalso;
  let almacen: AlmacenEvidenciasFalso;
  let uow: UnidadDeTrabajoFalsa;
  const horarios = new HorarioRepositorioFalso(horariosDpp());

  const crear = (iso = '2026-09-28T15:10:00-05:00') => new CrearReporteAveriaUseCase(uow, horarios, almacen, reloj(iso));

  beforeEach(() => {
    reportes = new ReporteAveriaRepositorioFalso();
    auditoria = new AuditoriaRepositorioFalso();
    almacen = new AlmacenEvidenciasFalso();

    const productos = new ProductoRepositorioFalso();
    productos.agregar({ id: 'P1', codigo: '300058141', descripcion: 'SURTIDO X12', proceso: null, activo: true, unidadesPorCaja: 12, cajasPorEstiba: null, personasIdeal: null, subdescripcion: null, cajasPorHora: null, pesoNetoKg: null });
    productos.agregar({ id: 'P2', codigo: '300000002', descripcion: 'INACTIVO', proceso: null, activo: false, unidadesPorCaja: null, cajasPorEstiba: null, personasIdeal: null, subdescripcion: null, cajasPorHora: null, pesoNetoKg: null });
    const causales = new CausalRepositorioFalso();
    causales.agregar({ id: 'C1', codigo: 'ESTALLADO', nombre: 'Estallado', orden: 1, activo: true });
    causales.agregar({ id: 'C2', codigo: 'VIEJA', nombre: 'Vieja', orden: 2, activo: false });
    const grupos = new GrupoRepositorioFalso();
    grupos.agregar({ id: 'G1', codigo: 'MIX', nombre: 'MIX', descripcion: null, personasEsperadas: null, activo: true });
    const usuarios = new UsuarioRepositorioFalso();
    usuarios.agregar(
      Usuario.desdePersistencia({ id: 'u1', documento: '1', nombre: 'Ana Coordinadora', email: null, passwordHash: 'x', activo: true, rolId: 'r', rolCodigo: 'COORDINADOR_MQ', permisos: [] }),
    );

    uow = new UnidadDeTrabajoFalsa({ reportesAveria: reportes, auditoria, productos, causales, grupos, usuarios });
  });

  describe('CrearReporteAveriaUseCase', () => {
    it('fecha, hora y turno los pone el sistema; guarda copia del producto, fotos y auditoría', async () => {
      const creado = await crear().ejecutar({ grupoId: 'G1', registros: [fila()], usuarioId: 'u1' });

      expect(creado).toMatchObject({
        fechaOperativa: new Date('2026-09-28T00:00:00Z'),
        turnoId: 'T2',
        grupoId: 'G1',
        reportadoPorNombre: 'Ana Coordinadora',
        estado: 'REGISTRADO',
      });
      expect(creado.registros[0]).toMatchObject({ productoCodigo: '300058141', productoDescripcion: 'SURTIDO X12', cantidad: 3 });
      expect(creado.registros[0].evidencias.map((e) => e.tipo)).toEqual(['UNIDAD', 'LOTE_FECHA', 'CONJUNTO']);
      expect(almacen.archivos.size).toBe(3);
      expect(auditoria.entradas).toEqual([expect.objectContaining({ entidad: 'reporte_averia', accion: 'CREAR', usuarioId: 'u1' })]);
    });

    it('a las 03:00 pertenece al día operativo anterior, turno T3', async () => {
      const creado = await crear('2026-09-29T03:00:00-05:00').ejecutar({ grupoId: 'G1', registros: [fila()], usuarioId: 'u1' });
      expect(creado).toMatchObject({ fechaOperativa: new Date('2026-09-28T00:00:00Z'), turnoId: 'T3' });
    });

    it('en la pausa de las 13:45 queda en el T1', async () => {
      const creado = await crear('2026-09-28T13:45:00-05:00').ejecutar({ grupoId: 'G1', registros: [fila()], usuarioId: 'u1' });
      expect(creado.turnoId).toBe('T1');
    });

    it('sin la tercera foto no guarda nada y dice qué avería corregir', async () => {
      const incompleta = fila({ fotos: { UNIDAD: JPG(), LOTE_FECHA: JPG() } });
      await expect(
        crear().ejecutar({ grupoId: 'G1', registros: [fila(), incompleta], usuarioId: 'u1' }),
      ).rejects.toThrow(/Avería 2: Falta la foto 3/);
      expect(almacen.archivos.size).toBe(0);
    });

    it('rechaza un archivo que no es imagen', async () => {
      const pdf = fila({ fotos: { ...FOTOS(), CONJUNTO: { contenido: new Uint8Array([1]), tipoMime: 'application/pdf' } } });
      await expect(crear().ejecutar({ grupoId: 'G1', registros: [pdf], usuarioId: 'u1' })).rejects.toThrow(DatosAveriaInvalidosError);
    });

    it('rechaza un reporte vacío', async () => {
      await expect(crear().ejecutar({ grupoId: 'G1', registros: [], usuarioId: 'u1' })).rejects.toThrow(DatosAveriaInvalidosError);
    });

    it.each([
      ['producto inactivo', { productoId: 'P2' }, ProductoNoEncontradoError],
      ['causal inactiva', { causalId: 'C2' }, CausalNoEncontradaError],
    ])('%s: falla y borra las fotos ya guardadas', async (_, cambios, Error) => {
      await expect(crear().ejecutar({ grupoId: 'G1', registros: [fila(cambios)], usuarioId: 'u1' })).rejects.toBeInstanceOf(Error);
      expect(almacen.archivos.size).toBe(0);
      expect(auditoria.entradas).toHaveLength(0);
    });

    it('grupo inexistente', async () => {
      await expect(crear().ejecutar({ grupoId: 'NO', registros: [fila()], usuarioId: 'u1' })).rejects.toBeInstanceOf(GrupoNoEncontradoError);
      expect(almacen.archivos.size).toBe(0);
    });

    it('si el disco falla a mitad, borra las fotos que alcanzó a guardar', async () => {
      almacen.fallarAlGuardarNumero = 5;
      await expect(crear().ejecutar({ grupoId: 'G1', registros: [fila(), fila()], usuarioId: 'u1' })).rejects.toThrow('Disco lleno');
      expect(almacen.archivos.size).toBe(0);
    });

    it('sin horarios configurados no puede decidir el turno', async () => {
      const sinHorarios = new CrearReporteAveriaUseCase(uow, new HorarioRepositorioFalso([]), almacen, reloj('2026-09-28T15:10:00-05:00'));
      await expect(sinHorarios.ejecutar({ grupoId: 'G1', registros: [fila()], usuarioId: 'u1' })).rejects.toBeInstanceOf(SinTurnoParaLaHoraError);
    });
  });

  describe('Corregir y anular (administrador)', () => {
    it('corrige un registro, conserva las fotos y audita antes y después', async () => {
      const creado = await crear().ejecutar({ grupoId: 'G1', registros: [fila()], usuarioId: 'u1' });
      const registroId = creado.registros[0].id;

      const corregido = await new CorregirRegistroAveriaUseCase(uow).ejecutar({
        reporteId: creado.id,
        registroId,
        cambios: { cantidad: 7, unidadMedida: 'UNIDAD' },
        usuarioId: 'admin',
      });

      expect(corregido.registros[0]).toMatchObject({ cantidad: 7, unidadMedida: 'UNIDAD', lote: 'L127 23:33' });
      expect(corregido.registros[0].evidencias).toHaveLength(3);
      expect(auditoria.entradas.at(-1)).toMatchObject({
        accion: 'ACTUALIZAR',
        valorAnterior: expect.objectContaining({ cantidad: 3 }),
        valorNuevo: expect.objectContaining({ cantidad: 7 }),
      });
    });

    it('anula con motivo; un anulado ya no se corrige ni se vuelve a anular', async () => {
      const creado = await crear().ejecutar({ grupoId: 'G1', registros: [fila()], usuarioId: 'u1' });
      const anular = new AnularReporteAveriaUseCase(uow, reloj('2026-09-28T16:00:00-05:00'));

      await expect(anular.ejecutar({ reporteId: creado.id, motivo: '  ', usuarioId: 'admin' })).rejects.toThrow(DatosAveriaInvalidosError);

      const anulado = await anular.ejecutar({ reporteId: creado.id, motivo: 'Enviado dos veces', usuarioId: 'admin' });
      expect(anulado).toMatchObject({ estado: 'ANULADO', motivoAnulacion: 'Enviado dos veces', anuladoPorId: 'admin' });
      expect(auditoria.entradas.at(-1)).toMatchObject({ accion: 'CAMBIO_ESTADO', motivo: 'Enviado dos veces' });

      await expect(anular.ejecutar({ reporteId: creado.id, motivo: 'otra vez', usuarioId: 'admin' })).rejects.toBeInstanceOf(
        ReporteAveriaNoModificableError,
      );
      await expect(
        new CorregirRegistroAveriaUseCase(uow).ejecutar({ reporteId: creado.id, registroId: anulado.registros[0].id, cambios: { cantidad: 1 }, usuarioId: 'admin' }),
      ).rejects.toBeInstanceOf(ReporteAveriaNoModificableError);
    });
  });
});
