import { describe, expect, it } from 'vitest';

import { datosResumen } from '../../application/pruebas/dobles-resumen.js';
import type { ResumenTurno } from '../../domain/resumen/resumen-turno.js';
import { plantillaResumen } from './plantilla-resumen.js';

const resumen = (extra: Partial<ResumenTurno> = {}): ResumenTurno => ({
  id: 'r1',
  tipo: 'TURNO',
  anio: 2026,
  numero: 7,
  fechaOperativa: new Date('2026-10-02T00:00:00.000Z'),
  turnoId: 'T1',
  formato: { codigo: null, version: null, vigencia: null },
  datos: datosResumen('T1 · Turno 1', [{ turno: 'T1', texto: 'Parada <L2> de 20 min\nSe cambió la cinta' }]),
  cerradoPorId: 'u1',
  cerradoPorNombre: 'Ana Coordinadora',
  fechaHora: new Date('2026-10-02T18:35:00.000Z'), // 13:35 en Bogotá
  ...extra,
});

describe('plantilla del resumen del turno', () => {
  it('lleva el consecutivo, el día operativo en UTC y la hora de cierre en Bogotá', () => {
    const html = plantillaResumen(resumen());
    expect(html).toContain('RESUMEN DE TURNO');
    expect(html).toContain('RT-2026-0007');
    expect(html).toContain('02/10/2026');
    expect(html).toContain('13:35');
    expect(html).toContain('Ana Coordinadora');
  });

  it('sin código del SIG lo marca como pendiente; con código, lo muestra', () => {
    expect(plantillaResumen(resumen())).toContain('PENDIENTE DE');
    const aprobado = plantillaResumen(resumen({ formato: { codigo: 'MQ-FO-012', version: '01', vigencia: '2026-11-01' } }));
    expect(aprobado).toContain('MQ-FO-012');
    expect(aprobado).not.toContain('PENDIENTE DE<br>APROBACIÓN SIG');
  });

  it('escapa las novedades y respeta los saltos de línea', () => {
    const html = plantillaResumen(resumen());
    expect(html).toContain('Parada &lt;L2&gt; de 20 min<br>Se cambió la cinta');
  });

  it('el del día usa la serie RD y su título', () => {
    const html = plantillaResumen(resumen({ tipo: 'DIA', turnoId: null, numero: 1 }));
    expect(html).toContain('RESUMEN DEL DÍA OPERATIVO');
    expect(html).toContain('RD-2026-0001');
  });
});
