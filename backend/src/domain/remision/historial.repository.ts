/**
 * HISTORIAL DE UNA REMISIÓN — Puerto de consulta
 * ==============================================
 *
 * Dos fuentes de trazabilidad, ambas de solo lectura aquí:
 *
 *   - Versiones: cada rectificación guarda el documento tal como estaba
 *     antes, con el motivo del rechazo que la originó.
 *   - Auditoría: cada escritura (crear, editar, cambio de estado) con
 *     quién, cuándo y qué cambió.
 *
 * Se devuelve el nombre del usuario resuelto, no solo su id: quien lee
 * el historial necesita saber "quién", y el dominio no debe obligar al
 * frontend a cruzar tablas.
 */

export interface VersionRemision {
  version: number;
  motivoRechazo: string | null;
  /** Snapshot del documento en esa versión (forma de `aObjeto()`). */
  datosAnteriores: unknown;
  rectificadaPor: { id: string; nombre: string };
  fechaRectificacion: Date;
}

export interface EntradaAuditoriaRemision {
  id: string;
  accion: 'CREAR' | 'ACTUALIZAR' | 'CAMBIO_ESTADO' | 'ELIMINAR';
  valorAnterior: unknown;
  valorNuevo: unknown;
  motivo: string | null;
  usuario: { id: string; nombre: string };
  fecha: Date;
}

export interface HistorialRemisionRepository {
  versiones(remisionId: string): Promise<VersionRemision[]>;
  auditoria(remisionId: string): Promise<EntradaAuditoriaRemision[]>;
}

export const HISTORIAL_REMISION_REPOSITORY = Symbol('HistorialRemisionRepository');
