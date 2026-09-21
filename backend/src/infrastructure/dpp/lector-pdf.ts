/**
 * LECTOR DE PDF — texto plano
 * ===========================
 *
 * Extrae el texto de un PDF con `pdf-parse` (pdf.js). Es todo lo que la
 * infraestructura sabe del DPP: interpretarlo es del dominio
 * (`domain/mfr/dpp-pepsico.ts`), que solo recibe texto.
 *
 * `pdf-parse` conserva los saltos de línea y separa las celdas con
 * tabuladores, que es justo lo que el lector del dominio espera.
 */

import { Injectable } from '@nestjs/common';
import { PDFParse } from 'pdf-parse';

import { DppNoReconocidoError } from '../../domain/mfr/mfr.errors.js';

@Injectable()
export class LectorPdfService {
  async extraerTexto(archivo: Buffer): Promise<string> {
    if (archivo.subarray(0, 5).toString('latin1') !== '%PDF-') {
      throw new DppNoReconocidoError('El archivo no es un PDF.');
    }
    const parser = new PDFParse({ data: archivo });
    try {
      const resultado = await parser.getText();
      return resultado.text;
    } catch (error) {
      throw new DppNoReconocidoError(`No se pudo leer el PDF: ${error instanceof Error ? error.message : String(error)}`);
    } finally {
      await parser.destroy().catch(() => undefined);
    }
  }
}
