/**
 * CASOS DE USO: FIRMA ELECTRÓNICA DE LA REMISIÓN
 * ==============================================
 *
 * Firmar: quien firma sale del TOKEN y además escribe su CONTRASEÑA (el
 * computador de MQ es compartido: así se prueba que firmó el dueño de la
 * cuenta y no alguien que encontró la sesión abierta). La contraseña se
 * verifica ANTES de abrir la transacción (bcrypt tarda y no debe alargarla).
 * En la transacción: se relee la remisión, se aplican las reglas, se
 * guarda la firma con la huella del contenido y se audita.
 *
 * Consultar: las firmas de la remisión, marcando cuáles siguen vigentes
 * (versión actual y huella igual a la del contenido actual).
 */

import type { Reloj } from './crear-remision.use-case.js';
import {
  ContrasenaFirmaIncorrectaError,
  contenidoFirmable,
  DECLARACION_FIRMA,
  esVigente,
  exigirTipoHabilitado,
  FirmaFueraDeTiempoError,
  PERMISO_FIRMA,
  TIPOS_FIRMA,
  TIPOS_FIRMA_SUELTA,
  validarTrazo,
  verificarPuedeFirmar,
  type CalculadorHuella,
  type ConfiguracionFirma,
  type FirmaRemision,
  type ModoFirma,
  type FirmaRemisionRepository,
  type NuevaFirma,
  type TipoFirma,
} from '../../domain/remision/firma-remision.js';
import type { Remision } from '../../domain/remision/remision.entity.js';
import { RemisionNoEncontradaError } from '../../domain/remision/remision.errors.js';
import type { RemisionRepository } from '../../domain/remision/remision.repository.js';
import type { ContextoTransaccional, UnidadDeTrabajo } from '../../domain/shared/unidad-de-trabajo.js';
import type { Usuario } from '../../domain/usuario/usuario.entity.js';
import type { HashContrasena } from '../../domain/usuario/contrasena.js';
import { PermisoDenegadoError, UsuarioNoEncontradoError } from '../../domain/usuario/usuario.errors.js';
import type { UsuarioRepository } from '../../domain/usuario/usuario.repository.js';

/** Lo que se necesita para firmar una casilla: el trazo, la contraseña y la evidencia del equipo. */
export interface DatosFirma {
  /** PNG del trazo como data URL. */
  trazo: string;
  /** Se verifica y se descarta: nunca se guarda ni se audita. */
  contrasena: string;
  dispositivo: string | null;
  ip: string | null;
}

export interface FirmarRemisionComando extends DatosFirma {
  remisionId: string;
  tipo: TipoFirma;
  usuarioId: string;
}

/** Firmante ya verificado (contraseña + permiso de la casilla), con su trazo validado. */
export interface FirmanteVerificado {
  usuario: Usuario;
  tipo: TipoFirma;
  datos: DatosFirma;
}

/**
 * Pieza común de "firmar suelta" y "aprobar firmando": comprueba el trazo,
 * la contraseña y el permiso de la casilla ANTES de abrir la transacción
 * (bcrypt tarda y no debe alargarla), y luego arma y registra la firma.
 */
export class FirmaDeRemision {
  constructor(
    private readonly usuarios: UsuarioRepository,
    private readonly hash: HashContrasena,
    private readonly huella: CalculadorHuella,
    private readonly reloj: Reloj,
  ) {}

  async verificarFirmante(usuarioId: string, tipo: TipoFirma, datos: DatosFirma): Promise<FirmanteVerificado> {
    exigirTipoHabilitado(tipo);
    const trazo = validarTrazo(datos.trazo);
    const usuario = await this.usuarios.buscarPorId(usuarioId);
    if (!usuario || !usuario.activo) throw new UsuarioNoEncontradoError('El usuario no existe o está inactivo.');
    if (!datos.contrasena || !(await this.hash.verificar(datos.contrasena, usuario.passwordHash))) {
      throw new ContrasenaFirmaIncorrectaError();
    }
    const permiso = PERMISO_FIRMA[tipo];
    if (!usuario.tienePermiso(permiso)) throw new PermisoDenegadoError(permiso);
    return { usuario, tipo, datos: { ...datos, trazo } };
  }

