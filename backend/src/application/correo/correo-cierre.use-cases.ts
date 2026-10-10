/**
 * CASOS DE USO: CORREOS DEL CIERRE DEL TURNO Y REENVÍO
 * ====================================================
 *
 *   EnviarCorreosDelCierreUseCase   al cerrar el turno: RESUMEN (RT y RD) y
 *                                   REMISIONES aprobadas, cada uno a sus listas
 *   ReenviarEnvioUseCase            vuelve a mandar un envío registrado
 *                                   (mismos destinatarios, adjuntos y texto)
 *
 * Decisiones del usuario (2026-10-10): los correos se envían DESPUÉS de
 * guardar el cierre y el coordinador espera el resultado. Si algo falla
 * (el PDF o el servidor de correo), el cierre NO se deshace: el envío queda
 * FALLIDO y se puede reenviar desde la pantalla de Correos.
 */

import {
  correoDeRemisiones,
  correoDeResumen,
  listasDelCierre,
  turnoSiguiente,
  type ContenidoCierre,
} from '../../domain/correo/correo-cierre.js';
import {
  CorreoNoEnviadoError,
  destinatariosDe,
  EnvioNoEncontradoError,
  type AdjuntoCorreo,
  type EnvioCorreo,
  type EnvioCorreoRepository,
  type ListaDistribucionRepository,
} from '../../domain/correo/correo.js';
import type { CatalogoRepository } from '../../domain/catalogo/catalogo.repository.js';
import { ESTADOS_QUE_CUENTAN } from '../../domain/mfr/calculo-mfr.js';
import type { EstadoRemision } from '../../domain/remision/remision.entity.js';
import type { RemisionRepository } from '../../domain/remision/remision.repository.js';
import {
  consecutivoResumen,
  ResumenNoEncontradoError,
  type GeneradorPdfResumen,
  type ResumenTurno,
  type ResumenTurnoRepository,
} from '../../domain/resumen/resumen-turno.js';
import type { ImprimirRemisionesUseCase } from '../remision/imprimir-remisiones.use-case.js';
import { adjuntoPdf, enviarYRegistrar, lineaDeRemision, mensajeDeFallo, type DependenciasEnvio } from './correo.use-cases.js';

/** Lo que necesitan los dos casos de uso para armar los adjuntos. */
export interface FuentesDeAdjuntos {
  resumenes: ResumenTurnoRepository;
  pdfResumen: GeneradorPdfResumen;
  imprimir: ImprimirRemisionesUseCase;
}

async function adjuntosDeResumenes(fuentes: FuentesDeAdjuntos, resumenes: ResumenTurno[]): Promise<AdjuntoCorreo[]> {
  return Promise.all(
    resumenes.map(async (r) => adjuntoPdf(`${consecutivoResumen(r.tipo, r.anio, r.numero)}.pdf`, await fuentes.pdfResumen.generar(r))),
  );
}

async function buscarResumenes(repo: ResumenTurnoRepository, ids: string[]): Promise<ResumenTurno[]> {
  const encontrados = await Promise.all(ids.map((id) => repo.buscarPorId(id)));
  if (encontrados.some((r) => r === null)) throw new ResumenNoEncontradoError('Uno de los resúmenes del envío ya no existe.');
  return encontrados as ResumenTurno[];
}

const nombreRemisiones = (turno: string, fechaOperativa: Date) => `remisiones-${turno}-${fechaOperativa.toISOString().slice(0, 10)}.pdf`;

// ---------- Cierre del turno ----------

export interface CorreosDelCierreComando {
  fechaOperativa: Date;
  turnoId: string;
  resumenTurnoId: string;
  /** Si el cierre terminó el día operativo. */
  resumenDiaId: string | null;
  usuarioId: string;
  usuarioNombre: string;
}

/**
 * Resultado de cada correo, para mostrárselo al coordinador.
 * SIN_DESTINATARIOS: ninguna lista lo recibe; no se envía ni se registra.
 */
