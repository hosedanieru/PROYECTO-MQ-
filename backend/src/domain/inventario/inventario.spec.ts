import { describe, expect, it } from 'vitest';

import { DatosInventarioInvalidosError, ExistenciaInsuficienteError } from './inventario.errors.js';
import { validarDatosItem } from './item-inventario.js';
import { aplicarMovimiento, type DatosMovimiento } from './movimiento-inventario.js';

const mov = (cambios: Partial<DatosMovimiento>): DatosMovimiento => ({
  tipo: 'ENTRADA',
  cantidad: 10,
  referencia: null,
  observacion: null,
  motivo: null,
  ...cambios,
});

describe('validarDatosItem', () => {
  it('insumo: normaliza código y unidad a mayúsculas', () => {
    expect(
      validarDatosItem({ tipo: 'INSUMO', codigo: ' caja-12x ', descripcion: ' Caja corrugada ', unidadMedida: 'unidad', productoId: null }),
    ).toEqual({ tipo: 'INSUMO', codigo: 'CAJA-12X', descripcion: 'Caja corrugada', unidadMedida: 'UNIDAD', productoId: null });
  });

  it('PT: exige el producto y no guarda código ni descripción propios', () => {
    expect(validarDatosItem({ tipo: 'PT', codigo: 'X', descripcion: 'Y', unidadMedida: 'CAJA', productoId: 'p1' })).toEqual({
      tipo: 'PT',
      codigo: null,
      descripcion: null,
      unidadMedida: 'CAJA',
      productoId: 'p1',
    });
    expect(() => validarDatosItem({ tipo: 'PT', codigo: null, descripcion: null, unidadMedida: 'CAJA', productoId: null })).toThrow(
      /enlazarse a un producto/,
    );
  });

  it.each([
    ['tipo desconocido', { tipo: 'OTRO' as 'PI' }],
    ['sin código', { codigo: '' }],
    ['código con espacios', { codigo: 'CAJA 12' }],
    ['sin descripción', { descripcion: ' ' }],
    ['sin unidad', { unidadMedida: '' }],
    ['insumo con producto', { productoId: 'p1' }],
  ])('rechaza: %s', (_, cambios) => {
    expect(() =>
      validarDatosItem({ tipo: 'PI', codigo: 'PI-1', descripcion: 'Bolsa individual', unidadMedida: 'UNIDAD', productoId: null, ...cambios }),
    ).toThrow(DatosInventarioInvalidosError);
  });
});

describe('aplicarMovimiento', () => {
  it('entrada suma, salida resta', () => {
    expect(aplicarMovimiento(100, mov({ tipo: 'ENTRADA', cantidad: 50 }), 'CAJA')).toMatchObject({ cantidad: 50, saldo: 150 });
    expect(aplicarMovimiento(100, mov({ tipo: 'SALIDA', cantidad: 30 }), 'CAJA')).toMatchObject({ cantidad: -30, saldo: 70 });
  });

  it('una salida no puede dejar la existencia en negativo', () => {
    expect(() => aplicarMovimiento(100, mov({ tipo: 'SALIDA', cantidad: 120 }), 'CAJA')).toThrow(ExistenciaInsuficienteError);
    expect(() => aplicarMovimiento(100, mov({ tipo: 'SALIDA', cantidad: 120 }), 'CAJA')).toThrow(/hay 100 CAJA y se intentan sacar 120/);
    // Sacar exactamente todo sí se puede.
    expect(aplicarMovimiento(100, mov({ tipo: 'SALIDA', cantidad: 100 }), 'CAJA').saldo).toBe(0);
  });

  it('ajuste: con signo, exige motivo y tampoco deja negativos', () => {
    expect(aplicarMovimiento(100, mov({ tipo: 'AJUSTE', cantidad: -12, motivo: 'Conteo físico' }), 'CAJA')).toMatchObject({ cantidad: -12, saldo: 88 });
    expect(aplicarMovimiento(100, mov({ tipo: 'AJUSTE', cantidad: 5, motivo: 'Se encontraron en bodega' }), 'CAJA').saldo).toBe(105);
    expect(() => aplicarMovimiento(100, mov({ tipo: 'AJUSTE', cantidad: -12, motivo: '  ' }), 'CAJA')).toThrow(/exige un motivo/);
    expect(() => aplicarMovimiento(100, mov({ tipo: 'AJUSTE', cantidad: 0, motivo: 'x' }), 'CAJA')).toThrow(DatosInventarioInvalidosError);
    expect(() => aplicarMovimiento(10, mov({ tipo: 'AJUSTE', cantidad: -11, motivo: 'x' }), 'CAJA')).toThrow(ExistenciaInsuficienteError);
  });

  it('decimales: hasta 3, y el saldo no acumula errores de coma flotante', () => {
    expect(aplicarMovimiento(0.1, mov({ cantidad: 0.2 }), 'KG').saldo).toBe(0.3);
    expect(aplicarMovimiento(10, mov({ tipo: 'SALIDA', cantidad: 2.125 }), 'KG').saldo).toBe(7.875);
    expect(() => aplicarMovimiento(10, mov({ cantidad: 1.2345 }), 'KG')).toThrow(/3 decimales/);
  });

  it.each([
    ['entrada en cero', mov({ cantidad: 0 })],
    ['salida negativa', mov({ tipo: 'SALIDA', cantidad: -5 })],
    ['tipo desconocido', mov({ tipo: 'TRASLADO' as 'ENTRADA' })],
    ['referencia muy larga', mov({ referencia: 'x'.repeat(101) })],
  ])('rechaza: %s', (_, datos) => {
    expect(() => aplicarMovimiento(100, datos, 'CAJA')).toThrow(DatosInventarioInvalidosError);
  });

  it('recorta los textos y deja null los vacíos', () => {
    const r = aplicarMovimiento(0, mov({ referencia: ' REM-4512 ', observacion: '   ' }), 'CAJA');
    expect(r.datos).toMatchObject({ referencia: 'REM-4512', observacion: null, motivo: null });
  });
});
