import { describe, expect, it } from 'vitest';

import { leerHojaTiempos, type Celda } from './hoja-tiempos.js';

/** Fila con las 11 columnas de la hoja: ITEM … SUBDESCRIPCION. */
const fila = (numeroFila: number, celdas: Celda[]) => ({ numeroFila, celdas });

describe('leerHojaTiempos', () => {
  it('lee una fila completa (fórmula de cajas/hora ya resuelta)', () => {
    const { registros, excepciones } = leerHojaTiempos([
      fila(4, ['300062680', 'SURTIDO LONCHERA D1 236GX7X1', 'AUTOMATICA', 7, 49, 7, 3, 1029, 147, 12, 'surtido']),
    ]);
    expect(excepciones).toEqual([]);
    expect(registros[0]).toMatchObject({
      codigo: '300062680', proceso: 'AUTOMATICA', unidadesPorCaja: 7, cajasPorEstiba: 49, cajasPorHora: 147,
      personasIdeal: 12, subdescripcion: 'SURTIDO', pesoSugeridoKg: 1.652,
    });
  });

  it('calcula cajas/hora con productividad × cajas por estiba cuando la fórmula no trae resultado', () => {
    const { registros, excepciones } = leerHojaTiempos([
      fila(89, ['300066644', 'MARGARITA SURTIDO 600GX3X1 TER BX24X25G', 'MANUAL', 3, 36, 7, 2, null, null, null, 'MULTIPACK']),
    ]);
    expect(excepciones).toEqual([]);
    expect(registros[0].cajasPorHora).toBe(72);
    expect(registros[0].personasIdeal).toBeNull();
  });

  it('reporta la fila sin cajas/hora y sin productividad, pero la importa', () => {
    const { registros, excepciones } = leerHojaTiempos([
      fila(87, ['300066478', 'DETODITO BBQ 4X1 BX12X45G+GTX1X45G   ', 'MANUAL', 4, 36, 7, null, null, null, 10, 'OFERTA']),
    ]);
    expect(registros).toHaveLength(1);
    expect(registros[0].cajasPorHora).toBeNull();
    expect(registros[0].descripcion).toBe('DETODITO BBQ 4X1 BX12X45G+GTX1X45G');
    expect(excepciones.map((e) => e.motivo)).toEqual([expect.stringContaining('Sin "CAJAS POR HORA"')]);
  });

  it('no propone peso cuando la descripción contradice las unidades por caja', () => {
    const { registros, excepciones } = leerHojaTiempos([
      fila(2, ['300058141', 'SURTIDO MEGA LONCHERA 586GX3X1 BX22', 'AUTOMATICA', 4, 36, 7, 4, 576, 144, 13, 'SURTIDO']),
    ]);
    expect(registros[0].pesoSugeridoKg).toBeNull();
    expect(excepciones[0].motivo).toContain('descripción dice 3 unidades');
  });

  it('LINEA IDEAL en 0 se toma como sin dato y se reporta', () => {
    const { registros, excepciones } = leerHojaTiempos([
      fila(2, ['300061302', 'MANI MOTO NATURAL 360GX24X1 PROM2X', 'MANUAL', 24, 70, 7, 1, null, 70, 0, 'OFERTA']),
    ]);
    expect(registros[0].personasIdeal).toBeNull();
    expect(excepciones[0].motivo).toContain('"LINEA IDEAL" en 0');
  });

  it('normaliza AUTOMATICO y rechaza procesos desconocidos sin perder la fila', () => {
    const { registros, excepciones } = leerHojaTiempos([
      fila(2, ['A1', 'X', 'automatico', 4, 36, 7, 1, null, 36, 1, null]),
      fila(3, ['A2', 'Y', 'LINEA', 4, 36, 7, 1, null, 36, 1, null]),
    ]);
    expect(registros.map((r) => r.proceso)).toEqual(['AUTOMATICA', null]);
    expect(excepciones).toEqual([expect.objectContaining({ codigo: 'A2', motivo: expect.stringContaining('LINEA') })]);
  });

  it('duplicados: iguales se toma uno; distintos se omiten y se reportan', () => {
    const base: Celda[] = ['300064890', 'PROMO DORITOS', 'MANUAL', 6, 42, 7, 1, null, 42, 9, 'OFERTA'];
    const { registros, excepciones } = leerHojaTiempos([
      fila(10, base),
      fila(20, base),
      fila(30, ['300065062', 'DETODITO BBQ PROMO', 'MANUAL', 4, 54, 7, 2, null, 108, 10, 'OFERTA']),
      fila(31, ['300065062', 'DETODITO BBQ PROMO', 'MANUAL', 4, 54, 7, 1, null, 54, 10, 'OFERTA']),
    ]);
    expect(registros.map((r) => r.codigo)).toEqual(['300064890']);
    expect(excepciones.map((e) => e.codigo)).toEqual(['300064890', '300065062']);
    expect(excepciones[1].motivo).toContain('DISTINTOS');
  });

  it('omite filas vacías y reporta filas sin código', () => {
    const { registros, excepciones } = leerHojaTiempos([
      fila(5, [null, null, null, null, null, null, null, null, null, null, null]),
      fila(6, ['', 'DUOS DE CHOCLITO', 'MANUAL', 40, 36, 7, 1, null, 36, 6, 'OFERTA']),
    ]);
    expect(registros).toEqual([]);
    expect(excepciones).toEqual([{ numeroFila: 6, codigo: null, motivo: expect.stringContaining('sin código') }]);
  });
});
