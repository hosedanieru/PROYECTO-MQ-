import { beforeEach, describe, expect, it } from 'vitest';

import {
  CatalogoInventarioNoEncontradoError,
  ExistenciaInsuficienteError,
  ItemInventarioDuplicadoError,
  ItemInventarioNoEncontradoError,
} from '../../domain/inventario/inventario.errors.js';
import type { ItemInventario } from '../../domain/inventario/item-inventario.js';
import type { TipoMaterial } from '../../domain/inventario/material.js';
import { Usuario } from '../../domain/usuario/usuario.entity.js';
import { AuditoriaRepositorioFalso, UnidadDeTrabajoFalsa, UsuarioRepositorioFalso } from '../pruebas/dobles-en-memoria.js';
import {
  EntradaMercanciaRepositorioFalso,
  ItemInventarioRepositorioFalso,
  MaterialRepositorioFalso,
  MovimientoInventarioRepositorioFalso,
  UnidadMedidaRepositorioFalso,
} from '../pruebas/dobles-inventario.js';
import { HorarioRepositorioFalso, horariosDpp } from '../pruebas/dobles-mfr.js';
import {
  ActualizarMaterialUseCase,
  CrearMaterialUseCase,
  CrearUnidadUseCase,
} from './catalogo-inventario.use-cases.js';
import { RegistrarEntradaMercanciaUseCase, RegistrarMovimientoUseCase } from './inventario.use-cases.js';

const RELOJ = { ahora: () => new Date('2026-09-29T08:15:00-05:00') }; // T1

