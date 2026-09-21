/**
 * GENERADOR DE PDF — Puerto
 * =========================
 *
 * El dominio solo sabe que "una lista de remisiones se convierte en un
 * documento imprimible". Que por debajo sea Puppeteer, PDFKit u otro es
 * infraestructura; si se cambia, los casos de uso no se enteran.
 *
 * Recibe los datos ya resueltos (nombres de turno y grupo, no ids)
 * porque el formato impreso muestra nombres y el generador no debe
 * consultar catálogos.
 */

import type { Remision } from './remision.entity.js';

export interface RemisionParaImprimir {
  remision: Remision;
  turno: string;
  grupo: string;
  lugar: string;
}

export interface GeneradorPdfRemision {
  /**
   * Genera un PDF con las remisiones indicadas, dos por hoja (así lo
   * maneja el área; es ahorro de papel, no una relación entre ellas).
   */
  generar(remisiones: RemisionParaImprimir[]): Promise<Buffer>;
}

export const GENERADOR_PDF_REMISION = Symbol('GeneradorPdfRemision');
