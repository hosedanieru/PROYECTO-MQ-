import { describe, expect, it } from 'vitest';

import {
  BloqueProgramacion,
  verificarSinSolapamiento,
  type EstadoPersistidoBloque,
} from './bloque-programacion.js';
import {
  calcularBloque,
  calcularBloques,
  calcularFamiliasHorarias,
  calcularLinea,
  calcularMfrDia,
  calcularTurno,
  calcularVistaHoraria,
  semaforo,
} from './calculo-mfr.js';
import { pesoNetoSugeridoKg, type EstandarProducto } from './estandar-produccion.js';
import { diaSemanaDe, horasDeHorario, horasTurnoEn, minutosOperativos, turnoDeHora, type HorarioTurno } from './horas-turno.js';
import { BloquesSolapadosError, DatosMfrInvalidosError, TurnoCerradoError } from './mfr.errors.js';

const FECHA = new Date('2026-09-16T00:00:00.000Z'); // miércoles

/** Productos del DPP del 2026-09-16, con el peso deducido de la descripción. */
const ESTANDARES: EstandarProducto[] = [
  { productoId: 'LNC', codigo: '300066770', descripcion: 'SURT MG LNC 586GX4X1 BX22', subdescripcion: 'SURTIDO', unidadesPorCaja: 4, cajasPorHora: 150, pesoNetoKg: 2.344 },
  { productoId: 'SPR', codigo: '300058140', descripcion: 'SRT SPR LNC 271GX7X1 BX12', subdescripcion: 'SURTIDO', unidadesPorCaja: 7, cajasPorHora: 77.14, pesoNetoKg: 1.897 },
  { productoId: 'BBQ', codigo: '300066478', descripcion: 'DTBBQ4X1 BX12X45GGTX1X45G', subdescripcion: 'OFERTA', unidadesPorCaja: 4, cajasPorHora: 105, pesoNetoKg: 2.34 },
  { productoId: 'SIN', codigo: '999', descripcion: 'SIN PESO', subdescripcion: null, unidadesPorCaja: null, cajasPorHora: null, pesoNetoKg: null },
];

function bloque(
  lineaId: string,
  turnoId: string,
  productoId: string,
  horaInicio: string,
  horaFin: string,
  cajasPorHora: number,
  eficiencia: number,
  extra: Partial<EstadoPersistidoBloque> = {},
): EstadoPersistidoBloque {
  return {
    ...BloqueProgramacion.crear(
      { fechaOperativa: FECHA, lineaId, productoId, horaInicio, horaFin, cajasPorHora, eficienciaPorcentaje: eficiencia, loop: null, personasAsignadas: null },
      turnoId,
      'MANUAL',
      'coord',
      FECHA,
    ).aObjeto(),
    id: `${lineaId}-${horaInicio}`,
    ...extra,
  };
}

const HORARIOS_DPP: HorarioTurno[] = [
  { turnoId: 'T1', diaSemana: 'MIERCOLES', horaInicio: '06:00', horaFin: '13:30', cruzaMedianoche: false },
  { turnoId: 'T2', diaSemana: 'MIERCOLES', horaInicio: '14:00', horaFin: '21:30', cruzaMedianoche: false },
  { turnoId: 'T3', diaSemana: 'MIERCOLES', horaInicio: '22:00', horaFin: '05:30', cruzaMedianoche: true },
];

describe('semaforo', () => {
  it('verde desde la meta, amarillo hasta 10 puntos abajo, rojo después', () => {
    expect(semaforo(95)).toBe('VERDE');
    expect(semaforo(100)).toBe('VERDE');
    expect(semaforo(94.9)).toBe('AMARILLO');
    expect(semaforo(85)).toBe('AMARILLO');
    expect(semaforo(84.9)).toBe('ROJO');
    expect(semaforo(null)).toBeNull();
  });
});

