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
 */

import { PrismaPg } from '@prisma/adapter-pg';

export const OPCIONES_SESION_POSTGRES = '-c TimeZone=UTC';

export function crearAdaptadorPostgres(connectionString = process.env.DATABASE_URL): PrismaPg {
  return new PrismaPg({ connectionString, options: OPCIONES_SESION_POSTGRES });
}
