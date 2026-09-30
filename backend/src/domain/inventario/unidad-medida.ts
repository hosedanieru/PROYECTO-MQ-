/**
 * UNIDAD DE MEDIDA — catálogo
 * ===========================
 *
 * La unidad base en la que se cuenta un PI o un insumo (UNIDAD, ROLLO…):
 * es la lista desplegable del formulario (usuario, 2026-09-29). Se
 * administra desde el panel; viene sembrada solo con UNIDAD para no
 * inventar nombres. No se elimina: se desactiva.
 *
 * Todo se cuenta en unidades cerradas (enteros) de la unidad base. Caja
 * y estiba NO son unidades de este catálogo: son presentaciones con su
 * equivalencia propia en cada PI o insumo (estiba → caja → unidad).
 */

import { DatosInventarioInvalidosError } from './inventario.errors.js';

export interface UnidadMedida {
  id: string;
  codigo: string;
  nombre: string;
  activo: boolean;
}

export interface DatosUnidad {
  codigo: string;
  nombre: string;
}

export function validarDatosUnidad(datos: DatosUnidad): DatosUnidad {
  const codigo = datos.codigo?.trim().toUpperCase() ?? '';
  if (!/^[A-Z0-9_-]{1,20}$/.test(codigo)) {
    throw new DatosInventarioInvalidosError('El código de la unidad: 1 a 20 letras, números, guion o guion bajo.');
  }
  const nombre = datos.nombre?.trim() ?? '';
  if (nombre.length === 0 || nombre.length > 40) {
    throw new DatosInventarioInvalidosError('El nombre de la unidad es obligatorio (máx. 40 caracteres).');
  }
  return { codigo, nombre };
}

export interface UnidadMedidaRepository {
  listar(): Promise<UnidadMedida[]>;
  buscarPorId(id: string): Promise<UnidadMedida | null>;
  buscarPorCodigo(codigo: string): Promise<UnidadMedida | null>;
  crear(datos: DatosUnidad): Promise<UnidadMedida>;
  actualizar(id: string, cambios: Partial<DatosUnidad> & { activo?: boolean }): Promise<UnidadMedida>;
}

export const UNIDAD_MEDIDA_REPOSITORY = Symbol('UnidadMedidaRepository');
