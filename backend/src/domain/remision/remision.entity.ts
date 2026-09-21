/**
 * ENTIDAD REMISIÓN
 * ================
 *
 * Documento formal de entrega de Producto Terminado ("llevo o recibo").
 * Es la entidad raíz del aplicativo MQ: MFR, averías, calidad e inventario
 * se construyen sobre los datos que produce.
 *
 * Esta clase NO importa nada de NestJS, Prisma, PostgreSQL ni React.
 * Solo TypeScript. Es la regla estructural del proyecto: si aquí hiciera
 * falta un import de una librería externa, habría un error de diseño.
 *
 * Reglas fundamentales:
 *  - Una remisión corresponde a un solo producto (SKU).
 *  - El consecutivo reinicia cada año → identidad = (año, número).
 *  - Nunca se elimina: es un documento firmado. Un rechazo se corrige
 *    mediante rectificación, conservando el mismo consecutivo.
 *  - Aprobación (OPA de PepsiCo) y validación (conciliación interna)
 *    son eventos distintos, con responsables y momentos distintos.
 */

import {
  DatosRemisionInvalidosError,
  InformacionIncompletaError,
  RemisionNoEditableError,
  TransicionEstadoInvalidaError,
} from './remision.errors.js';

// ============================================================
// TIPOS DEL DOMINIO
// ============================================================

/**
 * El dominio define su propio estado, sin importar el enum de Prisma.
 * La infraestructura se encarga de traducir entre ambos. Así el día que
 * se cambie de base de datos, el dominio no se toca.
 */
export const ESTADOS_REMISION = [
  'BORRADOR',
  'ENTREGADA',
  'APROBADA',
  'RECHAZADA',
  'EN_RECTIFICACION',
  'VALIDADA',
] as const;

export type EstadoRemision = (typeof ESTADOS_REMISION)[number];

/** Datos necesarios para crear una remisión nueva. */
export interface DatosNuevaRemision {
  anio: number;
  numero: number;
  fechaOperativa: Date;
  fechaHoraRegistro: Date;
  turnoId: string;
  grupoId: string;
  lugarId: string;
  productoId: string;
  codigoSnapshot: string;
  descripcionSnapshot: string;
  fechaVencimiento: Date;
  cantidadCajas: number;
  cantidadUnidades: number;
  estibasCompletas: number;
  cajasSueltas: number;
  numerosEstiba: number[];
  observaciones?: string | null;
  /**
   * Pedido de emergencia por fuera del DPP de PepsiCo (decisión del área,
   * 2026-09-18). No cuenta para el MFR ni para el tope de lo programado;
   * exige motivo. Por defecto, false.
   */
  extraoficial?: boolean;
  motivoExtraoficial?: string | null;
  creadaPorId: string;
}

/**
 * Lo que un coordinador puede corregir mientras el documento no ha
 * salido a entrega. Quedan FUERA a propósito: consecutivo, fecha
 * operativa, fecha de registro, autor, estado y versión.
 *
 * Si cambia el producto, el snapshot debe venir junto: la remisión no
 * conoce el catálogo, así que quien la edita (el caso de uso) resuelve
 * código y descripción y los entrega aquí.
 */
export interface DatosEditablesRemision {
  turnoId?: string;
  grupoId?: string;
  lugarId?: string;
  producto?: { id: string; codigo: string; descripcion: string };
  fechaVencimiento?: Date;
  cantidadCajas?: number;
  cantidadUnidades?: number;
  estibasCompletas?: number;
  cajasSueltas?: number;
  numerosEstiba?: number[];
  observaciones?: string | null;
  extraoficial?: boolean;
  motivoExtraoficial?: string | null;
}

/** Estado completo de una remisión existente, tal como se persiste. */
export interface EstadoPersistidoRemision extends DatosNuevaRemision {
  id: string;
  version: number;
  estado: EstadoRemision;
  extraoficial: boolean;
  motivoExtraoficial: string | null;
  entregadaPorId?: string | null;
  fechaEntrega?: Date | null;
  opaNombre?: string | null;
  opaCargo?: string | null;
  fechaAprobacion?: Date | null;
  /** Motivo del último rechazo del OPA; alimenta el historial de versiones. */
  motivoRechazo?: string | null;
  validadaPorId?: string | null;
  fechaValidacion?: Date | null;
  conciliadoCon?: string | null;
  motivoUltimoRechazo?: string | null;
}