describe('horas y turnos', () => {
  it('calcula duración, incluido el cruce de medianoche y las fracciones', () => {
    expect(horasDeHorario({ horaInicio: '06:00', horaFin: '13:30' })).toBe(7.5);
    expect(horasDeHorario({ horaInicio: '22:00', horaFin: '05:30' })).toBe(7.5);
    expect(horasDeHorario({ horaInicio: '14:00', horaFin: '15:45' })).toBe(1.75);
    expect(horasDeHorario({ horaInicio: '16:15', horaFin: '21:30' })).toBe(5.25);
  });

  it('minutos operativos: el día empieza a las 06:00', () => {
    expect(minutosOperativos('06:00')).toBe(0);
    expect(minutosOperativos('22:00')).toBe(960);
    expect(minutosOperativos('05:30')).toBe(1410);
  });

  it('usa el día de la semana de la fecha operativa', () => {
    expect(diaSemanaDe(FECHA)).toBe('MIERCOLES');
    expect(horasTurnoEn(HORARIOS_DPP, 'T1', FECHA)).toBe(7.5);
    expect(horasTurnoEn(HORARIOS_DPP, 'T3', FECHA)).toBe(7.5);
    expect(horasTurnoEn(HORARIOS_DPP, 'T1', new Date('2026-09-13T00:00:00.000Z'))).toBeNull(); // domingo sin horario
  });

  it('asigna el turno por la hora de inicio; la pausa queda con el turno anterior', () => {
    expect(turnoDeHora(HORARIOS_DPP, FECHA, '06:00')).toBe('T1');
    expect(turnoDeHora(HORARIOS_DPP, FECHA, '13:45')).toBe('T1');
    expect(turnoDeHora(HORARIOS_DPP, FECHA, '14:00')).toBe('T2');
    expect(turnoDeHora(HORARIOS_DPP, FECHA, '16:15')).toBe('T2');
    expect(turnoDeHora(HORARIOS_DPP, FECHA, '22:00')).toBe('T3');
    expect(turnoDeHora(HORARIOS_DPP, FECHA, '02:00')).toBe('T3');
    expect(turnoDeHora(HORARIOS_DPP, FECHA, '05:45')).toBe('T3'); // antes de las 06:00 sigue siendo el último
    expect(turnoDeHora([], FECHA, '06:00')).toBeNull();
  });
});

describe('BloqueProgramacion', () => {
  it('valida horas, cajas/h, eficiencia y que quepa en el día operativo', () => {
    expect(() => bloque('L1', 'T1', 'LNC', '6:00', '13:30', 150, 87)).toThrow(DatosMfrInvalidosError);
    expect(() => bloque('L1', 'T1', 'LNC', '06:00', '06:00', 150, 87)).toThrow(DatosMfrInvalidosError);
    expect(() => bloque('L1', 'T1', 'LNC', '22:00', '07:00', 150, 87)).toThrow(DatosMfrInvalidosError); // pasa de las 06:00
    expect(() => bloque('L1', 'T1', 'LNC', '06:00', '13:30', 0, 87)).toThrow(DatosMfrInvalidosError);
    expect(() => bloque('L1', 'T1', 'LNC', '06:00', '13:30', 150, 0)).toThrow(DatosMfrInvalidosError);
    expect(() => bloque('L1', 'T1', 'LNC', '06:00', '13:30', 150, 101)).toThrow(DatosMfrInvalidosError);
    expect(() => bloque('L1', 'T1', 'LNC', '22:00', '05:30', 150, 87)).not.toThrow();
  });

  it('se edita mientras está abierto y se congela al cerrar', () => {
    const b = BloqueProgramacion.desdePersistencia(bloque('L1', 'T1', 'LNC', '06:00', '13:30', 150, 87));

    b.editar({ eficienciaPorcentaje: 80, cajasPorHora: undefined, horaInicio: '14:00', horaFin: '21:30' }, 'T2');
    expect(b.aObjeto()).toMatchObject({ eficienciaPorcentaje: 80, cajasPorHora: 150, horaInicio: '14:00', turnoId: 'T2' });
    expect(b.horas).toBe(7.5);

    b.cerrar('coord', FECHA);
    expect(b.estaCerrado).toBe(true);
    expect(() => b.editar({ eficienciaPorcentaje: 50 }, 'T2')).toThrow(TurnoCerradoError);
    expect(() => b.cerrar('coord', FECHA)).toThrow(TurnoCerradoError);
  });

  it('detecta solapamientos dentro de la misma línea, no entre líneas', () => {
    const a = bloque('M2', 'T2', 'BBQ', '14:00', '15:45', 105, 80);
    const b = bloque('M2', 'T2', 'BBQ', '16:15', '21:30', 105, 80);
    const c = bloque('M2', 'T2', 'BBQ', '15:30', '17:00', 105, 80);
    const otraLinea = bloque('M1', 'T2', 'BBQ', '15:30', '17:00', 105, 80);

    expect(() => verificarSinSolapamiento([a, b, otraLinea])).not.toThrow();
    expect(() => verificarSinSolapamiento([a, b, c])).toThrow(BloquesSolapadosError);
    // Contiguos (fin == inicio) no se solapan.
    expect(() => verificarSinSolapamiento([a, bloque('M2', 'T2', 'BBQ', '15:45', '16:00', 105, 80)])).not.toThrow();
    // Cruce de medianoche.
    expect(() =>
      verificarSinSolapamiento([bloque('M1', 'T3', 'BBQ', '22:00', '05:30', 60, 82), bloque('M1', 'T3', 'BBQ', '04:00', '05:00', 60, 82)]),
    ).toThrow(BloquesSolapadosError);
  });
});

