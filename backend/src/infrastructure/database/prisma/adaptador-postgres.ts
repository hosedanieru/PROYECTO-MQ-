/**
 * CONEXIÓN A POSTGRESQL — siempre en UTC
 * ======================================
 *
 * ÚNICO lugar donde se crea el adaptador de Prisma para PostgreSQL. El
 * servicio de la aplicación, el seed, los datos demo, las pruebas y los
 * scripts lo usan; nadie debe hacer `new PrismaPg(...)` por su cuenta.
 *
 * Por qué la sesión va en UTC (hallado el 2026-09-28):
 *
 *   `@prisma/adapter-pg` envía las fechas como hora UTC SIN indicar la
 *   zona. Si la sesión de la base está en `America/Bogota` (lo que trae
 *   PostgreSQL instalado en un Windows de Colombia), la base interpreta
 *   ese valor como hora de Bogotá y lo guarda 5 horas corrido. Al leer
 *   pasa lo inverso, así que la aplicación "se veía bien", pero la base
 *   guardaba mal el instante y lo que generaba la propia base (`now()`)
 *   se leía 5 horas atrasado.
 *
 *   Con la sesión en UTC no hay nada que interpretar: lo que se envía es
 *   lo que se guarda. La hora de Colombia se aplica solo al MOSTRAR
 *   (frontend, PDF, Excel) y al calcular la fecha operativa (dominio).
 *
 * Se fija en la conexión, no en la configuración del servidor, para que
 * no dependa de cómo se instaló PostgreSQL en cada equipo.
 *
 * Por qué el pool lleva límites de espera (hallado el 2026-10-09):
 *
 *   Sin `connectionTimeoutMillis`, `pg-pool` deja esperando PARA SIEMPRE
 *   a una petición que no consigue conexión (base caída, pool agotado,
 *   equipo que volvió de suspensión). El navegador se rinde a los 15 s,
 *   pero en el backend la petición sigue viva y se acumula con las del
 *   siguiente refresco: el servidor "está arriba" y no responde. Con el
 *   límite falla rápido, responde error y se recupera solo.
 *
 *   `keepAlive` hace que el sistema operativo detecte las conexiones que
 *   murieron sin avisar (red caída, suspensión) en vez de usarlas a ciegas.
 */

import { PrismaPg } from '@prisma/adapter-pg';

export const OPCIONES_SESION_POSTGRES = '-c TimeZone=UTC';

/** Cuánto espera una consulta por una conexión libre antes de fallar. */
export const ESPERA_MAXIMA_CONEXION_MS = 10_000;

export function crearAdaptadorPostgres(connectionString = process.env.DATABASE_URL): PrismaPg {
  return new PrismaPg({
    connectionString,
    options: OPCIONES_SESION_POSTGRES,
    connectionTimeoutMillis: ESPERA_MAXIMA_CONEXION_MS,
    keepAlive: true,
  });
}
