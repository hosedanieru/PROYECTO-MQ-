import { beforeEach, describe, expect, it } from 'vitest';

import type { Producto } from '../../domain/producto/producto.repository.js';
import { Remision, type EstadoRemision } from '../../domain/remision/remision.entity.js';
import {
  DatosRemisionInvalidosError,
  RemisionExcedeProgramacionError,
  RemisionNoEditableError,
  RemisionNoEncontradaError,
} from '../../domain/remision/remision.errors.js';
import {
  conteoEnCero,
  type CajasAgrupadas,
  type ConteoPorEstado,
  type FiltroRemisiones,
  type RemisionRepository,
  type ResultadoPaginado,
} from '../../domain/remision/remision.repository.js';
import {
  AuditoriaRepositorioFalso,
  ProductoRepositorioFalso,
  UnidadDeTrabajoFalsa,
  UsuarioRepositorioFalso,
} from '../pruebas/dobles-en-memoria.js';
import { BloqueRepositorioFalso, EstandarRepositorioFalso, programarTarget } from '../pruebas/dobles-mfr.js';
import { EditarRemisionUseCase } from './editar-remision.use-case.js';

/** Repositorio en memoria que conserva las remisiones por id. */
class RemisionRepositorioFalso implements RemisionRepository {
  readonly porId = new Map<string, Remision>();

  agregar(id: string, remision: Remision): void {
    this.porId.set(id, Remision.desdePersistencia({ ...remision.aObjeto(), id }));
  }

  crearConConsecutivo(): Promise<Remision> {
    return Promise.reject(new Error('No aplica'));
  }

  actualizar(remision: Remision): Promise<Remision> {
    this.porId.set(remision.id, remision);
    return Promise.resolve(remision);
  }

  registrarVersion(): Promise<void> {
    return Promise.resolve();
  }

  buscarPorId(id: string): Promise<Remision | null> {
    const r = this.porId.get(id);
    // Copia, como haría la base: los cambios no persistidos no se ven.
    return Promise.resolve(r ? Remision.desdePersistencia(r.aObjeto()) : null);
  }

  buscarPorConsecutivo(): Promise<Remision | null> {
    return Promise.resolve(null);
  }

  listar(filtro: FiltroRemisiones): Promise<ResultadoPaginado<Remision>> {
    return Promise.resolve({
      items: [...this.porId.values()],
      total: this.porId.size,
      pagina: filtro.pagina ?? 1,
      porPagina: filtro.porPagina ?? 20,
    });
  }

  listarTodas(): Promise<Remision[]> {
    return Promise.resolve([...this.porId.values()]);
  }

  buscarPorIds(ids: string[]): Promise<Remision[]> {
    return Promise.resolve(ids.map((id) => this.porId.get(id)).filter((r): r is Remision => !!r));
  }

  contarPorEstado(): Promise<ConteoPorEstado> {
    const conteo = conteoEnCero();
    for (const r of this.porId.values()) conteo[r.aObjeto().estado] += 1;
    return Promise.resolve(conteo);
  }

  totalizarCajas(fechaOperativa: Date, estados: readonly EstadoRemision[]): Promise<CajasAgrupadas[]> {
    return Promise.resolve(
      [...this.porId.values()]
        .map((r) => r.aObjeto())
        .filter((d) => d.fechaOperativa.getTime() === fechaOperativa.getTime() && estados.includes(d.estado))
        .map((d) => ({ turnoId: d.turnoId, productoId: d.productoId, extraoficial: d.extraoficial, cajas: d.cantidadCajas })),
    );
  }
}

