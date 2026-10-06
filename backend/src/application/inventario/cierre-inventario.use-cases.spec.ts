import { beforeEach, describe, expect, it } from 'vitest';

import { CierreYaRegistradoError } from '../../domain/inventario/cierre-inventario.js';
import type { ItemInventario } from '../../domain/inventario/item-inventario.js';
import { Remision } from '../../domain/remision/remision.entity.js';
import { AuditoriaRepositorioFalso, RemisionRepositorioEnMemoria, UnidadDeTrabajoFalsa } from '../pruebas/dobles-en-memoria.js';
import {
  CierreInventarioRepositorioFalso,
  ItemInventarioRepositorioFalso,
  MovimientoInventarioRepositorioFalso,
  RecetaRepositorioFalso,
} from '../pruebas/dobles-inventario.js';
import { HorarioRepositorioFalso, horariosDpp } from '../pruebas/dobles-mfr.js';
import { PrepararCierreUseCase, RegistrarCierreUseCase } from './cierre-inventario.use-cases.js';

const FECHA = new Date('2026-09-30T00:00:00.000Z');
const RELOJ = { ahora: () => new Date('2026-10-01T05:30:00-05:00') }; // T3 del 30/09

const item = (id: string, tipo: ItemInventario['tipo'], referenciaId: string, existencia: number, unidad = 'METRO'): ItemInventario => ({
  id, tipo, referenciaId, codigo: id.toUpperCase(), descripcion: id, unidadMedida: unidad, activo: true, existencia,
  equivalencias: tipo === 'PT' ? null : { presentacion: 'ROLLO', contenidoPresentacion: 50, unidadesPorCaja: null, cajasPorEstiba: null },
});

/** Remisión del PT "A" en el estado pedido (sin aprobar = en tránsito). */
function remision(cajas: number, estado: 'BORRADOR' | 'ENTREGADA' | 'APROBADA'): Remision {
  const r = Remision.crear({
    anio: 2026, numero: 1, fechaOperativa: FECHA, fechaHoraRegistro: FECHA, turnoId: 'T1', grupoId: 'g', lugarId: 'l', productoId: 'A',
    codigoSnapshot: 'A', descripcionSnapshot: 'A', fechaVencimiento: new Date('2027-01-01T00:00:00Z'), cantidadCajas: cajas, cantidadUnidades: cajas,
    estibasCompletas: 0, cajasSueltas: cajas, numerosEstiba: [], creadaPorId: 'c', extraoficial: false, motivoExtraoficial: null,
  });
  if (estado !== 'BORRADOR') r.entregar('p', FECHA);
  if (estado === 'APROBADA') r.aprobar('OPA', null, FECHA);
  return r;
}

