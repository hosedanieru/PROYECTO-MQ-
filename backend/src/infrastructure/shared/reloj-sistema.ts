/**
 * RELOJ DEL SISTEMA
 * =================
 *
 * Implementación real de la interfaz `Reloj` que declara la capa de
 * aplicación. En pruebas se usa un reloj fijo que permite situarse en
 * cualquier instante — por ejemplo, las 02:00 de un turno T3 — sin
 * depender de cuándo se ejecuten.
 *
 * Vive en infraestructura (y no en dominio) porque depende de NestJS.
 */

import { Injectable } from '@nestjs/common';

import type { Reloj } from '../../application/remision/crear-remision.use-case.js';

@Injectable()
export class RelojSistema implements Reloj {
  ahora(): Date {
    return new Date();
  }
}
