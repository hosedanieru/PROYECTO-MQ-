/**
 * ARRANQUE DE LA APLICACIÓN — MQ Backend
 * ======================================
 *
 * Además de levantar el servidor, este archivo se encarga de que el
 * proceso NUNCA muera en silencio. Un backend que se cae sin dejar
 * mensaje es imposible de diagnosticar, y en planta se traduce en
 * "el sistema no sirve" sin más información.
 *
 * Tres cosas lo garantizan:
 *
 *   1. `bootstrap()` termina en `.catch()`. Sin él, un fallo de arranque
 *      (puerto ocupado, credenciales de Firebase mal puestas, Firestore
 *      inalcanzable) es una promesa rechazada sin manejar y Node mata el
 *      proceso sin explicar por qué.
 *   2. Manejadores globales de `unhandledRejection` y
 *      `uncaughtException`, que dejan el error completo en el log.
 *   3. `enableShutdownHooks()`, para que al cerrar se ejecuten los
 *      `onModuleDestroy`: cerrar Chromium, terminar Firestore y soltar
 *      el puerto. Sin esto, cada reinicio dejaba recursos colgados.
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
import { ErrorPersistenciaFilter } from './infrastructure/http/filters/error-persistencia.filter.js';

const logger = new Logger('Bootstrap');

function detallar(error: unknown): string {
  if (error instanceof Error) return error.stack ?? `${error.name}: ${error.message}`;
  return JSON.stringify(error);
}

/**
 * Red de seguridad del proceso.
 *
 * Una promesa rechazada fuera del ciclo de una petición (un reintento de
 * gRPC de Firestore, un temporizador) tumbaría el proceso entero: es el
 * comportamiento por defecto de Node. Aquí se registra y el servidor
 * sigue atendiendo, porque tumbar la API a mitad de turno por un error
 * que no afecta a la petición en curso es peor que el error.
 *
 * `uncaughtException` sí termina el proceso: una excepción síncrona sin
 * capturar deja el estado en un punto desconocido, y seguir desde ahí
 * puede corromper datos. Se sale con código 1 para que el supervisor
 * (Docker, `--watch`) vuelva a levantar.
 */
function instalarRedDeSeguridad(): void {
  process.on('unhandledRejection', (razon) => {
    logger.error(`Promesa rechazada sin manejar: ${detallar(razon)}`);
  });

  process.on('uncaughtException', (error) => {
    logger.error(`Excepción no capturada, cerrando: ${detallar(error)}`);
    process.exit(1);
  });

  // Distingue en el log un reinicio ordenado de una caída.
  for (const senal of ['SIGINT', 'SIGTERM'] as const) {
    process.once(senal, () => {
      logger.log(`Señal ${senal} recibida: cerrando de forma ordenada…`);
    });
  }
}

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

  // Cada filtro atrapa su propia familia de errores; no se pisan.
  app.useGlobalFilters(new ErrorDominioFilter(), new ErrorPersistenciaFilter());

  // CORS para el frontend de Vite en desarrollo.
  app.enableCors({
    origin: process.env.CORS_ORIGIN ?? 'http://localhost:5173',
    credentials: true,
  });

  // Hace que SIGINT/SIGTERM disparen los onModuleDestroy antes de salir.
  app.enableShutdownHooks();

  const puerto = Number(process.env.PORT ?? 3000);

  try {
    await app.listen(puerto);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'EADDRINUSE') {
      // Caso habitual en desarrollo: quedó vivo un proceso anterior.
      throw new Error(
        `El puerto ${puerto} ya está ocupado. Probablemente quedó corriendo otra ` +
          'instancia del backend. Ciérrala (en PowerShell: ' +
          `Get-NetTCPConnection -LocalPort ${puerto} | Select-Object OwningProcess) ` +
          'o cambia PORT en el .env.',
      );
    }
    throw error;
  }

  logger.log(`API MQ escuchando en http://localhost:${puerto}/api`);
}

instalarRedDeSeguridad();

bootstrap().catch((error: unknown) => {
  logger.error(`La aplicación no pudo arrancar: ${detallar(error)}`);
  process.exit(1);
});
