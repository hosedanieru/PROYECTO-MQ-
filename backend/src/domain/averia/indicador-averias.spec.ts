import { describe, expect, it } from 'vitest';

import { calcularIndicadorAverias, type ProductoIndicador } from './indicador-averias.js';
import type { RegistroAveria, ReporteAveria } from './reporte-averia.js';

const PRODUCTOS: ProductoIndicador[] = [
  { id: 'P1', codigo: '300000001', descripcion: 'SURTIDO X4', unidadesPorCaja: 4 },
  { id: 'P2', codigo: '300000002', descripcion: 'MULTIPACK X10', unidadesPorCaja: 10 },
  { id: 'P3', codigo: '300000003', descripcion: 'SIN UNIDADES', unidadesPorCaja: null },
];

function reporte(dia: string, turnoId: string, grupoId: string, registros: Array<Partial<RegistroAveria>>, estado: ReporteAveria['estado'] = 'REGISTRADO'): ReporteAveria {
  return {
    id: `${dia}-${turnoId}-${grupoId}`,
    fechaHoraRegistro: new Date(`${dia}T15:00:00Z`),
    fechaOperativa: new Date(`${dia}T00:00:00Z`),
    turnoId,
    grupoId,
    reportadoPorId: 'u1',
    reportadoPorNombre: 'Ana',
    estado,
    motivoAnulacion: null,
    anuladoPorId: null,
    fechaAnulacion: null,
    registros: registros.map((r, i) => ({
      id: `r${i}`,
      productoId: 'P1',
      productoCodigo: '300000001',
      productoDescripcion: 'SURTIDO X4',
      fechaVencimiento: new Date('2026-12-31T00:00:00Z'),
      lote: 'L1',
      causalId: 'C1',
      cantidad: 1,
      unidadMedida: 'UNIDAD',
      evidencias: [],
      ...r,
    })),
  };
}

