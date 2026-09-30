import { describe, expect, it } from 'vitest';

import { convertirConteo, type Conteo, type Equivalencias } from './conteo.js';
import { DatosInventarioInvalidosError } from './inventario.errors.js';

/** Cinta: METRO, ROLLO de 50 m, 36 rollos por caja, 20 cajas por estiba. */
const CINTA: Equivalencias = { presentacion: 'ROLLO', contenidoPresentacion: 50, unidadesPorCaja: 36, cajasPorEstiba: 20 };
const conteo = (c: Partial<Conteo>): Conteo => ({ estibas: 0, cajas: 0, presentaciones: 0, medida: 0, ...c });

describe('convertirConteo (fase B)', () => {
  it('10 rollos de 50 m = 500 m, y guarda lo digitado con la equivalencia usada', () => {
    expect(convertirConteo(conteo({ presentaciones: 10 }), CINTA, 'METRO')).toEqual({ total: 500, texto: '10 ROLLO (1 ROLLO = 50 METRO)' });
  });

  it('conteo mixto: estibas + cajas + rollos + metros sueltos, en ese orden', () => {
    // 1 estiba = 20 × 36 × 50 = 36.000 · 2 cajas = 3.600 · 3 rollos = 150 · 12,5 m sueltos
    const r = convertirConteo(conteo({ estibas: 1, cajas: 2, presentaciones: 3, medida: 12.5 }), CINTA, 'METRO');
    expect(r.total).toBe(39_762.5);
    expect(r.texto).toBe('1 estiba + 2 cajas + 3 ROLLO + 12,5 METRO (1 ROLLO = 50 METRO)');
  });

  it('sin presentación, la caja trae unidades de la medida (bolsas por caja)', () => {
    const bolsa: Equivalencias = { presentacion: null, contenidoPresentacion: null, unidadesPorCaja: 1000, cajasPorEstiba: null };
    expect(convertirConteo(conteo({ cajas: 3, medida: 250 }), bolsa, 'UNIDAD')).toEqual({ total: 3250, texto: '3 cajas + 250 UNIDAD' });
  });

  it('no deja usar un escalón que el ítem no tiene definido', () => {
    const soloRollo: Equivalencias = { presentacion: 'ROLLO', contenidoPresentacion: 50, unidadesPorCaja: null, cajasPorEstiba: null };
    expect(() => convertirConteo(conteo({ cajas: 1 }), soloRollo, 'METRO')).toThrow(/cuánto trae una caja/);
    expect(() => convertirConteo(conteo({ estibas: 1 }), { ...CINTA, cajasPorEstiba: null }, 'METRO')).toThrow(/estiba/);
    expect(() => convertirConteo(conteo({ presentaciones: 1 }), null, 'METRO')).toThrow(/presentación/);
  });

  it('rollos, cajas y estibas se cuentan cerrados; la medida suelta admite 3 decimales', () => {
    expect(() => convertirConteo(conteo({ presentaciones: 1.5 }), CINTA, 'METRO')).toThrow(DatosInventarioInvalidosError);
    expect(() => convertirConteo(conteo({ medida: 1.2345 }), CINTA, 'METRO')).toThrow(/3 decimales/);
  });

  it('vacío no vale, salvo en un conteo físico (ajuste), donde contar 0 es un dato', () => {
    expect(() => convertirConteo(conteo({}), CINTA, 'METRO')).toThrow(/vacío/);
    expect(convertirConteo(conteo({}), CINTA, 'METRO', true)).toEqual({ total: 0, texto: '0 METRO' });
  });
});
