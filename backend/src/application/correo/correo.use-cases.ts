/**
 * CASOS DE USO: CORREO
 * ====================
 *
 *   CrearListaUseCase / ActualizarListaUseCase   listas de distribución (auditadas)
 *   EnviarRemisionesUseCase                      envío manual: remisiones elegidas
 *                                                → PDF adjunto → listas + correos
 *   enviarYRegistrar                             lo común: enviar + registrar (lo usan
 *                                                también el cierre y el reenvío,
 *                                                `correo-cierre.use-cases.ts`)
 *
 * Cada envío queda registrado, salga o falle: si el servidor rechaza el
 * correo se guarda como FALLIDO con el error y se avisa (no se pierde el
 * rastro de que se intentó).
 */

import {
  CorreoNoEnviadoError,
  DatosCorreoInvalidosError,
  destinatariosDe,
  ListaNoEncontradaError,
  validarLista,
  type AdjuntoCorreo,
  type DatosLista,
  type EnviadorDeCorreo,
  type EnvioCorreo,
  type ListaDistribucion,
  type ListaDistribucionRepository,
  type MensajeCorreo,
  type OrigenEnvio,
} from '../../domain/correo/correo.js';
import type { Remision } from '../../domain/remision/remision.entity.js';
import type { RemisionRepository } from '../../domain/remision/remision.repository.js';
import { registroActual } from '../../domain/shared/fecha-operativa.js';
import type { UnidadDeTrabajo } from '../../domain/shared/unidad-de-trabajo.js';
import type { Reloj } from '../remision/crear-remision.use-case.js';
import type { ImprimirRemisionesUseCase } from '../remision/imprimir-remisiones.use-case.js';

const sinIndefinidos = <T extends object>(o: T): Partial<T> =>
  Object.fromEntries(Object.entries(o).filter(([, v]) => v !== undefined)) as Partial<T>;

// ---------- Listas ----------

export class CrearListaUseCase {
  constructor(private readonly uow: UnidadDeTrabajo) {}

  async ejecutar(comando: DatosLista & { usuarioId: string }): Promise<ListaDistribucion> {
    const datos = validarLista(comando);
    return this.uow.ejecutar(async ({ listasDistribucion, auditoria }) => {
      const creada = await listasDistribucion.crear(datos);
      await auditoria.registrar({ entidad: 'lista_distribucion', entidadId: creada.id, accion: 'CREAR', valorNuevo: creada, usuarioId: comando.usuarioId });
      return creada;
    });
  }
}

export class ActualizarListaUseCase {
  constructor(private readonly uow: UnidadDeTrabajo) {}

  async ejecutar(comando: { listaId: string; cambios: Partial<DatosLista> & { activo?: boolean }; usuarioId: string }): Promise<ListaDistribucion> {
    return this.uow.ejecutar(async ({ listasDistribucion, auditoria }) => {
      const actual = await listasDistribucion.buscarPorId(comando.listaId);
      if (!actual) throw new ListaNoEncontradaError('La lista de distribución no existe.');
      const { activo, ...cambios } = sinIndefinidos(comando.cambios);
      const datos = validarLista({ ...actual, ...cambios });
      const actualizada = await listasDistribucion.actualizar(actual.id, { ...datos, ...(activo !== undefined ? { activo } : {}) });
      await auditoria.registrar({
        entidad: 'lista_distribucion',
        entidadId: actual.id,
        accion: 'ACTUALIZAR',
        valorAnterior: actual,
        valorNuevo: actualizada,
        usuarioId: comando.usuarioId,
      });
      return actualizada;
    });
  }
}

// ---------- Envío manual ----------

export const MAXIMO_REMISIONES_POR_CORREO = 50;

/** Una línea por remisión: "2026-0012 · 300058141 SURTIDO… · 36 cajas · APROBADA". */
export function lineaDeRemision(r: Remision): string {
  const d = r.aObjeto();
  return `${r.consecutivo} · ${d.codigoSnapshot} ${d.descripcionSnapshot} · ${d.cantidadCajas} cajas · ${d.estado}${d.extraoficial ? ' (extraoficial)' : ''}`;
}

export interface EnviarRemisionesComando {
  remisionIds: string[];
  listaIds: string[];
  /** Correos escritos a mano, además de las listas. */
  correos: string[];
  usuarioId: string;
}

export class EnviarRemisionesUseCase {
  constructor(
    private readonly uow: UnidadDeTrabajo,
    private readonly remisiones: RemisionRepository,
    private readonly listas: ListaDistribucionRepository,
    private readonly imprimir: ImprimirRemisionesUseCase,
    private readonly enviador: EnviadorDeCorreo,
    private readonly reloj: Reloj,
  ) {}

