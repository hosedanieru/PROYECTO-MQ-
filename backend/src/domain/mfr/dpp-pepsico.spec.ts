import { readFileSync } from 'node:fs';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

import { coincideConSku, leerDpp } from './dpp-pepsico.js';

/** Texto extraído del DPP real del 2026-09-16 (7 páginas, 8 líneas, 20 bloques). */
const TEXTO = readFileSync(path.join(import.meta.dirname, 'dpp-ejemplo-2026-09-16.txt'), 'utf8');

describe('leerDpp', () => {
  const dpp = leerDpp(TEXTO);

  it('toma la fecha del encabezado', () => {
    expect(dpp.fechaOperativa).toBe('2026-09-16');
  });

  it('lee los 20 bloques de "Bar Details" con línea, horas, producto y cifras', () => {
    expect(dpp.bloques).toHaveLength(20);

    expect(dpp.bloques[0]).toEqual({
      linea: 'L1',
      tipoLinea: 'MULTIPACK',
      fechaInicio: '2026-09-16',
      horaInicio: '06:00',
      horaFin: '13:30',
      codigoPepsico: '271350PQJ02-66770',
      sufijoItem: '66770',
      descripcion: 'SURT MG LNC 586GX4X1 BX22',
      targetCajas: 979,
      maxCajas: 1125,
      eficienciaPorcentaje: 87,
      loop: 'LOOP1',
      bpm: 10,
      cajasPorHora: 150,
    });

    const lineas = [...new Set(dpp.bloques.map((b) => b.linea))];
    expect(lineas).toEqual(['L1', 'L2', 'L3', 'L4', 'MANUAL 1', 'MANUAL 2', 'REEMPAQU 2', 'REEMPAQUES']);
  });

  it('convierte horas AM/PM y detecta el cruce de medianoche del T3', () => {
    const t3 = dpp.bloques.find((b) => b.linea === 'MANUAL 1' && b.horaInicio === '22:00')!;
    expect(t3.horaFin).toBe('05:30');
    expect(t3.fechaInicio).toBe('2026-09-16');

    const corto = dpp.bloques.find((b) => b.linea === 'MANUAL 2' && b.horaInicio === '14:00')!;
    expect(corto).toMatchObject({ horaFin: '15:45', targetCajas: 147, maxCajas: 184, eficienciaPorcentaje: 80, bpm: 7, cajasPorHora: 105.14 });

    const siguiente = dpp.bloques.find((b) => b.linea === 'MANUAL 2' && b.horaInicio === '16:15')!;
    expect(siguiente).toMatchObject({ horaFin: '21:30', codigoPepsico: '682263MPM09-66749', targetCajas: 258, loop: null, bpm: 5 });
  });

  it('toma el BPM de la franja horaria aunque el bloque no traiga Loop', () => {
    const papa = dpp.bloques.find((b) => b.codigoPepsico === '271350MPI01-63261')!;
    expect(papa).toMatchObject({ descripcion: 'MULTI PAPA 225X6X1 BX9', bpm: 9, loop: null, maxCajas: 675, targetCajas: 601 });

    const chocl = dpp.bloques.filter((b) => b.codigoPepsico === '285263BLL09-65472');
    expect(chocl).toHaveLength(2);
    expect(chocl.every((b) => b.bpm === 16)).toBe(true);
  });

  it('con texto ajeno no encuentra nada, sin fallar', () => {
    expect(leerDpp('hola mundo')).toEqual({ fechaOperativa: null, bloques: [] });
  });
});

describe('coincideConSku', () => {
  it('cruza por los 5 últimos dígitos', () => {
    expect(coincideConSku('66770', '300066770')).toBe(true);
    expect(coincideConSku('66770', '300058141')).toBe(false);
    expect(coincideConSku('66770', 'ABC')).toBe(false);
  });
});
