import { Module } from '@nestjs/common';

import { GENERADOR_PDF_REMISION } from '../../domain/remision/generador-pdf.js';
import { GENERADOR_PDF_RESUMEN } from '../../domain/resumen/resumen-turno.js';
import { PuppeteerPdfService } from './puppeteer-pdf.service.js';

/**
 * Generación de PDF compartida. Un único `PuppeteerPdfService` (un solo
 * Chromium abierto) atiende los dos puertos; si cada módulo registrara el
 * suyo, habría un navegador por módulo.
 */
@Module({
  providers: [
    PuppeteerPdfService,
    { provide: GENERADOR_PDF_REMISION, inject: [PuppeteerPdfService], useFactory: (pdf: PuppeteerPdfService) => pdf.remisiones },
    { provide: GENERADOR_PDF_RESUMEN, inject: [PuppeteerPdfService], useFactory: (pdf: PuppeteerPdfService) => pdf.resumen },
  ],
  exports: [GENERADOR_PDF_REMISION, GENERADOR_PDF_RESUMEN],
})
export class PdfModule {}