/**
 * Transiciones permitidas del flujo.
 *
 *   BORRADOR ──► ENTREGADA ──► APROBADA ──► VALIDADA
 *                    ▲              │
 *                    │              ▼
 *                    └── EN_RECTIFICACION ◄── RECHAZADA
 */
const TRANSICIONES_PERMITIDAS: Record<EstadoRemision, EstadoRemision[]> = {
  BORRADOR: ['ENTREGADA'],
  ENTREGADA: ['APROBADA', 'RECHAZADA'],
  APROBADA: ['VALIDADA'],
  RECHAZADA: ['EN_RECTIFICACION'],
  EN_RECTIFICACION: ['ENTREGADA'],
  VALIDADA: [],
};

/** Quita las claves con `undefined` para que no pisen valores al hacer spread. */
function sinIndefinidos<T extends object>(objeto: T): Partial<T> {
  return Object.fromEntries(
    Object.entries(objeto).filter(([, valor]) => valor !== undefined),
  ) as Partial<T>;
}

// ============================================================
// ENTIDAD
// ============================================================

export class Remision {
  private constructor(private estadoInterno: EstadoPersistidoRemision) { }

  // ---------- Construcción ----------

  /**
   * Crea una remisión nueva en estado BORRADOR.
   * Valida todas las reglas de negocio antes de permitir la creación.
   */
  static crear(datos: DatosNuevaRemision): Remision {
    Remision.validarDatos(datos);

    return new Remision({
      ...datos,
      id: '',
      version: 1,
      estado: 'BORRADOR',
      observaciones: datos.observaciones?.trim() || null,
      numerosEstiba: [...datos.numerosEstiba].sort((a, b) => a - b),
      extraoficial: datos.extraoficial ?? false,
      motivoExtraoficial: datos.extraoficial ? datos.motivoExtraoficial!.trim() : null,
    });
  }

  /** Reconstruye una remisión desde la base de datos, sin revalidar. */
  static desdePersistencia(estado: EstadoPersistidoRemision): Remision {
    return new Remision({
      ...estado,
      numerosEstiba: [...estado.numerosEstiba],
    });
  }

  // ---------- Validaciones ----------

  private static validarDatos(datos: DatosNuevaRemision): void {
    const exigir = (condicion: boolean, mensaje: string): void => {
      if (!condicion) {
        throw new DatosRemisionInvalidosError(mensaje);
      }
    };

    exigir(
      Number.isInteger(datos.anio) && datos.anio >= 2000,
      'El año de la remisión no es válido.',
    );
    exigir(
      Number.isInteger(datos.numero) && datos.numero > 0,
      'El número de remisión debe ser un entero positivo.',
    );

    exigir(
      Number.isInteger(datos.cantidadCajas) && datos.cantidadCajas > 0,
      'La cantidad de cajas debe ser un entero mayor que cero.',
    );
    exigir(
      Number.isInteger(datos.cantidadUnidades) && datos.cantidadUnidades > 0,
      'La cantidad de unidades debe ser un entero mayor que cero.',
    );

    exigir(
      Number.isInteger(datos.estibasCompletas) && datos.estibasCompletas >= 0,
      'Las estibas completas no pueden ser negativas.',
    );
    exigir(
      Number.isInteger(datos.cajasSueltas) && datos.cajasSueltas >= 0,
      'Las cajas sueltas no pueden ser negativas.',
    );
    exigir(
      datos.estibasCompletas > 0 || datos.cajasSueltas > 0,
      'La remisión debe tener al menos una estiba completa o una caja suelta.',
    );

    exigir(
      datos.codigoSnapshot.trim().length > 0,
      'El código del producto es obligatorio.',
    );
    exigir(
      datos.descripcionSnapshot.trim().length > 0,
      'La descripción del producto es obligatoria.',
    );

    exigir(
      datos.fechaVencimiento.getTime() > datos.fechaOperativa.getTime(),
      'La fecha de vencimiento debe ser posterior a la fecha operativa.',
    );

    // Un pedido de emergencia sale del MFR: debe quedar explicado.
    exigir(
      !datos.extraoficial || (datos.motivoExtraoficial?.trim().length ?? 0) >= 5,
      'Una remisión extraoficial exige el motivo (mínimo 5 caracteres).',
    );

    Remision.validarEstibas(datos.numerosEstiba);
  }

