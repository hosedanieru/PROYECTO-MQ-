/**
 * INSTANTES EN UTC — prueba de regresión
 * ======================================
 *
 * El 2026-09-28 se descubrió que cada fecha y hora se guardaba 5 horas
 * corrida: la sesión de PostgreSQL estaba en America/Bogota y el
 * adaptador de Prisma envía las fechas sin zona. La aplicación no lo
 * notaba porque al leer se deshacía el error. Estas pruebas miran la
 * base por DEBAJO de Prisma (SQL directo), que es donde se veía.
 *
 * Si alguien crea una conexión sin `crearAdaptadorPostgres()`, fallan.
 */

import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { catalogosBase, limpiarDatos, prisma, type CatalogosBase } from './ayudantes.js';

let base: CatalogosBase;

beforeAll(async () => {
  await limpiarDatos();
  base = await catalogosBase();
});

afterAll(async () => {
  await limpiarDatos();
  await prisma.$disconnect();
});

describe('instantes en UTC', () => {
  it('la sesión de la aplicación está en UTC', async () => {
    const [fila] = await prisma.$queryRaw<Array<{ zona: string }>>`SELECT current_setting('TimeZone') AS zona`;
    expect(fila.zona).toBe('UTC');
  });

  it('lo que Prisma guarda es el mismo instante que ve SQL', async () => {
    // 12:46 en Bogotá.
    const instante = new Date('2026-09-28T17:46:05.000Z');
    const creada = await prisma.auditoria.create({
      data: { entidad: 'prueba_zona', entidadId: 'x', accion: 'CREAR', usuarioId: base.adminId, creadoEn: instante },
    });

    const [fila] = await prisma.$queryRaw<Array<{ epoch: number; bogota: string }>>`
      SELECT extract(epoch FROM creado_en)::float8 AS epoch,
             to_char(creado_en AT TIME ZONE 'America/Bogota', 'HH24:MI') AS bogota
      FROM auditoria WHERE id = ${creada.id}`;

    expect(fila.epoch * 1000).toBe(instante.getTime());
    expect(fila.bogota).toBe('12:46');
  });

  it('la hora que pone la base (now()) se lee como la hora real', async () => {
    const [fila] = await prisma.$queryRaw<Array<{ ahora: Date }>>`SELECT now() AS ahora`;
    expect(Math.abs(fila.ahora.getTime() - Date.now())).toBeLessThan(60_000);
  });
});
