/**
 * INVENTARIO CONTRA POSTGRESQL
 * ============================
 *
 * Lo que solo se puede probar con la base real: el bloqueo de fila del
 * ítem. Dos salidas simultáneas sobre la misma existencia no pueden
 * pasar las dos (quedaría en negativo), y el kardex debe cuadrar con la
 * existencia guardada.
 */

import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import {
  CrearItemUseCase,
  RegistrarEntradaMercanciaUseCase,
  RegistrarMovimientoUseCase,
} from '../src/application/inventario/inventario.use-cases.js';
import { ExistenciaInsuficienteError } from '../src/domain/inventario/inventario.errors.js';
import type { DiaSemana, HorarioRepository } from '../src/domain/mfr/horas-turno.js';
import { PrismaService } from '../src/infrastructure/database/prisma/prisma.service.js';
import { UnidadDeTrabajoPrisma } from '../src/infrastructure/persistence/prisma/unidad-de-trabajo.prisma.js';
import { catalogosBase, limpiarDatos, prisma, type CatalogosBase } from './ayudantes.js';

const DIAS: DiaSemana[] = ['LUNES', 'MARTES', 'MIERCOLES', 'JUEVES', 'VIERNES', 'SABADO', 'DOMINGO'];
const RELOJ = { ahora: () => new Date('2026-09-29T08:00:00-05:00') };

let servicio: PrismaService;
let base: CatalogosBase;
let registrar: RegistrarMovimientoUseCase;
let crear: CrearItemUseCase;
let horarios: HorarioRepository;

beforeAll(async () => {
  servicio = new PrismaService();
  await servicio.$connect();
  base = await catalogosBase();
  // Un solo turno que cubre el día: cualquier hora cae en él.
  horarios = {
    vigentesEn: () =>
      Promise.resolve(DIAS.map((diaSemana) => ({ turnoId: base.turnoId, diaSemana, horaInicio: '06:00', horaFin: '05:59', cruzaMedianoche: true }))),
  };
  const uow = new UnidadDeTrabajoPrisma(servicio);
  registrar = new RegistrarMovimientoUseCase(uow, horarios, RELOJ);
  crear = new CrearItemUseCase(uow);
});

beforeEach(async () => {
  await limpiarDatos();
});

afterAll(async () => {
  await limpiarDatos();
  await servicio.$disconnect();
  await prisma.$disconnect();
});

const salida = (itemId: string, cantidad: number) =>
  registrar.ejecutar({ itemId, tipo: 'SALIDA', cantidad, referencia: null, observacion: null, motivo: null, usuarioId: base.adminId });

