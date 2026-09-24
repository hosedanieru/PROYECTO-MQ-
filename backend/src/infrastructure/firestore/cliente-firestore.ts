/**
 * CLIENTE FIRESTORE — dentro o fuera de transacción
 * =================================================
 *
 * Equivalente a `ClientePrisma`: los repositorios reciben este objeto y
 * no saben si están dentro de una transacción. Cuando hay `tx`, las
 * lecturas y escrituras pasan por ella.
 *
 * Regla de Firestore que condiciona TODO el diseño de los repositorios:
 * dentro de una transacción, todas las lecturas van ANTES que cualquier
 * escritura. Por eso los repositorios de Firestore nunca "releen" lo que
 * acaban de escribir: devuelven el objeto que construyeron.
 *
 * Nombres de colección centralizados aquí.
 */

import {
  FieldValue,
  Timestamp,
  type CollectionReference,
  type DocumentData,
  type DocumentReference,
  type DocumentSnapshot,
  type Firestore,
  type Query,
  type QuerySnapshot,
  type Transaction,
} from 'firebase-admin/firestore';

import { traducirErrorFirestore } from './errores-firestore.js';

export const COLECCION = {
  usuarios: 'usuarios',
  roles: 'roles',
  permisos: 'permisos',
  turnos: 'turnos',
  grupos: 'grupos',
  lugares: 'lugares',
  productos: 'productos',
  remisiones: 'remisiones',
  remisionVersiones: 'remisionVersiones',
  consecutivos: 'consecutivos',
  auditoria: 'auditoria',
  lineasProduccion: 'lineasProduccion',
  bloquesProgramacion: 'bloquesProgramacion',
  asistenciasTurno: 'asistenciasTurno',
  asignacionesLinea: 'asignacionesLinea',
} as const;

export class ClienteFirestore {
  constructor(
    readonly db: Firestore,
    private readonly tx: Transaction | null = null,
  ) {}

  coleccion(nombre: string): CollectionReference {
    return this.db.collection(nombre);
  }

  /** Id nuevo con el formato de Firestore, sin tocar la base. */
  nuevoId(nombre: string): string {
    return this.db.collection(nombre).doc().id;
  }

  obtener(ref: DocumentReference): Promise<DocumentSnapshot> {
    return conNombrePropio(() => (this.tx ? this.tx.get(ref) : ref.get()));
  }

  consultar(q: Query): Promise<QuerySnapshot> {
    return conNombrePropio(() => (this.tx ? this.tx.get(q) : q.get()));
  }

  async guardar(ref: DocumentReference, datos: DocumentData, fusionar = false): Promise<void> {
    if (this.tx) {
      this.tx.set(ref, datos, { merge: fusionar });
    } else {
      await conNombrePropio(() => ref.set(datos, { merge: fusionar }));
    }
  }

  async actualizar(ref: DocumentReference, datos: DocumentData): Promise<void> {
    if (this.tx) {
      this.tx.update(ref, datos);
    } else {
      await conNombrePropio(() => ref.update(datos));
    }
  }

  async eliminar(ref: DocumentReference): Promise<void> {
    if (this.tx) {
      this.tx.delete(ref);
    } else {
      await conNombrePropio(() => ref.delete());
    }
  }
}

/**
 * Único punto donde los fallos del servicio (cuota agotada, sin
 * conexión) reciben un nombre entendible. Dentro de una transacción las
 * escrituras no devuelven promesa —se aplican al confirmar—, así que
 * ahí el error lo traduce la unidad de trabajo.
 */
async function conNombrePropio<T>(operacion: () => Promise<T>): Promise<T> {
  try {
    return await operacion();
  } catch (error) {
    throw traducirErrorFirestore(error);
  }
}

// ---------- Conversión de tipos ----------

/** Firestore guarda Timestamp; el dominio usa Date. */
export function aDate(valor: unknown): Date {
  if (valor instanceof Timestamp) return valor.toDate();
  if (valor instanceof Date) return valor;
  throw new Error(`Se esperaba una fecha y llegó ${typeof valor}`);
}

export function aDateONulo(valor: unknown): Date | null {
  return valor === null || valor === undefined ? null : aDate(valor);
}

/** Fecha operativa como texto YYYY-MM-DD, la forma en que se consulta por igualdad. */
export function claveFecha(fechaOperativa: Date): string {
  return fechaOperativa.toISOString().slice(0, 10);
}

export const ahoraServidor = () => FieldValue.serverTimestamp();
