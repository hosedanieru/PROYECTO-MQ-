import { describe, expect, it } from 'vitest';

import { instanteOperativo } from './indicadores-produccion.js';
import { calcularRitmo, esperadoHasta, estadoRitmo, type BloqueRitmo, type RemisionRitmo } from './ritmo-produccion.js';

const DIA = '2026-10-06';

/** Hora de Bogotá del día operativo → instante. */
const a = (hora: string) => {
  const [h, m] = hora.split(':').map(Number);
  return instanteOperativo(DIA, ((h - 6 + 24) % 24) * 60 + m);
};

/** T1 06:00–13:30 (0 → 450 min), 750 cajas: 100 cajas por hora. */
const T1: BloqueRitmo = { turnoId: 'T1', inicioMinutos: 0, finMinutos: 450, targetCajas: 750 };
/** T2 14:00–21:30 (480 → 930), 450 cajas. */
const T2: BloqueRitmo = { turnoId: 'T2', inicioMinutos: 480, finMinutos: 930, targetCajas: 450 };

const rem = (cajas: number, hora: string, extra: Partial<RemisionRitmo> = {}): RemisionRitmo => ({
  turnoId: 'T1',
  cajas,
  creada: a(hora),
  extraoficial: false,
  ...extra,
});

describe('estadoRitmo: ±5 % es "en línea"', () => {
  it('clasifica según la desviación', () => {
    expect(estadoRitmo(100, 100)).toBe('EN_LINEA');
    expect(estadoRitmo(105, 100)).toBe('EN_LINEA'); // justo en el borde
    expect(estadoRitmo(95, 100)).toBe('EN_LINEA');
    expect(estadoRitmo(106, 100)).toBe('ADELANTADO');
    expect(estadoRitmo(94, 100)).toBe('RETRASADO');
  });

  it('sin nada esperado no hay ritmo que juzgar', () => {
    expect(estadoRitmo(10, 0)).toBe('SIN_DATO');
  });
});

describe('esperadoHasta: el T del bloque se reparte parejo en sus horas', () => {
  it('a mitad del bloque se espera la mitad', () => {
    expect(esperadoHasta([T1], 225)).toBe(375);
  });

  it('antes de empezar, cero; después de terminar, todo', () => {
    expect(esperadoHasta([T2], 100)).toBe(0);
    expect(esperadoHasta([T2], 1000)).toBe(450);
  });
});

describe('calcularRitmo', () => {
  it('a las 09:00 se esperan 300 cajas del T1: con 300 va en línea', () => {
    const ritmo = calcularRitmo(DIA, [T1, T2], [rem(200, '07:50'), rem(100, '08:55')], a('09:00'));
    const t1 = ritmo.porTurno.find((t) => t.turnoId === 'T1')!;
    expect(t1).toMatchObject({ esperadoAhoraCajas: 300, realAhoraCajas: 300, estado: 'EN_LINEA', diferenciaCajas: 0 });
    expect(ritmo.minutoActual).toBe(180);
  });

  it('retrasado y adelantado', () => {
    expect(calcularRitmo(DIA, [T1], [rem(200, '08:00')], a('09:00')).estado).toBe('RETRASADO'); // 200 de 300
    expect(calcularRitmo(DIA, [T1], [rem(400, '08:00')], a('09:00')).estado).toBe('ADELANTADO'); // 400 de 300
  });

  it('cuentan las remisiones por su hora de CREACIÓN, en cualquier estado; las extraoficiales no', () => {
    const ritmo = calcularRitmo(
      DIA,
      [T1],
      [rem(150, '07:00'), rem(150, '08:30'), rem(500, '08:00', { extraoficial: true }), rem(100, '09:30')],
      a('09:00'),
    );
    expect(ritmo.realAhoraCajas).toBe(300); // la de 09:30 todavía no existe a las 09:00
  });

  it('un turno que no ha empezado no tiene esperado: SIN_DATO', () => {
    const t2 = calcularRitmo(DIA, [T1, T2], [], a('09:00')).porTurno.find((t) => t.turnoId === 'T2')!;
    expect(t2).toMatchObject({ empezo: false, esperadoAhoraCajas: 0, estado: 'SIN_DATO' });
  });

  it('al terminar el turno lo esperado se congela en su meta y lo real sigue sumando registros tardíos', () => {
    const t1 = calcularRitmo(DIA, [T1, T2], [rem(700, '13:00'), rem(50, '15:00')], a('16:00')).porTurno.find((t) => t.turnoId === 'T1')!;
    expect(t1).toMatchObject({ esperadoAhoraCajas: 750, realAhoraCajas: 750, estado: 'EN_LINEA' });
  });

  it('por turno usa el turno de la remisión', () => {
    const ritmo = calcularRitmo(DIA, [T1, T2], [rem(300, '08:00'), rem(90, '15:00', { turnoId: 'T2' })], a('15:00'));
    expect(ritmo.porTurno.find((t) => t.turnoId === 'T2')!.realAhoraCajas).toBe(90);
  });

  it('la serie tiene las 24 horas; lo real solo hasta la hora en curso', () => {
    const ritmo = calcularRitmo(DIA, [T1], [rem(100, '06:30')], a('08:30'));
    expect(ritmo.serie).toHaveLength(24);
    expect(ritmo.serie.slice(0, 4).map((p) => p.realCajas)).toEqual([100, 100, 100, null]);
    expect(ritmo.serie[0]).toMatchObject({ hora: '07:00', esperadoCajas: 100 });
    expect(ritmo.serie[23].hora).toBe('06:00');
  });

  it('un día que terminó: minuto 1440 y todo lo real', () => {
    const ritmo = calcularRitmo(DIA, [T1], [rem(750, '12:00')], new Date('2026-10-09T12:00:00Z'));
    expect(ritmo.minutoActual).toBe(1440);
    expect(ritmo.estado).toBe('EN_LINEA');
  });

  it('sin DPP no hay ritmo', () => {
    const ritmo = calcularRitmo(DIA, [], [rem(10, '08:00')], a('09:00'));
    expect(ritmo).toMatchObject({ metaCajas: 0, estado: 'SIN_DATO', porTurno: [] });
  });
});
