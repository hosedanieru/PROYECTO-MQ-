import { describe, expect, it } from 'vitest';

import type { ItemInventario } from '../../domain/inventario/item-inventario.js';
import { REMISIONES_SIN_USO } from '../pruebas/dobles-en-memoria.js';
import { ItemInventarioRepositorioFalso, RecetaRepositorioFalso } from '../pruebas/dobles-inventario.js';
import { BloqueRepositorioFalso, EstandarRepositorioFalso, programarTarget } from '../pruebas/dobles-mfr.js';
import { AlertasInventarioUseCase } from './alertas-inventario.use-case.js';

const FECHA = new Date('2026-09-30T00:00:00.000Z');
const item = (id: string, tipo: ItemInventario['tipo'], referenciaId: string, existencia: number): ItemInventario => ({
  id, tipo, referenciaId, codigo: id.toUpperCase(), descripcion: id, unidadMedida: 'METRO', activo: true, equivalencias: null, existencia,
});

async function escenario(aprobadas: Array<{ cajas: number; extraoficial: boolean }>) {
  const items = new ItemInventarioRepositorioFalso();
  items.agregar(item('pt', 'PT', 'A', 0));
  items.agregar(item('cinta', 'INSUMO', 'ins-1', 100));
  const recetas = new RecetaRepositorioFalso();
  await recetas.crear({ productoId: 'A', version: 1, vigenteDesde: FECHA, creadaPorId: 'a', creadaPorNombre: 'A', componentes: [{ itemId: 'cinta', cantidad: 1.8 }] });
  const bloques = new BloqueRepositorioFalso();
  await programarTarget(bloques, FECHA, 'A', 100); // DPP: 100 cajas de A
  const estandares = new EstandarRepositorioFalso();
  estandares.agregar({ productoId: 'A', codigo: 'A', descripcion: 'A', subdescripcion: null, unidadesPorCaja: 4, cajasPorHora: null, pesoNetoKg: null });
  const remisiones = {
    ...REMISIONES_SIN_USO,
    totalizarCajas: () => Promise.resolve(aprobadas.map((a) => ({ turnoId: 'T1', productoId: 'A', ...a }))),
  };
  return new AlertasInventarioUseCase(items, recetas, bloques, estandares, remisiones).ejecutar(FECHA);
}

describe('AlertasInventarioUseCase', () => {
  it('sin nada aprobado: 100 cajas × 1,8 m = 180 m; hay 100 → faltan 80', async () => {
    const r = await escenario([]);
    expect(r.hayDpp).toBe(true);
    expect(r.alertas).toEqual([expect.objectContaining({ tipo: 'NO_ALCANZA_DPP', necesita: 180, falta: 80 })]);
  });

  it('lo ya aprobado no se vuelve a pedir (ya descontó su consumo); las extraoficiales no restan del DPP', async () => {
    // 60 aprobadas oficiales → faltan 40 cajas × 1,8 = 72 m ≤ 100: alcanza.
    expect((await escenario([{ cajas: 60, extraoficial: false }])).alertas).toEqual([]);
    // Una extraoficial no está en el DPP: el pendiente sigue siendo 100 cajas.
    expect((await escenario([{ cajas: 60, extraoficial: true }])).alertas).toEqual([expect.objectContaining({ tipo: 'NO_ALCANZA_DPP', falta: 80 })]);
  });
});
