/**
 * ARRANQUE DE LA APLICACIÓN — MQ Backend
 * ======================================
 */

// Carga .env antes de que cualquier módulo lea process.env (DATABASE_URL, PORT,
// OBSERVE_*). NestJS no lo hace por sí solo; solo la CLI de Prisma lo carga vía
// prisma.config.ts.
import 'dotenv/config';

import { Logger, ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';

import {
  AppModule,
  ObserveInstrument,
  observeHabilitado,
} from './app.module.js';
import { ErrorDominioFilter } from './infrastructure/http/filters/error-dominio.filter.js';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule, {
    instrument: observeHabilitado ? ObserveInstrument : undefined,
  });

  app.setGlobalPrefix('api');

  app.useGlobalPipes(
    new ValidationPipe({
      // Descarta cualquier campo que no esté declarado en el DTO.
      whitelist: true,
      // Y además responde con error si llegan campos desconocidos, en
      // lugar de ignorarlos en silencio: un typo en el nombre de un
      // campo debe fallar, no perderse.
      forbidNonWhitelisted: true,
      // Convierte tipos según los decoradores (por ejemplo, la cadena
      // de fecha a objeto Date).
      transform: true,
    }),
  );

  app.useGlobalFilters(new ErrorDominioFilter());

  // CORS para el frontend de Vite en desarrollo.
  app.enableCors({
    origin: process.env.CORS_ORIGIN ?? 'http://localhost:5173',
    credentials: true,
  });

  const puerto = Number(process.env.PORT ?? 3000);
  await app.listen(puerto);

  new Logger('Bootstrap').log(
    `API MQ escuchando en http://localhost:${puerto}/api`,
  );
}

void bootstrap();