describe('calcularBloque — fórmula del DPP', () => {
  it('Mx = cajas/h × horas; T = Mx × E (bloques reales del 2026-09-16)', () => {
    const l1 = calcularBloque(bloque('L1', 'T1', 'LNC', '06:00', '13:30', 150, 87), ESTANDARES[0]);
    expect(l1).toMatchObject({ horas: 7.5, maxCajas: 1125, targetCajas: 979, maxKg: 2637, targetKg: 2294.8 });

    const l2 = calcularBloque(bloque('L2', 'T1', 'SPR', '06:00', '13:30', 77.14, 84), ESTANDARES[1]);
    expect(l2).toMatchObject({ maxCajas: 579, targetCajas: 486 });

    const m2corto = calcularBloque(bloque('M2', 'T2', 'BBQ', '14:00', '15:45', 105, 80), ESTANDARES[2]);
    expect(m2corto).toMatchObject({ horas: 1.75, maxCajas: 184, targetCajas: 147 });
  });

  it('las cajas siempre calculan (el ritmo va en el bloque); sin peso no hay kilos', () => {
    const sinPeso = calcularBloque(bloque('L1', 'T1', 'SIN', '06:00', '13:30', 150, 87), ESTANDARES[3]);
    expect(sinPeso).toMatchObject({ maxCajas: 1125, targetCajas: 979, maxKg: null, targetKg: null });

    const sinEstandar = calcularBloque(bloque('L1', 'T1', 'X', '06:00', '13:30', 150, 87), undefined);
    expect(sinEstandar).toMatchObject({ maxCajas: 1125, targetCajas: 979, maxKg: null });
  });
});

describe('calcularMfrDia', () => {
  const bloques = calcularBloques(
    [
      bloque('L1', 'T1', 'LNC', '06:00', '13:30', 150, 87), // T 979
      bloque('L1', 'T2', 'LNC', '14:00', '21:30', 150, 87), // T 979 → LNC programado 1958
      bloque('L2', 'T1', 'SPR', '06:00', '13:30', 77.14, 84), // T 486
    ],
    ESTANDARES,
  );

  it('programado por SKU = Σ target de sus bloques; cumplimiento con un decimal', () => {
    const mfr = calcularMfrDia(bloques, [
      { turnoId: 'T1', productoId: 'LNC', cajas: 900 },
      { turnoId: 'T2', productoId: 'LNC', cajas: 960 },
      { turnoId: 'T1', productoId: 'SPR', cajas: 486 },
    ]);

    expect(mfr.porProducto).toEqual([
      { productoId: 'LNC', programadoCajas: 1958, producidoCajas: 1860, programadoKg: 4589.6, producidoKg: 4359.8, cumplimiento: 95, semaforo: 'VERDE' },
      { productoId: 'SPR', programadoCajas: 486, producidoCajas: 486, programadoKg: 921.9, producidoKg: 921.9, cumplimiento: 100, semaforo: 'VERDE' },
    ]);
    expect(mfr.programadoCajas).toBe(2444);
    expect(mfr.producidoCajas).toBe(2346);
    expect(mfr.cumplimiento).toBe(96);
    expect(mfr.semaforo).toBe('VERDE');
  });

  it('producir de más en un SKU no compensa faltar en otro', () => {
    const mfr = calcularMfrDia(bloques, [
      { turnoId: 'T1', productoId: 'LNC', cajas: 3000 },
      { turnoId: 'T1', productoId: 'SPR', cajas: 0 },
    ]);

    expect(mfr.porProducto[0].cumplimiento).toBe(153.2);
    expect(mfr.producidoCajas).toBe(1958); // LNC aporta máximo lo programado
    expect(mfr.cumplimiento).toBe(80.1);
    expect(mfr.semaforo).toBe('ROJO');
  });

  it('señala lo producido sin programación y no divide por cero', () => {
    const mfr = calcularMfrDia(bloques, [{ turnoId: 'T1', productoId: 'Z', cajas: 30 }]);
    expect(mfr.producidoSinProgramar).toEqual([{ productoId: 'Z', cajas: 30 }]);
    expect(mfr.porProducto[0].producidoCajas).toBe(0);

    const vacio = calcularMfrDia([], [{ turnoId: 'T1', productoId: 'LNC', cajas: 10 }]);
    expect(vacio.cumplimiento).toBeNull();
    expect(vacio.semaforo).toBeNull();
  });
});

