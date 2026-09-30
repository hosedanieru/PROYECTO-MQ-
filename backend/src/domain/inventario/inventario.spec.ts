import { describe, expect, it } from 'vitest';

import { DatosInventarioInvalidosError, ExistenciaInsuficienteError } from './inventario.errors.js';
import { validarDatosMaterial, type DatosMaterial } from './material.js';
import { aplicarMovimiento, type DatosMovimiento } from './movimiento-inventario.js';
import { validarDatosUnidad } from './unidad-medida.js';

const mov = (cambios: Partial<DatosMovimiento>): DatosMovimiento => ({
  tipo: 'ENTRADA',
  cantidad: 10,
  referencia: null,
  observacion: null,
  motivo: null,
  ...cambios,
});

const material = (cambios: Partial<DatosMaterial> = {}): DatosMaterial => ({
  codigo: 'BOLSA-25G',
  descripcion: 'Bolsa papa 25 g',
  unidadBaseId: 'u-unidad',
  presentacionId: null,
  contenidoPresentacion: null,
  unidadesPorCaja: 1000,
  cajasPorEstiba: 40,
  ...cambios,
});

describe('validarDatosMaterial (PI e insumos)', () => {
  it('normaliza el código y recorta la descripción', () => {
    expect(validarDatosMaterial(material({ codigo: ' bolsa-25g ', descripcion: ' Bolsa papa 25 g ' }))).toMatchObject({
      codigo: 'BOLSA-25G',
      descripcion: 'Bolsa papa 25 g',
    });
  });

  it('caja y estiba son opcionales', () => {
    expect(validarDatosMaterial(material({ unidadesPorCaja: null, cajasPorEstiba: null }))).toMatchObject({ unidadesPorCaja: null, cajasPorEstiba: null });
  });

  it('estiba → caja → unidad: sin unidades por caja no hay estiba', () => {
    expect(() => validarDatosMaterial(material({ unidadesPorCaja: null, cajasPorEstiba: 40 }))).toThrow(/unidades por caja/);
  });

  it('cinta: medida METRO con presentación ROLLO de 50 m (el contenido admite decimales)', () => {
    expect(validarDatosMaterial(material({ unidadBaseId: 'u-metro', presentacionId: 'u-rollo', contenidoPresentacion: 50 }))).toMatchObject({
      presentacionId: 'u-rollo',
      contenidoPresentacion: 50,
    });
    expect(validarDatosMaterial(material({ unidadBaseId: 'u-metro', presentacionId: 'u-rollo', contenidoPresentacion: 45.5 })).contenidoPresentacion).toBe(45.5);
  });

  it.each([
    ['sin código', { codigo: '' }],
    ['código con espacios', { codigo: 'CAJA 12' }],
    ['sin descripción', { descripcion: ' ' }],
    ['sin unidad base', { unidadBaseId: '' }],
    ['unidades por caja en cero', { unidadesPorCaja: 0 }],
    ['cajas por estiba con decimales', { cajasPorEstiba: 2.5 }],
    ['presentación sin contenido', { presentacionId: 'u-rollo' }],
    ['contenido sin presentación', { contenidoPresentacion: 50 }],
    ['presentación igual a la medida', { presentacionId: 'u-unidad', contenidoPresentacion: 5 }],
    ['contenido con 4 decimales', { presentacionId: 'u-rollo', contenidoPresentacion: 1.2345 }],
  ])('rechaza: %s', (_, cambios) => {
    expect(() => validarDatosMaterial(material(cambios))).toThrow(DatosInventarioInvalidosError);
  });
});

describe('validarDatosUnidad', () => {
  it('normaliza el código a mayúsculas', () => {
    expect(validarDatosUnidad({ codigo: ' rollo ', nombre: ' Rollo ' })).toEqual({ codigo: 'ROLLO', nombre: 'Rollo' });
  });

  it('rechaza código con espacios o nombre vacío', () => {
    expect(() => validarDatosUnidad({ codigo: 'DOS PALABRAS', nombre: 'x' })).toThrow(DatosInventarioInvalidosError);
    expect(() => validarDatosUnidad({ codigo: 'ROLLO', nombre: ' ' })).toThrow(DatosInventarioInvalidosError);
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

  it('PI e insumos: hasta 3 decimales, sin ruido de redondeo en el saldo', () => {
    expect(aplicarMovimiento(10, mov({ tipo: 'SALIDA', cantidad: 2.5 }), 'METRO').saldo).toBe(7.5);
    // 0,1 + 0,2 en JavaScript da 0,30000000000000004: el saldo sale limpio.
    expect(aplicarMovimiento(0.1, mov({ cantidad: 0.2 }), 'METRO').saldo).toBe(0.3);
    expect(() => aplicarMovimiento(10, mov({ cantidad: 1.2345 }), 'METRO')).toThrow(/3 decimales/);
  });

  it('el PT se mueve en cajas enteras', () => {
    expect(() => aplicarMovimiento(10, mov({ cantidad: 2.5 }), 'CAJA', true)).toThrow(/cajas enteras/);
    expect(aplicarMovimiento(10, mov({ cantidad: 2 }), 'CAJA', true).saldo).toBe(12);
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
