/**
 * REGISTRO DE AVERÍA — reglas de negocio
 * ======================================
 *
 * Un reporte de averías (encabezado: fecha, turno, grupo, quién reporta)
 * lleva uno o más registros, uno por cada fila de "Agregar avería" del
 * formulario del área (2026-09-28). Este archivo tiene las reglas de UN
 * registro y la conversión de unidades; el reporte se arma en la fase 2.
 *
 * Alcance inicial: solo PT (producto terminado, catálogo `producto`, por
 * código SAP). Las averías de PI (producto intermedio) e insumos llegan
 * con Inventario.
 *
 * Cada registro exige las 3 fotos del formulario: la unidad, el lote y la
 * fecha, y el conjunto. Son la trazabilidad del reporte.
 *
 * Sin línea (área, 2026-09-28): las cajas con averías a veces llegan sin
 * que nadie sepa de qué línea vienen, así que el dato no sería confiable.
 * Se quitó "por ahora"; si vuelve, se agrega como campo opcional.
 */

import { DatosAveriaInvalidosError } from './averia.errors.js';

export const UNIDADES_MEDIDA_AVERIA = ['UNIDAD', 'DOCENA', 'SIX', 'BOLSA'] as const;
export type UnidadMedidaAveria = (typeof UNIDADES_MEDIDA_AVERIA)[number];

export const TIPOS_EVIDENCIA = ['UNIDAD', 'LOTE_FECHA', 'CONJUNTO'] as const;
export type TipoEvidencia = (typeof TIPOS_EVIDENCIA)[number];

/**
 * Unidades que equivalen a una unidad de medida.
 *
 * `BOLSA`: PENDIENTE DE DEFINIR con el área (¿cuántas unidades trae?
 * ¿depende del producto?). Mientras sea `null`, las bolsas se registran
 * pero no se convierten: el total las reporta aparte y no entran al %.
 */
export const UNIDADES_POR_MEDIDA: Record<UnidadMedidaAveria, number | null> = {
  UNIDAD: 1,
  DOCENA: 12,
  SIX: 6,
  BOLSA: null,
};

export interface EvidenciaAveria {
  tipo: TipoEvidencia;
  /** Ruta del archivo en el almacén de evidencias (no la imagen). */
  ruta: string;
}

export interface DatosRegistroAveria {
  productoId: string;
  fechaVencimiento: Date;
  /** Texto libre, como viene impreso: "L127 23:33 DD AM". */
  lote: string;
  causalId: string;
  cantidad: number;
  unidadMedida: UnidadMedidaAveria;
  evidencias: EvidenciaAveria[];
}

export const LARGO_MAXIMO_LOTE = 60;

export function validarRegistroAveria(datos: DatosRegistroAveria): DatosRegistroAveria {
  const campos = validarCamposRegistro(datos);
  validarEvidencias(datos.evidencias ?? []);
  return { ...campos, evidencias: datos.evidencias };
}

export type CamposRegistroAveria = Omit<DatosRegistroAveria, 'evidencias'>;

/**
 * Todo menos las fotos. Se usa por separado al crear: los datos se
 * validan ANTES de guardar las fotos, para no dejar archivos huérfanos
 * cuando el registro viene mal.
 */
export function validarCamposRegistro(datos: CamposRegistroAveria): CamposRegistroAveria {
  const exigir = (condicion: boolean, mensaje: string): void => {
    if (!condicion) throw new DatosAveriaInvalidosError(mensaje);
  };

  exigir(!!datos.productoId?.trim(), 'El producto es obligatorio.');
  exigir(!!datos.causalId?.trim(), 'La causal de avería es obligatoria.');
  exigir(
    datos.fechaVencimiento instanceof Date && !Number.isNaN(datos.fechaVencimiento.getTime()),
    'La fecha de vencimiento es obligatoria.',
  );

  const lote = datos.lote?.trim() ?? '';
  exigir(lote.length > 0 && lote.length <= LARGO_MAXIMO_LOTE, `El lote es obligatorio (máx. ${LARGO_MAXIMO_LOTE} caracteres).`);

  exigir(Number.isInteger(datos.cantidad) && datos.cantidad > 0, 'La cantidad debe ser un entero mayor que cero.');
  exigir(UNIDADES_MEDIDA_AVERIA.includes(datos.unidadMedida), 'La unidad de medida no es válida.');

  return {
    productoId: datos.productoId.trim(),
    fechaVencimiento: datos.fechaVencimiento,
    lote,
    causalId: datos.causalId.trim(),
    cantidad: datos.cantidad,
    unidadMedida: datos.unidadMedida,
  };
}

/** Exactamente una foto de cada tipo: unidad, lote y fecha, y conjunto. */
export function validarEvidencias(evidencias: ReadonlyArray<{ tipo: TipoEvidencia; ruta: string }>): void {
  const faltan = TIPOS_EVIDENCIA.filter((tipo) => !evidencias.some((e) => e.tipo === tipo && e.ruta?.trim()));
  if (faltan.length > 0) {
    throw new DatosAveriaInvalidosError(`Faltan fotos de evidencia: ${faltan.join(', ')}.`);
  }
  if (evidencias.length !== TIPOS_EVIDENCIA.length) {
    throw new DatosAveriaInvalidosError('Cada registro lleva exactamente 3 fotos: unidad, lote y fecha, y conjunto.');
  }
}

export interface TotalAverias {
  /** Unidades de todo lo que tiene factor de conversión. */
  unidades: number;
  /** Cantidades que no se pudieron convertir, por unidad de medida (hoy: BOLSA). */
  sinConvertir: Partial<Record<UnidadMedidaAveria, number>>;
}

/**
 * Total del reporte en unidades. Se calcula, no se almacena: así nunca
 * queda desincronizado con los registros (p. ej. cuando el administrador
 * corrige uno).
 */
export function totalizarUnidades(registros: ReadonlyArray<Pick<DatosRegistroAveria, 'cantidad' | 'unidadMedida'>>): TotalAverias {
  const total: TotalAverias = { unidades: 0, sinConvertir: {} };
  for (const r of registros) {
    const factor = UNIDADES_POR_MEDIDA[r.unidadMedida];
    if (factor === null) {
      total.sinConvertir[r.unidadMedida] = (total.sinConvertir[r.unidadMedida] ?? 0) + r.cantidad;
    } else {
      total.unidades += r.cantidad * factor;
    }
  }
  return total;
}
