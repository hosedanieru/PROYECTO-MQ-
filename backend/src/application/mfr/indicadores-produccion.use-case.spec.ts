import { beforeEach, describe, expect, it } from 'vitest';

import type { CatalogoRepository } from '../../domain/catalogo/catalogo.repository.js';
import { RangoFechasInvalidoError } from '../../domain/shared/rango-fechas.js';
import { Remision, type EstadoPersistidoRemision } from '../../domain/remision/remision.entity.js';
import { ReporteAveriaRepositorioFalso } from '../pruebas/dobles-averia.js';
import { ProductoRepositorioFalso, RemisionRepositorioEnMemoria } from '../pruebas/dobles-en-memoria.js';
import {
  AsistenciaRepositorioFalso,
  BloqueRepositorioFalso,
  GrupoRepositorioFalso,
  HorarioRepositorioFalso,
  horariosDpp,
  programarTarget,
} from '../pruebas/dobles-mfr.js';
import { IndicadoresPeriodoUseCase, RitmoDiaUseCase } from './indicadores-produccion.use-case.js';

const FECHA = new Date('2026-10-06T00:00:00.000Z');
/** Hora de Bogotá (UTC−5) del 6 de octubre. */
const bogota = (hora: string) => new Date(`2026-10-06T${hora}:00-05:00`);

const catalogos = {
  listarTurnos: () =>
    Promise.resolve([
      { id: 'T1', codigo: 'T1', nombre: 'Turno 1', activo: true },
      { id: 'T2', codigo: 'T2', nombre: 'Turno 2', activo: true },
      { id: 'T3', codigo: 'T3', nombre: 'Turno 3', activo: true },
    ]),
} as unknown as CatalogoRepository;

let numero = 0;
function remision(productoId: string, cajas: number, cambios: Partial<EstadoPersistidoRemision> = {}): Remision {
  numero += 1;
  return Remision.desdePersistencia({
    id: `r${numero}`,
    anio: 2026,
    numero,
    version: 1,
    fechaOperativa: FECHA,
    fechaHoraRegistro: bogota('08:00'),
    turnoId: 'T1',
    grupoId: 'G1',
    lugarId: 'LUG',
    productoId,
    codigoSnapshot: productoId,
    descripcionSnapshot: productoId,
    fechaVencimiento: new Date('2027-01-01T00:00:00.000Z'),
    cantidadCajas: cajas,
    cantidadUnidades: cajas * 4,
    estibasCompletas: 0,
    cajasSueltas: cajas,
    numerosEstiba: [],
    observaciones: null,
    estado: 'APROBADA',
    extraoficial: false,
    motivoExtraoficial: null,
    fechaAprobacion: bogota('12:00'),
    creadaPorId: 'coord',
    ...cambios,
  } as EstadoPersistidoRemision);
}