const PRODUCTO_A: Producto = {
  id: 'prod-a',
  codigo: '300058141',
  descripcion: 'SURTIDO MEGA LONCHERA',
  proceso: 'MANUAL',
  activo: true,
  unidadesPorCaja: 4,
  cajasPorEstiba: 36,
  personasIdeal: null,
  subdescripcion: null,
  cajasPorHora: null,
  pesoNetoKg: null,
};
const PRODUCTO_B: Producto = { ...PRODUCTO_A, id: 'prod-b', codigo: '300099999', descripcion: 'OTRO' };
const PRODUCTO_INACTIVO: Producto = { ...PRODUCTO_A, id: 'prod-x', codigo: '300000000', activo: false };

function borrador(): Remision {
  return Remision.crear({
    anio: 2026,
    numero: 1,
    fechaOperativa: new Date('2026-09-14T00:00:00.000Z'),
    fechaHoraRegistro: new Date('2026-09-14T09:30:00-05:00'),
    turnoId: 'turno-t1',
    grupoId: 'prov-1',
    lugarId: 'lugar-1',
    productoId: PRODUCTO_A.id,
    codigoSnapshot: PRODUCTO_A.codigo,
    descripcionSnapshot: PRODUCTO_A.descripcion,
    fechaVencimiento: new Date('2027-03-01T00:00:00.000Z'),
    cantidadCajas: 36,
    cantidadUnidades: 144,
    estibasCompletas: 1,
    cajasSueltas: 0,
    numerosEstiba: [31],
    creadaPorId: 'user-coord',
  });
}

