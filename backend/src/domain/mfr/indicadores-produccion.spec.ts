import { describe, expect, it } from 'vitest';

import type { ReporteAveria } from '../averia/reporte-averia.js';
import {
  calcularAveriasVsFabricado,
  calcularFr,
  calcularOtif,
  calcularProductividad,
  calcularRankingPt,
  instanteOperativo,
  type BloqueIndicador,
  type RemisionIndicador,
} from './indicadores-produccion.js';

const DIA = '2026-10-06';
const OTRO_DIA = '2026-10-07';

function bloque(productoId: string, targetCajas: number, finMinutos: number, extra: Partial<BloqueIndicador> = {}): BloqueIndicador {
  return { fechaOperativa: DIA, turnoId: 'T1', productoId, finMinutos, targetCajas, ...extra };
}

/** Hora de Bogotá del día operativo → instante. "07:30" = 90 min desde las 06:00. */
const a = (hora: string, fecha = DIA) => {
  const [h, m] = hora.split(':').map(Number);
  return instanteOperativo(fecha, ((h - 6 + 24) % 24) * 60 + m);
};

function remision(productoId: string, cajas: number, extra: Partial<RemisionIndicador> = {}): RemisionIndicador {
  return {
    fechaOperativa: DIA,
    turnoId: 'T1',
    grupoId: 'G1',
    productoId,
    cajas,
    unidades: cajas * 10,
    estado: 'APROBADA',
    extraoficial: false,
    creada: a('08:00'),
    aprobada: a('09:00'),
    ...extra,
  };
}

describe('instanteOperativo', () => {
  it('las 06:00 del día operativo son las 11:00 UTC (Bogotá es UTC−5 todo el año)', () => {
    expect(instanteOperativo(DIA, 0).toISOString()).toBe('2026-10-06T11:00:00.000Z');
  });

  it('el T3 cruza la medianoche: 05:30 es del día calendario siguiente', () => {
    expect(instanteOperativo(DIA, 1410).toISOString()).toBe('2026-10-07T10:30:00.000Z');
  });
});

describe('FR: total aprobado ÷ total programado, sin tope por SKU', () => {
  it('lo que sobra en un SKU compensa lo que falta en otro (el MFR no lo permitiría)', () => {
    const fr = calcularFr([bloque('A', 100, 450), bloque('B', 100, 450)], [remision('A', 130), remision('B', 70)]);
    expect(fr).toMatchObject({ programadoCajas: 200, aprobadoCajas: 200, porcentaje: 100 });
  });

  it('no cuenta borradores, entregadas sin aprobar, rechazadas ni extraoficiales', () => {
    const fr = calcularFr(
      [bloque('A', 100, 450)],
      [
        remision('A', 40),
        remision('A', 20, { estado: 'VALIDADA' }),
        remision('A', 50, { estado: 'ENTREGADA', aprobada: null }),
        remision('A', 50, { estado: 'RECHAZADA', aprobada: null }),
        remision('A', 50, { extraoficial: true }),
      ],
    );
    expect(fr.aprobadoCajas).toBe(60);
    expect(fr.porcentaje).toBe(60);
  });

  it('un día sin DPP no se puede dividir: porcentaje null, no cero', () => {
    const fr = calcularFr([], [remision('A', 10)]);
    expect(fr.porcentaje).toBeNull();
    expect(fr.porDia).toEqual([{ fechaOperativa: DIA, programadoCajas: 0, aprobadoCajas: 10, porcentaje: null }]);
  });

  it('separa por día del periodo', () => {
    const fr = calcularFr(
      [bloque('A', 100, 450), bloque('A', 50, 450, { fechaOperativa: OTRO_DIA })],
      [remision('A', 100), remision('A', 25, { fechaOperativa: OTRO_DIA })],
    );
    expect(fr.porDia.map((d) => d.porcentaje)).toEqual([100, 50]);
    expect(fr.porcentaje).toBe(83.3);
  });
});

