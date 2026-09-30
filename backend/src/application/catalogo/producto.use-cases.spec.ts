import { beforeEach, describe, expect, it } from 'vitest';

import {
  CodigoProductoDuplicadoError,
  DatosProductoInvalidosError,
  ProductoNoEncontradoError,
} from '../../domain/producto/producto.errors.js';
import {
  AuditoriaRepositorioFalso,
  ProductoRepositorioFalso,
  REMISIONES_SIN_USO,
  UnidadDeTrabajoFalsa,
  UsuarioRepositorioFalso,
} from '../pruebas/dobles-en-memoria.js';
import { DatosInventarioInvalidosError, ItemInventarioNoEncontradoError } from '../../domain/inventario/inventario.errors.js';
import type { ItemInventario } from '../../domain/inventario/item-inventario.js';
import { ItemInventarioRepositorioFalso, RecetaRepositorioFalso } from '../pruebas/dobles-inventario.js';
import {
  ActualizarProductoUseCase,
  CrearProductoUseCase,
  type CrearProductoComando,
} from './producto.use-cases.js';

const AHORA = new Date('2026-09-29T15:00:00Z');

const PI: ItemInventario = {
  id: 'item-pi', tipo: 'PI', referenciaId: 'pi-1', codigo: 'PI-1', descripcion: 'BOLSA PAPA 25 G', unidadMedida: 'UNIDAD', activo: true, equivalencias: null, existencia: 0,
};

function comando(sobrescribir: Partial<CrearProductoComando> = {}): CrearProductoComando {
  return {
    codigo: '300058141',
    descripcion: 'SURTIDO MEGA LONCHERA 586GX3X1 BX22',
    proceso: 'MANUAL',
    unidadesPorCaja: 4,
    cajasPorEstiba: 36,
    personasIdeal: 13,
    subdescripcion: 'surtido',
    receta: [{ itemId: PI.id, cantidad: 12 }],
    usuarioId: 'user-admin',
    ...sobrescribir,
  };
}