describe('inventario contra PostgreSQL', () => {
  it('dos salidas simultáneas no sacan la misma existencia', async () => {
    const item = await crear.ejecutar({ tipo: 'INSUMO', codigo: 'CINTA-48', descripcion: 'Cinta 48 mm', unidadMedida: 'ROLLO', productoId: null, usuarioId: base.adminId });
    await registrar.ejecutar({ itemId: item.id, tipo: 'ENTRADA', cantidad: 100, referencia: null, observacion: null, motivo: null, usuarioId: base.adminId });

    // Cada una cabe sola (60 ≤ 100), pero no las dos juntas (120 > 100).
    const resultados = await Promise.allSettled([salida(item.id, 60), salida(item.id, 60)]);

    expect(resultados.filter((r) => r.status === 'fulfilled')).toHaveLength(1);
    const fallida = resultados.find((r) => r.status === 'rejected') as PromiseRejectedResult;
    expect(fallida.reason).toBeInstanceOf(ExistenciaInsuficienteError);

    const guardado = await prisma.itemInventario.findUniqueOrThrow({ where: { id: item.id } });
    expect(Number(guardado.existencia)).toBe(40);
  });

  it('la existencia guardada cuadra con la suma del kardex, con decimales', async () => {
    const item = await crear.ejecutar({ tipo: 'INSUMO', codigo: 'FILM', descripcion: 'Film stretch', unidadMedida: 'KG', productoId: null, usuarioId: base.adminId });
    await registrar.ejecutar({ itemId: item.id, tipo: 'ENTRADA', cantidad: 25.5, referencia: 'OC-77', observacion: null, motivo: null, usuarioId: base.adminId });
    await salida(item.id, 3.125);
    await registrar.ejecutar({ itemId: item.id, tipo: 'AJUSTE', cantidad: -0.375, referencia: null, observacion: null, motivo: 'Conteo físico', usuarioId: base.adminId });

    const [fila] = await prisma.$queryRaw<Array<{ suma: string; existencia: string }>>`
      SELECT SUM(m.cantidad)::text AS suma, i.existencia::text AS existencia
      FROM movimiento_inventario m JOIN item_inventario i ON i.id = m.item_id
      WHERE m.item_id = ${item.id} GROUP BY i.existencia`;
    expect(Number(fila.suma)).toBe(22);
    expect(Number(fila.existencia)).toBe(22);

    const ultimo = await prisma.movimientoInventario.findFirstOrThrow({ where: { itemId: item.id }, orderBy: { fechaHoraRegistro: 'desc' } });
    expect(Number(ultimo.saldo)).toBe(22);
    expect(await prisma.auditoria.count({ where: { entidad: 'movimiento_inventario' } })).toBe(3);
  });

  it('entrada de mercancía: todo o nada', async () => {
    const entrar = new RegistrarEntradaMercanciaUseCase(new UnidadDeTrabajoPrisma(servicio), horarios, RELOJ);
    const caja = await crear.ejecutar({ tipo: 'INSUMO', codigo: 'CAJA-12X', descripcion: 'Caja 12X', unidadMedida: 'UNIDAD', productoId: null, usuarioId: base.adminId });
    const bolsa = await crear.ejecutar({ tipo: 'PI', codigo: 'BOLSA-25G', descripcion: 'Bolsa 25 g', unidadMedida: 'UNIDAD', productoId: null, usuarioId: base.adminId });
    const pt = await crear.ejecutar({ tipo: 'PT', codigo: null, descripcion: null, unidadMedida: 'CAJA', productoId: base.productoId, usuarioId: base.adminId });

    // La 3.ª línea es PT: se rechaza y no debe quedar NADA de las dos primeras.
    await expect(
      entrar.ejecutar({
        documento: 'REM 1',
        remitente: null,
        observacion: null,
        lineas: [{ itemId: caja.id, cantidad: 10 }, { itemId: bolsa.id, cantidad: 20 }, { itemId: pt.id, cantidad: 5 }],
        usuarioId: base.adminId,
      }),
    ).rejects.toThrow(/Línea 3/);
    expect(await prisma.entradaMercancia.count()).toBe(0);
    expect(await prisma.movimientoInventario.count()).toBe(0);

    const ok = await entrar.ejecutar({
      documento: 'REM PepsiCo 4512',
      remitente: 'PepsiCo',
      observacion: null,
      lineas: [{ itemId: caja.id, cantidad: 10 }, { itemId: bolsa.id, cantidad: 20 }],
      usuarioId: base.adminId,
    });
    expect(await prisma.movimientoInventario.count({ where: { entradaId: ok.id, referencia: 'REM PepsiCo 4512' } })).toBe(2);
    expect(Number((await prisma.itemInventario.findUniqueOrThrow({ where: { id: bolsa.id } })).existencia)).toBe(20);
  });

  it('el PT se enlaza al producto: toma su código y descripción', async () => {
    const pt = await crear.ejecutar({ tipo: 'PT', codigo: null, descripcion: null, unidadMedida: 'CAJA', productoId: base.productoId, usuarioId: base.adminId });
    expect(pt).toMatchObject({ codigo: '300058141', descripcion: 'SURTIDO MEGA LONCHERA 586GX3X1 BX22', productoId: base.productoId });
    const fila = await prisma.itemInventario.findUniqueOrThrow({ where: { id: pt.id } });
    expect(fila.codigo).toBeNull(); // no se duplica
  });
});
