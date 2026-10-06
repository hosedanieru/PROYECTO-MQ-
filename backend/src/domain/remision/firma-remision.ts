/**
 * FIRMA ELECTRÓNICA DE LA REMISIÓN
 * ================================
 *
 * Decisiones del usuario (2026-10-03): las firmas del formato se hacen en
 * el aplicativo (sin imprimir ni escanear), cada quien con su sesión y
 * escribiendo su CONTRASEÑA al firmar (el computador de MQ es compartido),
 * y quedan dentro del PDF. Firma electrónica en el sentido de la Ley 527
 * de 1999 y el Decreto 2364 de 2012 (compilado en el 1074 de 2015); el
 * aval de PepsiCo y del área legal está PENDIENTE: mientras tanto el PDF
 * marca las firmas como PILOTO.
 *
 * Lo que da el respaldo no es el trazo sino la evidencia que lo rodea:
 * quién (usuario autenticado + contraseña), cuándo, desde qué equipo, qué
 * declaró, y la HUELLA (SHA-256) del contenido de la remisión firmada. Si
 * el documento cambia, la huella deja de coincidir y la firma no aplica.
 *
 * Casillas del formato:
 *   INLOTRANS    coordinador que emite          (fase 1)
 *   VERIFICADOR  patinador que cuenta y entrega (fase 1)
 *   RECIBE       OPA de PepsiCo, al aprobar     (fase 2; después del verificador)
 *   VALIDACION   coordinador, al validar        (fase 3)
 *
 * Una firma por casilla y versión. Rectificar crea la versión siguiente:
 * las firmas viejas quedan en el historial y la nueva versión se firma de
 * nuevo. Una firma nunca se borra ni se edita.
 */

import { ErrorDominio } from '../shared/errores.js';
import type { EstadoRemision, Remision } from './remision.entity.js';

export const TIPOS_FIRMA = ['INLOTRANS', 'VERIFICADOR', 'RECIBE', 'VALIDACION'] as const;
export type TipoFirma = (typeof TIPOS_FIRMA)[number];

/** Todas habilitadas desde la fase 3. */
export const TIPOS_FIRMA_HABILITADOS: readonly TipoFirma[] = ['INLOTRANS', 'VERIFICADOR', 'RECIBE', 'VALIDACION'];

/**
 * RECIBE y VALIDACION no se firman sueltas: van con la aprobación del OPA
 * (fase 2) y con la validación del coordinador (fase 3).
 */
export const TIPOS_FIRMA_SUELTA: readonly TipoFirma[] = ['INLOTRANS', 'VERIFICADOR'];

/**
 * PILOTO: las firmas son opcionales y el papel sigue siendo el respaldo.
 * OBLIGATORIA: fin del piloto (con el aval de PepsiCo y del área legal): la
 * firma electrónica es el soporte, así que el flujo no avanza sin ella.
 * Lo decide la configuración (`FIRMA_ELECTRONICA_PILOTO`).
 */
export type ModoFirma = 'PILOTO' | 'OBLIGATORIA';

export const CONFIGURACION_FIRMA = Symbol('ConfiguracionFirma');
export interface ConfiguracionFirma {
  modo: ModoFirma;
}

/** Fin del piloto: falta una firma para avanzar. */
export class FirmasIncompletasError extends ErrorDominio {
  readonly codigo = 'FIRMAS_INCOMPLETAS';
}

const NOMBRE_CASILLA: Record<TipoFirma, string> = {
  INLOTRANS: 'Inlotrans',
  VERIFICADOR: 'verificador',
  RECIBE: 'quien recibe (OPA)',
  VALIDACION: 'validación',
};

/**
 * Reglas del fin del piloto (fase 3). En PILOTO no exige nada.
 *   APROBAR: solo firmando (el OPA), y con Inlotrans y verificador firmados.
 *   VALIDAR: solo firmando (el coordinador), y con quien recibe firmado.
 * Cuenta solo lo firmado sobre la versión actual.
 */
