/**
 * GRUPO — Catálogo
 * ================
 *
 * Decisión del área (2026-09-21): lo que antes se llamaba "proveedor"
 * (la empresa que pone el personal del turno: LOGICMARD, MAXISERVICE,
 * APOYOS MAXI, MIX) pasa a llamarse GRUPO, sin excepción. El proveedor
 * real se escribe a mano en la descripción.
 *
 *   esperadasPorTurno   cuántas personas debería enviar el grupo a CADA
 *                       turno (usuario, 2026-10-03: antes era un solo
 *                       número para todos). { turnoId: personas }; un
 *                       turno que no aparece = el grupo no se espera ahí.
 *                       Un día puntual se ajusta con motivo
 *                       (`mfr/esperadas-personal.ts`).
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
  esperadasPorTurno: EsperadasPorTurno;
  activo: boolean;
}

/** { turnoId: personas esperadas }. Solo los turnos donde se espera al grupo. */
export type EsperadasPorTurno = Record<string, number>;

/** Tope de sensatez: un grupo no manda miles de personas a un turno (evita errores de digitación). */
export const MAXIMO_PERSONAS_GRUPO = 500;

export interface DatosGrupo {
  codigo: string;
  nombre: string;
  descripcion: string | null;
  esperadasPorTurno: EsperadasPorTurno;
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

  const esperadasPorTurno: EsperadasPorTurno = {};
  for (const [turnoId, personas] of Object.entries(datos.esperadasPorTurno ?? {})) {
    exigir(turnoId.trim().length > 0, 'Cada valor de personas esperadas debe indicar su turno.');
    exigir(
      Number.isInteger(personas) && personas > 0 && personas <= MAXIMO_PERSONAS_GRUPO,
      `Las personas esperadas por turno deben ser un entero entre 1 y ${MAXIMO_PERSONAS_GRUPO}.`,
    );
    esperadasPorTurno[turnoId.trim()] = personas;
  }

  return { codigo, nombre, descripcion, esperadasPorTurno };
}

export interface GrupoRepository {
  listar(): Promise<Grupo[]>;
  buscarPorId(id: string): Promise<Grupo | null>;
  buscarPorCodigo(codigo: string): Promise<Grupo | null>;
  crear(datos: DatosGrupo): Promise<Grupo>;
  actualizar(id: string, cambios: Partial<DatosGrupo> & { activo?: boolean }): Promise<Grupo>;
}

export const GRUPO_REPOSITORY = Symbol('GrupoRepository');
