import { beforeEach, describe, expect, it } from 'vitest';

import type { ItemCatalogo } from '../../domain/catalogo/catalogo.repository.js';
import { CorreoNoEnviadoError, EnvioNoEncontradoError, type ListaDistribucion } from '../../domain/correo/correo.js';
import type { GeneradorPdfRemision } from '../../domain/remision/generador-pdf.js';
import { Remision } from '../../domain/remision/remision.entity.js';
import { AuditoriaRepositorioFalso, RemisionRepositorioEnMemoria, UnidadDeTrabajoFalsa } from '../pruebas/dobles-en-memoria.js';
import { EnviadorDeCorreoFalso, EnvioCorreoRepositorioFalso, ListaDistribucionRepositorioFalso } from '../pruebas/dobles-correo.js';
import { CalculadorHuellaFalso, FirmaRemisionRepositorioFalso } from '../pruebas/dobles-firma.js';
import { datosResumen, GeneradorPdfResumenFalso, ResumenTurnoRepositorioFalso } from '../pruebas/dobles-resumen.js';
import { ImprimirRemisionesUseCase } from '../remision/imprimir-remisiones.use-case.js';
import { EnviarCorreosDelCierreUseCase, ReenviarEnvioUseCase, type FuentesDeAdjuntos } from './correo-cierre.use-cases.js';

const AHORA = new Date('2026-10-10T18:35:00Z');
const DIA = new Date('2026-10-10T00:00:00Z');

const turnos: ItemCatalogo[] = [
  { id: 'T1', codigo: 'T1', nombre: 'Turno 1', activo: true },
  { id: 'T2', codigo: 'T2', nombre: 'Turno 2', activo: true },
  { id: 'T3', codigo: 'T3', nombre: 'Turno 3', activo: true },
];

const remision = (numero: number, estado: 'BORRADOR' | 'APROBADA' | 'RECHAZADA') => {
  const r = Remision.crear({
    anio: 2026, numero, fechaOperativa: DIA, fechaHoraRegistro: AHORA, turnoId: 'T1', grupoId: 'g', lugarId: 'l', productoId: 'A',
    codigoSnapshot: '300058141', descripcionSnapshot: 'SURTIDO', fechaVencimiento: new Date('2027-01-01T00:00:00Z'), cantidadCajas: 36, cantidadUnidades: 144,
    estibasCompletas: 1, cajasSueltas: 0, numerosEstiba: [1], creadaPorId: 'c', extraoficial: false, motivoExtraoficial: null,
  });
  if (estado !== 'BORRADOR') {
    r.entregar('patinador', AHORA);
    if (estado === 'APROBADA') r.aprobar('OPA', null, AHORA);
    else r.rechazar('Cajas golpeadas');
  }
  return r;
};

const lista = (id: string, cambios: Partial<ListaDistribucion>): ListaDistribucion => ({
  id, nombre: id, recibe: 'AMBOS', turnoId: null, incluirEnCierres: true, correos: [`${id}@x.co`], activo: true, ...cambios,
});