describe('OTIF: completo y antes del fin de su último bloque', () => {
  it('completo y a tiempo', () => {
    const otif = calcularOtif([bloque('A', 100, 450)], [remision('A', 100, { aprobada: a('13:00') })]); // límite 13:30
    expect(otif).toMatchObject({ skus: 1, completos: 1, cumplen: 1, porcentaje: 100 });
    expect(otif.detalle[0].limite.toISOString()).toBe(a('13:30').toISOString());
  });

  it('justo en la hora límite cuenta como a tiempo', () => {
    const otif = calcularOtif([bloque('A', 100, 450)], [remision('A', 100, { aprobada: a('13:30') })]);
    expect(otif.cumplen).toBe(1);
  });

  it('completo pero tarde: In Full sí, OTIF no', () => {
    const otif = calcularOtif([bloque('A', 100, 450)], [remision('A', 100, { aprobada: a('14:10') })]);
    expect(otif).toMatchObject({ completos: 1, cumplen: 0, porcentaje: 0, completosPorcentaje: 100 });
  });

  it('a tiempo pero incompleto no cumple', () => {
    const otif = calcularOtif([bloque('A', 100, 450)], [remision('A', 99, { aprobada: a('08:00') })]);
    expect(otif.detalle[0]).toMatchObject({ completo: false, aTiempo: false, completoEn: null });
  });

  it('SKU en varios bloques: suma sus T y la hora límite es el fin del ÚLTIMO bloque', () => {
    const otif = calcularOtif(
      [bloque('A', 60, 450), bloque('A', 40, 930, { turnoId: 'T2' })], // 13:30 y 21:30
      [remision('A', 60, { aprobada: a('12:00') }), remision('A', 40, { aprobada: a('20:00') })],
    );
    expect(otif.detalle[0]).toMatchObject({ programadoCajas: 100, completo: true, aTiempo: true });
    expect(otif.detalle[0].limite.toISOString()).toBe(a('21:30').toISOString());
    expect(otif.detalle[0].completoEn!.toISOString()).toBe(a('20:00').toISOString());
  });

  it('el momento en que se completó es la aprobación que alcanzó lo programado, no la última', () => {
    const otif = calcularOtif(
      [bloque('A', 100, 450)],
      [remision('A', 100, { aprobada: a('10:00') }), remision('A', 30, { aprobada: a('15:00') })],
    );
    expect(otif.detalle[0].completoEn!.toISOString()).toBe(a('10:00').toISOString());
    expect(otif.cumplen).toBe(1);
  });

  it('una remisión fuera del DPP no crea un SKU para el OTIF', () => {
    const otif = calcularOtif([bloque('A', 100, 450)], [remision('A', 100, { aprobada: a('09:00') }), remision('Z', 50)]);
    expect(otif.skus).toBe(1);
  });

  it('sin DPP no hay SKU que medir: porcentaje null', () => {
    expect(calcularOtif([], [remision('A', 10)]).porcentaje).toBeNull();
  });

  it('marca la aprobación sin fecha (no se puede juzgar la hora)', () => {
    const otif = calcularOtif([bloque('A', 100, 450)], [remision('A', 100, { aprobada: null })]);
    expect(otif.detalle[0]).toMatchObject({ completo: true, aTiempo: false, sinFechaAprobacion: true });
  });
});

describe('Ranking de PT', () => {
  it('ordena de mayor a menor y busca el menor entre los programados, incluidos los de 0', () => {
    const ranking = calcularRankingPt(
      [bloque('A', 100, 450), bloque('B', 100, 450), bloque('C', 100, 450)],
      [remision('A', 80), remision('B', 120)],
    );
    expect(ranking.filas.map((f) => f.productoId)).toEqual(['B', 'A', 'C']);
    expect(ranking.mayor?.productoId).toBe('B');
    expect(ranking.menor).toMatchObject({ productoId: 'C', producidoCajas: 0, cumplimiento: 0 });
  });

  it('un PT producido sin programación aparece en las filas pero no puede ser "el menor"', () => {
    const ranking = calcularRankingPt([bloque('A', 100, 450)], [remision('A', 100), remision('Z', 5)]);
    expect(ranking.filas.find((f) => f.productoId === 'Z')).toMatchObject({ programado: false, cumplimiento: null });
    expect(ranking.menor?.productoId).toBe('A');
  });

  it('empate en cajas: es "menor" el que peor cumplió frente a lo programado', () => {
    const ranking = calcularRankingPt([bloque('A', 100, 450), bloque('B', 50, 450)], [remision('A', 50), remision('B', 50)]);
    expect(ranking.menor?.productoId).toBe('A'); // 50 % contra 100 %
  });

  it('sin producción no hay "mayor"', () => {
    expect(calcularRankingPt([bloque('A', 100, 450)], []).mayor).toBeNull();
  });
});

function reporte(fechaOperativa: string, registros: Array<{ productoId: string; cantidad: number; unidadMedida: 'UNIDAD' | 'BOLSA' }>, estado: ReporteAveria['estado'] = 'REGISTRADO'): ReporteAveria {
  return {
    id: 'R',
    fechaHoraRegistro: new Date(),
    fechaOperativa: new Date(`${fechaOperativa}T00:00:00.000Z`),
    turnoId: 'T1',
    grupoId: 'G1',
    reportadoPorId: 'u',
    reportadoPorNombre: 'U',
    estado,
    motivoAnulacion: null,
    anuladoPorId: null,
    fechaAnulacion: null,
    registros: registros.map((r, i) => ({
      id: `r${i}`,
      productoId: r.productoId,
      productoCodigo: r.productoId,
      productoDescripcion: r.productoId,
      fechaVencimiento: new Date(),
      lote: 'L',
      causalId: 'C',
      cantidad: r.cantidad,
      unidadMedida: r.unidadMedida,
      evidencias: [],
    })),
  };
}

