/**
 * LÍNEA DE PRODUCCIÓN
 * ===================
 *
 * Activo físico con identidad estable. Lo confirmó el DPP de PepsiCo
 * (2026-09-18): el schedule se emite por línea y cada una tiene un
 * tipo de máquina y una capacidad nominal en kg/h:
 *
 *   L1..L4            MULTIPACK   306 kg/h
 *   MANUAL 1, 2       MANUAL      249 kg/h
 *   REEMPAQU 2,
 *   REEMPAQUES        MANUAL      203 kg/h
 *
 * `capacidadKgHora` alimenta el "Pct Overpull" del DPP (carga de la
 * línea respecto a su capacidad nominal). `orden` define cómo se
 * listan las líneas en pantalla, igual que en el PDF.
 */

import { DatosMfrInvalidosError } from './mfr.errors.js';

export const TIPOS_LINEA = ['MULTIPACK', 'MANUAL'] as const;
export type TipoLinea = (typeof TIPOS_LINEA)[number];

export interface LineaProduccion {
  id: string;
  codigo: string;
  nombre: string;
  tipo: TipoLinea;
  /** Capacidad nominal según PepsiCo; null si no se conoce (sin Overpull). */
  capacidadKgHora: number | null;
  orden: number;
  activo: boolean;
}

export interface DatosLinea {
  codigo: string;
  nombre: string;
  tipo: TipoLinea;
  capacidadKgHora: number | null;
  orden: number;
}

export function validarLinea(datos: DatosLinea): DatosLinea {
  const codigo = datos.codigo?.trim() ?? '';
  const nombre = datos.nombre?.trim() ?? '';
  if (!/^[A-Za-z0-9-]{1,20}$/.test(codigo)) {
    throw new DatosMfrInvalidosError('El código de la línea debe tener entre 1 y 20 caracteres alfanuméricos.');
  }
  if (!nombre) {
    throw new DatosMfrInvalidosError('El nombre de la línea es obligatorio.');
  }
  if (!TIPOS_LINEA.includes(datos.tipo)) {
    throw new DatosMfrInvalidosError(`El tipo de línea debe ser uno de: ${TIPOS_LINEA.join(', ')}.`);
  }
  if (datos.capacidadKgHora !== null && !(Number.isFinite(datos.capacidadKgHora) && datos.capacidadKgHora > 0)) {
    throw new DatosMfrInvalidosError('La capacidad en kg/h debe ser un número mayor que cero.');
  }
  if (!Number.isInteger(datos.orden) || datos.orden < 0) {
    throw new DatosMfrInvalidosError('El orden debe ser un entero mayor o igual a cero.');
  }
  return { codigo: codigo.toUpperCase(), nombre, tipo: datos.tipo, capacidadKgHora: datos.capacidadKgHora, orden: datos.orden };
}

/**
 * Clave para cruzar la línea con el nombre que trae el DPP ("MANUAL 1",
 * "REEMPAQU 2"): solo letras y números, en mayúsculas. Así "MANUAL-1",
 * "Manual 1" y "MANUAL 1" son la misma línea.
 */
export function claveLinea(texto: string): string {
  return texto.toUpperCase().replace(/[^A-Z0-9]/g, '');
}

export interface LineaRepository {
  listar(): Promise<LineaProduccion[]>;
  buscarPorId(id: string): Promise<LineaProduccion | null>;
  buscarPorCodigo(codigo: string): Promise<LineaProduccion | null>;
  crear(datos: DatosLinea): Promise<LineaProduccion>;
  actualizar(id: string, cambios: Partial<DatosLinea> & { activo?: boolean }): Promise<LineaProduccion>;
}

export const LINEA_REPOSITORY = Symbol('LineaRepository');