describe('Correos del cierre del turno', () => {
  let listas: ListaDistribucionRepositorioFalso;
  let envios: EnvioCorreoRepositorioFalso;
  let enviador: EnviadorDeCorreoFalso;
  let remisiones: RemisionRepositorioEnMemoria;
  let resumenes: ResumenTurnoRepositorioFalso;
  let fuentes: FuentesDeAdjuntos;
  let correos: EnviarCorreosDelCierreUseCase;
  let reenviar: ReenviarEnvioUseCase;
  let resumenTurnoId: string;

  beforeEach(async () => {
    listas = new ListaDistribucionRepositorioFalso();
    envios = new EnvioCorreoRepositorioFalso();
    enviador = new EnviadorDeCorreoFalso();
    remisiones = new RemisionRepositorioEnMemoria();
    resumenes = new ResumenTurnoRepositorioFalso();
    const uow = new UnidadDeTrabajoFalsa({ listasDistribucion: listas, enviosCorreo: envios, remisiones, auditoria: new AuditoriaRepositorioFalso() });
    const generador: GeneradorPdfRemision = { generar: () => Promise.resolve(Buffer.from('%PDF')) };
    const nombres = { catalogos: { listarTurnos: () => Promise.resolve([]), listarLugares: () => Promise.resolve([]) }, grupos: { listar: () => Promise.resolve([]) } };
    const imprimir = new ImprimirRemisionesUseCase(remisiones, nombres as never, generador, new FirmaRemisionRepositorioFalso(), new CalculadorHuellaFalso());
    fuentes = { resumenes, pdfResumen: new GeneradorPdfResumenFalso(), imprimir };
    const deps = { uow, enviador, reloj: { ahora: () => AHORA } };
    const catalogos = { listarTurnos: () => Promise.resolve(turnos), listarLugares: () => Promise.resolve([]), listarRoles: () => Promise.resolve([]) };
    correos = new EnviarCorreosDelCierreUseCase(deps, fuentes, listas, catalogos, remisiones);
    reenviar = new ReenviarEnvioUseCase(deps, fuentes, envios, remisiones);

    const base = { anio: 2026, fechaOperativa: DIA, formato: { codigo: null, version: null, vigencia: null }, cerradoPorId: 'c', cerradoPorNombre: 'Coord', fechaHora: AHORA };
    resumenTurnoId = (await resumenes.crear({ ...base, tipo: 'TURNO', turnoId: 'T1', datos: datosResumen('T1') }, 7)).id;
  });

  const comando = (resumenDiaId: string | null = null) => ({
    fechaOperativa: DIA, turnoId: 'T1', resumenTurnoId, resumenDiaId, usuarioId: 'c', usuarioNombre: 'Coord',
  });

  it('manda el resumen y las remisiones aprobadas, cada uno a sus listas, y los registra', async () => {
    listas.agregar(lista('jefes', { recibe: 'RESUMEN' }));
    listas.agregar(lista('pepsico', { recibe: 'REMISIONES' }));
    listas.agregar(lista('turno-2', { turnoId: 'T2', incluirEnCierres: false }));
    listas.agregar(lista('turno-3', { turnoId: 'T3', incluirEnCierres: false }));
    remisiones.agregar('r1', remision(12, 'APROBADA'));
    remisiones.agregar('r2', remision(13, 'BORRADOR'));
    remisiones.agregar('r3', remision(14, 'RECHAZADA'));

    const resultados = await correos.ejecutar(comando());

    expect(resultados).toEqual([
      expect.objectContaining({ contenido: 'RESUMEN', estado: 'ENVIADO', destinatarios: 2 }),
      expect.objectContaining({ contenido: 'REMISIONES', estado: 'ENVIADO', destinatarios: 2 }),
    ]);
    const [resumen, rem] = enviador.enviados;
    expect(resumen.para).toEqual(['jefes@x.co', 'turno-2@x.co']);
    expect(resumen.adjuntos.map((a) => a.nombre)).toEqual(['RT-2026-0007.pdf']);
    expect(rem.para).toEqual(['pepsico@x.co', 'turno-2@x.co']);
    expect(rem.asunto).toBe('Remisiones MQ T1 · 10/10/2026: 1 aprobada');
    expect(rem.adjuntos.map((a) => a.nombre)).toEqual(['remisiones-T1-2026-10-10.pdf']);
    expect(rem.texto).toContain('2026-0013');
    expect(rem.texto).toContain('2026-0014');
    expect(envios.envios).toEqual([
      expect.objectContaining({ origen: 'CIERRE_TURNO', turnoId: 'T1', fechaOperativa: DIA, resumenIds: [resumenTurnoId], remisionIds: [], usuarioNombre: 'Coord' }),
      expect.objectContaining({ origen: 'CIERRE_TURNO', remisionIds: ['r1'], resumenIds: [], texto: rem.texto }),
    ]);
  });

  it('si el cierre terminó el día, el resumen lleva también el del día', async () => {
    listas.agregar(lista('jefes', { recibe: 'RESUMEN' }));
    const base = { anio: 2026, fechaOperativa: DIA, formato: { codigo: null, version: null, vigencia: null }, cerradoPorId: 'c', cerradoPorNombre: 'Coord', fechaHora: AHORA };
    const dia = await resumenes.crear({ ...base, tipo: 'DIA', turnoId: null, datos: datosResumen('Día') }, 3);

    await correos.ejecutar(comando(dia.id));

    expect(enviador.enviados[0].adjuntos.map((a) => a.nombre)).toEqual(['RT-2026-0007.pdf', 'RD-2026-0003.pdf']);
  });

  it('sin aprobadas el correo de remisiones sale igual, sin adjunto (usuario, 2026-10-10)', async () => {
    listas.agregar(lista('pepsico', { recibe: 'REMISIONES' }));
    remisiones.agregar('r2', remision(13, 'BORRADOR'));

    const resultados = await correos.ejecutar(comando());

    expect(resultados[1]).toMatchObject({ contenido: 'REMISIONES', estado: 'ENVIADO' });
    expect(enviador.enviados[0]).toMatchObject({ asunto: 'Remisiones MQ T1 · 10/10/2026: sin remisiones aprobadas', adjuntos: [] });
  });

  it('sin listas que lo reciban no se envía ni se registra', async () => {
    const resultados = await correos.ejecutar(comando());

    expect(resultados.map((r) => r.estado)).toEqual(['SIN_DESTINATARIOS', 'SIN_DESTINATARIOS']);
    expect(enviador.enviados).toHaveLength(0);
    expect(envios.envios).toHaveLength(0);
  });

  it('si el servidor falla NO lanza: devuelve FALLIDO y lo deja registrado para reenviar', async () => {
    listas.agregar(lista('jefes', { recibe: 'RESUMEN' }));
    enviador.fallarCon = '535 Authentication unsuccessful';

    const resultados = await correos.ejecutar(comando());

    expect(resultados[0]).toMatchObject({ estado: 'FALLIDO', error: '535 Authentication unsuccessful' });
    expect(envios.envios).toEqual([expect.objectContaining({ estado: 'FALLIDO' })]);
  });

  it('si el PDF falla NO lanza: devuelve FALLIDO sin envío registrado', async () => {
    listas.agregar(lista('jefes', { recibe: 'RESUMEN' }));
    fuentes.pdfResumen.generar = () => Promise.reject(new Error('Chrome no disponible'));

    const resultados = await correos.ejecutar(comando());

    expect(resultados[0]).toMatchObject({ estado: 'FALLIDO', envioId: null, error: 'Chrome no disponible' });
  });

  it('reenvía con los mismos destinatarios, adjuntos y texto, como envío nuevo', async () => {
    listas.agregar(lista('jefes', { recibe: 'RESUMEN' }));
    enviador.fallarCon = 'timeout';
    const [fallido] = await correos.ejecutar(comando());
    enviador.fallarCon = null;

    const nuevo = await reenviar.ejecutar({ envioId: fallido.envioId!, usuarioId: 'admin' });

    expect(nuevo).toMatchObject({ origen: 'REENVIO', estado: 'ENVIADO', turnoId: 'T1', resumenIds: [resumenTurnoId], destinatarios: ['jefes@x.co'] });
    expect(enviador.enviados[0].asunto).toMatch(/^Reenvío: Resumen MQ T1/);
    expect(enviador.enviados[0].adjuntos.map((a) => a.nombre)).toEqual(['RT-2026-0007.pdf']);
    expect(enviador.enviados[0].texto).toBe(envios.envios[0].texto);
  });

  it('el reenvío avisa con error si vuelve a fallar, y rechaza un envío inexistente', async () => {
    listas.agregar(lista('jefes', { recibe: 'RESUMEN' }));
    enviador.fallarCon = 'timeout';
    const [fallido] = await correos.ejecutar(comando());

    await expect(reenviar.ejecutar({ envioId: fallido.envioId!, usuarioId: 'admin' })).rejects.toBeInstanceOf(CorreoNoEnviadoError);
    await expect(reenviar.ejecutar({ envioId: 'no-existe', usuarioId: 'admin' })).rejects.toBeInstanceOf(EnvioNoEncontradoError);
  });
});
