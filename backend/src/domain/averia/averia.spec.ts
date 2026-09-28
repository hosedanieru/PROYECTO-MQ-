import { describe, expect, it } from 'vitest';

import { DatosAveriaInvalidosError, DatosCausalInvalidosError } from './averia.errors.js';
import { ordenarCausales, validarDatosCausal, type CausalAveria } from './causal-averia.js';
import {
  totalizarUnidades,
  validarRegistroAveria,
  type DatosRegistroAveria,
  type EvidenciaAveria,
} from './registro-averia.js';

const FOTOS: EvidenciaAveria[] = [
  { tipo: 'UNIDAD', ruta: 'evidencias/a.jpg' },
  { tipo: 'LOTE_FECHA', ruta: 'evidencias/b.jpg' },
  { tipo: 'CONJUNTO', ruta: 'evidencias/c.jpg' },
];

function registro(cambios: Partial<DatosRegistroAveria> = {}): DatosRegistroAveria {
  return {
    productoId: 'prod-1',
    fechaVencimiento: new Date('2026-12-31T00:00:00Z'),
    lote: 'L127 23:33 DD AM',
    causalId: 'ESTALLADO',
    cantidad: 5,
    unidadMedida: 'UNIDAD',
    evidencias: FOTOS,
    ...cambios,
  };
}

describe('validarDatosCausal', () => {
  it('normaliza el código a mayúsculas y recorta el nombre', () => {
    expect(validarDatosCausal({ codigo: ' bolsa_rota ', nombre: '  Bolsa - rota ', orden: 9 })).toEqual({
      codigo: 'BOLSA_ROTA',
      nombre: 'Bolsa - rota',
      orden: 9,
    });
  });

  it.each([
    [{ codigo: '', nombre: 'X', orden: 0 }],
    [{ codigo: 'CON ESPACIO', nombre: 'X', orden: 0 }],
    [{ codigo: 'OK', nombre: '   ', orden: 0 }],
    [{ codigo: 'OK', nombre: 'X', orden: -1 }],
    [{ codigo: 'OK', nombre: 'X', orden: 1.5 }],
  ])('rechaza datos inválidos %#', (datos) => {
    expect(() => validarDatosCausal(datos)).toThrow(DatosCausalInvalidosError);
  });
});

describe('ordenarCausales', () => {
  it('ordena por orden y, a igual orden, por nombre', () => {
    const c = (nombre: string, orden: number): CausalAveria => ({ id: nombre, codigo: nombre, nombre, orden, activo: true });
    const ordenadas = ordenarCausales([c('Sobrepeso', 2), c('Bajo de aire', 2), c('Estallado', 1)]);
    expect(ordenadas.map((x) => x.nombre)).toEqual(['Estallado', 'Bajo de aire', 'Sobrepeso']);
  });
});

describe('validarRegistroAveria', () => {
  it('acepta un registro completo y recorta el lote', () => {
    const valido = validarRegistroAveria(registro({ lote: '  L127  ' }));
    expect(valido.lote).toBe('L127');
  });

  it.each([
    ['sin producto', { productoId: '' }],
    ['sin causal', { causalId: '' }],
    ['sin lote', { lote: '   ' }],
    ['lote demasiado largo', { lote: 'x'.repeat(61) }],
    ['vencimiento inválido', { fechaVencimiento: new Date('no-es-fecha') }],
    ['cantidad cero', { cantidad: 0 }],
    ['cantidad decimal', { cantidad: 2.5 }],
    ['unidad desconocida', { unidadMedida: 'CAJA' as DatosRegistroAveria['unidadMedida'] }],
  ])('rechaza: %s', (_, cambios) => {
    expect(() => validarRegistroAveria(registro(cambios))).toThrow(DatosAveriaInvalidosError);
  });

  it('exige las 3 fotos: unidad, lote y fecha, y conjunto', () => {
    expect(() => validarRegistroAveria(registro({ evidencias: FOTOS.slice(0, 2) }))).toThrow(/CONJUNTO/);
    expect(() => validarRegistroAveria(registro({ evidencias: [] }))).toThrow(DatosAveriaInvalidosError);
  });

  it('rechaza una foto repetida o sin ruta', () => {
    expect(() => validarRegistroAveria(registro({ evidencias: [...FOTOS, FOTOS[0]] }))).toThrow(DatosAveriaInvalidosError);
    expect(() =>
      validarRegistroAveria(registro({ evidencias: [FOTOS[0], FOTOS[1], { tipo: 'CONJUNTO', ruta: ' ' }] })),
    ).toThrow(/CONJUNTO/);
  });
});

describe('totalizarUnidades', () => {
  it('convierte docenas y sixes a unidades', () => {
    const total = totalizarUnidades([
      { cantidad: 5, unidadMedida: 'UNIDAD' },
      { cantidad: 2, unidadMedida: 'DOCENA' },
      { cantidad: 3, unidadMedida: 'SIX' },
    ]);
    expect(total).toEqual({ unidades: 5 + 24 + 18, sinConvertir: {} });
  });

  it('las bolsas quedan aparte mientras su equivalencia esté pendiente', () => {
    const total = totalizarUnidades([
      { cantidad: 4, unidadMedida: 'BOLSA' },
      { cantidad: 1, unidadMedida: 'UNIDAD' },
      { cantidad: 2, unidadMedida: 'BOLSA' },
    ]);
    expect(total).toEqual({ unidades: 1, sinConvertir: { BOLSA: 6 } });
  });

  it('sin registros el total es cero', () => {
    expect(totalizarUnidades([])).toEqual({ unidades: 0, sinConvertir: {} });
  });
});