export interface ResultadoCorreoCierre {
  contenido: ContenidoCierre;
  estado: 'ENVIADO' | 'FALLIDO' | 'SIN_DESTINATARIOS';
  envioId: string | null;
  destinatarios: number;
  error: string | null;
}

const APROBADAS: readonly EstadoRemision[] = ESTADOS_QUE_CUENTAN;

export class EnviarCorreosDelCierreUseCase {
  constructor(
    private readonly deps: DependenciasEnvio,
    private readonly fuentes: FuentesDeAdjuntos,
    private readonly listas: ListaDistribucionRepository,
    private readonly catalogos: CatalogoRepository,
    private readonly remisiones: RemisionRepository,
  ) {}

  /** Nunca lanza: el cierre ya quedó guardado, así que cada fallo se devuelve como resultado. */
  async ejecutar(comando: CorreosDelCierreComando): Promise<ResultadoCorreoCierre[]> {
    let turnos: Awaited<ReturnType<CatalogoRepository['listarTurnos']>>;
    let todas: Awaited<ReturnType<ListaDistribucionRepository['listar']>>;
    try {
      [turnos, todas] = await Promise.all([this.catalogos.listarTurnos(), this.listas.listar()]);
    } catch (e) {
      const error = e instanceof Error ? e.message : String(e);
      return (['RESUMEN', 'REMISIONES'] as const).map((contenido) => ({ contenido, estado: 'FALLIDO', envioId: null, destinatarios: 0, error }));
    }
    const siguienteId = turnoSiguiente(turnos, comando.turnoId);
    const turno = turnos.find((t) => t.id === comando.turnoId)?.codigo ?? comando.turnoId;

    const resultados: ResultadoCorreoCierre[] = [];
    // Uno detrás de otro: Chrome genera un PDF a la vez y el servidor de correo lo agradece.
    for (const contenido of ['RESUMEN', 'REMISIONES'] as const) {
      resultados.push(await this.enviarUno(contenido, listasDelCierre(todas, contenido, siguienteId), turno, comando));
    }
    return resultados;
  }

  private async enviarUno(
    contenido: ContenidoCierre,
    listas: ReturnType<typeof listasDelCierre>,
    turno: string,
    comando: CorreosDelCierreComando,
  ): Promise<ResultadoCorreoCierre> {
    if (listas.length === 0) return { contenido, estado: 'SIN_DESTINATARIOS', envioId: null, destinatarios: 0, error: null };
    const para = destinatariosDe(listas, []);
    try {
      const armado = contenido === 'RESUMEN' ? await this.armarResumen(turno, comando) : await this.armarRemisiones(turno, comando);
      const envio = await enviarYRegistrar(this.deps, { para, ...armado.mensaje }, {
        origen: 'CIERRE_TURNO',
        fechaOperativa: comando.fechaOperativa,
        turnoId: comando.turnoId,
        remisionIds: armado.remisionIds,
        resumenIds: armado.resumenIds,
        usuarioId: comando.usuarioId,
        usuarioNombre: comando.usuarioNombre,
      });
      return { contenido, estado: envio.estado, envioId: envio.id, destinatarios: para.length, error: envio.error };
    } catch (e) {
      // Falló antes de enviar (el PDF, la base): no hay mensaje que registrar.
      return { contenido, estado: 'FALLIDO', envioId: null, destinatarios: para.length, error: e instanceof Error ? e.message : String(e) };
    }
  }

  private async armarResumen(turno: string, comando: CorreosDelCierreComando) {
    const resumenIds = [comando.resumenTurnoId, ...(comando.resumenDiaId ? [comando.resumenDiaId] : [])];
    const resumenes = await buscarResumenes(this.fuentes.resumenes, resumenIds);
    const [rt, rd] = resumenes;
    const { asunto, texto } = correoDeResumen({
      turno,
      fechaOperativa: comando.fechaOperativa,
      consecutivoTurno: consecutivoResumen(rt.tipo, rt.anio, rt.numero),
      consecutivoDia: rd ? consecutivoResumen(rd.tipo, rd.anio, rd.numero) : null,
    });
    return { mensaje: { asunto, texto, adjuntos: await adjuntosDeResumenes(this.fuentes, resumenes) }, remisionIds: [], resumenIds };
  }