describe('Indicadores de producción (casos de uso)', () => {
  let bloques: BloqueRepositorioFalso;
  let remisiones: RemisionRepositorioEnMemoria;
  let reportes: ReporteAveriaRepositorioFalso;
  let asistencias: AsistenciaRepositorioFalso;
  let productos: ProductoRepositorioFalso;
  let grupos: GrupoRepositorioFalso;

  beforeEach(async () => {
    bloques = new BloqueRepositorioFalso();
    remisiones = new RemisionRepositorioEnMemoria();
    reportes = new ReporteAveriaRepositorioFalso();
    asistencias = new AsistenciaRepositorioFalso();
    productos = new ProductoRepositorioFalso();
    grupos = new GrupoRepositorioFalso();

    productos.agregar({ id: 'A', codigo: '300000001', descripcion: 'PT A', proceso: null, activo: true, unidadesPorCaja: 4, cajasPorEstiba: null, personasIdeal: null, subdescripcion: null, cajasPorHora: null, pesoNetoKg: null });
    productos.agregar({ id: 'B', codigo: '300000002', descripcion: 'PT B', proceso: null, activo: true, unidadesPorCaja: 4, cajasPorEstiba: null, personasIdeal: null, subdescripcion: null, cajasPorHora: null, pesoNetoKg: null });
    grupos.agregar({ id: 'G1', codigo: 'LOGIC', nombre: 'Grupo 1', descripcion: null, activo: true, esperadasPorTurno: {} });

    // DPP: A 300 cajas y B 150, los dos en T1 (06:00–13:30).
    await programarTarget(bloques, FECHA, 'A', 300);
    await programarTarget(bloques, FECHA, 'B', 150, 'L2');

    remisiones.agregar('r-a', remision('A', 300, { fechaAprobacion: bogota('12:00') })); // completo y a tiempo
    remisiones.agregar('r-b', remision('B', 150, { fechaAprobacion: bogota('15:00') })); // completo pero tarde
    remisiones.agregar('r-extra', remision('A', 40, { extraoficial: true, motivoExtraoficial: 'Pedido de emergencia' }));
    remisiones.agregar('r-borrador', remision('B', 30, { estado: 'BORRADOR', fechaAprobacion: null, fechaHoraRegistro: bogota('09:30') }));

    await asistencias.guardar({ fechaOperativa: FECHA, turnoId: 'T1', grupoId: 'G1', personasLlegaron: 10, observacion: null }, 'coord', FECHA);
  });

  const periodo = () =>
    new IndicadoresPeriodoUseCase(bloques, remisiones, reportes, asistencias, new HorarioRepositorioFalso(horariosDpp()), productos, catalogos, grupos);

  it('arma FR, OTIF, ranking, averías y productividad con los datos guardados', async () => {
    await reportes.crear({
      fechaHoraRegistro: bogota('10:00'),
      fechaOperativa: FECHA,
      turnoId: 'T1',
      grupoId: 'G1',
      reportadoPorId: 'coord',
      reportadoPorNombre: 'Coordinador',
      estado: 'REGISTRADO',
      motivoAnulacion: null,
      anuladoPorId: null,
      fechaAnulacion: null,
      registros: [
        { productoId: 'A', productoCodigo: 'A', productoDescripcion: 'A', fechaVencimiento: FECHA, lote: 'L', causalId: 'C', cantidad: 20, unidadMedida: 'UNIDAD', evidencias: [] },
      ],
    });

    const r = await periodo().ejecutar(FECHA, FECHA);

    expect(r.fr).toMatchObject({ programadoCajas: 450, aprobadoCajas: 450, porcentaje: 100 }); // ni la extraoficial ni el borrador
    expect(r.otif).toMatchObject({ skus: 2, completos: 2, cumplen: 1, porcentaje: 50 });
    expect(r.ranking.mayor?.productoId).toBe('A');
    expect(r.ranking.menor?.productoId).toBe('B');
    // Fabricado: (300 + 150 + 40 extraoficial) × 4 = 1.960 unidades, de ellas 160 extraoficiales; 20 averiadas → 20 / 1.980.
    expect(r.averiasVsFabricado.total).toEqual({ fabricadoUnidades: 1960, extraoficialUnidades: 160, averiadasUnidades: 20, porcentaje: 1.01 });
    // 450 cajas ÷ (10 personas × 7,5 h) = 6.
    expect(r.productividad.porTurno).toEqual([{ turnoId: 'T1', cajas: 450, personas: 10, horasPersona: 75, cajasPorPersonaHora: 6 }]);
    expect(r.productos.A).toEqual({ codigo: '300000001', nombre: 'PT A' });
    expect(r.turnos.T1.nombre).toBe('Turno 1');
    expect(r.grupos.G1).toEqual({ codigo: 'LOGIC', nombre: 'Grupo 1' });
    expect([r.desde, r.hasta]).toEqual(['2026-10-06', '2026-10-06']);
  });

  it('rechaza un rango al revés', async () => {
    await expect(periodo().ejecutar(FECHA, new Date('2026-10-01T00:00:00.000Z'))).rejects.toThrow(RangoFechasInvalidoError);
  });

  it('ritmo a las 09:45: cuenta lo creado (también el borrador) contra lo esperado del T1', async () => {
    const reloj = { ahora: () => bogota('09:45') };
    const ritmo = await new RitmoDiaUseCase(bloques, remisiones, catalogos, reloj).ejecutar(FECHA);

    // Esperado a las 09:45 (3,75 de 7,5 h): la mitad de 450 = 225. Real: 300 + 150 + 30 (borrador) = 480, sin la extraoficial.
    const t1 = ritmo.porTurno.find((t) => t.turnoId === 'T1')!;
    expect(t1).toMatchObject({ esperadoAhoraCajas: 225, realAhoraCajas: 480, estado: 'ADELANTADO' });
    expect(ritmo.fechaOperativa).toBe('2026-10-06');
    expect(ritmo.turnos.T1.codigo).toBe('T1');
  });
});
