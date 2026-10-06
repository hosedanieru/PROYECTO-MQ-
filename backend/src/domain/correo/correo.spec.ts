import { describe, expect, it } from 'vitest';

import { DatosCorreoInvalidosError, destinatariosDe, normalizarCorreos, validarLista, type ListaDistribucion } from './correo.js';

const lista = (correos: string[]): ListaDistribucion => ({ id: 'l', nombre: 'L', recibe: 'REMISIONES', turnoId: null, incluirEnCierres: true, correos, activo: true });

describe('Correo — listas y destinatarios', () => {
  it('normaliza: minúsculas, sin espacios ni repetidos; rechaza lo que no es correo', () => {
    expect(normalizarCorreos([' Jefe@Inlotrans.com.co ', 'jefe@inlotrans.com.co', '', 'opa@pepsico.com'])).toEqual(['jefe@inlotrans.com.co', 'opa@pepsico.com']);
    expect(() => normalizarCorreos(['no-es-correo'])).toThrow(/no es un correo válido/);
  });

  it('una lista exige nombre y al menos un correo; "incluir en cierres" solo aplica a las listas sin turno', () => {
    expect(() => validarLista({ nombre: ' ', recibe: 'RESUMEN', turnoId: null, incluirEnCierres: false, correos: ['a@b.co'] })).toThrow(DatosCorreoInvalidosError);
    expect(() => validarLista({ nombre: 'Jefes', recibe: 'RESUMEN', turnoId: null, incluirEnCierres: false, correos: [] })).toThrow(/al menos un correo/);
    expect(validarLista({ nombre: ' Turno T2 ', recibe: 'AMBOS', turnoId: 'T2', incluirEnCierres: true, correos: ['c@d.co'] })).toEqual({
      nombre: 'Turno T2', recibe: 'AMBOS', turnoId: 'T2', incluirEnCierres: false, correos: ['c@d.co'],
    });
  });

  it('una lista dice qué recibe al cerrar el turno: remisiones, resumen o ambos', () => {
    const datos = { nombre: 'Jefes', turnoId: null, incluirEnCierres: true, correos: ['a@b.co'] };
    expect(validarLista({ ...datos, recibe: 'RESUMEN' }).recibe).toBe('RESUMEN');
    expect(() => validarLista({ ...datos, recibe: 'TODO' as never })).toThrow(/qué recibe/);
  });

  it('destinatarios: listas + correos sueltos sin repetir; al menos uno', () => {
    expect(destinatariosDe([lista(['a@b.co', 'c@d.co'])], ['C@D.co', 'e@f.co'])).toEqual(['a@b.co', 'c@d.co', 'e@f.co']);
    expect(() => destinatariosDe([], [])).toThrow(/al menos una lista/);
  });
});
