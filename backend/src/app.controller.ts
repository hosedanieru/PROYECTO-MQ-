/**
 * COMPROBACIÓN DE VIDA
 * ====================
 *
 * `GET /api` responde sin token. No es un endpoint decorativo: es el
 * healthcheck del contenedor del backend en
 * `infrastructure/docker-compose.yml`, y el frontend solo arranca cuando
 * este responde (`depends_on: service_healthy`). Si se elimina, el
 * despliegue con Docker se queda esperando indefinidamente.
 *
 * Responde únicamente que el proceso está vivo. NO consulta la base de
 * datos a propósito: un healthcheck que depende de la base reinicia el
 * contenedor de la API cuando el problema está en otra parte.
 */

import { Controller, Get } from '@nestjs/common';

import { Publico } from './infrastructure/auth/decoradores.js';

@Controller()
export class AppController {
  @Publico()
  @Get()
  estado(): { estado: string; servicio: string } {
    return { estado: 'ok', servicio: 'mq-backend' };
  }
}
