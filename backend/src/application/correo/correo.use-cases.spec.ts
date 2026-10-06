import { beforeEach, describe, expect, it } from 'vitest';

import { CorreoNoEnviadoError, ListaNoEncontradaError } from '../../domain/correo/correo.js';
import type { GeneradorPdfRemision } from '../../domain/remision/generador-pdf.js';
import { Remision } from '../../domain/remision/remision.entity.js';
import { AuditoriaRepositorioFalso, RemisionRepositorioEnMemoria, UnidadDeTrabajoFalsa } from '../pruebas/dobles-en-memoria.js';
import { EnviadorDeCorreoFalso, EnvioCorreoRepositorioFalso, ListaDistribucionRepositorioFalso } from '../pruebas/dobles-correo.js';
import { CalculadorHuellaFalso, FirmaRemisionRepositorioFalso } from '../pruebas/dobles-firma.js';
import { ImprimirRemisionesUseCase } from '../remision/imprimir-remisiones.use-case.js';
import { ActualizarListaUseCase, CrearListaUseCase, EnviarRemisionesUseCase } from './correo.use-cases.js';

const AHORA = new Date('2026-10-03T15:00:00Z');

const remision = (numero: number) =>
  Remision.crear({
    anio: 2026, numero, fechaOperativa: new Date('2026-10-03T00:00:00Z'), fechaHoraRegistro: AHORA, turnoId: 'T1', grupoId: 'g', lugarId: 'l', productoId: 'A',
    codigoSnapshot: '300058141', descripcionSnapshot: 'SURTIDO', fechaVencimiento: new Date('2027-01-01T00:00:00Z'), cantidadCajas: 36, cantidadUnidades: 144,
    estibasCompletas: 1, cajasSueltas: 0, numerosEstiba: [1], creadaPorId: 'c', extraoficial: false, motivoExtraoficial: null,
  });

describe('Correo — listas y envío manual de remisiones', () => {
  let listas: ListaDistribucionRepositorioFalso;
  let envios: EnvioCorreoRepositorioFalso;
  let enviador: EnviadorDeCorreoFalso;
  let uow: UnidadDeTrabajoFalsa;
  let enviar: EnviarRemisionesUseCase;

  beforeEach(() => {
    listas = new ListaDistribucionRepositorioFalso();
    envios = new EnvioCorreoRepositorioFalso();
    enviador = new EnviadorDeCorreoFalso();
    const remisiones = new RemisionRepositorioEnMemoria();
    remisiones.agregar('r1', remision(12));
    remisiones.agregar('r2', remision(13));
    uow = new UnidadDeTrabajoFalsa({ listasDistribucion: listas, enviosCorreo: envios, remisiones, auditoria: new AuditoriaRepositorioFalso() });
    const generador: GeneradorPdfRemision = { generar: () => Promise.resolve(Buffer.from('%PDF')) };
    const nombres = { catalogos: { listarTurnos: () => Promise.resolve([]), listarLugares: () => Promise.resolve([]) }, grupos: { listar: () => Promise.resolve([]) } };
    const imprimir = new ImprimirRemisionesUseCase(remisiones, nombres as never, generador, new FirmaRemisionRepositorioFalso(), new CalculadorHuellaFalso());
    enviar = new EnviarRemisionesUseCase(uow, remisiones, listas, imprimir, enviador, { ahora: () => AHORA });
  });

  it('crea y edita listas, con los correos normalizados y auditadas', async () => {
    const jefes = await new CrearListaUseCase(uow).ejecutar({ nombre: 'Jefes', recibe: 'RESUMEN', turnoId: null, incluirEnCierres: true, correos: ['Jefe@Inlotrans.com.co'], usuarioId: 'admin' });
    expect(jefes).toMatchObject({ nombre: 'Jefes', incluirEnCierres: true, correos: ['jefe@inlotrans.com.co'], activo: true });
    const editada = await new ActualizarListaUseCase(uow).ejecutar({ listaId: jefes.id, cambios: { correos: ['a@b.co', 'c@d.co'] }, usuarioId: 'admin' });
    expect(editada.correos).toEqual(['a@b.co', 'c@d.co']);
  });

  it('envía el PDF de las remisiones elegidas a las listas + correos sueltos, y lo registra', async () => {
    const pepsico = await new CrearListaUseCase(uow).ejecutar({ nombre: 'PepsiCo', recibe: 'REMISIONES', turnoId: null, incluirEnCierres: true, correos: ['opa@pepsico.com'], usuarioId: 'admin' });

    const envio = await enviar.ejecutar({ remisionIds: ['r2', 'r1'], listaIds: [pepsico.id], correos: ['jefe@inlotrans.com.co'], usuarioId: 'admin' });

    expect(enviador.enviados).toHaveLength(1);
    expect(enviador.enviados[0]).toMatchObject({
      para: ['opa@pepsico.com', 'jefe@inlotrans.com.co'],
      asunto: 'Remisiones MQ: 2 remisiones (2026-0012 a 2026-0013)',
      adjuntos: [expect.objectContaining({ nombre: 'remisiones.pdf', tipo: 'application/pdf' })],
    });
    expect(enviador.enviados[0].texto).toContain('2026-0012 · 300058141 SURTIDO · 36 cajas · BORRADOR');
    expect(envio).toMatchObject({ origen: 'MANUAL', estado: 'ENVIADO', remisionIds: ['r1', 'r2'], fechaOperativa: new Date('2026-10-03T00:00:00Z') });
  });

  it('si el servidor rechaza el correo: queda registrado como FALLIDO y se avisa', async () => {
    enviador.fallarCon = '535 Authentication unsuccessful';

    await expect(enviar.ejecutar({ remisionIds: ['r1'], listaIds: [], correos: ['a@b.co'], usuarioId: 'admin' })).rejects.toBeInstanceOf(CorreoNoEnviadoError);
    expect(envios.envios).toEqual([expect.objectContaining({ estado: 'FALLIDO', error: '535 Authentication unsuccessful' })]);
  });

  it('rechaza listas inexistentes o inactivas, y un envío sin destinatarios', async () => {
    await expect(enviar.ejecutar({ remisionIds: ['r1'], listaIds: ['no-existe'], correos: [], usuarioId: 'admin' })).rejects.toBeInstanceOf(ListaNoEncontradaError);
    await expect(enviar.ejecutar({ remisionIds: ['r1'], listaIds: [], correos: [], usuarioId: 'admin' })).rejects.toThrow(/al menos una lista/);
    expect(enviador.enviados).toHaveLength(0);
  });
});
