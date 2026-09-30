import { beforeEach, describe, expect, it } from 'vitest';

import { DatosInventarioInvalidosError } from '../../domain/inventario/inventario.errors.js';
import type { ItemInventario } from '../../domain/inventario/item-inventario.js';
import { consumoDe, MAXIMO_COMPONENTES_RECETA, validarComponentes } from '../../domain/inventario/receta.js';
import { ProductoNoEncontradoError } from '../../domain/producto/producto.errors.js';
import { AuditoriaRepositorioFalso, ProductoRepositorioFalso, UnidadDeTrabajoFalsa } from '../pruebas/dobles-en-memoria.js';
import { ItemInventarioRepositorioFalso, RecetaRepositorioFalso } from '../pruebas/dobles-inventario.js';
import { ConsultarRecetaUseCase, GuardarRecetaUseCase } from './receta.use-cases.js';

const item = (id: string, tipo: ItemInventario['tipo'], codigo: string, activo = true): ItemInventario => ({
  id, tipo, referenciaId: `ref-${id}`, codigo, descripcion: `DESC ${codigo}`, unidadMedida: 'UNIDAD', activo, equivalencias: null, existencia: 50,
});

describe('Receta del PT — reglas del dominio', () => {
  it('exige al menos un componente y como máximo el límite técnico', () => {
    expect(() => validarComponentes([])).toThrow(DatosInventarioInvalidosError);
    const muchos = Array.from({ length: MAXIMO_COMPONENTES_RECETA + 1 }, (_, i) => ({ itemId: `i${i}`, cantidad: 1 }));
    expect(() => validarComponentes(muchos)).toThrow(/máximo/);
  });

  it('cantidad exacta por caja, con hasta 3 decimales: "1,8 m de cinta por caja"', () => {
    expect(validarComponentes([{ itemId: 'a', cantidad: 1.8 }])).toEqual([{ itemId: 'a', cantidad: 1.8 }]);
    expect(validarComponentes([{ itemId: 'a', cantidad: 0.025 }])[0].cantidad).toBe(0.025);
    expect(() => validarComponentes([{ itemId: 'a', cantidad: 0 }])).toThrow(/mayor que cero/);
    expect(() => validarComponentes([{ itemId: 'a', cantidad: 1.2345 }])).toThrow(/3 decimales/);
  });

  it('consumo = cajas × cantidad por caja, sin ruido de decimales', () => {
    expect(consumoDe({ itemId: 'cinta', cantidad: 1.8 }, 7)).toBe(12.6);
    expect(consumoDe({ itemId: 'bolsa', cantidad: 12 }, 250)).toBe(3000);
    // 0,1 × 3 en JavaScript da 0,30000000000000004.
    expect(consumoDe({ itemId: 'x', cantidad: 0.1 }, 3)).toBe(0.3);
  });

  it('no admite el mismo componente dos veces', () => {
    expect(() =>
      validarComponentes([
        { itemId: 'a', cantidad: 1 },
        { itemId: 'a', cantidad: 2 },
      ]),
    ).toThrow(/dos veces/);
  });
});

describe('Receta del PT — versiones', () => {
  let productos: ProductoRepositorioFalso;
  let items: ItemInventarioRepositorioFalso;
  let recetas: RecetaRepositorioFalso;
  let auditoria: AuditoriaRepositorioFalso;
  let guardar: GuardarRecetaUseCase;
  let productoId: string;
  let ahora: Date;

  beforeEach(async () => {
    productos = new ProductoRepositorioFalso();
    items = new ItemInventarioRepositorioFalso();
    items.agregar(item('pi', 'PI', 'PI-1'));
    items.agregar(item('cinta', 'INSUMO', 'CINTA-48'));
    recetas = new RecetaRepositorioFalso();
    auditoria = new AuditoriaRepositorioFalso();
    ahora = new Date('2026-09-29T15:00:00Z');
    guardar = new GuardarRecetaUseCase(new UnidadDeTrabajoFalsa({ productos, itemsInventario: items, recetas, auditoria }), { ahora: () => ahora });
    productoId = (
      await productos.crear({
        codigo: '300033627', descripcion: 'NATUCHIPS', proceso: null, unidadesPorCaja: null, cajasPorEstiba: null,
        personasIdeal: null, subdescripcion: null, cajasPorHora: null, pesoNetoKg: null,
      })
    ).id;
  });

  it('a un PT sin receta le crea la versión 1, con los datos de cada componente', async () => {
    const receta = await guardar.ejecutar({
      productoId,
      componentes: [
        { itemId: 'pi', cantidad: 12 },
        { itemId: 'cinta', cantidad: 1.8 },
      ],
      usuarioId: 'user-admin',
    });

    expect(receta).toMatchObject({ version: 1, vigenteDesde: ahora });
    expect(receta.componentes[1]).toMatchObject({ codigo: 'CINTA-48', tipo: 'INSUMO', cantidad: 1.8, existencia: 50 });
    expect(auditoria.entradas[0]).toMatchObject({ entidad: 'receta', accion: 'CREAR', valorAnterior: undefined });
  });

  it('guardar otra vez crea una versión NUEVA: la anterior se conserva intacta', async () => {
    await guardar.ejecutar({ productoId, componentes: [{ itemId: 'pi', cantidad: 12 }], usuarioId: 'user-admin' });
    ahora = new Date('2026-10-05T15:00:00Z');
    const v2 = await guardar.ejecutar({ productoId, componentes: [{ itemId: 'pi', cantidad: 10 }], usuarioId: 'user-admin' });

    expect(v2.version).toBe(2);
    expect(recetas.recetas.map((r) => [r.version, r.componentes[0].cantidad])).toEqual([[1, 12], [2, 10]]);
    expect(auditoria.entradas.at(-1)).toMatchObject({ valorAnterior: { version: 1 }, valorNuevo: { version: 2 } });
  });

  it('falla si el PT no existe', async () => {
    await expect(guardar.ejecutar({ productoId: 'no-existe', componentes: [{ itemId: 'pi', cantidad: 1 }], usuarioId: 'u' })).rejects.toThrow(
      ProductoNoEncontradoError,
    );
  });

  it('la consulta devuelve la vigente y el historial, la más reciente primero', async () => {
    await guardar.ejecutar({ productoId, componentes: [{ itemId: 'pi', cantidad: 12 }], usuarioId: 'user-admin' });
    await guardar.ejecutar({ productoId, componentes: [{ itemId: 'cinta', cantidad: 1 }], usuarioId: 'user-admin' });

    const consulta = await new ConsultarRecetaUseCase(recetas, items).ejecutar(productoId);

    expect(consulta.vigente?.version).toBe(2);
    expect(consulta.versiones.map((v) => v.version)).toEqual([2, 1]);
    expect(consulta.vigente?.componentes[0].codigo).toBe('CINTA-48');
    expect(await new ConsultarRecetaUseCase(recetas, items).ejecutar('otro')).toEqual({ vigente: null, versiones: [] });
  });
});