describe('Cierre del día (conteo físico y merma)', () => {
  let items: ItemInventarioRepositorioFalso;
  let movimientos: MovimientoInventarioRepositorioFalso;
  let remisiones: RemisionRepositorioEnMemoria;
  let cierres: CierreInventarioRepositorioFalso;
  let uow: UnidadDeTrabajoFalsa;
  let registrar: RegistrarCierreUseCase;

  beforeEach(async () => {
    items = new ItemInventarioRepositorioFalso();
    items.agregar(item('pt', 'PT', 'A', 0, 'CAJA'));
    items.agregar(item('cinta', 'INSUMO', 'ins-1', 500));
    items.agregar(item('suelto', 'INSUMO', 'ins-2', 80)); // ninguna receta lo usa: no se cuenta
    const recetas = new RecetaRepositorioFalso();
    await recetas.crear({ productoId: 'A', version: 1, vigenteDesde: FECHA, creadaPorId: 'a', creadaPorNombre: 'A', componentes: [{ itemId: 'cinta', cantidad: 1.8 }] });
    movimientos = new MovimientoInventarioRepositorioFalso();
    remisiones = new RemisionRepositorioEnMemoria();
    cierres = new CierreInventarioRepositorioFalso();
    uow = new UnidadDeTrabajoFalsa({ itemsInventario: items, recetas, movimientosInventario: movimientos, remisiones, cierresInventario: cierres, auditoria: new AuditoriaRepositorioFalso() });
    registrar = new RegistrarCierreUseCase(uow, new HorarioRepositorioFalso(horariosDpp()), RELOJ);
  });

  it('prepara solo los materiales de las recetas, con lo en tránsito (remisiones sin aprobar) y lo esperado', async () => {
    remisiones.agregar('r1', remision(10, 'ENTREGADA')); // 18 m en tránsito
    remisiones.agregar('r2', remision(5, 'BORRADOR')); //    9 m en tránsito
    remisiones.agregar('r3', remision(100, 'APROBADA')); // ya descontó: no está en tránsito

    const p = await new PrepararCierreUseCase(uow.contexto).ejecutar(FECHA);

    expect(p.cierre).toBeNull();
    expect(p.materiales).toEqual([expect.objectContaining({ codigo: 'CINTA', existenciaSistema: 500, enTransito: 27, esperado: 473 })]);
  });

  it('merma = esperado − contado; el ajuste deja la existencia en contado + en tránsito', async () => {
    remisiones.agregar('r1', remision(10, 'ENTREGADA')); // 18 m en tránsito → esperado 482

    // Se cuentan 9 rollos de 50 m + 12 m sueltos = 462 m → merma 20 m.
    const cierre = await registrar.ejecutar({
      fechaOperativa: FECHA,
      lineas: [{ itemId: 'cinta', conteo: { estibas: 0, cajas: 0, presentaciones: 9, medida: 12 } }],
      observacion: null,
      usuarioId: 'u1',
    });

    expect(cierre.lineas).toEqual([expect.objectContaining({ esperado: 482, contado: 462, merma: 20, conteoTexto: '9 ROLLO + 12 METRO (1 ROLLO = 50 METRO)' })]);
    // 462 contados + 18 en tránsito: al aprobar r1 se descuentan los 18 y queda 462, lo que hay físicamente.
    expect((await items.buscarPorId('cinta'))!.existencia).toBe(480);
    expect(movimientos.movimientos).toEqual([
      expect.objectContaining({ tipo: 'AJUSTE', cantidad: -20, saldo: 480, cierreId: cierre.id, motivo: expect.stringContaining('merma de 20 METRO') }),
    ]);
  });

  it('% de merma contra lo que descontaron las recetas desde el cierre anterior', async () => {
    // Consumo teórico del día: una aprobación descontó 100 m.
    await movimientos.crear({
      itemId: 'cinta', tipo: 'SALIDA', cantidad: -100, saldo: 400, fechaHoraRegistro: FECHA, fechaOperativa: FECHA, turnoId: 'T1', usuarioId: 'u',
      usuarioNombre: 'U', referencia: null, observacion: null, motivo: null, entradaId: null, remisionId: 'r9', conteoTexto: null, cierreId: null,
    });
    const cierre = await registrar.ejecutar({ fechaOperativa: FECHA, lineas: [{ itemId: 'cinta', cantidad: 495 }], observacion: null, usuarioId: 'u1' });
    expect(cierre.lineas[0]).toMatchObject({ consumoTeorico: 100, merma: 5, mermaPorcentaje: 5 });
  });

  it('sobrante (merma negativa) también ajusta; sin diferencia no hay movimiento', async () => {
    const sobrante = await registrar.ejecutar({ fechaOperativa: FECHA, lineas: [{ itemId: 'cinta', cantidad: 510 }], observacion: null, usuarioId: 'u1' });
    expect(sobrante.lineas[0].merma).toBe(-10);
    expect(movimientos.movimientos.at(-1)).toMatchObject({ cantidad: 10, saldo: 510, motivo: expect.stringContaining('sobrante') });

    const otroDia = new Date('2026-10-01T00:00:00.000Z');
    const igual = await registrar.ejecutar({ fechaOperativa: otroDia, lineas: [{ itemId: 'cinta', cantidad: 510 }], observacion: null, usuarioId: 'u1' });
    expect(igual.lineas[0].merma).toBe(0);
    expect(movimientos.movimientos.filter((m) => m.cierreId === igual.id)).toHaveLength(0);
  });

  it('un cierre por día; hay que contar todos los materiales y nada más', async () => {
    await expect(registrar.ejecutar({ fechaOperativa: FECHA, lineas: [], observacion: null, usuarioId: 'u1' })).rejects.toThrow(/Faltan por contar: CINTA/);
    await expect(
      registrar.ejecutar({ fechaOperativa: FECHA, lineas: [{ itemId: 'cinta', cantidad: 1 }, { itemId: 'suelto', cantidad: 1 }], observacion: null, usuarioId: 'u1' }),
    ).rejects.toThrow(/no usa ninguna receta/);

    await registrar.ejecutar({ fechaOperativa: FECHA, lineas: [{ itemId: 'cinta', cantidad: 500 }], observacion: null, usuarioId: 'u1' });
    await expect(registrar.ejecutar({ fechaOperativa: FECHA, lineas: [{ itemId: 'cinta', cantidad: 500 }], observacion: null, usuarioId: 'u1' })).rejects.toBeInstanceOf(
      CierreYaRegistradoError,
    );
  });
});