  private async armarRemisiones(turno: string, comando: CorreosDelCierreComando) {
    const delTurno = await this.remisiones.listarTodas({
      fechaOperativaDesde: comando.fechaOperativa,
      fechaOperativaHasta: comando.fechaOperativa,
      turnoId: comando.turnoId,
    });
    const aprobadas = delTurno.filter((r) => APROBADAS.includes(r.estado));
    const pendientes = delTurno.filter((r) => !APROBADAS.includes(r.estado));
    const { asunto, texto } = correoDeRemisiones({
      turno,
      fechaOperativa: comando.fechaOperativa,
      aprobadas: aprobadas.map(lineaDeRemision),
      pendientes: pendientes.map(lineaDeRemision),
    });
    const remisionIds = aprobadas.map((r) => r.id);
    // Sin aprobadas sale igual, sin adjunto (usuario, 2026-10-10).
    const adjuntos = remisionIds.length > 0 ? [adjuntoPdf(nombreRemisiones(turno, comando.fechaOperativa), await this.fuentes.imprimir.ejecutar(remisionIds))] : [];
    return { mensaje: { asunto, texto, adjuntos }, remisionIds, resumenIds: [] };
  }
}

// ---------- Reenviar ----------

const PREFIJO_REENVIO = 'Reenvío: ';

export class ReenviarEnvioUseCase {
  constructor(
    private readonly deps: DependenciasEnvio,
    private readonly fuentes: FuentesDeAdjuntos,
    private readonly envios: EnvioCorreoRepository,
    private readonly remisiones: RemisionRepository,
  ) {}

  /**
   * Mismos destinatarios, adjuntos y texto que el original; queda como un
   * envío nuevo (origen REENVIO). Es una acción del usuario: si el servidor
   * vuelve a fallar, se le avisa con error (como en el envío manual).
   */
  async ejecutar(comando: { envioId: string; usuarioId: string }): Promise<EnvioCorreo> {
    const original = await this.envios.buscarPorId(comando.envioId);
    if (!original) throw new EnvioNoEncontradoError(`No existe el envío "${comando.envioId}".`);

    const remisiones = original.remisionIds.length > 0 ? await this.remisiones.buscarPorIds(original.remisionIds) : [];
    const adjuntos = [
      ...(await adjuntosDeResumenes(this.fuentes, await buscarResumenes(this.fuentes.resumenes, original.resumenIds))),
      ...(remisiones.length > 0 ? [adjuntoPdf('remisiones.pdf', await this.fuentes.imprimir.ejecutar(original.remisionIds))] : []),
    ];
    // Los envíos anteriores al 2026-10-10 no guardaban el texto: se rehace con las remisiones.
    const texto =
      original.texto ??
      ['Maquila PepsiCo Santo Domingo — Inlotrans S.A.S.', '', 'Se adjuntan las remisiones en PDF:', ...remisiones.map((r) => `  - ${lineaDeRemision(r)}`)].join('\n');
    const asunto = original.asunto.startsWith(PREFIJO_REENVIO) ? original.asunto : `${PREFIJO_REENVIO}${original.asunto}`;

    const envio = await enviarYRegistrar(this.deps, { para: original.destinatarios, asunto, texto, adjuntos }, {
      origen: 'REENVIO',
      turnoId: original.turnoId,
      remisionIds: original.remisionIds,
      resumenIds: original.resumenIds,
      usuarioId: comando.usuarioId,
    });
    if (envio.error) throw new CorreoNoEnviadoError(mensajeDeFallo(envio.error));
    return envio;
  }
}
