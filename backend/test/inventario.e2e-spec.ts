/**
 * INVENTARIO CONTRA POSTGRESQL
 * ============================
 *
 * Lo que solo se puede probar con la base real: el bloqueo de fila del
 * ítem (dos salidas simultáneas no pueden pasar las dos), que el kardex
 * cuadre con la existencia, el "todo o nada" de las entradas y la regla
 * CHECK de que cada ítem apunta a exactamente un PT, PI o insumo.
 */

import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import { CrearProductoUseCase } from '../src/application/catalogo/producto.use-cases.js';
import { CrearMaterialUseCase } from '../src/application/inventario/catalogo-inventario.use-cases.js';
import { RegistrarCierreUseCase } from '../src/application/inventario/cierre-inventario.use-cases.js';
import { GuardarRecetaUseCase } from '../src/application/inventario/receta.use-cases.js';
import {
  RegistrarEntradaMercanciaUseCase,
  RegistrarMovimientoUseCase,
} from '../src/application/inventario/inventario.use-cases.js';
import { ExistenciaInsuficienteError } from '../src/domain/inventario/inventario.errors.js';
import type { TipoMaterial } from '../src/domain/inventario/material.js';
import type { DiaSemana, HorarioRepository } from '../src/domain/mfr/horas-turno.js';
import { PrismaService } from '../src/infrastructure/database/prisma/prisma.service.js';
import { UnidadDeTrabajoPrisma } from '../src/infrastructure/persistence/prisma/unidad-de-trabajo.prisma.js';
import { catalogosBase, limpiarDatos, prisma, type CatalogosBase } from './ayudantes.js';

const DIAS: DiaSemana[] = ['LUNES', 'MARTES', 'MIERCOLES', 'JUEVES', 'VIERNES', 'SABADO', 'DOMINGO'];
const RELOJ = { ahora: () => new Date('2026-09-29T08:00:00-05:00') };

let servicio: PrismaService;
let base: CatalogosBase;
let uow: UnidadDeTrabajoPrisma;
let registrar: RegistrarMovimientoUseCase;
let horarios: HorarioRepository;
let unidadId: string;

beforeAll(async () => {
  servicio = new PrismaService();
  await servicio.$connect();
  base = await catalogosBase();
  // Un solo turno que cubre el día: cualquier hora cae en él.
  horarios = {
    vigentesEn: () =>
      Promise.resolve(DIAS.map((diaSemana) => ({ turnoId: base.turnoId, diaSemana, horaInicio: '06:00', horaFin: '05:59', cruzaMedianoche: true }))),
  };
  uow = new UnidadDeTrabajoPrisma(servicio);
  registrar = new RegistrarMovimientoUseCase(uow, horarios, RELOJ);
  unidadId = (await prisma.unidadMedida.upsert({ where: { codigo: 'UNIDAD' }, update: {}, create: { codigo: 'UNIDAD', nombre: 'Unidad' } })).id;
});

beforeEach(async () => {
  await limpiarDatos();
});

afterAll(async () => {
  await limpiarDatos();
  await servicio.$disconnect();
  await prisma.$disconnect();
});

/** Crea el PI o insumo y devuelve el id de su ítem de inventario. */
const crear = async (tipo: TipoMaterial, codigo: string): Promise<string> => {
  const m = await new CrearMaterialUseCase(uow).ejecutar({
    tipo, codigo, descripcion: codigo, unidadBaseId: unidadId, presentacionId: null, contenidoPresentacion: null, unidadesPorCaja: null, cajasPorEstiba: null, usuarioId: base.adminId,
  });
  const item = await prisma.itemInventario.findFirstOrThrow({ where: tipo === 'PI' ? { piId: m.id } : { insumoId: m.id } });
  return item.id;
};

const salida = (itemId: string, cantidad: number) =>
  registrar.ejecutar({ itemId, tipo: 'SALIDA', cantidad, referencia: null, observacion: null, motivo: null, usuarioId: base.adminId });