  private static validarEstibas(numeros: number[]): void {
    for (const numero of numeros) {
      if (!Number.isInteger(numero) || numero <= 0) {
        throw new DatosRemisionInvalidosError(
          `El número de estiba "${numero}" no es válido.`,
        );
      }
    }

    if (new Set(numeros).size !== numeros.length) {
      throw new DatosRemisionInvalidosError(
        'Hay números de estiba repetidos en la remisión.',
      );
    }
  }

  // ---------- Edición ----------

  /**
   * Corrige los datos del documento. Solo en BORRADOR o EN_RECTIFICACION.
   *
   * Se valida el documento COMPLETO resultante con las mismas reglas de
   * la creación: una edición parcial no puede dejar la remisión en un
   * estado que `crear` habría rechazado.
   */
  editar(cambios: DatosEditablesRemision): void {
    if (!this.esEditable) {
      throw new RemisionNoEditableError(this.estadoInterno.estado);
    }

    const { producto, ...resto } = cambios;
    const propuesto: EstadoPersistidoRemision = {
      ...this.estadoInterno,
      ...sinIndefinidos(resto),
      ...(producto
        ? {
            productoId: producto.id,
            codigoSnapshot: producto.codigo,
            descripcionSnapshot: producto.descripcion,
          }
        : {}),
    };

    Remision.validarDatos(propuesto);

    this.estadoInterno = {
      ...propuesto,
      observaciones: propuesto.observaciones?.trim() || null,
      numerosEstiba: [...propuesto.numerosEstiba].sort((a, b) => a - b),
      extraoficial: propuesto.extraoficial ?? false,
      motivoExtraoficial: propuesto.extraoficial ? propuesto.motivoExtraoficial!.trim() : null,
    };
  }

  // ---------- Transiciones de estado ----------

  private exigirTransicion(destino: EstadoRemision): void {
    if (!TRANSICIONES_PERMITIDAS[this.estadoInterno.estado].includes(destino)) {
      throw new TransicionEstadoInvalidaError(
        this.estadoInterno.estado,
        destino,
      );
    }
  }

  /** El patinador entrega físicamente la remisión al OPA. */
  entregar(entregadaPorId: string, momento: Date): void {
    this.exigirTransicion('ENTREGADA');

    if (!entregadaPorId.trim()) {
      throw new InformacionIncompletaError(
        'Se requiere el usuario que entrega la remisión.',
      );
    }

    this.estadoInterno.estado = 'ENTREGADA';
    this.estadoInterno.entregadaPorId = entregadaPorId;
    this.estadoInterno.fechaEntrega = momento;
  }

  /**
   * El OPA de PepsiCo aprueba la entrega.
   * El OPA no es usuario del sistema: su participación se registra como
   * dato (nombre y cargo), no como cuenta.
   */
  aprobar(opaNombre: string, opaCargo: string | null, momento: Date): void {
    this.exigirTransicion('APROBADA');

    if (!opaNombre.trim()) {
      throw new InformacionIncompletaError(
        'Se requiere el nombre del OPA que aprueba.',
      );
    }

    this.estadoInterno.estado = 'APROBADA';
    this.estadoInterno.opaNombre = opaNombre.trim();
    this.estadoInterno.opaCargo = opaCargo?.trim() || null;
    this.estadoInterno.fechaAprobacion = momento;
  }

