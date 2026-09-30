import { beforeEach, describe, expect, it } from 'vitest';

import { ConsumoInsuficienteError, PtSinRecetaError } from '../../domain/inventario/consumo.js';
import type { ItemInventario } from '../../domain/inventario/item-inventario.js';
import { Remision } from '../../domain/remision/remision.entity.js';
import { RemisionExcedeProgramacionError } from '../../domain/remision/remision.errors.js';
import {
  AuditoriaRepositorioFalso,
  ProductoRepositorioFalso,
  RemisionRepositorioEnMemoria,
  UnidadDeTrabajoFalsa,
} from '../pruebas/dobles-en-memoria.js';
import { ItemInventarioRepositorioFalso, MovimientoInventarioRepositorioFalso, RecetaRepositorioFalso } from '../pruebas/dobles-inventario.js';
import { BloqueRepositorioFalso, EstandarRepositorioFalso, HorarioRepositorioFalso, horariosDpp, programarTarget } from '../pruebas/dobles-mfr.js';
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

const item = (id: string, codigo: string, unidad: string, existencia: number): ItemInventario => ({
  id, tipo: id === 'cinta' ? 'INSUMO' : 'PI', referenciaId: `ref-${id}`, codigo, descripcion: codigo, unidadMedida: unidad, activo: true, equivalencias: null, existencia,
});

describe('Flujo de remisión — aprobar', () => {
  let remisiones: RemisionRepositorioEnMemoria;
  let items: ItemInventarioRepositorioFalso;
  let movimientos: MovimientoInventarioRepositorioFalso;
  let recetas: RecetaRepositorioFalso;
  let entregar: EntregarRemisionUseCase;
  let aprobar: AprobarRemisionUseCase;

  /** La receta del PT "A": 12 bolsas y 1,8 m de cinta por caja. */
  const conReceta = () =>
    recetas.crear({
      productoId: 'A', version: 1, vigenteDesde: FECHA, creadaPorId: 'admin', creadaPorNombre: 'Admin',
      componentes: [{ itemId: 'bolsa', cantidad: 12 }, { itemId: 'cinta', cantidad: 1.8 }],
    });

  const entregada = async (id: string, r: Remision) => {
    remisiones.agregar(id, r);
    await entregar.ejecutar({ remisionId: id, entregadaPorId: 'pat' });
  };
  const aprobarla = (id: string) => aprobar.ejecutar({ remisionId: id, opaNombre: 'OPA', registradaPorId: 'coord' });

  beforeEach(async () => {
    remisiones = new RemisionRepositorioEnMemoria();
    items = new ItemInventarioRepositorioFalso();
    items.agregar(item('bolsa', 'BOLSA-LNC', 'UNIDAD', 10_000));
    items.agregar(item('cinta', 'CINTA-48', 'METRO', 500));
    movimientos = new MovimientoInventarioRepositorioFalso();
    recetas = new RecetaRepositorioFalso();
    const bloques = new BloqueRepositorioFalso();
    const estandares = new EstandarRepositorioFalso();
    estandares.agregar({ productoId: 'A', codigo: '300066770', descripcion: 'LNC', subdescripcion: null, unidadesPorCaja: 4, cajasPorHora: null, pesoNetoKg: null });
    await programarTarget(bloques, FECHA, 'A', 100);
    const uow = new UnidadDeTrabajoFalsa({
      remisiones, bloques, estandares, itemsInventario: items, movimientosInventario: movimientos, recetas,
      auditoria: new AuditoriaRepositorioFalso(), productos: new ProductoRepositorioFalso(),
    });
    entregar = new EntregarRemisionUseCase(uow, RELOJ);
    aprobar = new AprobarRemisionUseCase(uow, RELOJ, new HorarioRepositorioFalso(horariosDpp()));
  });

  describe('contra el DPP', () => {
    beforeEach(conReceta);

    it('dos entregadas del mismo SKU no pueden quedar aprobadas por encima de lo programado', async () => {
      await entregada('r1', remision(60));
      await entregada('r2', remision(60));

      // La primera cabe (60 ≤ 100); la segunda ya no (60 + 60 > 100).
      await expect(aprobarla('r1')).resolves.toBeDefined();
      await expect(aprobarla('r2')).rejects.toThrow(RemisionExcedeProgramacionError);
      expect(remisiones.porId.get('r2')!.estado).toBe('ENTREGADA'); // no cambió
    });

    it('una extraoficial se aprueba sin mirar el tope', async () => {
      await entregada('r1', remision(100));
      await entregada('extra', remision(50, true));

      await aprobarla('r1');
      await expect(aprobarla('extra')).resolves.toBeDefined();

      const totales = await remisiones.totalizarCajas(FECHA, ['APROBADA']);
      expect(totales).toEqual([
        { turnoId: 'T1', productoId: 'A', extraoficial: false, cajas: 100 },
        { turnoId: 'T1', productoId: 'A', extraoficial: true, cajas: 50 },
      ]);
    });
  });

  describe('descuento de PI e insumos (receta)', () => {
    it('aprobar descuenta cajas × receta vigente y deja cada salida enlazada a la remisión', async () => {
      await conReceta();
      await entregada('r1', remision(7));

      await aprobarla('r1');

      expect((await items.buscarPorId('bolsa'))!.existencia).toBe(10_000 - 84);
      expect((await items.buscarPorId('cinta'))!.existencia).toBe(487.4); // 500 − 7 × 1,8
      expect(movimientos.movimientos).toEqual([
        expect.objectContaining({ itemId: 'bolsa', tipo: 'SALIDA', cantidad: -84, saldo: 9916, remisionId: 'r1' }),
        expect.objectContaining({ itemId: 'cinta', tipo: 'SALIDA', cantidad: -12.6, saldo: 487.4, remisionId: 'r1', observacion: expect.stringContaining('receta v1') }),
      ]);
    });

    it('la extraoficial también descuenta', async () => {
      await conReceta();
      await entregada('extra', remision(10, true));
      await aprobarla('extra');
      expect((await items.buscarPorId('cinta'))!.existencia).toBe(482);
    });

    it('PT sin receta: bloquea la aprobación y no descuenta nada', async () => {
      await entregada('r1', remision(7));

      await expect(aprobarla('r1')).rejects.toThrow(PtSinRecetaError);
      expect(remisiones.porId.get('r1')!.estado).toBe('ENTREGADA');
      expect(movimientos.movimientos).toHaveLength(0);
    });

    it('si un componente no alcanza: bloquea, dice cuáles faltan y no toca nada', async () => {
      await conReceta();
      await entregada('r1', remision(100)); // 180 m de cinta: hay 500, alcanza
      await aprobarla('r1');
      await entregada('r2', remision(100, true)); // otros 180 m: quedan 320, alcanza
      await aprobarla('r2');
      await entregada('r3', remision(100, true)); // 180 m más: quedan 140 → no alcanza

      const error = await aprobarla('r3').catch((e: unknown) => e);
      expect(error).toBeInstanceOf(ConsumoInsuficienteError);
      expect((error as ConsumoInsuficienteError).faltantes).toEqual([{ codigo: 'CINTA-48', unidad: 'METRO', hay: 140, seNecesita: 180 }]);
      expect(remisiones.porId.get('r3')!.estado).toBe('ENTREGADA');
      expect((await items.buscarPorId('cinta'))!.existencia).toBe(140);
      expect((await items.buscarPorId('bolsa'))!.existencia).toBe(10_000 - 2400); // la bolsa tampoco se tocó en r3
    });
  });
});