export function exigirFirmasPara(
  paso: 'APROBAR' | 'VALIDAR',
  modo: ModoFirma,
  remision: Remision,
  firmas: FirmaRemision[],
  firmando: boolean,
): void {
  if (modo === 'PILOTO') return;
  if (!firmando) {
    throw new FirmasIncompletasError(
      paso === 'APROBAR'
        ? 'La aprobación solo la hace el OPA firmando ("Aprobar y firmar").'
        : 'La validación se hace firmando ("Validar y firmar").',
    );
  }
  const requeridas: TipoFirma[] = paso === 'APROBAR' ? ['INLOTRANS', 'VERIFICADOR'] : ['RECIBE'];
  const faltan = requeridas.filter((t) => !firmas.some((f) => f.tipo === t && f.version === remision.version));
  if (faltan.length > 0) {
    throw new FirmasIncompletasError(`Falta la firma de: ${faltan.map((t) => NOMBRE_CASILLA[t]).join(', ')}.`);
  }
}

/**
 * Texto que el firmante declara. Borrador propuesto el 2026-10-03:
 * PENDIENTE DE VALIDAR con el área y con PepsiCo. Se guarda una copia en
 * cada firma, así un cambio de texto no altera lo que alguien ya firmó.
 */
export const DECLARACION_FIRMA: Record<TipoFirma, string> = {
  INLOTRANS: 'Emito esta remisión.',
  VERIFICADOR: 'Certifico el conteo físico de las cantidades de esta remisión.',
  RECIBE: 'Recibo conforme según el conteo certificado por el verificador.',
  VALIDACION: 'Concilié esta remisión.',
};

/** Permiso que exige cada casilla (el administrador pasa todos). */
export const PERMISO_FIRMA: Record<TipoFirma, string> = {
  INLOTRANS: 'remision.firmar_emision',
  VERIFICADOR: 'remision.firmar_verificacion',
  // Propio del rol OPA_PEPSICO (el coordinador NO firma por PepsiCo).
  RECIBE: 'remision.firmar_recepcion',
  VALIDACION: 'remision.validar',
};

/**
 * Estados en que se puede firmar cada casilla. Inlotrans y verificador
 * firman con la remisión ENTREGADA: desde ahí el documento ya no se edita,
 * así que lo firmado es lo que se entrega.
 */
const ESTADOS_PARA_FIRMAR: Record<TipoFirma, readonly EstadoRemision[]> = {
  INLOTRANS: ['ENTREGADA'],
  VERIFICADOR: ['ENTREGADA'],
  RECIBE: ['ENTREGADA'],
  VALIDACION: ['APROBADA'],
};

export interface FirmaRemision {
  id: string;
  remisionId: string;
  /** Versión de la remisión que se firmó. */
  version: number;
  tipo: TipoFirma;
  usuarioId: string;
  /** Copias congeladas: si el usuario cambia de nombre o rol, la firma sigue diciendo lo que decía. */
  usuarioNombre: string;
  usuarioDocumento: string;
  usuarioRol: string;
  declaracion: string;
  /** SHA-256 del contenido firmado (`contenidoFirmable`). */
  huella: string;
  /** Imagen PNG del trazo como data URL. */
  trazo: string;
  /** Navegador/equipo desde el que se firmó (user-agent) y su IP. */
  dispositivo: string | null;
  ip: string | null;
  fechaHora: Date;
}

export type NuevaFirma = Omit<FirmaRemision, 'id'>;

export interface FirmaRemisionRepository {
  listarPorRemision(remisionId: string): Promise<FirmaRemision[]>;
  /** Falla si ya existe la firma de esa casilla en esa versión (restricción única). */
  crear(firma: NuevaFirma): Promise<FirmaRemision>;
}

export const FIRMA_REMISION_REPOSITORY = Symbol('FirmaRemisionRepository');

/** Calcula la huella de un texto. La implementación (SHA-256) es infraestructura. */
export interface CalculadorHuella {
  sha256(texto: string): string;
}

export const CALCULADOR_HUELLA = Symbol('CalculadorHuella');

// ---------- Errores ----------

export class FirmaInvalidaError extends ErrorDominio {
  readonly codigo = 'FIRMA_INVALIDA';
}

export class FirmaYaRegistradaError extends ErrorDominio {
  readonly codigo = 'FIRMA_YA_REGISTRADA';
  constructor(tipo: TipoFirma, version: number) {
    super(`La casilla ${tipo} de la versión ${version} ya está firmada. Una firma no se reemplaza.`);
  }
}

export class FirmaFueraDeTiempoError extends ErrorDominio {
  readonly codigo = 'FIRMA_FUERA_DE_TIEMPO';
}

