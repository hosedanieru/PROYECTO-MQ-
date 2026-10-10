import { describe, expect, it } from 'vitest';

import { correoDeRemisiones, correoDeResumen, fechaCorreo, listasDelCierre, turnoSiguiente } from './correo-cierre.js';
import type { ListaDistribucion } from './correo.js';

const turnos = [
  { id: 't3', codigo: 'T3', activo: true },
  { id: 't1', codigo: 'T1', activo: true },
  { id: 't2', codigo: 'T2', activo: true },
];

const lista = (id: string, cambios: Partial<ListaDistribucion>): ListaDistribucion => ({
  id, nombre: id, recibe: 'AMBOS', turnoId: null, incluirEnCierres: true, correos: [`${id}@x.co`], activo: true, ...cambios,
});

describe('Correos del cierre — turno siguiente', () => {
  it('sigue el orden del código y vuelve al primero después del último', () => {
    expect(turnoSiguiente(turnos, 't1')).toBe('t2');
    expect(turnoSiguiente(turnos, 't2')).toBe('t3');
    expect(turnoSiguiente(turnos, 't3')).toBe('t1');
  });

  it('salta los turnos inactivos; sin el turno o con uno solo no hay siguiente', () => {
    expect(turnoSiguiente([...turnos.slice(0, 2), { id: 't2', codigo: 'T2', activo: false }], 't1')).toBe('t3');
    expect(turnoSiguiente(turnos, 'no-existe')).toBeNull();
    expect(turnoSiguiente([turnos[1]], 't1')).toBeNull();
  });
});

describe('Correos del cierre — listas que reciben cada contenido', () => {
  const listas = [
    lista('jefes', { recibe: 'RESUMEN' }),
    lista('pepsico', { recibe: 'REMISIONES' }),
    lista('ambos', { recibe: 'AMBOS' }),
    lista('solo-manual', { incluirEnCierres: false }),
    lista('turno-2', { turnoId: 't2', incluirEnCierres: false }),
    lista('turno-3', { turnoId: 't3' }),
    lista('inactiva', { activo: false }),
  ];
  const nombres = (l: ListaDistribucion[]) => l.map((x) => x.id);

  it('resumen: las que lo reciben, generales marcadas y la del turno siguiente', () => {
    expect(nombres(listasDelCierre(listas, 'RESUMEN', 't2'))).toEqual(['jefes', 'ambos', 'turno-2']);
  });

  it('remisiones: lo mismo con las que reciben remisiones', () => {
    expect(nombres(listasDelCierre(listas, 'REMISIONES', 't3'))).toEqual(['pepsico', 'ambos', 'turno-3']);
  });

  it('sin turno siguiente solo van las generales', () => {
    expect(nombres(listasDelCierre(listas, 'REMISIONES', null))).toEqual(['pepsico', 'ambos']);
  });
});

describe('Correos del cierre — textos', () => {
  const fecha = new Date('2026-10-10T00:00:00Z');

  it('la fecha operativa se escribe en UTC (no retrocede un día)', () => {
    expect(fechaCorreo(fecha)).toBe('10/10/2026');
  });

  it('resumen del turno, y del día cuando el cierre lo terminó', () => {
    expect(correoDeResumen({ turno: 'T1', fechaOperativa: fecha, consecutivoTurno: 'RT-2026-0007', consecutivoDia: null }).asunto).toBe(
      'Resumen MQ T1 · 10/10/2026 (RT-2026-0007)',
    );
    const delDia = correoDeResumen({ turno: 'T3', fechaOperativa: fecha, consecutivoTurno: 'RT-2026-0009', consecutivoDia: 'RD-2026-0003' });
    expect(delDia.asunto).toBe('Resumen MQ T3 · 10/10/2026 (RT-2026-0009 y RD-2026-0003)');
    expect(delDia.texto).toContain('terminó el día');
  });

  it('remisiones: aprobadas adjuntas y pendientes en el cuerpo', () => {
    const c = correoDeRemisiones({ turno: 'T1', fechaOperativa: fecha, aprobadas: ['2026-0012 · A', '2026-0013 · B'], pendientes: ['2026-0014 · C · RECHAZADA'] });
    expect(c.asunto).toBe('Remisiones MQ T1 · 10/10/2026: 2 aprobadas');
    expect(c.texto).toContain('Remisiones aprobadas (2, adjuntas en PDF):\n  - 2026-0012 · A');
    expect(c.texto).toContain('rechazadas (1, no se adjuntan):\n  - 2026-0014 · C · RECHAZADA');
  });

  it('sin aprobadas el correo sale igual y lo dice (usuario, 2026-10-10)', () => {
    const c = correoDeRemisiones({ turno: 'T2', fechaOperativa: fecha, aprobadas: [], pendientes: [] });
    expect(c.asunto).toBe('Remisiones MQ T2 · 10/10/2026: sin remisiones aprobadas');
    expect(c.texto).toContain('no lleva adjunto');
    expect(c.texto).not.toContain('Pendientes');
  });
});
