/**
 * CORREO — puerto, listas de distribución y registro de envíos
 * ============================================================
 *
 * Decisiones del usuario (2026-10-03): las remisiones se envían por correo
 * en lugar de imprimirse. Manual (se seleccionan y se envían) y, en una
 * segunda fase, automático al cerrar el turno a los jefes, a PepsiCo y al
 * turno siguiente.
 *
 * Los destinatarios salen de LISTAS que mantiene el administrador:
 *   - lista sin turno ("Jefes", "PepsiCo"): va en todos los envíos
 *     automáticos si `incluirEnCierres`; siempre se puede elegir a mano;
 *   - lista de un turno ("Turno T2"): en el envío automático va cuando ESE
 *     turno es el siguiente (al cerrar el T1 recibe la lista del T2).
 * Los actores de PepsiCo siguen sin ser usuarios: aquí son correos en una
 * lista, como dato.
 *
 * Cada envío queda registrado (a quién, qué remisiones, si salió o falló):
 * es la trazabilidad de lo que se mandó.
 */

import { ErrorDominio } from '../shared/errores.js';

export class DatosCorreoInvalidosError extends ErrorDominio {
  readonly codigo = 'CORREO_DATOS_INVALIDOS';
}

export class ListaNoEncontradaError extends ErrorDominio {
  readonly codigo = 'CORREO_LISTA_NO_ENCONTRADA';
}

/** El servidor de correo no aceptó el mensaje (queda registrado como FALLIDO). */
export class CorreoNoEnviadoError extends ErrorDominio {
  readonly codigo = 'CORREO_NO_ENVIADO';
}

// ---------- Puerto: enviar ----------

export interface AdjuntoCorreo {
  nombre: string;
  contenido: Buffer;
  tipo: string;
}

export interface MensajeCorreo {
  para: string[];
  asunto: string;
  texto: string;
  adjuntos: AdjuntoCorreo[];
}

export interface EnviadorDeCorreo {
  /** Lanza si el servidor no acepta el mensaje. */
  enviar(mensaje: MensajeCorreo): Promise<void>;
}

export const ENVIADOR_DE_CORREO = Symbol('EnviadorDeCorreo');

// ---------- Listas de distribución ----------

export const MAXIMO_CORREOS_LISTA = 50;
/** Forma razonable de un correo; la verificación real la hace el servidor. */
const CORREO = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * Qué recibe la lista al cerrar el turno (usuario, 2026-10-03): las
 * REMISIONES aprobadas (PepsiCo…), el RESUMEN del turno (jefes,
 * coordinadores) o AMBOS.
 */
export type RecibeLista = 'REMISIONES' | 'RESUMEN' | 'AMBOS';
export const RECIBE_LISTA: readonly RecibeLista[] = ['REMISIONES', 'RESUMEN', 'AMBOS'];

export interface ListaDistribucion {
  id: string;
  nombre: string;
  recibe: RecibeLista;
  /** Lista de un turno: en el envío automático va cuando ese turno es el siguiente. */
  turnoId: string | null;
  /** Solo listas sin turno: si va en todos los envíos automáticos. */
  incluirEnCierres: boolean;
  correos: string[];
  activo: boolean;
}

export interface DatosLista {
  nombre: string;
  recibe: RecibeLista;
  turnoId: string | null;
  incluirEnCierres: boolean;
  correos: string[];
}

/** Correos en minúscula, sin repetidos, en el orden en que llegaron. */
export function normalizarCorreos(correos: string[]): string[] {
  const vistos = new Set<string>();
  const salida: string[] = [];
  for (const bruto of correos) {
    const c = bruto.trim().toLowerCase();
    if (!c) continue;
    if (!CORREO.test(c)) throw new DatosCorreoInvalidosError(`"${bruto.trim()}" no es un correo válido.`);
    if (!vistos.has(c)) {
      vistos.add(c);
      salida.push(c);
    }
  }
  return salida;
}

export function validarLista(datos: DatosLista): DatosLista {
  const nombre = datos.nombre?.trim() ?? '';
  if (nombre.length === 0 || nombre.length > 60) throw new DatosCorreoInvalidosError('El nombre de la lista es obligatorio (máx. 60 caracteres).');
  const correos = normalizarCorreos(datos.correos ?? []);
  if (correos.length === 0) throw new DatosCorreoInvalidosError('La lista debe tener al menos un correo.');
  if (correos.length > MAXIMO_CORREOS_LISTA) throw new DatosCorreoInvalidosError(`Una lista admite máximo ${MAXIMO_CORREOS_LISTA} correos.`);
  if (!RECIBE_LISTA.includes(datos.recibe)) throw new DatosCorreoInvalidosError('Indique qué recibe la lista: REMISIONES, RESUMEN o AMBOS.');
  const turnoId = datos.turnoId?.trim() || null;
  // "Incluir en cierres" es de las listas generales; la de un turno ya va cuando le toca.
  return { nombre, recibe: datos.recibe, turnoId, incluirEnCierres: turnoId === null && datos.incluirEnCierres === true, correos };
}

export interface ListaDistribucionRepository {
  listar(): Promise<ListaDistribucion[]>;
  buscarPorId(id: string): Promise<ListaDistribucion | null>;
  crear(datos: DatosLista): Promise<ListaDistribucion>;
  actualizar(id: string, cambios: Partial<DatosLista> & { activo?: boolean }): Promise<ListaDistribucion>;
}

export const LISTA_DISTRIBUCION_REPOSITORY = Symbol('ListaDistribucionRepository');

// ---------- Registro de envíos ----------

export type OrigenEnvio = 'MANUAL' | 'CIERRE_TURNO';
export type EstadoEnvio = 'ENVIADO' | 'FALLIDO';

export interface EnvioCorreo {
  id: string;
  origen: OrigenEnvio;
  fechaHora: Date;
  /** Día operativo del envío (para listar por día, como todo el sistema). */
  fechaOperativa: Date;
  /** Turno cerrado (envío automático); null en el manual. */
  turnoId: string | null;
  destinatarios: string[];
  remisionIds: string[];
  asunto: string;
  estado: EstadoEnvio;
  /** Lo que respondió el servidor si falló. */
  error: string | null;
  usuarioId: string;
  usuarioNombre: string;
}

export type NuevoEnvio = Omit<EnvioCorreo, 'id'>;

export interface EnvioCorreoRepository {
  crear(envio: NuevoEnvio): Promise<EnvioCorreo>;
  /** Fechas operativas, inclusive; más recientes primero. */
  listar(desde: Date, hasta: Date): Promise<EnvioCorreo[]>;
}

export const ENVIO_CORREO_REPOSITORY = Symbol('EnvioCorreoRepository');

/** Máximo de destinatarios de un envío (límite habitual de los servidores corporativos). */
export const MAXIMO_DESTINATARIOS = 100;

/** Destinatarios de un envío: correos de las listas + los escritos a mano, sin repetir. */
export function destinatariosDe(listas: ListaDistribucion[], sueltos: string[]): string[] {
  const todos = normalizarCorreos([...listas.flatMap((l) => l.correos), ...sueltos]);
  if (todos.length === 0) throw new DatosCorreoInvalidosError('Elija al menos una lista o escriba al menos un correo.');
  if (todos.length > MAXIMO_DESTINATARIOS) throw new DatosCorreoInvalidosError(`Un envío admite máximo ${MAXIMO_DESTINATARIOS} destinatarios.`);
  return todos;
}