  /** El OPA no acepta la remisión. Debe verificarse y rectificarse. */
  rechazar(motivo: string): void {
    this.exigirTransicion('RECHAZADA');

    if (!motivo.trim()) {
      throw new InformacionIncompletaError(
        'Se requiere el motivo del rechazo.',
      );
    }

    this.estadoInterno.estado = 'RECHAZADA';
    this.estadoInterno.motivoRechazo = motivo.trim();
    this.estadoInterno.motivoUltimoRechazo = motivo.trim();
  }

  /**
   * Abre la rectificación de una remisión rechazada.
   * Incrementa la versión; el consecutivo NO cambia.
   */
  iniciarRectificacion(): void {
    this.exigirTransicion('EN_RECTIFICACION');

    this.estadoInterno.estado = 'EN_RECTIFICACION';
    this.estadoInterno.version += 1;
    // El motivo pasa al historial de versiones y se libera aquí.
    this.estadoInterno.motivoUltimoRechazo = null;
  }

  /**
   * Conciliación administrativa interna (cuaderno virtual).
   * Es un evento distinto de la aprobación del OPA: solo se puede
   * validar una remisión previamente aprobada.
   */
  validar(validadaPorId: string, conciliadoCon: string, momento: Date): void {
    this.exigirTransicion('VALIDADA');

    if (!validadaPorId.trim()) {
      throw new InformacionIncompletaError(
        'Se requiere el usuario que valida la remisión.',
      );
    }
    if (!conciliadoCon.trim()) {
      throw new InformacionIncompletaError(
        'Se requiere el contacto con quien se concilió.',
      );
    }

    this.estadoInterno.estado = 'VALIDADA';
    this.estadoInterno.validadaPorId = validadaPorId;
    this.estadoInterno.conciliadoCon = conciliadoCon.trim();
    this.estadoInterno.fechaValidacion = momento;
  }

  // ---------- Consultas ----------

  get id(): string {
    return this.estadoInterno.id;
  }

  get estado(): EstadoRemision {
    return this.estadoInterno.estado;
  }

  get version(): number {
    return this.estadoInterno.version;
  }

  /** Identificador de negocio: el consecutivo es anual. */
  get consecutivo(): string {
    return `${this.estadoInterno.anio}-${String(this.estadoInterno.numero).padStart(4, '0')}`;
  }

  /** Puede editarse solo mientras no haya salido a entrega. */
  get esEditable(): boolean {
    return (
      this.estadoInterno.estado === 'BORRADOR' ||
      this.estadoInterno.estado === 'EN_RECTIFICACION'
    );
  }

  /** Pedido de emergencia fuera del DPP: no cuenta para el MFR ni para el tope. */
  get esExtraoficial(): boolean {
    return this.estadoInterno.extraoficial;
  }

  /** Aprobada por PepsiCo pero aún sin conciliar internamente. */
  get estaPendienteDeConciliar(): boolean {
    return this.estadoInterno.estado === 'APROBADA';
  }

  /** Motivo del último rechazo, o null si nunca fue rechazada. */
  get motivoRechazo(): string | null {
    return this.estadoInterno.motivoRechazo ?? null;
  }

  get motivoUltimoRechazo(): string | null {
    return this.estadoInterno.motivoUltimoRechazo ?? null;
  }

  /**
   * Texto de presentación de las estibas, equivalente a lo que en el
   * Excel se escribía a mano ("2 ESTIBAS+ 21 CAJAS"). Se calcula, no se
   * almacena: guardarlo como texto es lo que impedía sumar y comparar.
   */
  get descripcionEstibas(): string {
    const partes: string[] = [];
    const { estibasCompletas, cajasSueltas } = this.estadoInterno;

    if (estibasCompletas > 0) {
      partes.push(
        `${estibasCompletas} ${estibasCompletas === 1 ? 'estiba' : 'estibas'}`,
      );
    }
    if (cajasSueltas > 0) {
      partes.push(`${cajasSueltas} ${cajasSueltas === 1 ? 'caja' : 'cajas'}`);
    }

    return partes.join(' + ');
  }

  /** Copia del estado interno, para persistencia o serialización. */
  aObjeto(): EstadoPersistidoRemision {
    return {
      ...this.estadoInterno,
      numerosEstiba: [...this.estadoInterno.numerosEstiba],
    };
  }
}
