/**
 * GRUPO — Catálogo
 * ================
 *
 * Decisión del área (2026-09-21): lo que antes se llamaba "proveedor"
 * (la empresa que pone el personal del turno: LOGICMARD, MAXISERVICE,
 * APOYOS MAXI, MIX) pasa a llamarse GRUPO, sin excepción. El proveedor
 * real se escribe a mano en la descripción.
 *
 *   personasEsperadas   cuántas personas debería enviar el grupo a un
 *                       turno. Se compara con las que llegaron (módulo
 *                       de asistencia) para saber si la productividad
 *                       del turno queda "a fin" o afectada. `null` =
 *                       sin definir: no se compara.
 *
 * Se administra desde el panel (crear y editar). No se elimina: un
 * grupo con remisiones se desactiva.
 */

import { DatosGrupoInvalidosError } from './grupo.errors.js';

export interface Grupo {
  id: string;
  codigo: string;
  nombre: string;
  /** Texto libre: aquí se escribe el proveedor, contacto, etc. */
  descripcion: string | null;
  personasEsperadas: number | null;
  activo: boolean;
}

export interface DatosGrupo {
  codigo: string;
  nombre: string;
  descripcion: string | null;
  personasEsperadas: number | null;
}

export function validarDatosGrupo(datos: DatosGrupo): DatosGrupo {
  const exigir = (condicion: boolean, mensaje: string): void => {
    if (!condicion) throw new DatosGrupoInvalidosError(mensaje);
  };

  const codigo = datos.codigo?.trim().toUpperCase() ?? '';
  exigir(/^[A-Z0-9_-]{1,30}$/.test(codigo), 'El código del grupo: 1 a 30 letras, números, guion o guion bajo.');

  const nombre = datos.nombre?.trim() ?? '';
  exigir(nombre.length > 0 && nombre.length <= 80, 'El nombre del grupo es obligatorio (máx. 80 caracteres).');

  const descripcion = datos.descripcion?.trim() || null;
  exigir(descripcion === null || descripcion.length <= 500, 'La descripción no puede superar 500 caracteres.');

  if (datos.personasEsperadas !== null) {
    exigir(
      Number.isInteger(datos.personasEsperadas) && datos.personasEsperadas > 0,
      'Las personas esperadas deben ser un entero mayor que cero.',
    );
  }

  return { codigo, nombre, descripcion, personasEsperadas: datos.personasEsperadas };
}

export interface GrupoRepository {
  listar(): Promise<Grupo[]>;
  buscarPorId(id: string): Promise<Grupo | null>;
  buscarPorCodigo(codigo: string): Promise<Grupo | null>;
  crear(datos: DatosGrupo): Promise<Grupo>;
  actualizar(id: string, cambios: Partial<DatosGrupo> & { activo?: boolean }): Promise<Grupo>;
}

export const GRUPO_REPOSITORY = Symbol('GrupoRepository');