describe('Inventario — casos de uso', () => {
  let unidades: UnidadMedidaRepositorioFalso;
  let materiales: MaterialRepositorioFalso;
  let items: ItemInventarioRepositorioFalso;
  let movimientos: MovimientoInventarioRepositorioFalso;
  let auditoria: AuditoriaRepositorioFalso;
  let uow: UnidadDeTrabajoFalsa;
  let registrar: RegistrarMovimientoUseCase;

  beforeEach(() => {
    unidades = new UnidadMedidaRepositorioFalso();
    materiales = new MaterialRepositorioFalso(unidades);
    items = new ItemInventarioRepositorioFalso();
    movimientos = new MovimientoInventarioRepositorioFalso();
    auditoria = new AuditoriaRepositorioFalso();
    const usuarios = new UsuarioRepositorioFalso();
    usuarios.agregar(Usuario.desdePersistencia({ id: 'u1', documento: '1', nombre: 'Luis Patinador', email: null, passwordHash: 'x', activo: true, rolId: 'r', rolCodigo: 'PATINADOR', permisos: [] }));
    uow = new UnidadDeTrabajoFalsa({ unidadesMedida: unidades, materiales, itemsInventario: items, movimientosInventario: movimientos, auditoria, usuarios });
    registrar = new RegistrarMovimientoUseCase(uow, new HorarioRepositorioFalso(horariosDpp()), RELOJ);
  });

  /** Crea el PI o insumo y devuelve SU ítem de inventario (el que recibe movimientos). */
  const crear = async (tipo: TipoMaterial, codigo: string): Promise<ItemInventario> => {
    const m = await new CrearMaterialUseCase(uow).ejecutar({
      tipo,
      codigo,
      descripcion: `${tipo} ${codigo}`,
      unidadBaseId: 'u-unidad',
      presentacionId: null,
      contenidoPresentacion: null,
      unidadesPorCaja: 1000,
      cajasPorEstiba: 40,
      usuarioId: 'admin',
    });
    return (await items.buscarPorReferencia(tipo, m.id))!;
  };
  const crearInsumo = () => crear('INSUMO', 'CAJA-12X');

  /** Cinta en METRO, presentación ROLLO de 50 m, 36 rollos por caja. */
  const crearCinta = async (): Promise<ItemInventario> => {
    const metro = await new CrearUnidadUseCase(uow).ejecutar({ codigo: 'METRO', nombre: 'Metro', usuarioId: 'admin' });
    const rollo = await new CrearUnidadUseCase(uow).ejecutar({ codigo: 'ROLLO', nombre: 'Rollo', usuarioId: 'admin' });
    const m = await new CrearMaterialUseCase(uow).ejecutar({
      tipo: 'INSUMO', codigo: '400030486', descripcion: 'CINTA OFERTA', unidadBaseId: metro.id, presentacionId: rollo.id, contenidoPresentacion: 50,
      unidadesPorCaja: 36, cajasPorEstiba: null, usuarioId: 'admin',
    });
    return (await items.buscarPorReferencia('INSUMO', m.id))!;
  };
  const sinConteo = { estibas: 0, cajas: 0, presentaciones: 0, medida: 0 };

  describe('Catálogo: PI, insumos y unidades', () => {
    it('crear un insumo crea también su existencia (0) y audita los dos', async () => {
      const item = await crearInsumo();
      expect(materiales.materiales).toEqual([expect.objectContaining({ tipo: 'INSUMO', codigo: 'CAJA-12X', unidadBase: 'UNIDAD', unidadesPorCaja: 1000 })]);
      expect(item).toMatchObject({ tipo: 'INSUMO', codigo: 'CAJA-12X', unidadMedida: 'UNIDAD', existencia: 0, activo: true });
      expect(auditoria.entradas.map((a) => a.entidad)).toEqual(['insumo', 'item_inventario']);
    });

    it('el código no se repite entre PI e insumos', async () => {
      await crear('PI', 'BOLSA-25G');
      await expect(crear('INSUMO', 'BOLSA-25G')).rejects.toThrow(/ya existe como PI/);
      await expect(crear('PI', 'BOLSA-25G')).rejects.toBeInstanceOf(ItemInventarioDuplicadoError);
    });

    it('la unidad base y la presentación deben existir y estar activas', async () => {
      const base = { tipo: 'PI' as const, codigo: 'X', descripcion: 'X', unidadesPorCaja: null, cajasPorEstiba: null, usuarioId: 'admin' };
      await expect(
        new CrearMaterialUseCase(uow).ejecutar({ ...base, unidadBaseId: 'no-existe', presentacionId: null, contenidoPresentacion: null }),
      ).rejects.toBeInstanceOf(CatalogoInventarioNoEncontradoError);
      await expect(
        new CrearMaterialUseCase(uow).ejecutar({ ...base, unidadBaseId: 'u-unidad', presentacionId: 'no-existe', contenidoPresentacion: 50 }),
      ).rejects.toBeInstanceOf(CatalogoInventarioNoEncontradoError);
    });

    it('cinta en METRO con presentación ROLLO de 50 m: la existencia se lleva en metros', async () => {
      const metro = await new CrearUnidadUseCase(uow).ejecutar({ codigo: 'METRO', nombre: 'Metro', usuarioId: 'admin' });
      const rollo = await new CrearUnidadUseCase(uow).ejecutar({ codigo: 'ROLLO', nombre: 'Rollo', usuarioId: 'admin' });
      const cinta = await new CrearMaterialUseCase(uow).ejecutar({
        tipo: 'INSUMO', codigo: 'CINTA-48', descripcion: 'Cinta 48 mm', unidadBaseId: metro.id, presentacionId: rollo.id, contenidoPresentacion: 50,
        unidadesPorCaja: 36, cajasPorEstiba: null, usuarioId: 'admin',
      });
      expect(cinta).toMatchObject({ unidadBase: 'METRO', presentacion: 'ROLLO', contenidoPresentacion: 50 });
      expect(await items.buscarPorReferencia('INSUMO', cinta.id)).toMatchObject({ unidadMedida: 'METRO' });
    });

    it('crea unidades nuevas para la lista desplegable, sin repetir', async () => {
      const rollo = await new CrearUnidadUseCase(uow).ejecutar({ codigo: 'rollo', nombre: 'Rollo', usuarioId: 'admin' });
      expect(rollo).toMatchObject({ codigo: 'ROLLO', activo: true });
      await expect(new CrearUnidadUseCase(uow).ejecutar({ codigo: 'ROLLO', nombre: 'Otro', usuarioId: 'admin' })).rejects.toBeInstanceOf(ItemInventarioDuplicadoError);
    });

    it('edita equivalencias y desactiva; audita antes y después', async () => {
      await crearInsumo();
      const m = materiales.materiales[0];
      const editado = await new ActualizarMaterialUseCase(uow).ejecutar({ tipo: 'INSUMO', materialId: m.id, cambios: { cajasPorEstiba: 50, activo: false }, usuarioId: 'admin' });
      expect(editado).toMatchObject({ cajasPorEstiba: 50, activo: false });
      expect(auditoria.entradas.at(-1)).toMatchObject({ accion: 'ACTUALIZAR', valorAnterior: expect.objectContaining({ cajasPorEstiba: 40 }) });
    });
  });

  describe('Entrada de mercancía', () => {
    let entradas: EntradaMercanciaRepositorioFalso;
    let entrar: RegistrarEntradaMercanciaUseCase;

    beforeEach(() => {
      entradas = new EntradaMercanciaRepositorioFalso();
      const uowConEntradas = new UnidadDeTrabajoFalsa({ ...uow.contexto, entradasMercancia: entradas });
      entrar = new RegistrarEntradaMercanciaUseCase(uowConEntradas, new HorarioRepositorioFalso(horariosDpp()), RELOJ);
    });

    it('varias líneas: una ENTRADA por línea, enlazada al documento, y sube cada existencia', async () => {
      const caja = await crearInsumo();
      const bolsa = await crear('PI', 'BOLSA-25G');

      const entrada = await entrar.ejecutar({
        documento: ' REM PepsiCo 4512 ',
        remitente: 'PepsiCo',
        observacion: null,
        lineas: [{ itemId: bolsa.id, cantidad: 4800 }, { itemId: caja.id, cantidad: 1000 }],
        usuarioId: 'u1',
      });

      expect(entrada).toMatchObject({ documento: 'REM PepsiCo 4512', usuarioNombre: 'Luis Patinador', turnoId: 'T1' });
      expect(entrada.lineas.map((l) => [l.codigo, l.cantidad, l.saldo])).toEqual([
        ['BOLSA-25G', 4800, 4800],
        ['CAJA-12X', 1000, 1000],
      ]);
      expect(movimientos.movimientos.map((m) => [m.tipo, m.referencia, m.entradaId])).toEqual([
        ['ENTRADA', 'REM PepsiCo 4512', entrada.id],
        ['ENTRADA', 'REM PepsiCo 4512', entrada.id],
      ]);
      expect(items.items.find((i) => i.id === bolsa.id)!.existencia).toBe(4800);
      expect(auditoria.entradas.at(-1)).toMatchObject({ entidad: 'entrada_mercancia', entidadId: entrada.id });
    });

    it('llega en rollos: 10 rollos de 50 m suman 500 m, y queda lo digitado', async () => {
      const cinta = await crearCinta();

      const entrada = await entrar.ejecutar({
        documento: 'REM 77', remitente: null, observacion: null,
        lineas: [{ itemId: cinta.id, conteo: { ...sinConteo, presentaciones: 10 } }],
        usuarioId: 'u1',
      });

      expect(entrada.lineas[0]).toMatchObject({ cantidad: 500, saldo: 500, conteoTexto: '10 ROLLO (1 ROLLO = 50 METRO)' });
      expect(movimientos.movimientos[0]).toMatchObject({ cantidad: 500, conteoTexto: '10 ROLLO (1 ROLLO = 50 METRO)' });
    });

    it('conteo con un escalón que el ítem no tiene: dice la línea y el código', async () => {
      const caja = await crearInsumo(); // sin presentación
      await expect(
        entrar.ejecutar({ documento: 'X', remitente: null, observacion: null, lineas: [{ itemId: caja.id, conteo: { ...sinConteo, presentaciones: 2 } }], usuarioId: 'u1' }),
      ).rejects.toThrow(/Línea 1 \(CAJA-12X\): .*presentación/);
    });

    it('el PT no entra por recepción de mercancía', async () => {
      const pt = await items.crear('PT', 'P1', { codigo: '300058141', descripcion: 'SURTIDO X12', unidadMedida: 'CAJA', activo: true, equivalencias: null });
      await expect(
        entrar.ejecutar({ documento: 'X', remitente: null, observacion: null, lineas: [{ itemId: pt.id, cantidad: 5 }], usuarioId: 'u1' }),
      ).rejects.toThrow(/Línea 1: 300058141 es PT/);
      expect(entradas.entradas).toHaveLength(0);
    });

    it.each([
      ['sin documento', { documento: '  ' }, /documento de soporte/],
      ['sin líneas', { lineas: [] }, /al menos una línea/],
      ['ítem repetido', { lineas: [{ itemId: 'a', cantidad: 1 }, { itemId: 'a', cantidad: 2 }] }, /Línea 2: el ítem está repetido/],
      ['cantidad en cero', { lineas: [{ itemId: 'a', cantidad: 0 }] }, /Línea 1: la cantidad/],
      ['cantidad con más de 3 decimales', { lineas: [{ itemId: 'a', cantidad: 1.2345 }] }, /Línea 1: la cantidad debe ser mayor que cero, con máximo 3 decimales/],
    ])('rechaza: %s', async (_, cambios, mensaje) => {
      await expect(
        entrar.ejecutar({ documento: 'REM 1', remitente: null, observacion: null, lineas: [{ itemId: 'a', cantidad: 1 }], usuarioId: 'u1', ...cambios }),
      ).rejects.toThrow(mensaje);
    });

    it('ítem inexistente o inactivo: dice qué línea', async () => {
      const caja = await crearInsumo();
      await expect(
        entrar.ejecutar({ documento: 'REM 1', remitente: null, observacion: null, lineas: [{ itemId: caja.id, cantidad: 1 }, { itemId: 'nada', cantidad: 1 }], usuarioId: 'u1' }),
      ).rejects.toBeInstanceOf(ItemInventarioNoEncontradoError);
      expect(movimientos.movimientos).toHaveLength(0);
    });
  });

  describe('Movimientos (kardex)', () => {
    it('entrada y salida: saldo, fecha operativa y turno automáticos, quién lo hizo', async () => {
      const item = await crearInsumo();
      await registrar.ejecutar({ itemId: item.id, tipo: 'ENTRADA', cantidad: 1000, referencia: 'REM PepsiCo 4512', observacion: null, motivo: null, usuarioId: 'u1' });
      const { movimiento, item: despues } = await registrar.ejecutar({ itemId: item.id, tipo: 'SALIDA', cantidad: 320, referencia: null, observacion: 'Consumo L1', motivo: null, usuarioId: 'u1' });

      expect(movimiento).toMatchObject({
        tipo: 'SALIDA',
        cantidad: -320,
        saldo: 680,
        turnoId: 'T1',
        fechaOperativa: new Date('2026-09-29T00:00:00Z'),
        usuarioNombre: 'Luis Patinador',
      });
      expect(despues.existencia).toBe(680);
      expect(items.items[0].existencia).toBe(680);
      expect(auditoria.entradas.at(-1)).toMatchObject({ entidad: 'movimiento_inventario', valorAnterior: { existencia: 1000 } });
    });

    it('una salida sin existencia se rechaza y no deja rastro', async () => {
      const item = await crearInsumo();
      await registrar.ejecutar({ itemId: item.id, tipo: 'ENTRADA', cantidad: 100, referencia: null, observacion: null, motivo: null, usuarioId: 'u1' });
      await expect(
        registrar.ejecutar({ itemId: item.id, tipo: 'SALIDA', cantidad: 120, referencia: null, observacion: null, motivo: null, usuarioId: 'u1' }),
      ).rejects.toBeInstanceOf(ExistenciaInsuficienteError);
      expect(movimientos.movimientos).toHaveLength(1);
      expect(items.items[0].existencia).toBe(100);
    });

    it('ajuste con motivo corrige tras un conteo físico', async () => {
      const item = await crearInsumo();
      await registrar.ejecutar({ itemId: item.id, tipo: 'ENTRADA', cantidad: 100, referencia: null, observacion: null, motivo: null, usuarioId: 'u1' });
      const { movimiento } = await registrar.ejecutar({ itemId: item.id, tipo: 'AJUSTE', cantidad: -12, referencia: null, observacion: null, motivo: 'Conteo físico: había 88', usuarioId: 'admin' });
      expect(movimiento).toMatchObject({ cantidad: -12, saldo: 88, motivo: 'Conteo físico: había 88' });
      expect(auditoria.entradas.at(-1)).toMatchObject({ motivo: 'Conteo físico: había 88' });
    });

    it('ajuste por conteo físico mixto: el ajuste es lo contado menos la existencia', async () => {
      const cinta = await crearCinta();
      await registrar.ejecutar({ itemId: cinta.id, tipo: 'ENTRADA', cantidad: 500, referencia: null, observacion: null, motivo: null, usuarioId: 'u1' });

      // Se contaron 9 rollos cerrados + 37,4 m del rollo abierto = 487,4 m.
      const { movimiento } = await registrar.ejecutar({
        itemId: cinta.id, tipo: 'AJUSTE', cantidad: 0, conteo: { ...sinConteo, presentaciones: 9, medida: 37.4 },
        referencia: null, observacion: null, motivo: 'Conteo de cierre', usuarioId: 'admin',
      });
      expect(movimiento).toMatchObject({ cantidad: -12.6, saldo: 487.4, conteoTexto: 'Conteo físico: 9 ROLLO + 37,4 METRO (1 ROLLO = 50 METRO)' });
    });

    it('el PT no admite conteo mixto (va en cajas)', async () => {
      const pt = await items.crear('PT', 'P1', { codigo: '300058141', descripcion: 'SURTIDO', unidadMedida: 'CAJA', activo: true, equivalencias: null });
      await expect(
        registrar.ejecutar({ itemId: pt.id, tipo: 'ENTRADA', cantidad: 0, conteo: { ...sinConteo, cajas: 2 }, referencia: null, observacion: null, motivo: null, usuarioId: 'u1' }),
      ).rejects.toThrow(/PT se mueve en cajas/);
    });

    it('ítem inactivo (su catálogo se desactivó) o inexistente no recibe movimientos', async () => {
      const item = await crearInsumo();
      items.desactivar(item.id);
      await expect(
        registrar.ejecutar({ itemId: item.id, tipo: 'ENTRADA', cantidad: 1, referencia: null, observacion: null, motivo: null, usuarioId: 'u1' }),
      ).rejects.toBeInstanceOf(ItemInventarioNoEncontradoError);
      await expect(
        registrar.ejecutar({ itemId: 'nada', tipo: 'ENTRADA', cantidad: 1, referencia: null, observacion: null, motivo: null, usuarioId: 'u1' }),
      ).rejects.toBeInstanceOf(ItemInventarioNoEncontradoError);
    });
  });
});
