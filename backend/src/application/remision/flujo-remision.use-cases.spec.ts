import { beforeEach, describe, expect, it } from 'vitest';

import { Remision } from '../../domain/remision/remision.entity.js';
import { RemisionExcedeProgramacionError } from '../../domain/remision/remision.errors.js';
import {
  AuditoriaRepositorioFalso,
  ProductoRepositorioFalso,
  RemisionRepositorioEnMemoria,
  UnidadDeTrabajoFalsa,
} from '../pruebas/dobles-en-memoria.js';
import { BloqueRepositorioFalso, EstandarRepositorioFalso, programarTarget } from '../pruebas/dobles-mfr.js';
import { AprobarRemisionUseCase, EntregarRemisionUseCase } from './flujo-remision.use-cases.js';

const FECHA = new Date('2026-09-14T00:00:00.000Z');
const RELOJ = { ahora: () => new Date('2026-09-14T15:00:00.000Z') };

function remision(cajas: number, extraoficial = false): Remision {
  return Remision.crear({
    anio: 2026, numero: 1, fechaOperativa: FECHA, fechaHoraRegistro: new Date('2026-09-14T14:00:00.000Z'),
    turnoId: 'T1', grupoId: 'p', lugarId: 'l', productoId: 'A', codigoSnapshot: '300066770', descripcionSnapshot: 'LNC',
    fechaVencimiento: new Date('2027-01-01T00:00:00.000Z'), cantidadCajas: cajas, cantidadUnidades: cajas * 4,
    estibasCompletas: 1, cajasSueltas: 0, numerosEstiba: [1], creadaPorId: 'coord',
    extraoficial, motivoExtraoficial: extraoficial ? 'Pedido de emergencia' : null,
  });
}

describe('Flujo de remisión — aprobar contra el DPP', () => {
  let remisiones: RemisionRepositorioEnMemoria;
  let uow: UnidadDeTrabajoFalsa;

  beforeEach(async () => {
    remisiones = new RemisionRepositorioEnMemoria();
    const bloques = new BloqueRepositorioFalso();
    const estandares = new EstandarRepositorioFalso();
    estandares.agregar({ productoId: 'A', codigo: '300066770', descripcion: 'LNC', subdescripcion: null, unidadesPorCaja: 4, cajasPorHora: null, pesoNetoKg: null });
    await programarTarget(bloques, FECHA, 'A', 100);
    uow = new UnidadDeTrabajoFalsa({ remisiones, bloques, estandares, auditoria: new AuditoriaRepositorioFalso(), productos: new ProductoRepositorioFalso() });
  });

  it('dos entregadas del mismo SKU no pueden quedar aprobadas por encima de lo programado', async () => {
    const entregar = new EntregarRemisionUseCase(uow, RELOJ);
    const aprobar = new AprobarRemisionUseCase(uow, RELOJ);
    remisiones.agregar('r1', remision(60));
    remisiones.agregar('r2', remision(60));
    await entregar.ejecutar({ remisionId: 'r1', entregadaPorId: 'pat' });
    await entregar.ejecutar({ remisionId: 'r2', entregadaPorId: 'pat' });

    // La primera cabe (60 ≤ 100); la segunda ya no (60 + 60 > 100).
    await expect(aprobar.ejecutar({ remisionId: 'r1', opaNombre: 'OPA', registradaPorId: 'coord' })).resolves.toBeDefined();
    await expect(aprobar.ejecutar({ remisionId: 'r2', opaNombre: 'OPA', registradaPorId: 'coord' })).rejects.toThrow(RemisionExcedeProgramacionError);
    expect(remisiones.porId.get('r2')!.estado).toBe('ENTREGADA'); // no cambió
  });

  it('una extraoficial se aprueba sin mirar el tope', async () => {
    const entregar = new EntregarRemisionUseCase(uow, RELOJ);
    const aprobar = new AprobarRemisionUseCase(uow, RELOJ);
    remisiones.agregar('r1', remision(100));
    remisiones.agregar('extra', remision(500, true));
    for (const id of ['r1', 'extra']) await entregar.ejecutar({ remisionId: id, entregadaPorId: 'pat' });

    await aprobar.ejecutar({ remisionId: 'r1', opaNombre: 'OPA', registradaPorId: 'coord' });
    await expect(aprobar.ejecutar({ remisionId: 'extra', opaNombre: 'OPA', registradaPorId: 'coord' })).resolves.toBeDefined();

    const totales = await remisiones.totalizarCajas(FECHA, ['APROBADA']);
    expect(totales).toEqual([
      { turnoId: 'T1', productoId: 'A', extraoficial: false, cajas: 100 },
      { turnoId: 'T1', productoId: 'A', extraoficial: true, cajas: 500 },
    ]);
  });
});
