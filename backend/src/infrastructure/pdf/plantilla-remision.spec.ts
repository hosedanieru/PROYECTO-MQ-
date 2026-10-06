import { describe, expect, it } from 'vitest';

import { Remision } from '../../domain/remision/remision.entity.js';
import type { FirmaRemision } from '../../domain/remision/firma-remision.js';
import { plantillaRemisiones } from './plantilla-remision.js';

function remision(sobrescribir: Partial<Parameters<typeof Remision.desdePersistencia>[0]> = {}) {
  return Remision.desdePersistencia({
    id: 'r1',
    anio: 2026,
    numero: 7,
    version: 1,
    estado: 'APROBADA',
    fechaOperativa: new Date('2026-09-16T00:00:00.000Z'),
    fechaHoraRegistro: new Date('2026-09-17T01:06:15.000Z'), // 20:06 en Bogotá del 16
    turnoId: 't',
    grupoId: 'p',
    lugarId: 'l',
    productoId: 'pr',
    codigoSnapshot: '300058141',
    descripcionSnapshot: 'SURTIDO <MEGA> LONCHERA',
    fechaVencimiento: new Date('2027-03-01T00:00:00.000Z'),
    cantidadCajas: 36,
    cantidadUnidades: 144,
    estibasCompletas: 1,
    cajasSueltas: 0,
    numerosEstiba: [31, 32],
    observaciones: null,
    extraoficial: false,
    motivoExtraoficial: null,
    creadaPorId: 'u',
    opaNombre: 'Carlos',
    opaCargo: 'Facturador',
    ...sobrescribir,
  });
}

const contexto = { turno: 'T1', grupo: 'APOYOS MAXI', lugar: 'MAQUILA PEPSICO SANTO DOMINGO', firmas: [] as FirmaRemision[] };

const TRAZO = `data:image/png;base64,${'A'.repeat(200)}`;
const firma = (tipo: FirmaRemision['tipo'], nombre: string): FirmaRemision => ({
  id: tipo, remisionId: 'r', version: 1, tipo, usuarioId: 'u', usuarioNombre: nombre, usuarioDocumento: '1010', usuarioRol: 'PATINADOR',
  declaracion: 'Certifico el conteo físico de las cantidades de esta remisión.', huella: 'abc123', trazo: TRAZO,
  dispositivo: null, ip: null, fechaHora: new Date('2026-09-17T13:00:00Z'),
});

describe('plantillaRemisiones', () => {
  it('muestra la fecha operativa y el vencimiento como días, sin correrlos por zona horaria', () => {
    const html = plantillaRemisiones([{ remision: remision(), ...contexto }]);

    expect(html).toContain('16/09/26'); // fecha operativa (junto al turno), no 15/09
    expect(html).toContain('01/03/2027'); // vencimiento, no 28/02
    expect(html).toContain('16/09/2026'); // FECHA de registro en Bogotá (01:06Z del 17 = 20:06 del 16)
    expect(html).toContain('20:06'); // HORA de registro en Bogotá
  });

  it('incluye consecutivo, producto, cantidades, estibas y firmas', () => {
    const html = plantillaRemisiones([{ remision: remision(), ...contexto }]);

    expect(html).toContain('2026-0007');
    expect(html).toContain('300058141');
    expect(html).toContain('EST: 31,32');
    expect(html).toContain('<td>1,0</td>'); // Nº ESTIBAS = "completas,sueltas" (formato aprobado)
    expect(html).toContain('T1<br>16/09/26'); // TURNO + fecha operativa corta
    expect(html).toContain('FIRMA QUIEN RECIBE');
    expect(html).toContain('FIRMA INLOTRANS');
    expect(html).toContain('FIRMA VERIFICADOR');
    expect(html).toContain('<b>Nombre:</b> Carlos');
    expect(html).toContain('MAQUILA PEPSICO SANTO DOMINGO');
  });

  it('escapa el HTML que viene de la base', () => {
    const html = plantillaRemisiones([{ remision: remision(), ...contexto }]);

    expect(html).toContain('SURTIDO &lt;MEGA&gt; LONCHERA');
    expect(html).not.toContain('<MEGA>');
  });

  it('marca de agua cuando no está aprobada; ninguna cuando sí', () => {
    const entregada = plantillaRemisiones([{ remision: remision({ estado: 'ENTREGADA' }), ...contexto }]);
    const aprobada = plantillaRemisiones([{ remision: remision(), ...contexto }]);
    const validada = plantillaRemisiones([{ remision: remision({ estado: 'VALIDADA' }), ...contexto }]);

    expect(entregada).toContain('SIN APROBAR');
    expect(aprobada).not.toContain('class="marca"');
    expect(validada).not.toContain('class="marca"');
  });

  it('indica la versión solo cuando es mayor que 1', () => {
    expect(plantillaRemisiones([{ remision: remision(), ...contexto }])).not.toContain('rectificada');
    expect(plantillaRemisiones([{ remision: remision({ version: 2 }), ...contexto }])).toContain(
      'Versión 2 — rectificada',
    );
  });

  it('firmas electrónicas: trazo en su casilla, nombre, declaración, constancia con huella y marca de piloto', () => {
    const conFirmas = plantillaRemisiones([{ remision: remision({ estado: 'ENTREGADA' }), ...contexto, firmas: [firma('VERIFICADOR', 'Pedro Patinador')] }]);
    expect(conFirmas).toContain(`src="${TRAZO}"`);
    expect(conFirmas).toContain('<b>Nombre:</b> Pedro Patinador');
    expect(conFirmas).toContain('Certifico el conteo físico');
    expect(conFirmas).toContain('Huella SHA-256 del documento firmado: abc123');
    expect(conFirmas).toContain('17/09/2026 8:00'); // fecha y hora de la firma en Bogotá (13:00Z)
    expect(conFirmas).toContain('PILOTO');
    const sinPiloto = plantillaRemisiones([{ remision: remision(), ...contexto, firmas: [firma('INLOTRANS', 'Ana')] }], { pilotoFirmas: false });
    expect(sinPiloto).not.toContain('PILOTO');
    // Sin firmas no hay constancia.
    expect(plantillaRemisiones([{ remision: remision(), ...contexto }])).not.toContain('class="constancia"');
  });

  it('agrupa de a dos por hoja', () => {
    const tres = plantillaRemisiones([1, 2, 3].map(() => ({ remision: remision(), ...contexto })));

    expect(tres.match(/class="hoja"/g)).toHaveLength(2);
    expect(tres.match(/class="corte"/g)).toHaveLength(1);
  });
});