/** Contraseña incorrecta al firmar. No es 401: la sesión sigue siendo válida. */
export class ContrasenaFirmaIncorrectaError extends ErrorDominio {
  readonly codigo = 'FIRMA_CONTRASENA_INCORRECTA';
  constructor() {
    super('La contraseña no es correcta. La firma no se registró.');
  }
}

// ---------- Reglas ----------

/**
 * El trazo pesa poco (PNG de un canvas pequeño, 10–40 KB); el tope evita
 * guardar imágenes que no son firmas y cabe en el límite de 100 KB del
 * cuerpo de la petición.
 */
export const MAXIMO_TAMANO_TRAZO = 90_000;
const PREFIJO_PNG = 'data:image/png;base64,';

export function validarTrazo(trazo: string): string {
  const limpio = trazo?.trim() ?? '';
  if (!limpio.startsWith(PREFIJO_PNG) || limpio.length <= PREFIJO_PNG.length + 100) {
    throw new FirmaInvalidaError('Dibuje la firma antes de confirmar.');
  }
  if (limpio.length > MAXIMO_TAMANO_TRAZO) {
    throw new FirmaInvalidaError('La imagen de la firma es demasiado grande.');
  }
  if (!/^[A-Za-z0-9+/=]+$/.test(limpio.slice(PREFIJO_PNG.length))) {
    throw new FirmaInvalidaError('La imagen de la firma no es válida.');
  }
  return limpio;
}

export function exigirTipoHabilitado(tipo: TipoFirma): void {
  if (!TIPOS_FIRMA_HABILITADOS.includes(tipo)) {
    throw new FirmaFueraDeTiempoError(`La firma ${tipo} todavía no está habilitada.`);
  }
}

/** ¿Se puede firmar esta casilla ahora? */
export function verificarPuedeFirmar(remision: Remision, tipo: TipoFirma, firmas: FirmaRemision[]): void {
  exigirTipoHabilitado(tipo);
  if (!ESTADOS_PARA_FIRMAR[tipo].includes(remision.estado)) {
    throw new FirmaFueraDeTiempoError(
      `La casilla ${tipo} se firma con la remisión en estado ${ESTADOS_PARA_FIRMAR[tipo].join(' o ')}; está ${remision.estado}.`,
    );
  }
  if (firmas.some((f) => f.tipo === tipo && f.version === remision.version)) {
    throw new FirmaYaRegistradaError(tipo, remision.version);
  }
  // Decisión del usuario (2026-10-03): el OPA firma DESPUÉS del verificador,
  // porque su declaración es "según el conteo certificado por el verificador".
  if (tipo === 'RECIBE' && !firmas.some((f) => f.tipo === 'VERIFICADOR' && f.version === remision.version)) {
    throw new FirmaFueraDeTiempoError('Primero debe firmar el verificador (el conteo físico); después el OPA puede aprobar y firmar.');
  }
}

/**
 * Lo que la firma respalda: el contenido del documento en esa versión.
 * Texto canónico (claves en orden fijo) para que la misma remisión dé
 * siempre la misma huella. NO entra el estado (aprobar después de firmar
 * no invalida la firma del verificador) ni las firmas mismas.
 */
export function contenidoFirmable(remision: Remision): string {
  const d = remision.aObjeto();
  const dia = (f: Date) => f.toISOString().slice(0, 10);
  return JSON.stringify([
    ['consecutivo', remision.consecutivo],
    ['version', d.version],
    ['fechaOperativa', dia(d.fechaOperativa)],
    ['turnoId', d.turnoId],
    ['grupoId', d.grupoId],
    ['lugarId', d.lugarId],
    ['codigo', d.codigoSnapshot],
    ['descripcion', d.descripcionSnapshot],
    ['fechaVencimiento', dia(d.fechaVencimiento)],
    ['cantidadCajas', d.cantidadCajas],
    ['cantidadUnidades', d.cantidadUnidades],
    ['estibasCompletas', d.estibasCompletas],
    ['cajasSueltas', d.cajasSueltas],
    ['numerosEstiba', [...d.numerosEstiba].sort((a, b) => a - b)],
    ['observaciones', d.observaciones ?? null],
    ['extraoficial', d.extraoficial],
  ]);
}

/** Firma vigente = de la versión actual y con la huella del contenido actual. */
export function esVigente(firma: FirmaRemision, remision: Remision, huellaActual: string): boolean {
  return firma.version === remision.version && firma.huella === huellaActual;
}