describe('Averías vs lo fabricado: averiadas ÷ (fabricadas + averiadas)', () => {
  it('calcula sobre lo que pasó por la línea', () => {
    // 99 cajas × 10 = 990 fabricadas; 10 averiadas → 10 / 1000 = 1 %.
    const r = calcularAveriasVsFabricado([remision('A', 99)], [reporte(DIA, [{ productoId: 'A', cantidad: 10, unidadMedida: 'UNIDAD' }])]);
    expect(r.total).toEqual({ fabricadoUnidades: 990, extraoficialUnidades: 0, averiadasUnidades: 10, porcentaje: 1 });
  });

  it('las extraoficiales también se fabricaron; lo no aprobado aún no', () => {
    const r = calcularAveriasVsFabricado(
      [remision('A', 10, { extraoficial: true }), remision('A', 10, { estado: 'BORRADOR', aprobada: null })],
      [],
    );
    expect(r.total.fabricadoUnidades).toBe(100);
  });

  it('separa las extraoficiales dentro de lo fabricado, en el total y en cada corte', () => {
    const r = calcularAveriasVsFabricado([remision('A', 30), remision('A', 10, { extraoficial: true })], []);
    expect(r.total).toMatchObject({ fabricadoUnidades: 400, extraoficialUnidades: 100 });
    expect(r.porDia[0]).toMatchObject({ fabricadoUnidades: 400, extraoficialUnidades: 100 });
    expect(r.porTurno[0]).toMatchObject({ fabricadoUnidades: 400, extraoficialUnidades: 100 });
  });

  it('los reportes anulados no cuentan y las bolsas se informan aparte', () => {
    const r = calcularAveriasVsFabricado(
      [remision('A', 10)],
      [
        reporte(DIA, [{ productoId: 'A', cantidad: 5, unidadMedida: 'UNIDAD' }], 'ANULADO'),
        reporte(DIA, [{ productoId: 'A', cantidad: 3, unidadMedida: 'BOLSA' }]),
      ],
    );
    expect(r.total.averiadasUnidades).toBe(0);
    expect(r.bolsasSinConvertir).toBe(3);
  });

  it('sin nada fabricado ni averiado no hay porcentaje', () => {
    expect(calcularAveriasVsFabricado([], []).total.porcentaje).toBeNull();
  });

  it('por producto solo lista los que tuvieron averías, del peor al mejor', () => {
    const r = calcularAveriasVsFabricado(
      [remision('A', 10), remision('B', 10), remision('C', 10)],
      [reporte(DIA, [{ productoId: 'A', cantidad: 1, unidadMedida: 'UNIDAD' }, { productoId: 'B', cantidad: 5, unidadMedida: 'UNIDAD' }])],
    );
    expect(r.porProducto.map((p) => p.productoId)).toEqual(['B', 'A']);
  });
});

describe('Productividad: cajas ÷ (personas que llegaron × horas del turno)', () => {
  const horas = [
    { fechaOperativa: DIA, turnoId: 'T1', horas: 7.5 },
    { fechaOperativa: DIA, turnoId: 'T2', horas: 7.5 },
  ];

  it('por turno y por grupo', () => {
    const p = calcularProductividad(
      [remision('A', 150, { grupoId: 'G1' }), remision('A', 75, { grupoId: 'G2' })],
      [
        { fechaOperativa: DIA, turnoId: 'T1', grupoId: 'G1', personas: 10 },
        { fechaOperativa: DIA, turnoId: 'T1', grupoId: 'G2', personas: 5 },
      ],
      horas,
    );
    // 225 cajas ÷ (15 × 7,5 = 112,5) = 2
    expect(p.porTurno).toEqual([{ turnoId: 'T1', cajas: 225, personas: 15, horasPersona: 112.5, cajasPorPersonaHora: 2 }]);
    expect(p.porGrupo.find((g) => g.grupoId === 'G1')?.cajasPorPersonaHora).toBe(2); // 150 ÷ 75
    expect(p.total.cajasPorPersonaHora).toBe(2);
  });

  it('un turno sin asistencia no entra (no se divide por cero) y sus cajas se informan', () => {
    const p = calcularProductividad(
      [remision('A', 100), remision('A', 40, { turnoId: 'T2' })],
      [{ fechaOperativa: DIA, turnoId: 'T1', grupoId: 'G1', personas: 10 }],
      horas,
    );
    expect(p.cajasSinAsistencia).toBe(40);
    expect(p.porTurno.map((t) => t.turnoId)).toEqual(['T1']);
  });

  it('asistencia sin producción: productividad 0, no "sin dato"', () => {
    const p = calcularProductividad([], [{ fechaOperativa: DIA, turnoId: 'T1', grupoId: 'G1', personas: 4 }], horas);
    expect(p.porTurno[0].cajasPorPersonaHora).toBe(0);
  });

  it('un turno que ese día no opera (horas null) no entra', () => {
    const p = calcularProductividad(
      [remision('A', 10, { turnoId: 'T3' })],
      [{ fechaOperativa: DIA, turnoId: 'T3', grupoId: 'G1', personas: 4 }],
      [{ fechaOperativa: DIA, turnoId: 'T3', horas: null }],
    );
    expect(p.total.cajasPorPersonaHora).toBeNull();
    expect(p.cajasSinAsistencia).toBe(10);
  });
});
