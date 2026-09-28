/**
 * ALMACÉN DE EVIDENCIAS — Puerto del dominio
 * ==========================================
 *
 * Dónde se guardan las fotos de las averías. La base de datos solo
 * guarda la ruta que devuelve el almacén, nunca la imagen.
 *
 * Decisión del usuario (2026-09-28): por ahora, una carpeta del servidor
 * (disco local). El almacenamiento de producción (Firebase Storage u
 * otro) se decide después; bastará con otra implementación de esta
 * interfaz. Es independiente de PERSISTENCIA: funciona igual con
 * PostgreSQL y con Firestore.
 */

import { DatosAveriaInvalidosError } from './averia.errors.js';

export interface ArchivoEvidencia {
  contenido: Uint8Array;
  tipoMime: string;
}

export interface AlmacenDeEvidencias {
  /** Guarda la foto y devuelve su ruta (p. ej. "2026/09/<id>.jpg"). */
  guardar(archivo: ArchivoEvidencia): Promise<string>;
  /** `null` si la ruta no existe. */
  leer(ruta: string): Promise<ArchivoEvidencia | null>;
  eliminar(ruta: string): Promise<void>;
}

export const ALMACEN_DE_EVIDENCIAS = Symbol('AlmacenDeEvidencias');

export const TIPOS_MIME_FOTO = ['image/jpeg', 'image/png', 'image/webp'] as const;

/**
 * Límite técnico por foto. El navegador comprime antes de subir (unos
 * cientos de KB), así que 5 MB solo lo alcanza una foto sin comprimir.
 */
export const TAMANO_MAXIMO_FOTO = 5 * 1024 * 1024;

export function validarFoto(archivo: ArchivoEvidencia, descripcion: string): void {
  if (!(TIPOS_MIME_FOTO as readonly string[]).includes(archivo.tipoMime)) {
    throw new DatosAveriaInvalidosError(`${descripcion}: debe ser una imagen JPG, PNG o WEBP.`);
  }
  if (archivo.contenido.byteLength === 0) {
    throw new DatosAveriaInvalidosError(`${descripcion}: el archivo está vacío.`);
  }
  if (archivo.contenido.byteLength > TAMANO_MAXIMO_FOTO) {
    throw new DatosAveriaInvalidosError(`${descripcion}: supera el máximo de 5 MB.`);
  }
}
