/**
 * REGISTRO DE PETICIONES
 * ======================
 *
 * Sirve para responder "¿por qué se cae el backend?" con datos en vez de
 * suposiciones. Registra tres cosas y nada más:
 *
 *   1. Las peticiones que fallan (>= 400), con su código.
 *   2. Las que tardan más de `LENTA_MS`.
 *   3. Un resumen por minuto con el total y las rutas más pedidas.
 *
 * NO imprime una línea por petición: con el tablero abierto pueden ser
 * cientos por minuto y la consola quedaría inservible, que es justo
 * cuando uno necesita leerla.
 *
 * El resumen es la pieza clave: si dice "600 peticiones en el último
 * minuto", el problema no es el servidor, es quién lo está llamando.
 */

import { Injectable, Logger, type NestMiddleware } from '@nestjs/common';
import type { NextFunction, Request, Response } from 'express';

const LENTA_MS = 1500;
const RESUMEN_MS = 60_000;

@Injectable()
export class RegistroPeticionesMiddleware implements NestMiddleware {
  private readonly logger = new Logger('Peticiones');
  private conteo = new Map<string, number>();
  private fallidas = 0;
  private ultimoResumen = Date.now();

  use(peticion: Request, respuesta: Response, siguiente: NextFunction): void {
    const inicio = Date.now();
    // `finish` se emite cuando la respuesta terminó de enviarse.
    respuesta.once('finish', () => {
      const ms = Date.now() - inicio;
      const ruta = `${peticion.method} ${peticion.baseUrl}${peticion.path}`;

      this.conteo.set(ruta, (this.conteo.get(ruta) ?? 0) + 1);

      if (respuesta.statusCode >= 400) {
        this.fallidas += 1;
        this.logger.warn(`${respuesta.statusCode} ${ruta} (${ms} ms)`);
      } else if (ms >= LENTA_MS) {
        this.logger.warn(`LENTA ${ruta} tardó ${ms} ms`);
      }

      this.resumirSiToca();
    });

    siguiente();
  }

  private resumirSiToca(): void {
    if (Date.now() - this.ultimoResumen < RESUMEN_MS) return;

    const total = [...this.conteo.values()].reduce((suma, n) => suma + n, 0);
    if (total > 0) {
      const top = [...this.conteo.entries()]
        .sort(([, a], [, b]) => b - a)
        .slice(0, 5)
        .map(([ruta, n]) => `${n}× ${ruta}`)
        .join(' · ');
      this.logger.log(`${total} peticiones en el último minuto (${this.fallidas} con error) — ${top}`);
    }

    this.conteo = new Map();
    this.fallidas = 0;
    this.ultimoResumen = Date.now();
  }
}