describe('inventario contra PostgreSQL', () => {
  it('dos salidas simultáneas no sacan la misma existencia', async () => {
    const item = await crear('INSUMO', 'CINTA-48');
    await registrar.ejecutar({ itemId: item, tipo: 'ENTRADA', cantidad: 100, referencia: null, observacion: null, motivo: null, usuarioId: base.adminId });

    // Cada una cabe sola (60 ≤ 100), pero no las dos juntas (120 > 100).
    const resultados = await Promise.allSettled([salida(item, 60), salida(item, 60)]);

    expect(resultados.filter((r) => r.status === 'fulfilled')).toHaveLength(1);
    const fallida = resultados.find((r) => r.status === 'rejected') as PromiseRejectedResult;
    expect(fallida.reason).toBeInstanceOf(ExistenciaInsuficienteError);
    expect(Number((await prisma.itemInventario.findUniqueOrThrow({ where: { id: item } })).existencia)).toBe(40);
  });

  it('la existencia guardada cuadra con la suma del kardex', async () => {
    const item = await crear('INSUMO', 'FILM');
    await registrar.ejecutar({ itemId: item, tipo: 'ENTRADA', cantidad: 250, referencia: 'OC-77', observacion: null, motivo: null, usuarioId: base.adminId });
    await salida(item, 31);
    await registrar.ejecutar({ itemId: item, tipo: 'AJUSTE', cantidad: -4, referencia: null, observacion: null, motivo: 'Conteo físico', usuarioId: base.adminId });

    const [fila] = await prisma.$queryRaw<Array<{ suma: number; existencia: number }>>`
      SELECT SUM(m.cantidad)::float8 AS suma, i.existencia::float8 AS existencia
      FROM movimiento_inventario m JOIN item_inventario i ON i.id = m.item_id
      WHERE m.item_id = ${item} GROUP BY i.existencia`;
    expect(fila).toEqual({ suma: 215, existencia: 215 });
    const ultimo = await prisma.movimientoInventario.findFirstOrThrow({ where: { itemId: item }, orderBy: { fechaHoraRegistro: 'desc' } });
    expect(Number(ultimo.saldo)).toBe(215);
  });

  it('decimales: 10 rollos de 50 m entran como 500 m y el consumo de 7 cajas a 1,8 m deja 487,4 m exactos', async () => {
    const cinta = await crear('INSUMO', 'CINTA-DEC');
    await registrar.ejecutar({ itemId: cinta, tipo: 'ENTRADA', cantidad: 500, referencia: null, observacion: null, motivo: null, usuarioId: base.adminId });
    const r = await salida(cinta, 12.6);

    expect(r.movimiento).toMatchObject({ cantidad: -12.6, saldo: 487.4 });
    expect(Number((await prisma.itemInventario.findUniqueOrThrow({ where: { id: cinta } })).existencia)).toBe(487.4);
    await expect(salida(cinta, 0.0001)).rejects.toThrow(/3 decimales/);
  });

  it('entrada de mercancía: todo o nada', async () => {
    const entrar = new RegistrarEntradaMercanciaUseCase(uow, horarios, RELOJ);
    const caja = await crear('INSUMO', 'CAJA-12X');
    const bolsa = await crear('PI', 'BOLSA-25G');

    // La 3.ª línea no existe: se rechaza y no debe quedar NADA de las dos primeras.
    await expect(
      entrar.ejecutar({
        documento: 'REM 1',
        remitente: null,
        observacion: null,
        lineas: [{ itemId: caja, cantidad: 10 }, { itemId: bolsa, cantidad: 20 }, { itemId: 'no-existe', cantidad: 5 }],
        usuarioId: base.adminId,
      }),
    ).rejects.toThrow(/Línea 3/);
    expect(await prisma.entradaMercancia.count()).toBe(0);
    expect(await prisma.movimientoInventario.count()).toBe(0);

    const ok = await entrar.ejecutar({
      documento: 'REM PepsiCo 4512',
      remitente: 'PepsiCo',
      observacion: null,
      lineas: [{ itemId: caja, cantidad: 10 }, { itemId: bolsa, cantidad: 20 }],
      usuarioId: base.adminId,
    });
    expect(await prisma.movimientoInventario.count({ where: { entradaId: ok.id, referencia: 'REM PepsiCo 4512' } })).toBe(2);
    expect(Number((await prisma.itemInventario.findUniqueOrThrow({ where: { id: bolsa } })).existencia)).toBe(20);
  });

  it('crear un PT (producto) crea su existencia y la versión 1 de su receta', async () => {
    const bolsa = await crear('PI', 'BOLSA-PT');
    const producto = await new CrearProductoUseCase(uow, RELOJ).ejecutar({
      codigo: '300099999', descripcion: 'PT DE PRUEBA', proceso: null, unidadesPorCaja: 12, cajasPorEstiba: 40, personasIdeal: null, subdescripcion: null,
      receta: [{ itemId: bolsa, cantidad: 12 }],
      usuarioId: base.adminId,
    });
    const item = await prisma.itemInventario.findFirstOrThrow({ where: { productoId: producto.id }, include: { producto: true } });
    expect(item).toMatchObject({ tipo: 'PT', piId: null, insumoId: null });
    expect(Number(item.existencia)).toBe(0);
    expect(item.producto?.codigo).toBe('300099999');
    const receta = await prisma.receta.findFirstOrThrow({ where: { productoId: producto.id }, include: { componentes: true } });
    expect(receta).toMatchObject({ version: 1, componentes: [expect.objectContaining({ itemId: bolsa })] });
    expect(Number(receta.componentes[0].cantidad)).toBe(12);
    // El producto no está en la lista de TRUNCATE (lo comparten otras pruebas): se borra a mano.
    await prisma.recetaComponente.deleteMany({ where: { recetaId: receta.id } });
    await prisma.receta.delete({ where: { id: receta.id } });
    await prisma.itemInventario.delete({ where: { id: item.id } });
    await prisma.producto.delete({ where: { id: producto.id } });
  });

  it('regla de la base: no hay dos versiones con el mismo número ni cantidades en cero', async () => {
    const cinta = await crear('INSUMO', 'CINTA-R');
    const nueva = (version: number, cantidad: number) =>
      prisma.receta.create({
        data: {
          productoId: base.productoId, version, vigenteDesde: new Date(), creadaPorId: base.adminId, creadaPorNombre: 'Admin',
          componentes: { create: [{ itemId: cinta, cantidad }] },
        },
      });
    await nueva(1, 1);
    // Dos guardados simultáneos calcularían la misma versión: la base deja pasar solo uno.
    await expect(nueva(1, 2)).rejects.toThrow(/Unique constraint|receta_producto_id_version_key/);
    await expect(nueva(2, 0)).rejects.toThrow(/receta_componente_cantidad_positiva/);
  });

  it('cierre del día: merma contra lo contado, ajuste en el kardex y un solo cierre por día', async () => {
    const cinta = await crear('INSUMO', 'CINTA-CIERRE');
    // El producto base de las pruebas no pasa por el caso de uso: su ítem de PT se crea a mano.
    await prisma.itemInventario.create({ data: { tipo: 'PT', productoId: base.productoId } });
    await new GuardarRecetaUseCase(uow, RELOJ).ejecutar({ productoId: base.productoId, componentes: [{ itemId: cinta, cantidad: 1.8 }], usuarioId: base.adminId });
    await registrar.ejecutar({ itemId: cinta, tipo: 'ENTRADA', cantidad: 500, referencia: null, observacion: null, motivo: null, usuarioId: base.adminId });

    const cerrar = new RegistrarCierreUseCase(uow, horarios, RELOJ);
    const fecha = new Date('2026-09-29T00:00:00.000Z');
    const cierre = await cerrar.ejecutar({ fechaOperativa: fecha, lineas: [{ itemId: cinta, cantidad: 487.5 }], observacion: 'Conteo de prueba', usuarioId: base.adminId });

    expect(cierre.lineas).toEqual([expect.objectContaining({ esperado: 500, contado: 487.5, merma: 12.5 })]);
    expect(Number((await prisma.itemInventario.findUniqueOrThrow({ where: { id: cinta } })).existencia)).toBe(487.5);
    expect(await prisma.movimientoInventario.count({ where: { cierreId: cierre.id, tipo: 'AJUSTE' } })).toBe(1);
    // La base no deja un segundo cierre del mismo día, aunque el caso de uso lo dejara pasar.
    await expect(
      prisma.cierreInventario.create({ data: { fechaOperativa: fecha, fechaHoraRegistro: new Date(), usuarioId: base.adminId, usuarioNombre: 'X' } }),
    ).rejects.toThrow(/Unique constraint|cierre_inventario_fecha_operativa_key/);
  });

  it('regla de la base: un ítem apunta exactamente a lo que dice su tipo', async () => {
    const piItem = await crear('PI', 'BOLSA-X');
    const pi = await prisma.itemInventario.findUniqueOrThrow({ where: { id: piItem } });
    // Tipo INSUMO apuntando a un PI: la base lo rechaza aunque el código se equivoque.
    await expect(prisma.$executeRaw`INSERT INTO item_inventario (id, tipo, pi_id, existencia, actualizado_en)
      VALUES (gen_random_uuid(), 'INSUMO', ${pi.piId}, 0, now())`).rejects.toThrow(/item_inventario_una_referencia|unique/);
  });
});