describe('Productos', () => {
  let productos: ProductoRepositorioFalso;
  let items: ItemInventarioRepositorioFalso;
  let recetas: RecetaRepositorioFalso;
  let auditoria: AuditoriaRepositorioFalso;
  let crear: CrearProductoUseCase;
  let actualizar: ActualizarProductoUseCase;

  beforeEach(() => {
    productos = new ProductoRepositorioFalso();
    items = new ItemInventarioRepositorioFalso();
    items.agregar({ ...PI });
    recetas = new RecetaRepositorioFalso();
    auditoria = new AuditoriaRepositorioFalso();
    const uow = new UnidadDeTrabajoFalsa({
      remisiones: REMISIONES_SIN_USO,
      usuarios: new UsuarioRepositorioFalso(),
      productos,
      itemsInventario: items,
      recetas,
      auditoria,
    });
    crear = new CrearProductoUseCase(uow, { ahora: () => AHORA });
    actualizar = new ActualizarProductoUseCase(uow);
  });

  describe('crear', () => {
    it('crea el producto activo y lo audita', async () => {
      const creado = await crear.ejecutar(comando());

      expect(creado.activo).toBe(true);
      expect(creado.codigo).toBe('300058141');
      expect(auditoria.entradas[0]).toMatchObject({
        entidad: 'producto',
        entidadId: creado.id,
        accion: 'CREAR',
        usuarioId: 'user-admin',
      });
    });

    it('crea también su ítem de PT en el inventario (un solo módulo), con existencia 0', async () => {
      const creado = await crear.ejecutar(comando());

      expect(items.items.filter((i) => i.tipo === 'PT')).toEqual([
        expect.objectContaining({ tipo: 'PT', referenciaId: creado.id, codigo: '300058141', unidadMedida: 'CAJA', existencia: 0 }),
      ]);
      expect(auditoria.entradas.map((a) => a.entidad)).toEqual(['producto', 'item_inventario', 'receta']);
    });

    it('crea la versión 1 de su receta en la misma operación', async () => {
      const creado = await crear.ejecutar(comando());

      expect(recetas.recetas).toEqual([
        expect.objectContaining({
          productoId: creado.id,
          version: 1,
          vigenteDesde: AHORA,
          creadaPorId: 'user-admin',
          componentes: [{ itemId: PI.id, cantidad: 12 }],
        }),
      ]);
    });

    it('la receta es obligatoria: sin componentes no crea nada', async () => {
      await expect(crear.ejecutar(comando({ receta: [] }))).rejects.toThrow(DatosInventarioInvalidosError);

      expect(productos.items).toHaveLength(0);
      expect(items.items.filter((i) => i.tipo === 'PT')).toHaveLength(0);
      expect(auditoria.entradas).toHaveLength(0);
    });

    it('rechaza componentes que no existen, inactivos o que son PT, sin crear nada', async () => {
      items.agregar({ ...PI, id: 'item-pt', tipo: 'PT', codigo: 'PT-1' });
      items.agregar({ ...PI, id: 'item-inactivo', codigo: 'PI-2', activo: false });

      await expect(crear.ejecutar(comando({ receta: [{ itemId: 'no-existe', cantidad: 1 }] }))).rejects.toThrow(ItemInventarioNoEncontradoError);
      await expect(crear.ejecutar(comando({ receta: [{ itemId: 'item-pt', cantidad: 1 }] }))).rejects.toThrow(/solo lleva PI e insumos/);
      await expect(crear.ejecutar(comando({ receta: [{ itemId: 'item-inactivo', cantidad: 1 }] }))).rejects.toThrow(/inactivo/);
      expect(productos.items).toHaveLength(0);
    });

    it('recorta espacios del código y la descripción', async () => {
      const creado = await crear.ejecutar(
        comando({ codigo: '  300058141 ', descripcion: '  Lonchera  ' }),
      );

      expect(creado.codigo).toBe('300058141');
      expect(creado.descripcion).toBe('Lonchera');
    });

    it('guarda línea ideal, subdescripción en mayúsculas y los estándares iniciales sin motivo', async () => {
      const creado = await crear.ejecutar(comando({ cajasPorHora: 144, pesoNetoKg: 2.344 }));

      expect(creado).toMatchObject({ personasIdeal: 13, subdescripcion: 'SURTIDO', cajasPorHora: 144, pesoNetoKg: 2.344 });
      await expect(crear.ejecutar(comando({ codigo: 'X1', personasIdeal: -1 }))).rejects.toThrow(DatosProductoInvalidosError);
      await expect(crear.ejecutar(comando({ codigo: 'X2', cajasPorHora: 0 }))).rejects.toThrow(DatosProductoInvalidosError);
    });

    it('admite producto sin proceso ni empaque definidos', async () => {
      const creado = await crear.ejecutar(
        comando({ proceso: null, unidadesPorCaja: null, cajasPorEstiba: null }),
      );

      expect(creado.proceso).toBeNull();
      expect(creado.unidadesPorCaja).toBeNull();
    });

    it('rechaza código duplicado', async () => {
      await crear.ejecutar(comando());

      await expect(crear.ejecutar(comando())).rejects.toThrow(
        CodigoProductoDuplicadoError,
      );
    });

    it('rechaza código vacío, descripción vacía y cantidades no positivas', async () => {
      await expect(crear.ejecutar(comando({ codigo: ' ' }))).rejects.toThrow(
        DatosProductoInvalidosError,
      );
      await expect(crear.ejecutar(comando({ descripcion: '' }))).rejects.toThrow(
        DatosProductoInvalidosError,
      );
      await expect(crear.ejecutar(comando({ unidadesPorCaja: 0 }))).rejects.toThrow(
        DatosProductoInvalidosError,
      );
      await expect(crear.ejecutar(comando({ cajasPorEstiba: 1.5 }))).rejects.toThrow(
        DatosProductoInvalidosError,
      );
    });
  });

  describe('actualizar', () => {
    it('aplica cambios parciales y audita valor anterior y nuevo', async () => {
      const creado = await crear.ejecutar(comando());

      const actualizado = await actualizar.ejecutar({
        productoId: creado.id,
        cambios: { cajasPorEstiba: 40 },
        usuarioId: 'user-admin',
      });

      expect(actualizado.cajasPorEstiba).toBe(40);
      expect(actualizado.descripcion).toBe(creado.descripcion);
      // Al crear quedan tres entradas (producto, su PT y su receta); la edición es la última.
      expect(auditoria.entradas.at(-1)).toMatchObject({
        accion: 'ACTUALIZAR',
        valorAnterior: { cajasPorEstiba: 36 },
        valorNuevo: { cajasPorEstiba: 40 },
      });
    });

    it('ignora claves presentes con valor undefined (como llegan desde un DTO)', async () => {
      const creado = await crear.ejecutar(comando());

      const actualizado = await actualizar.ejecutar({
        productoId: creado.id,
        cambios: {
          codigo: undefined,
          descripcion: undefined,
          proceso: undefined,
          unidadesPorCaja: undefined,
          cajasPorEstiba: 40,
          activo: undefined,
        },
        usuarioId: 'user-admin',
      });

      expect(actualizado).toMatchObject({
        codigo: creado.codigo,
        descripcion: creado.descripcion,
        proceso: 'MANUAL',
        unidadesPorCaja: 4,
        cajasPorEstiba: 40,
        activo: true,
      });
    });

    it('permite desactivar', async () => {
      const creado = await crear.ejecutar(comando());

      const actualizado = await actualizar.ejecutar({
        productoId: creado.id,
        cambios: { activo: false },
        usuarioId: 'user-admin',
      });

      expect(actualizado.activo).toBe(false);
    });

    it('rechaza cambiar el código a uno que ya usa otro producto', async () => {
      await crear.ejecutar(comando({ codigo: 'A' }));
      const b = await crear.ejecutar(comando({ codigo: 'B' }));

      await expect(
        actualizar.ejecutar({
          productoId: b.id,
          cambios: { codigo: 'A' },
          usuarioId: 'user-admin',
        }),
      ).rejects.toThrow(CodigoProductoDuplicadoError);
    });

    it('valida el producto completo, no solo los campos que cambian', async () => {
      const creado = await crear.ejecutar(comando());

      await expect(
        actualizar.ejecutar({
          productoId: creado.id,
          cambios: { unidadesPorCaja: -1 },
          usuarioId: 'user-admin',
        }),
      ).rejects.toThrow(DatosProductoInvalidosError);
    });

    it('falla si el producto no existe', async () => {
      await expect(
        actualizar.ejecutar({
          productoId: 'no-existe',
          cambios: { activo: false },
          usuarioId: 'user-admin',
        }),
      ).rejects.toThrow(ProductoNoEncontradoError);
    });
  });
});