describe('calcularTurno y calcularLinea', () => {
  const bloques = calcularBloques(
    [
      bloque('L1', 'T1', 'LNC', '06:00', '13:30', 150, 87), // Mx 1125, T 979
      bloque('L2', 'T1', 'SPR', '06:00', '13:30', 77.14, 84), // Mx 579, T 486
      bloque('L1', 'T2', 'LNC', '14:00', '21:30', 150, 87, { cerradoEn: FECHA, cerradoPorId: 'coord' }),
      bloque('L3', 'T3', 'SIN', '22:00', '05:30', 77.14, 84), // Mx 579, T 486, sin kilos
    ],
    ESTANDARES,
  );

  it('turno: eficiencia planeada (T/Mx), real (producido/Mx) y cumplimiento (producido/T)', () => {
    const t1 = calcularTurno(
      'T1',
      bloques,
      [
        { turnoId: 'T1', productoId: 'LNC', cajas: 900 },
        { turnoId: 'T1', productoId: 'SPR', cajas: 400 },
        { turnoId: 'T2', productoId: 'LNC', cajas: 999 }, // otro turno, no cuenta
      ],
      ESTANDARES,
    );

    expect(t1).toMatchObject({
      maxCajas: 1704,
      targetCajas: 1465,
      producidoCajas: 1300,
      eficienciaPlaneada: 86,
      eficienciaReal: 76.3,
      cumplimiento: 88.7,
      semaforo: 'AMARILLO',
      cerrado: false,
    });
    expect(t1.producidoKg).toBe(2868.4); // 900 × 2,344 + 400 × 1,897
    expect(t1.bloques).toHaveLength(2);

    const t2 = calcularTurno('T2', bloques, [], ESTANDARES);
    expect(t2).toMatchObject({ targetCajas: 979, producidoCajas: 0, cumplimiento: 0, semaforo: 'ROJO', cerrado: true });

    const t3 = calcularTurno('T3', bloques, [], ESTANDARES);
    expect(t3).toMatchObject({ maxCajas: 579, targetCajas: 486, targetKg: 0, cumplimiento: 0, semaforo: 'ROJO', cerrado: false });

    expect(calcularTurno('T9', bloques, [], ESTANDARES)).toMatchObject({ maxCajas: 0, cumplimiento: null, semaforo: null });
  });

  it('línea: horas y cajas planeadas', () => {
    expect(calcularLinea('L1', bloques)).toMatchObject({ horasProgramadas: 15, maxCajas: 2250, targetCajas: 1958, targetKg: 4589.6 });
    expect(calcularLinea('L9', bloques)).toMatchObject({ horasProgramadas: 0, maxCajas: 0 });
  });
});

