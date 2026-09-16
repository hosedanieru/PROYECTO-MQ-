import { describe, expect, it } from 'vitest';

import {
    calcularFechaOperativa,
    fechaOperativaADate,
    registroActual
} from './fecha-operativa.js';

/**
 * Las fechas de prueba se escriben con el desplazamiento explícito -05:00
 * (hora de Colombia) para que las pruebas no dependan de la zona horaria
 * de la máquina donde se ejecutan.
 */
describe('calcularFechaOperativa', () => {
    describe('límites del corte de las 06:00', () => {
        it('las 06:00 en punto inician el nuevo día operativo', () => {
            const instante = new Date('2026-09-14T06:00:00-05:00');
            expect(calcularFechaOperativa(instante)).toBe('2026-09-14');
        });

        it('un minuto antes de las 06:00 pertenece al día anterior', () => {
            const instante = new Date('2026-09-14T05:59:00-05:00');
            expect(calcularFechaOperativa(instante)).toBe('2026-09-13');
        });

        it('el último segundo antes del corte pertenece al día anterior', () => {
            const instante = new Date('2026-09-15T05:59:59-05:00');
            expect(calcularFechaOperativa(instante)).toBe('2026-09-14');
        });
    });

    describe('turno T3 (cruza la medianoche)', () => {
        it('las 02:00 del martes pertenecen al día operativo del lunes', () => {
            const instante = new Date('2026-09-15T02:00:00-05:00');
            expect(calcularFechaOperativa(instante)).toBe('2026-09-14');
        });

        it('las 23:00 pertenecen al mismo día calendario', () => {
            const instante = new Date('2026-09-14T23:00:00-05:00');
            expect(calcularFechaOperativa(instante)).toBe('2026-09-14');
        });

        it('la medianoche exacta pertenece al día anterior', () => {
            const instante = new Date('2026-09-15T00:00:00-05:00');
            expect(calcularFechaOperativa(instante)).toBe('2026-09-14');
        });
    });

    describe('turnos diurnos', () => {
        it('media mañana pertenece al mismo día', () => {
            const instante = new Date('2026-09-14T09:30:00-05:00');
            expect(calcularFechaOperativa(instante)).toBe('2026-09-14');
        });

        it('media tarde pertenece al mismo día', () => {
            const instante = new Date('2026-09-14T16:45:00-05:00');
            expect(calcularFechaOperativa(instante)).toBe('2026-09-14');
        });
    });

    describe('cambios de mes y de año', () => {
        it('la madrugada del primero de mes pertenece al mes anterior', () => {
            const instante = new Date('2026-10-01T03:00:00-05:00');
            expect(calcularFechaOperativa(instante)).toBe('2026-09-30');
        });

        it('la madrugada del primero de enero pertenece al año anterior', () => {
            const instante = new Date('2027-01-01T04:00:00-05:00');
            expect(calcularFechaOperativa(instante)).toBe('2026-12-31');
        });

        it('respeta el 29 de febrero en año bisiesto', () => {
            const instante = new Date('2028-03-01T02:00:00-05:00');
            expect(calcularFechaOperativa(instante)).toBe('2028-02-29');
        });
    });

    describe('independencia de la zona horaria de entrada', () => {
        it('un instante en UTC se interpreta en hora de Colombia', () => {
            // 07:00 UTC = 02:00 en Colombia → día operativo anterior
            const instante = new Date('2026-09-15T07:00:00Z');
            expect(calcularFechaOperativa(instante)).toBe('2026-09-14');
        });

        it('el mismo instante expresado en dos zonas da el mismo resultado', () => {
            const enColombia = new Date('2026-09-15T02:00:00-05:00');
            const enUtc = new Date('2026-09-15T07:00:00Z');
            expect(calcularFechaOperativa(enColombia)).toBe(
                calcularFechaOperativa(enUtc),
            );
        });
    });

    describe('validación de entrada', () => {
        it('rechaza una fecha inválida', () => {
            expect(() => calcularFechaOperativa(new Date('no-es-fecha'))).toThrow();
        });
    });
});

describe('fechaOperativaADate', () => {
    it('convierte a medianoche UTC', () => {
        const resultado = fechaOperativaADate('2026-09-14');
        expect(resultado.toISOString()).toBe('2026-09-14T00:00:00.000Z');
    });

    it('rechaza formatos que no sean YYYY-MM-DD', () => {
        expect(() => fechaOperativaADate('14/09/2026')).toThrow();
        expect(() => fechaOperativaADate('2026-9-14')).toThrow();
        expect(() => fechaOperativaADate('')).toThrow();
    });
});

describe('registroActual', () => {
    it('devuelve el instante real y el día operativo correspondiente', () => {
        const ahora = new Date('2026-09-15T02:14:00-05:00');
        const resultado = registroActual(ahora);

        expect(resultado.fechaHoraRegistro).toEqual(ahora);
        expect(resultado.fechaOperativa.toISOString()).toBe(
            '2026-09-14T00:00:00.000Z',
        );
    });
});