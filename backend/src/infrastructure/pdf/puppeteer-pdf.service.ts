/**
 * GENERADOR DE PDF — Implementación con Puppeteer
 * ===============================================
 *
 * Renderiza la plantilla HTML en un Chromium sin interfaz y lo imprime a
 * PDF. El navegador se abre UNA vez (al primer uso) y se reutiliza: cada
 * PDF abre y cierra solo una pestaña. Abrir Chromium por petición
 * tardaría segundos.
 *
 * Resiliencia: si Chromium se cierra o muere (suspensión del equipo,
 * proceso terminado, fallo interno), el servicio lo detecta y lo vuelve
 * a lanzar en la siguiente petición en vez de responder 500 para siempre.
 * Un PDF que falla se reintenta una vez con navegador nuevo.
 *
 * Al apagar la aplicación (`onModuleDestroy`) se cierra el navegador
 * para no dejar procesos huérfanos.
 *
 * Decisión del usuario (2026-09-16): Puppeteer en lugar de PDFKit, por
 * diseñar el formato en HTML/CSS. Costo: Chromium (~150 MB) en la
 * instalación y en la imagen Docker.
 */

import { Injectable, Logger, type OnModuleDestroy } from '@nestjs/common';
import puppeteer, { type Browser } from 'puppeteer';

import type {
  GeneradorPdfRemision,
  RemisionParaImprimir,
} from '../../domain/remision/generador-pdf.js';
import type { GeneradorPdfResumen, ResumenTurno } from '../../domain/resumen/resumen-turno.js';
import { plantillaRemisiones } from './plantilla-remision.js';
import { plantillaResumen } from './plantilla-resumen.js';

/**
 * Un solo servicio (y un solo Chromium) para todos los PDF: remisiones y
 * resumen del turno. Lo entrega `PdfModule` con los dos tokens.
 */
@Injectable()
export class PuppeteerPdfService implements OnModuleDestroy {
  private readonly logger = new Logger(PuppeteerPdfService.name);
  private navegador: Promise<Browser> | null = null;

  /** Puerto de las remisiones. */
  readonly remisiones: GeneradorPdfRemision = {
    // Mientras no haya aval de PepsiCo y del área legal, las firmas se marcan como piloto.
    generar: (remisiones: RemisionParaImprimir[]) =>
      this.html(plantillaRemisiones(remisiones, { pilotoFirmas: process.env.FIRMA_ELECTRONICA_PILOTO !== 'false' })),
  };

  /** Puerto del resumen del turno / del día. */
  readonly resumen: GeneradorPdfResumen = {
    generar: (resumen: ResumenTurno) => this.html(plantillaResumen(resumen)),
  };

  private async html(html: string): Promise<Buffer> {
    try {
      return await this.imprimir(html);
    } catch (error) {
      // Navegador muerto o pestaña rota: se descarta y se reintenta una vez.
      this.logger.warn(`PDF falló (${mensajeDe(error)}); relanzando Chromium y reintentando…`);
      await this.descartarNavegador();
      return this.imprimir(html);
    }
  }

  private async imprimir(html: string): Promise<Buffer> {
    const navegador = await this.obtenerNavegador();
    const pagina = await navegador.newPage();
    try {
      await pagina.setContent(html, { waitUntil: 'load' });
      const pdf = await pagina.pdf({ format: 'letter', printBackground: true, preferCSSPageSize: true });
      return Buffer.from(pdf);
    } finally {
      await pagina.close().catch(() => undefined);
    }
  }

  private obtenerNavegador(): Promise<Browser> {
    if (!this.navegador) {
      this.logger.log('Iniciando Chromium para generación de PDF…');
      this.navegador = puppeteer
        .launch({
          headless: true,
          // Necesarios en contenedores sin sandbox de usuario (Docker).
          args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'],
        })
        .then((navegador) => {
          // Si Chromium se cierra por fuera, la próxima petición lo relanza.
          navegador.once('disconnected', () => {
            this.logger.warn('Chromium se desconectó; se relanzará en la próxima petición.');
            this.navegador = null;
          });
          return navegador;
        })
        .catch((error: unknown) => {
          this.navegador = null;
          throw error;
        });
    }
    return this.navegador;
  }

  private async descartarNavegador(): Promise<void> {
    const pendiente = this.navegador;
    this.navegador = null;
    if (pendiente) {
      const navegador = await pendiente.catch(() => null);
      await navegador?.close().catch(() => undefined);
    }
  }

  async onModuleDestroy(): Promise<void> {
    await this.descartarNavegador();
  }
}

function mensajeDe(error: unknown): string {
  return error instanceof Error ? error.message.split('\n')[0] : String(error);
}
