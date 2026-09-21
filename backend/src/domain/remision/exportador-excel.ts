/**
 * EXPORTADOR A EXCEL — Puerto
 * ===========================
 *
 * Igual que el PDF: el dominio define qué se exporta (filas con nombres
 * resueltos) y la infraestructura decide cómo se escribe el archivo.
 *
 * Las columnas replican el Excel actual del área (`REMISIONES GUARDADAS
 * 2026`) para que reconozcan el formato, pero con los datos ya
 * estructurados: estibas completas y sueltas en columnas separadas, y
 * los números de estiba en su propia columna, no dentro de las
 * observaciones.
 */

import type { RemisionParaImprimir } from './generador-pdf.js';

export interface ExportadorExcelRemision {
  generar(remisiones: RemisionParaImprimir[]): Promise<Buffer>;
}

export const EXPORTADOR_EXCEL_REMISION = Symbol('ExportadorExcelRemision');