  async ejecutar(comando: EnviarRemisionesComando): Promise<EnvioCorreo> {
    const ids = [...new Set(comando.remisionIds)];
    if (ids.length === 0 || ids.length > MAXIMO_REMISIONES_POR_CORREO) {
      throw new DatosCorreoInvalidosError(`Elija entre 1 y ${MAXIMO_REMISIONES_POR_CORREO} remisiones.`);
    }
    const listas: ListaDistribucion[] = [];
    for (const id of [...new Set(comando.listaIds)]) {
      const lista = await this.listas.buscarPorId(id);
      if (!lista || !lista.activo) throw new ListaNoEncontradaError('Una de las listas elegidas no existe o está inactiva.');
      listas.push(lista);
    }
    const destinatarios = destinatariosDe(listas, comando.correos);

    // El PDF es el mismo que se imprimía (dos por hoja); falla aquí si no existe ninguna.
    const pdf = await this.imprimir.ejecutar(ids);
    const remisiones = (await this.remisiones.buscarPorIds(ids)).sort((a, b) => a.consecutivo.localeCompare(b.consecutivo));
    const asunto = `Remisiones MQ: ${remisiones.length === 1 ? remisiones[0].consecutivo : `${remisiones.length} remisiones (${remisiones[0].consecutivo} a ${remisiones.at(-1)!.consecutivo})`}`;
    const texto = [
      'Maquila PepsiCo Santo Domingo — Inlotrans S.A.S.',
      '',
      `Se adjuntan ${remisiones.length} remisión(es) en PDF:`,
      ...remisiones.map((r) => `  - ${lineaDeRemision(r)}`),
      '',
      'Correo generado por el aplicativo MQ.',
    ].join('\n');

    const envio = await enviarYRegistrar(
      { uow: this.uow, enviador: this.enviador, reloj: this.reloj },
      { para: destinatarios, asunto, texto, adjuntos: [adjuntoPdf('remisiones.pdf', pdf)] },
      { origen: 'MANUAL', turnoId: null, remisionIds: remisiones.map((r) => r.id), resumenIds: [], usuarioId: comando.usuarioId },
    );
    if (envio.error) throw new CorreoNoEnviadoError(mensajeDeFallo(envio.error));
    return envio;
  }
}

// ---------- Enviar y registrar (común a todos los envíos) ----------

export const adjuntoPdf = (nombre: string, contenido: Buffer): AdjuntoCorreo => ({ nombre, contenido, tipo: 'application/pdf' });

export const mensajeDeFallo = (error: string) => `El servidor de correo no aceptó el envío: ${error}. Quedó registrado como fallido; intente de nuevo.`;

export interface DependenciasEnvio {
  uow: UnidadDeTrabajo;
  enviador: EnviadorDeCorreo;
  reloj: Reloj;
}

export interface RegistroDeEnvio {
  origen: OrigenEnvio;
  /** Por defecto, el día operativo del momento del envío. */
  fechaOperativa?: Date;
  turnoId: string | null;
  remisionIds: string[];
  resumenIds: string[];
  usuarioId: string;
  /** Si no llega, se busca el nombre del usuario. */
  usuarioNombre?: string;
}

/**
 * Envía el mensaje y lo registra (auditado), salga o falle: si el servidor
 * lo rechaza NO lanza; devuelve el envío como FALLIDO con el error, y quien
 * llama decide si eso es un error para el usuario (envío manual) o solo un
 * resultado que se informa (cierre del turno, que ya quedó guardado).
 */
export async function enviarYRegistrar(deps: DependenciasEnvio, mensaje: MensajeCorreo, registro: RegistroDeEnvio): Promise<EnvioCorreo> {
  let error: string | null = null;
  try {
    await deps.enviador.enviar(mensaje);
  } catch (e) {
    error = e instanceof Error ? e.message : String(e);
  }
  const ahora = deps.reloj.ahora();
  return deps.uow.ejecutar(async ({ enviosCorreo, usuarios, auditoria }) => {
    const usuarioNombre = registro.usuarioNombre ?? (await usuarios.buscarPorId(registro.usuarioId))?.nombre ?? registro.usuarioId;
    const creado = await enviosCorreo.crear({
      origen: registro.origen,
      fechaHora: ahora,
      fechaOperativa: registro.fechaOperativa ?? registroActual(ahora).fechaOperativa,
      turnoId: registro.turnoId,
      destinatarios: mensaje.para,
      remisionIds: registro.remisionIds,
      resumenIds: registro.resumenIds,
      asunto: mensaje.asunto,
      texto: mensaje.texto,
      estado: error ? 'FALLIDO' : 'ENVIADO',
      error,
      usuarioId: registro.usuarioId,
      usuarioNombre,
    });
    // El texto ya queda en el envío; la auditoría no lo repite.
    await auditoria.registrar({ entidad: 'envio_correo', entidadId: creado.id, accion: 'CREAR', valorNuevo: { ...creado, texto: undefined }, usuarioId: registro.usuarioId });
    return creado;
  });
}