  /** La firma a guardar. La huella se calcula sobre el contenido de la remisión en ese momento. */
  construir(remision: Remision, f: FirmanteVerificado): NuevaFirma {
    return {
      remisionId: remision.id,
      version: remision.version,
      tipo: f.tipo,
      usuarioId: f.usuario.id,
      usuarioNombre: f.usuario.nombre,
      usuarioDocumento: f.usuario.documento,
      usuarioRol: f.usuario.rolCodigo,
      declaracion: DECLARACION_FIRMA[f.tipo],
      huella: this.huella.sha256(contenidoFirmable(remision)),
      trazo: f.datos.trazo,
      dispositivo: f.datos.dispositivo?.slice(0, 300) ?? null,
      ip: f.datos.ip?.slice(0, 64) ?? null,
      fechaHora: this.reloj.ahora(),
    };
  }

  /** Solo escrituras (regla de Firestore): crea la firma y la audita. */
  async registrar(contexto: Pick<ContextoTransaccional, 'firmasRemision' | 'auditoria'>, firma: NuevaFirma): Promise<FirmaRemision> {
    const creada = await contexto.firmasRemision.crear(firma);
    await contexto.auditoria.registrar({
      entidad: 'remision',
      entidadId: firma.remisionId,
      accion: 'CREAR',
      // El trazo no va a la auditoría (es pesado y ya está en la firma); sí lo que prueba.
      valorNuevo: { firma: creada.tipo, version: creada.version, huella: creada.huella, declaracion: creada.declaracion, dispositivo: creada.dispositivo, ip: creada.ip },
      usuarioId: firma.usuarioId,
    });
    return creada;
  }
}

/** Firmar una casilla suelta: INLOTRANS o VERIFICADOR. La de quien recibe va con la aprobación. */
export class FirmarRemisionUseCase {
  constructor(
    private readonly uow: UnidadDeTrabajo,
    private readonly firma: FirmaDeRemision,
  ) {}

  async ejecutar(comando: FirmarRemisionComando): Promise<FirmaRemision> {
    if (!TIPOS_FIRMA_SUELTA.includes(comando.tipo)) {
      throw new FirmaFueraDeTiempoError(
        comando.tipo === 'RECIBE'
          ? 'La firma de quien recibe se registra al aprobar la remisión ("Aprobar y firmar").'
          : 'La firma de validación se registra al validar la remisión ("Validar y firmar").',
      );
    }
    const firmante = await this.firma.verificarFirmante(comando.usuarioId, comando.tipo, comando);

    return this.uow.ejecutar(async (contexto) => {
      // Firestore: lecturas primero.
      const remision = await contexto.remisiones.buscarPorId(comando.remisionId);
      if (!remision) throw new RemisionNoEncontradaError(`No existe la remisión "${comando.remisionId}".`);
      verificarPuedeFirmar(remision, comando.tipo, await contexto.firmasRemision.listarPorRemision(remision.id));
      return this.firma.registrar(contexto, this.firma.construir(remision, firmante));
    });
  }
}

export interface FirmaConVigencia extends FirmaRemision {
  vigente: boolean;
}

export interface FirmasDeRemision {
  /** PILOTO (firmas opcionales) u OBLIGATORIA (fin del piloto): la pantalla oculta lo que ya no se permite. */
  modo: ModoFirma;
  version: number;
  huellaActual: string;
  /** Casillas de la versión actual: la firma vigente o null si falta. */
  casillas: Array<{ tipo: TipoFirma; declaracion: string; firma: FirmaConVigencia | null }>;
  /** Todas, incluidas las de versiones anteriores (historial). */
  historial: FirmaConVigencia[];
}

export class ConsultarFirmasUseCase {
  constructor(
    private readonly remisiones: RemisionRepository,
    private readonly firmas: FirmaRemisionRepository,
    private readonly huella: CalculadorHuella,
    private readonly configuracion: ConfiguracionFirma = { modo: 'PILOTO' },
  ) {}

  async ejecutar(remisionId: string): Promise<FirmasDeRemision> {
    const [remision, firmas] = await Promise.all([this.remisiones.buscarPorId(remisionId), this.firmas.listarPorRemision(remisionId)]);
    if (!remision) throw new RemisionNoEncontradaError(`No existe la remisión "${remisionId}".`);
    const huellaActual = this.huella.sha256(contenidoFirmable(remision));
    const historial = firmas.map((f) => ({ ...f, vigente: esVigente(f, remision, huellaActual) }));
    return {
      modo: this.configuracion.modo,
      version: remision.version,
      huellaActual,
      casillas: TIPOS_FIRMA.map((tipo) => ({
        tipo,
        declaracion: DECLARACION_FIRMA[tipo],
        firma: historial.find((f) => f.tipo === tipo && f.vigente) ?? null,
      })),
      historial,
    };
  }
}
