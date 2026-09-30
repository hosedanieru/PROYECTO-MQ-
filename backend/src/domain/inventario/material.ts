/**
 * MATERIALES: PI E INSUMOS
 * ========================
 *
 * Lo que se consume para armar el PT (usuario, 2026-09-29):
 *   PI       producto intermedio: lo que llega de PepsiCo para reempaque
 *   INSUMO   cajas, cintas, bolsas…
 *
 * Cada uno vive en SU tabla ("una tabla por cada tipo"), pero tienen la
 * misma forma, así que comparten reglas aquí en lugar de duplicarlas.
 *
 * Medición (usuario, 2026-09-29, versión con decimales):
 *   - `unidadBase` es la MEDIDA en que se lleva la existencia y en que el
 *     PT lo descuenta: METRO para la cinta, UNIDAD para una bolsa… Admite
 *     decimales (ver cantidad.ts).
 *   - `presentacion` + `contenidoPresentacion`: cómo viene empacado y
 *     cuánto trae. Ej.: ROLLO con 50 METRO. Opcional (una bolsa se cuenta
 *     por unidad y no necesita presentación).
 *   - Escalones hacia arriba, opcionales y enteros: `unidadesPorCaja`
 *     (cuántas presentaciones trae una caja; si no hay presentación, cuántas
 *     unidades base) y `cajasPorEstiba`. Estiba → caja → presentación → medida.
 *
 * El código no se repite entre PI e insumos: en una entrada de mercancía
 * se busca por código y no puede haber dos cosas distintas con el mismo.
 */

import { DECIMALES_CANTIDAD, esCantidadPositiva } from './cantidad.js';
import { DatosInventarioInvalidosError } from './inventario.errors.js';

export const TIPOS_MATERIAL = ['PI', 'INSUMO'] as const;
export type TipoMaterial = (typeof TIPOS_MATERIAL)[number];

export interface Material {
  id: string;
  tipo: TipoMaterial;
  codigo: string;
  descripcion: string;
  unidadBaseId: string;
  /** Código de la medida (METRO, UNIDAD…), para mostrar. */
  unidadBase: string;
  presentacionId: string | null;
  /** Código de la presentación (ROLLO…), para mostrar. */
  presentacion: string | null;
  /** Cuánto de la medida trae una presentación (50 metros por rollo). */
  contenidoPresentacion: number | null;
  unidadesPorCaja: number | null;
  cajasPorEstiba: number | null;
  activo: boolean;
}

export interface DatosMaterial {
  codigo: string;
  descripcion: string;
  unidadBaseId: string;
  presentacionId: string | null;
  contenidoPresentacion: number | null;
  unidadesPorCaja: number | null;
  cajasPorEstiba: number | null;
}

export function validarDatosMaterial(datos: DatosMaterial): DatosMaterial {
  const exigir = (condicion: boolean, mensaje: string): void => {
    if (!condicion) throw new DatosInventarioInvalidosError(mensaje);
  };
  const codigo = datos.codigo?.trim().toUpperCase() ?? '';
  exigir(/^[A-Z0-9._-]{1,40}$/.test(codigo), 'El código: 1 a 40 letras, números, punto, guion o guion bajo.');
  const descripcion = datos.descripcion?.trim() ?? '';
  exigir(descripcion.length > 0 && descripcion.length <= 200, 'La descripción es obligatoria (máx. 200 caracteres).');
  const unidadBaseId = datos.unidadBaseId?.trim() ?? '';
  exigir(unidadBaseId !== '', 'La unidad de medida es obligatoria.');

  const presentacionId = datos.presentacionId?.trim() || null;
  const contenido = datos.contenidoPresentacion ?? null;
  // La presentación sin su contenido (o al revés) no dice nada.
  exigir((presentacionId === null) === (contenido === null), 'La presentación y su contenido van juntos (ej.: ROLLO con 50 metros).');
  exigir(presentacionId === null || presentacionId !== unidadBaseId, 'La presentación debe ser distinta de la unidad de medida.');
  exigir(contenido === null || esCantidadPositiva(contenido), `El contenido de la presentación debe ser mayor que cero, con máximo ${DECIMALES_CANTIDAD} decimales.`);

  for (const [valor, nombre] of [
    [datos.unidadesPorCaja, 'Las unidades por caja'],
    [datos.cajasPorEstiba, 'Las cajas por estiba'],
  ] as const) {
    exigir(valor === null || (Number.isInteger(valor) && valor > 0), `${nombre} deben ser un entero mayor que cero.`);
  }
  // Estiba → caja → …: sin saber qué trae una caja, la estiba no se puede convertir.
  exigir(datos.cajasPorEstiba === null || datos.unidadesPorCaja !== null, 'Para manejar estibas hay que definir primero las unidades por caja.');
  return {
    codigo,
    descripcion,
    unidadBaseId,
    presentacionId,
    contenidoPresentacion: contenido,
    unidadesPorCaja: datos.unidadesPorCaja,
    cajasPorEstiba: datos.cajasPorEstiba,
  };
}

export interface MaterialRepository {
  listar(tipo?: TipoMaterial): Promise<Material[]>;
  buscarPorId(tipo: TipoMaterial, id: string): Promise<Material | null>;
  /** Busca el código en PI y en insumos: no se puede repetir entre los dos. */
  buscarPorCodigo(codigo: string): Promise<Material | null>;
  crear(tipo: TipoMaterial, datos: DatosMaterial): Promise<Material>;
  actualizar(tipo: TipoMaterial, id: string, cambios: Partial<DatosMaterial> & { activo?: boolean }): Promise<Material>;
}

export const MATERIAL_REPOSITORY = Symbol('MaterialRepository');
