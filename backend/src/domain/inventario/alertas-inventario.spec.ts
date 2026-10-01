import { describe, expect, it } from 'vitest';

import { calcularAlertasInventario } from './alertas-inventario.js';
import type { ItemInventario } from './item-inventario.js';
import type { RecetaPt } from './receta.js';

const item = (id: string, tipo: ItemInventario['tipo'], existencia: number, activo = true, unidad = 'UNIDAD'): ItemInventario => ({
  id, tipo, referenciaId: `ref-${id}`, codigo: id.toUpperCase(), descripcion: `Desc ${id}`, unidadMedida: unidad, activo, equivalencias: null, existencia,
});

const receta = (productoId: string, componentes: Array<[string, number]>): RecetaPt => ({
  id: `r-${productoId}`, productoId, version: 1, vigenteDesde: new Date(), creadaPorId: 'a', creadaPorNombre: 'A',
  componentes: componentes.map(([itemId, cantidad]) => ({ itemId, cantidad })),
});

describe('calcularAlertasInventario (fase D)', () => {
  it('no alcanza para el DPP: (programado − aprobado) × receta contra la existencia, con cuánto falta', () => {
    const alertas = calcularAlertasInventario({
      items: [item('pt1', 'PT', 0), item('cinta', 'INSUMO', 100, true, 'METRO')],
      recetasVigentes: [receta('ref-pt1', [['cinta', 1.8]])],
      pendientePorProducto: new Map([['ref-pt1', 70]]), // 70 cajas × 1,8 m = 126 m
    });
    expect(alertas).toEqual([
      expect.objectContaining({ tipo: 'NO_ALCANZA_DPP', gravedad: 'CRITICA', itemId: 'cinta', necesita: 126, hay: 100, falta: 26, unidad: 'METRO' }),
    ]);
  });

  it('el mismo componente en varios PT del DPP suma lo que necesitan todos', () => {
    const alertas = calcularAlertasInventario({
      items: [item('pt1', 'PT', 0), item('pt2', 'PT', 0), item('bolsa', 'PI', 1000)],
      recetasVigentes: [receta('ref-pt1', [['bolsa', 12]]), receta('ref-pt2', [['bolsa', 6]])],
      pendientePorProducto: new Map([['ref-pt1', 50], ['ref-pt2', 80]]), // 600 + 480 = 1080 > 1000
    });
    expect(alertas).toEqual([expect.objectContaining({ tipo: 'NO_ALCANZA_DPP', necesita: 1080, falta: 80 })]);
  });

  it('si alcanza, o si el PT ya no tiene nada pendiente, no hay alerta', () => {
    expect(
      calcularAlertasInventario({
        items: [item('pt1', 'PT', 0), item('bolsa', 'PI', 1000)],
        recetasVigentes: [receta('ref-pt1', [['bolsa', 12]])],
        pendientePorProducto: new Map([['ref-pt1', 0]]),
      }),
    ).toEqual([]);
  });

  it('PT sin receta: crítica si tiene cajas pendientes en el DPP (no se podrá aprobar), advertencia si no', () => {
    const alertas = calcularAlertasInventario({
      items: [item('pt1', 'PT', 0), item('pt2', 'PT', 0), item('pt3', 'PT', 0, false)],
      recetasVigentes: [],
      pendientePorProducto: new Map([['ref-pt1', 40]]),
    });
    expect(alertas.map((a) => [a.tipo, a.itemId, a.gravedad])).toEqual([
      ['PT_SIN_RECETA', 'pt1', 'CRITICA'],
      ['PT_SIN_RECETA', 'pt2', 'ADVERTENCIA'],
      // pt3 está inactivo: no alerta.
    ]);
  });

  it('agotado: crítico si una receta lo usa; no se repite si ya "no alcanza"', () => {
    const alertas = calcularAlertasInventario({
      items: [item('pt1', 'PT', 0), item('usado', 'INSUMO', 0), item('suelto', 'INSUMO', 0), item('dpp', 'PI', 0)],
      recetasVigentes: [receta('ref-pt1', [['usado', 1], ['dpp', 2]])],
      pendientePorProducto: new Map([['ref-pt1', 0]]),
    });
    expect(alertas.map((a) => [a.tipo, a.itemId, a.gravedad])).toEqual([
      ['AGOTADO', 'dpp', 'CRITICA'],
      ['AGOTADO', 'usado', 'CRITICA'],
      ['AGOTADO', 'suelto', 'ADVERTENCIA'],
    ]);

    const conDpp = calcularAlertasInventario({
      items: [item('pt1', 'PT', 0), item('dpp', 'PI', 0)],
      recetasVigentes: [receta('ref-pt1', [['dpp', 2]])],
      pendientePorProducto: new Map([['ref-pt1', 5]]),
    });
    expect(conDpp.map((a) => a.tipo)).toEqual(['NO_ALCANZA_DPP']);
  });

  it('componente inactivo en la receta vigente de un PT activo', () => {
    const alertas = calcularAlertasInventario({
      items: [item('pt1', 'PT', 0), item('viejo', 'INSUMO', 50, false)],
      recetasVigentes: [receta('ref-pt1', [['viejo', 1]])],
      pendientePorProducto: new Map(),
    });
    expect(alertas).toEqual([expect.objectContaining({ tipo: 'COMPONENTE_INACTIVO', itemId: 'pt1', gravedad: 'ADVERTENCIA', mensaje: expect.stringContaining('VIEJO') })]);
  });
});