describe('EditarRemisionUseCase', () => {
  let remisiones: RemisionRepositorioFalso;
  let auditoria: AuditoriaRepositorioFalso;
  let useCase: EditarRemisionUseCase;

  beforeEach(async () => {
    remisiones = new RemisionRepositorioFalso();
    remisiones.agregar('rem-1', borrador());
    auditoria = new AuditoriaRepositorioFalso();
    const productos = new ProductoRepositorioFalso();
    productos.agregar(PRODUCTO_A);
    productos.agregar(PRODUCTO_B);
    productos.agregar(PRODUCTO_INACTIVO);

    // DPP del 14/09: 100 cajas de A y 50 de B.
    const bloques = new BloqueRepositorioFalso();
    const estandares = new EstandarRepositorioFalso();
    for (const p of [PRODUCTO_A, PRODUCTO_B]) {
      estandares.agregar({ productoId: p.id, codigo: p.codigo, descripcion: p.descripcion, subdescripcion: null, unidadesPorCaja: 4, cajasPorHora: null, pesoNetoKg: null });
    }
    const fecha = new Date('2026-09-14T00:00:00.000Z');
    await programarTarget(bloques, fecha, PRODUCTO_A.id, 100, 'L1');
    await programarTarget(bloques, fecha, PRODUCTO_B.id, 50, 'L2');

    useCase = new EditarRemisionUseCase(
      new UnidadDeTrabajoFalsa({
        remisiones,
        usuarios: new UsuarioRepositorioFalso(),
        productos,
        auditoria,
        bloques,
        estandares,
      }),
      productos,
    );
  });

  it('corrige cantidades y audita valor anterior y nuevo', async () => {
    const editada = await useCase.ejecutar({
      remisionId: 'rem-1',
      cambios: { cantidadCajas: 72, cantidadUnidades: 288, estibasCompletas: 2 },
      editadaPorId: 'user-admin',
    });

    expect(editada.aObjeto().cantidadCajas).toBe(72);
    expect(remisiones.porId.get('rem-1')!.aObjeto().cantidadCajas).toBe(72);
    expect(auditoria.entradas[0]).toMatchObject({
      entidad: 'remision',
      entidadId: 'rem-1',
      accion: 'ACTUALIZAR',
      usuarioId: 'user-admin',
      valorAnterior: { cantidadCajas: 36 },
      valorNuevo: { cantidadCajas: 72 },
    });
  });

  it('cambia el producto tomando el snapshot del catálogo', async () => {
    const editada = await useCase.ejecutar({
      remisionId: 'rem-1',
      cambios: { productoId: 'prod-b' },
      editadaPorId: 'user-admin',
    });

    expect(editada.aObjeto()).toMatchObject({
      productoId: 'prod-b',
      codigoSnapshot: '300099999',
      descripcionSnapshot: 'OTRO',
    });
  });

  it('rechaza un producto inexistente o inactivo sin tocar la remisión', async () => {
    await expect(
      useCase.ejecutar({ remisionId: 'rem-1', cambios: { productoId: 'nada' }, editadaPorId: 'u' }),
    ).rejects.toThrow(DatosRemisionInvalidosError);
    await expect(
      useCase.ejecutar({ remisionId: 'rem-1', cambios: { productoId: 'prod-x' }, editadaPorId: 'u' }),
    ).rejects.toThrow(DatosRemisionInvalidosError);

    expect(auditoria.entradas).toHaveLength(0);
    expect(remisiones.porId.get('rem-1')!.aObjeto().productoId).toBe('prod-a');
  });

  it('no edita una remisión entregada', async () => {
    const entregada = borrador();
    entregada.entregar('user-pat', new Date());
    remisiones.agregar('rem-2', entregada);

    await expect(
      useCase.ejecutar({ remisionId: 'rem-2', cambios: { cantidadCajas: 1 }, editadaPorId: 'u' }),
    ).rejects.toThrow(RemisionNoEditableError);
    expect(auditoria.entradas).toHaveLength(0);
  });

  it('falla si la remisión no existe', async () => {
    await expect(
      useCase.ejecutar({ remisionId: 'no', cambios: {}, editadaPorId: 'u' }),
    ).rejects.toThrow(RemisionNoEncontradaError);
  });

  it('la edición respeta el tope del DPP: cajas, producto y marca extraoficial', async () => {
    // Otra remisión APROBADA del día consume 80 de las 100 de A.
    const aprobada = borrador();
    aprobada.entregar('pat', new Date());
    aprobada.aprobar('OPA', null, new Date());
    remisiones.agregar('rem-ok', Remision.desdePersistencia({ ...aprobada.aObjeto(), cantidadCajas: 80 }));

    await expect(useCase.ejecutar({ remisionId: 'rem-1', cambios: { cantidadCajas: 20 }, editadaPorId: 'u' })).resolves.toBeDefined();
    await expect(useCase.ejecutar({ remisionId: 'rem-1', cambios: { cantidadCajas: 21 }, editadaPorId: 'u' })).rejects.toThrow(RemisionExcedeProgramacionError);
    // Cambiar a B (50 programadas, 0 aprobadas) con 21 cajas sí cabe.
    await expect(useCase.ejecutar({ remisionId: 'rem-1', cambios: { productoId: 'prod-b', cantidadCajas: 21 }, editadaPorId: 'u' })).resolves.toBeDefined();
    // Un producto fuera del DPP no se puede poner… salvo extraoficial con motivo.
    await expect(useCase.ejecutar({ remisionId: 'rem-1', cambios: { productoId: 'prod-x' }, editadaPorId: 'u' })).rejects.toThrow(DatosRemisionInvalidosError); // inactivo
    await expect(useCase.ejecutar({ remisionId: 'rem-1', cambios: { cantidadCajas: 500 }, editadaPorId: 'u' })).rejects.toThrow(RemisionExcedeProgramacionError);
    const emergencia = await useCase.ejecutar({ remisionId: 'rem-1', cambios: { cantidadCajas: 500, extraoficial: true, motivoExtraoficial: 'Pedido extra del OPA' }, editadaPorId: 'u' });
    expect(emergencia.esExtraoficial).toBe(true);
    // Quitar la marca vuelve a aplicar el tope.
    await expect(useCase.ejecutar({ remisionId: 'rem-1', cambios: { extraoficial: false }, editadaPorId: 'u' })).rejects.toThrow(RemisionExcedeProgramacionError);
    expect(remisiones.porId.get('rem-1')!.aObjeto().productoId).toBe('prod-b');
  });
});
