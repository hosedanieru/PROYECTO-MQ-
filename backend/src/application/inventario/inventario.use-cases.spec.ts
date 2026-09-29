import { beforeEach, describe, expect, it } from 'vitest';

import {
  DatosInventarioInvalidosError,
  ExistenciaInsuficienteError,
  ItemInventarioDuplicadoError,
  ItemInventarioNoEncontradoError,
} from '../../domain/inventario/inventario.errors.js';
import { ProductoNoEncontradoError } from '../../domain/producto/producto.errors.js';
import { Usuario } from '../../domain/usuario/usuario.entity.js';
import {
  AuditoriaRepositorioFalso,
  ProductoRepositorioFalso,
  UnidadDeTrabajoFalsa,
  UsuarioRepositorioFalso,
} from '../pruebas/dobles-en-memoria.js';
import {
  EntradaMercanciaRepositorioFalso,
  ItemInventarioRepositorioFalso,
  MovimientoInventarioRepositorioFalso,
} from '../pruebas/dobles-inventario.js';
import { HorarioRepositorioFalso, horariosDpp } from '../pruebas/dobles-mfr.js';
import {
  ActualizarItemUseCase,
  CrearItemUseCase,
  RegistrarEntradaMercanciaUseCase,
  RegistrarMovimientoUseCase,
} from './inventario.use-cases.js';

const RELOJ = { ahora: () => new Date('2026-09-29T08:15:00-05:00') }; // T1

describe('Inventario — casos de uso', () => {
  let productos: ProductoRepositorioFalso;
  let items: ItemInventarioRepositorioFalso;
  let movimientos: MovimientoInventarioRepositorioFalso;
  let auditoria: AuditoriaRepositorioFalso;
  let uow: UnidadDeTrabajoFalsa;
  let registrar: RegistrarMovimientoUseCase;

  beforeEach(() => {
    productos = new ProductoRepositorioFalso();
    productos.agregar({ id: 'P1', codigo: '300058141', descripcion: 'SURTIDO X12', proceso: null, activo: true, unidadesPorCaja: 12, cajasPorEstiba: null, personasIdeal: null, subdescripcion: null, cajasPorHora: null, pesoNetoKg: null });
    productos.agregar({ id: 'P2', codigo: '300000002', descripcion: 'INACTIVO', proceso: null, activo: false, unidadesPorCaja: null, cajasPorEstiba: null, personasIdeal: null, subdescripcion: null, cajasPorHora: null, pesoNetoKg: null });
    items = new ItemInventarioRepositorioFalso(productos);
    movimientos = new MovimientoInventarioRepositorioFalso();
    auditoria = new AuditoriaRepositorioFalso();
    const usuarios = new UsuarioRepositorioFalso();
    usuarios.agregar(Usuario.desdePersistencia({ id: 'u1', documento: '1', nombre: 'Luis Patinador', email: null, passwordHash: 'x', activo: true, rolId: 'r', rolCodigo: 'PATINADOR', permisos: [] }));
    uow = new UnidadDeTrabajoFalsa({ productos, itemsInventario: items, movimientosInventario: movimientos, auditoria, usuarios });
    registrar = new RegistrarMovimientoUseCase(uow, new HorarioRepositorioFalso(horariosDpp()), RELOJ);
  });

  const crearInsumo = () =>
    new CrearItemUseCase(uow).ejecutar({ tipo: 'INSUMO', codigo: 'CAJA-12X', descripcion: 'Caja corrugada 12X', unidadMedida: 'unidad', productoId: null, usuarioId: 'admin' });

  describe('Catálogo', () => {
    it('crea un insumo con existencia 0 y lo audita', async () => {
      const item = await crearInsumo();
      expect(item).toMatchObject({ tipo: 'INSUMO', codigo: 'CAJA-12X', unidadMedida: 'UNIDAD', existencia: 0, activo: true });
      expect(auditoria.entradas[0]).toMatchObject({ entidad: 'item_inventario', accion: 'CREAR' });
    });

    it('PT: toma código y descripción del producto; uno por producto; producto activo', async () => {
      const crear = new CrearItemUseCase(uow);
      const pt = await crear.ejecutar({ tipo: 'PT', codigo: null, descripcion: null, unidadMedida: 'CAJA', productoId: 'P1', usuarioId: 'admin' });
      expect(pt).toMatchObject({ codigo: '300058141', descripcion: 'SURTIDO X12', productoId: 'P1' });

      await expect(crear.ejecutar({ tipo: 'PT', codigo: null, descripcion: null, unidadMedida: 'CAJA', productoId: 'P1', usuarioId: 'admin' })).rejects.toBeInstanceOf(ItemInventarioDuplicadoError);
      await expect(crear.ejecutar({ tipo: 'PT', codigo: null, descripcion: null, unidadMedida: 'CAJA', productoId: 'P2', usuarioId: 'admin' })).rejects.toBeInstanceOf(ProductoNoEncontradoError);
    });

    it('no repite el código de un insumo o PI', async () => {
      await crearInsumo();
      await expect(crearInsumo()).rejects.toBeInstanceOf(ItemInventarioDuplicadoError);
    });

    it('edita la descripción y desactiva; al PT no se le cambia el código aquí', async () => {
      const item = await crearInsumo();
      const editado = await new ActualizarItemUseCase(uow).ejecutar({ itemId: item.id, cambios: { descripcion: 'Caja 12X nueva', activo: false }, usuarioId: 'admin' });
      expect(editado).toMatchObject({ codigo: 'CAJA-12X', descripcion: 'Caja 12X nueva', activo: false });

      const pt = await new CrearItemUseCase(uow).ejecutar({ tipo: 'PT', codigo: null, descripcion: null, unidadMedida: 'CAJA', productoId: 'P1', usuarioId: 'admin' });
      await expect(new ActualizarItemUseCase(uow).ejecutar({ itemId: pt.id, cambios: { codigo: 'OTRO' }, usuarioId: 'admin' })).rejects.toBeInstanceOf(DatosInventarioInvalidosError);
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

    const crearPi = () =>
      new CrearItemUseCase(uow).ejecutar({ tipo: 'PI', codigo: 'BOLSA-25G', descripcion: 'Bolsa papa 25 g', unidadMedida: 'UNIDAD', productoId: null, usuarioId: 'admin' });

    it('varias líneas: una ENTRADA por línea, enlazada al documento, y sube cada existencia', async () => {
      const caja = await crearInsumo();
      const bolsa = await crearPi();

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

    it('el PT no entra por recepción de mercancía', async () => {
      const pt = await new CrearItemUseCase(uow).ejecutar({ tipo: 'PT', codigo: null, descripcion: null, unidadMedida: 'CAJA', productoId: 'P1', usuarioId: 'admin' });
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

    it('ítem inactivo o inexistente no recibe movimientos', async () => {
      const item = await crearInsumo();
      await new ActualizarItemUseCase(uow).ejecutar({ itemId: item.id, cambios: { activo: false }, usuarioId: 'admin' });
      await expect(
        registrar.ejecutar({ itemId: item.id, tipo: 'ENTRADA', cantidad: 1, referencia: null, observacion: null, motivo: null, usuarioId: 'u1' }),
      ).rejects.toBeInstanceOf(ItemInventarioNoEncontradoError);
      await expect(
        registrar.ejecutar({ itemId: 'nada', tipo: 'ENTRADA', cantidad: 1, referencia: null, observacion: null, motivo: null, usuarioId: 'u1' }),
      ).rejects.toBeInstanceOf(ItemInventarioNoEncontradoError);
    });
  });
});
