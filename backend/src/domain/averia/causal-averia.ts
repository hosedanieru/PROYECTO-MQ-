/**
 * CAUSAL DE AVERÍA — Catálogo
 * ===========================
 *
 * Las causales "generalizadas" del formulario de averías (Estallado,
 * Bajo de aire, Bolsa - rota…). Decisión del usuario (2026-09-28): viven
 * en la base de datos y se administran desde el panel, no fijas en el
 * código, para que el área pueda agregar una sin tocar el sistema.
 *
 *   orden   posición en la lista desplegable (menor primero).
 *
 * Sin valor por defecto: en el formulario anterior "Estallado" venía
 * preseleccionado y quien no cambiaba la lista lo registraba sin
 * elegirlo. Aquí la causal siempre la elige la persona.
 *
 * No se elimina: una causal usada en reportes se desactiva.
 */

import { DatosCausalInvalidosError } from './averia.errors.js';

export interface CausalAveria {
  id: string;
  codigo: string;
  nombre: string;
  orden: number;
  activo: boolean;
}

export interface DatosCausal {
  codigo: string;
  nombre: string;
  orden: number;
}

export function validarDatosCausal(datos: DatosCausal): DatosCausal {
  const exigir = (condicion: boolean, mensaje: string): void => {
    if (!condicion) throw new DatosCausalInvalidosError(mensaje);
  };

  const codigo = datos.codigo?.trim().toUpperCase() ?? '';
  exigir(/^[A-Z0-9_-]{1,40}$/.test(codigo), 'El código de la causal: 1 a 40 letras, números, guion o guion bajo.');

  const nombre = datos.nombre?.trim() ?? '';
  exigir(nombre.length > 0 && nombre.length <= 100, 'El nombre de la causal es obligatorio (máx. 100 caracteres).');

  exigir(Number.isInteger(datos.orden) && datos.orden >= 0, 'El orden debe ser un entero mayor o igual a cero.');

  return { codigo, nombre, orden: datos.orden };
}

/** Orden de la lista desplegable: por `orden` y, a igual orden, por nombre. */
export function ordenarCausales(causales: CausalAveria[]): CausalAveria[] {
  return [...causales].sort((a, b) => a.orden - b.orden || a.nombre.localeCompare(b.nombre, 'es'));
}

export interface CausalAveriaRepository {
  /** Todas (activas e inactivas), ya ordenadas para la lista. */
  listar(): Promise<CausalAveria[]>;
  buscarPorId(id: string): Promise<CausalAveria | null>;
  buscarPorCodigo(codigo: string): Promise<CausalAveria | null>;
  crear(datos: DatosCausal): Promise<CausalAveria>;
  actualizar(id: string, cambios: Partial<DatosCausal> & { activo?: boolean }): Promise<CausalAveria>;
}

export const CAUSAL_AVERIA_REPOSITORY = Symbol('CausalAveriaRepository');