describe('calcularIndicadorAverias', () => {
  // Día 1: T = 250 cajas de P1 × 4 = 1.000 unidades. Día 2: 100 cajas de P2 × 10 = 1.000.
  const programado = [
    { fechaOperativa: '2026-09-28', turnoId: 'T1', productoId: 'P1', cajas: 150 },
    { fechaOperativa: '2026-09-28', turnoId: 'T2', productoId: 'P1', cajas: 100 },
    { fechaOperativa: '2026-09-29', turnoId: 'T1', productoId: 'P2', cajas: 100 },
  ];

  it('% = averiadas ÷ (T × unidades por caja), por día, turno y total', () => {
    const r = calcularIndicadorAverias(
      programado,
      [
        reporte('2026-09-28', 'T1', 'G1', [{ cantidad: 1, unidadMedida: 'DOCENA' }]), // 12
        reporte('2026-09-29', 'T1', 'G2', [{ productoId: 'P2', cantidad: 3 }]), // 3
      ],
      PRODUCTOS,
    );

    expect(r.total).toMatchObject({ programadoUnidades: 2000, averiadasUnidades: 15, excede: false });
    expect(r.total.porcentaje).toBeCloseTo(0.75);
    expect(r.porDia.map((d) => [d.fechaOperativa, d.porcentaje])).toEqual([
      ['2026-09-28', 1.2],
      ['2026-09-29', 0.3],
    ]);
    expect(r.porDia[0].excede).toBe(true);
    expect(r.porTurno.find((t) => t.turnoId === 'T1')).toMatchObject({ programadoUnidades: 1600, averiadasUnidades: 15 });
    expect(r.alertas).toEqual(['El 2026-09-28 las averías fueron 1,2 % de lo programado (máximo 1 %).']);
  });

  it('el 1 % exacto no excede; pasarlo sí, y en un periodo se avisa también el total', () => {
    const justo = calcularIndicadorAverias(programado.slice(0, 2), [reporte('2026-09-28', 'T1', 'G1', [{ cantidad: 10 }])], PRODUCTOS);
    expect(justo.total).toMatchObject({ porcentaje: 1, excede: false });

    const pasado = calcularIndicadorAverias(programado, [reporte('2026-09-28', 'T1', 'G1', [{ cantidad: 30 }])], PRODUCTOS);
    expect(pasado.total.excede).toBe(true);
    expect(pasado.alertas[0]).toMatch(/En el periodo las averías suman 1,5 %/);
  });

  it('los reportes anulados no cuentan', () => {
    const r = calcularIndicadorAverias(programado, [reporte('2026-09-28', 'T1', 'G1', [{ cantidad: 500 }], 'ANULADO')], PRODUCTOS);
    expect(r.total.averiadasUnidades).toBe(0);
    expect(r.alertas).toEqual([]);
  });

  it('por grupo: aporte de cada uno sobre el mismo DPP (la suma da el total)', () => {
    const r = calcularIndicadorAverias(
      programado,
      [reporte('2026-09-28', 'T1', 'G1', [{ cantidad: 6 }]), reporte('2026-09-28', 'T2', 'G2', [{ cantidad: 4 }])],
      PRODUCTOS,
    );
    expect(r.porGrupo).toEqual([
      { grupoId: 'G1', averiadasUnidades: 6, porcentaje: 0.3 },
      { grupoId: 'G2', averiadasUnidades: 4, porcentaje: 0.2 },
    ]);
    expect(r.porGrupo.reduce((s, g) => s + g.porcentaje!, 0)).toBeCloseTo(r.total.porcentaje!);
  });

  it('fuera del DPP se juzga por el día de la avería, no por el periodo', () => {
    // P2 está programado el 29, pero la avería es del 28: está fuera del DPP de ESE día.
    const averiaP2El28 = reporte('2026-09-28', 'T1', 'G1', [{ productoId: 'P2', productoCodigo: '300000002', cantidad: 2 }]);

    const semana = calcularIndicadorAverias(programado, [averiaP2El28], PRODUCTOS);
    expect(semana.total.averiadasUnidades).toBe(2); // cuenta en el total
    expect(semana.porProducto.find((p) => p.productoId === 'P2')).toMatchObject({ enDpp: true, unidadesFueraDelDpp: 2 });
    expect(semana.alertas.at(-1)).toMatch(/no estaban en el DPP del día en que se reportaron: 300000002/);

    const soloEl28 = calcularIndicadorAverias(programado.slice(0, 2), [averiaP2El28], PRODUCTOS);
    expect(soloEl28.porProducto.find((p) => p.productoId === 'P2')).toMatchObject({ enDpp: false, unidadesFueraDelDpp: 2 });

    const dentro = calcularIndicadorAverias(programado, [reporte('2026-09-29', 'T1', 'G1', [{ productoId: 'P2', cantidad: 2 }])], PRODUCTOS);
    expect(dentro.porProducto.find((p) => p.productoId === 'P2')!.unidadesFueraDelDpp).toBe(0);
    expect(dentro.alertas).toEqual([]);
  });

  it('bolsas aparte; producto del DPP sin unidades por caja se informa', () => {
    const r = calcularIndicadorAverias(
      [...programado, { fechaOperativa: '2026-09-28', turnoId: 'T1', productoId: 'P3', cajas: 50 }],
      [reporte('2026-09-28', 'T1', 'G1', [{ cantidad: 5, unidadMedida: 'BOLSA' }])],
      PRODUCTOS,
    );
    expect(r.bolsasSinConvertir).toBe(5);
    expect(r.total.averiadasUnidades).toBe(0);
    expect(r.productosSinUnidadesPorCaja).toEqual(['300000003']);
    expect(r.total.programadoUnidades).toBe(2000);
  });

  it('averías en un día sin DPP: sin % y con alerta', () => {
    const r = calcularIndicadorAverias([], [reporte('2026-09-30', 'T1', 'G1', [{ cantidad: 4 }])], PRODUCTOS);
    expect(r.total).toMatchObject({ porcentaje: null, excede: false, averiadasUnidades: 4 });
    expect(r.alertas[0]).toMatch(/no hay DPP cargado/);
  });
});