describe('calcularVistaHoraria — las filas de kilos del DPP', () => {
  it('reproduce Target, Instant, Capacity y Overpull de la LINEA 1 del 2026-09-16', () => {
    const bloques = calcularBloques([bloque('L1', 'T1', 'LNC', '06:00', '13:30', 150, 87)], ESTANDARES);
    const vista = calcularVistaHoraria(bloques, [{ id: 'L1', capacidadKgHora: 306 }]);

    expect(vista.horas[0]).toBe('06:00');
    expect(vista.horas[23]).toBe('05:00');
    const l1 = vista.lineas[0];
    // 06:00–13:00 horas completas; 13:00–14:00 media hora; después nada.
    expect(l1.targetKg.slice(0, 9)).toEqual([306, 306, 306, 306, 306, 306, 306, 153, 0]);
    expect(l1.instantKg.slice(0, 9)).toEqual([352, 352, 352, 352, 352, 352, 352, 176, 0]);
    expect(l1.capacidadKg.slice(0, 9)).toEqual([306, 306, 306, 306, 306, 306, 306, 153, 0]);
    expect(l1.overpull.slice(0, 9)).toEqual([115, 115, 115, 115, 115, 115, 115, 115, null]);
    expect(vista.totalTargetKg[0]).toBe(306);
  });

  it('prorratea la capacidad cuando el bloque cubre parte de la hora (MANUAL 2, 14:00–15:45 y 16:15–21:30)', () => {
    const bloques = calcularBloques(
      [bloque('M2', 'T2', 'BBQ', '14:00', '15:45', 105, 80), bloque('M2', 'T2', 'BBQ', '16:15', '21:30', 105, 80)],
      ESTANDARES,
    );
    const vista = calcularVistaHoraria(bloques, [{ id: 'M2', capacidadKgHora: 249 }]);
    const m2 = vista.lineas[0];
    // Índices: 8 = 14:00, 9 = 15:00, 10 = 16:00, 11 = 17:00
    expect(m2.capacidadKg.slice(8, 12)).toEqual([249, 187, 187, 249]);
    expect(m2.overpull[9]).toBe(m2.overpull[8]); // la carga relativa no cambia con la fracción
  });

  it('sin capacidad nominal no hay overpull; sin peso no hay kilos', () => {
    const bloques = calcularBloques([bloque('L1', 'T1', 'LNC', '06:00', '13:30', 150, 87)], [{ ...ESTANDARES[0], pesoNetoKg: null }]);
    const vista = calcularVistaHoraria(bloques, [{ id: 'L1', capacidadKgHora: null }]);
    expect(vista.lineas[0].targetKg[0]).toBe(0);
    expect(vista.lineas[0].overpull[0]).toBeNull();
  });
});

describe('calcularFamiliasHorarias — "Flavor Breakdown"', () => {
  it('agrupa los kg target por hora según la subdescripción del producto', () => {
    const bloques = calcularBloques(
      [
        bloque('L1', 'T1', 'LNC', '06:00', '13:30', 150, 87), // SURTIDO, 306 kg/h
        bloque('L2', 'T1', 'SPR', '06:00', '13:30', 77.14, 84), // SURTIDO, 123 kg/h
        bloque('M2', 'T1', 'BBQ', '06:00', '13:30', 105, 80), // OFERTA
        bloque('M1', 'T1', 'SIN', '06:00', '13:30', 60, 80), // sin peso: no aporta kilos
      ],
      ESTANDARES,
    );
    const familias = calcularFamiliasHorarias(bloques, ESTANDARES);

    expect(familias.map((f) => f.familia)).toEqual(['SURTIDO', 'OFERTA']);
    expect(familias[0].targetKg[0]).toBe(429); // 306 + 123
    expect(familias[0].targetKg[7]).toBe(214); // media hora
    expect(familias[0].targetKg[8]).toBe(0);
    expect(familias[0].totalKg).toBe(Math.round(2294.8 + 921.9));
  });

  it('los productos sin familia van a "SIN FAMILIA"', () => {
    const bloques = calcularBloques([bloque('L1', 'T1', 'LNC', '06:00', '13:30', 150, 87)], [{ ...ESTANDARES[0], subdescripcion: null }]);
    expect(calcularFamiliasHorarias(bloques, [{ ...ESTANDARES[0], subdescripcion: null }])[0].familia).toBe('SIN FAMILIA');
  });
});

describe('pesoNetoSugeridoKg', () => {
  it('deduce el peso de las descripciones del DPP', () => {
    expect(pesoNetoSugeridoKg('SURT MG LNC 586GX4X1 BX22')).toBe(2.344);
    expect(pesoNetoSugeridoKg('SRT SPR LNC 271GX7X1 BX12')).toBe(1.897);
    expect(pesoNetoSugeridoKg('MULTI PAPA 225X6X1 BX9')).toBe(1.35);
    expect(pesoNetoSugeridoKg('MRGPLL5X1BX12X25GGTX2X25G')).toBe(1.75);
    expect(pesoNetoSugeridoKg('DTBBQ4X1 BX12X45GGTX1X45G')).toBe(2.34);
    expect(pesoNetoSugeridoKg('MARGARITA MIXTA 100GX18X1')).toBe(1.8);
    expect(pesoNetoSugeridoKg('CHOCL LIMON 170GX19X1 MAQ')).toBe(3.23);
    expect(pesoNetoSugeridoKg('SURTIDO MEGA LONCHERA')).toBeNull();
  });
});
