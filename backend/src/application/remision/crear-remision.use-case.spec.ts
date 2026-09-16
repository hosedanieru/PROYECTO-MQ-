import { beforeEach, describe, expect, it } from 'vitest';

import type {
  Producto,
  ProductoRepository,
} from '../../domain/producto/producto.repository.js';
import { Remision } from '../../domain/remision/remision.entity.js';
import { DatosRemisionInvalidosError } from '../../domain/remision/remision.errors.js';
import type {
  FiltroRemisiones,
  RemisionRepository,
  ResultadoPaginado,
} from '../../domain/remision/remision.repository.js';
import {
  AuditoriaRepositorioFalso,
  UnidadDeTrabajoFalsa,
  UsuarioRepositorioFalso,
} from '../pruebas/dobles-en-memoria.js';
import {
  CrearRemisionUseCase,
  type CrearRemisionComando,
  type Reloj,
} from './crear-remision.use-case.js';

// ============================================================
// DOBLES DE PRUEBA
// ============================================================

/**
 * Implementaciones en memoria de las interfaces del dominio.
 *
 * Esto es lo que compra la arquitectura: el caso de uso se prueba
 * completo, sin PostgreSQL, sin Prisma y sin levantar NestJS.
 */

class ProductoRepositorioFalso implements ProductoRepository {
  private readonly items = new Map<string, Producto>();

  agregar(producto: Producto): void {
    this.items.set(producto.id, producto);
  }

  buscarPorId(id: string): Promise<Producto | null> {
    return Promise.resolve(this.items.get(id) ?? null);
  }

  buscarPorCodigo(codigo: string): Promise<Producto | null> {
    const encontrado = [...this.items.values()].find(
      (p) => p.codigo === codigo,
    );
    return Promise.resolve(encontrado ?? null);
  }
}

class RemisionRepositorioFalso implements RemisionRepository {
  readonly guardadas: Remision[] = [];
  private readonly consecutivos = new Map<number, number>();

  crearConConsecutivo(
    construir: (anio: number, numero: number) => Remision,
    anio: number,
  ): Promise<Remision> {
    const siguiente = (this.consecutivos.get(anio) ?? 0) + 1;
    this.consecutivos.set(anio, siguiente);

    const remision = construir(anio, siguiente);
    this.guardadas.push(remision);

    return Promise.resolve(remision);
  }

  actualizar(remision: Remision): Promise<Remision> {
    return Promise.resolve(remision);
  }

  registrarVersion(): Promise<void> {
    return Promise.resolve();
  }

  buscarPorId(): Promise<Remision | null> {
    return Promise.resolve(null);
  }

  buscarPorConsecutivo(): Promise<Remision | null> {
    return Promise.resolve(null);
  }

  listar(filtro: FiltroRemisiones): Promise<ResultadoPaginado<Remision>> {
    return Promise.resolve({
      items: this.guardadas,
      total: this.guardadas.length,
      pagina: filtro.pagina ?? 1,
      porPagina: filtro.porPagina ?? 20,
    });
  }
}

class RelojFijo implements Reloj {
  constructor(private instante: Date) {}

  ahora(): Date {
    return this.instante;
  }

  mover(instante: Date): void {
    this.instante = instante;
  }
}

// ============================================================
// PRUEBAS
// ============================================================

const PRODUCTO: Producto = {
  id: 'prod-1',
  codigo: '300058141',
  descripcion: 'SURTIDO MEGA LONCHERA 586GX3X1 BX22',
  activo: true,
  unidadesPorCaja: 4,
  cajasPorEstiba: 36,
};

function comando(
  sobrescribir: Partial<CrearRemisionComando> = {},
): CrearRemisionComando {
  return {
    turnoId: 'turno-t1',
    proveedorId: 'prov-logicmard',
    lugarId: 'lugar-mq',
    productoId: 'prod-1',
    fechaVencimiento: new Date('2027-03-01T00:00:00.000Z'),
    cantidadCajas: 36,
    cantidadUnidades: 144,
    estibasCompletas: 1,
    cajasSueltas: 0,
    numerosEstiba: [31],
    observaciones: null,
    creadaPorId: 'user-coordinador',
    ...sobrescribir,
  };
}

describe('CrearRemisionUseCase', () => {
  let productos: ProductoRepositorioFalso;
  let remisiones: RemisionRepositorioFalso;
  let auditoria: AuditoriaRepositorioFalso;
  let reloj: RelojFijo;
  let useCase: CrearRemisionUseCase;

  beforeEach(() => {
    productos = new ProductoRepositorioFalso();
    productos.agregar(PRODUCTO);

    remisiones = new RemisionRepositorioFalso();
    auditoria = new AuditoriaRepositorioFalso();
    reloj = new RelojFijo(new Date('2026-09-14T09:30:00-05:00'));

    useCase = new CrearRemisionUseCase(
      new UnidadDeTrabajoFalsa({
        remisiones,
        auditoria,
        usuarios: new UsuarioRepositorioFalso(),
      }),
      productos,
      reloj,
    );
  });

  it('crea la remisión en estado BORRADOR', async () => {
    const remision = await useCase.ejecutar(comando());

    expect(remision.estado).toBe('BORRADOR');
    expect(remisiones.guardadas).toHaveLength(1);
  });

  it('audita la creación con el usuario que la registró', async () => {
    const remision = await useCase.ejecutar(comando());

    expect(auditoria.entradas).toHaveLength(1);
    expect(auditoria.entradas[0]).toMatchObject({
      entidad: 'remision',
      entidadId: remision.id,
      accion: 'CREAR',
      usuarioId: 'user-coordinador',
    });
  });

  it('congela el código y la descripción del producto', async () => {
    const remision = await useCase.ejecutar(comando());
    const datos = remision.aObjeto();

    expect(datos.codigoSnapshot).toBe('300058141');
    expect(datos.descripcionSnapshot).toBe(
      'SURTIDO MEGA LONCHERA 586GX3X1 BX22',
    );
  });

  it('asigna consecutivos secuenciales dentro del mismo año', async () => {
    const primera = await useCase.ejecutar(comando());
    const segunda = await useCase.ejecutar(comando());

    expect(primera.consecutivo).toBe('2026-0001');
    expect(segunda.consecutivo).toBe('2026-0002');
  });

  describe('cálculo del día operativo', () => {
    it('un turno diurno queda en el mismo día calendario', async () => {
      const remision = await useCase.ejecutar(comando());

      expect(remision.aObjeto().fechaOperativa.toISOString()).toBe(
        '2026-09-14T00:00:00.000Z',
      );
    });

    it('una remisión de la madrugada queda en el día operativo anterior', async () => {
      // 02:00 del martes 15 → pertenece al lunes 14 (turno T3)
      reloj.mover(new Date('2026-09-15T02:00:00-05:00'));

      const remision = await useCase.ejecutar(comando());

      expect(remision.aObjeto().fechaOperativa.toISOString()).toBe(
        '2026-09-14T00:00:00.000Z',
      );
    });

    it('conserva el instante real del registro además del día operativo', async () => {
      const instante = new Date('2026-09-15T02:14:00-05:00');
      reloj.mover(instante);

      const remision = await useCase.ejecutar(comando());

      expect(remision.aObjeto().fechaHoraRegistro).toEqual(instante);
    });
  });

  describe('año del consecutivo', () => {
    it('usa el año de la fecha operativa, no el del calendario', async () => {
      // 1 de enero de 2027 a las 03:00 → día operativo 31/12/2026
      reloj.mover(new Date('2027-01-01T03:00:00-05:00'));

      const remision = await useCase.ejecutar(comando());

      expect(remision.consecutivo).toBe('2026-0001');
    });

    it('reinicia el consecutivo al cambiar de año operativo', async () => {
      await useCase.ejecutar(comando());

      reloj.mover(new Date('2027-06-15T09:00:00-05:00'));
      const deOtroAnio = await useCase.ejecutar(
        comando({ fechaVencimiento: new Date('2027-12-01T00:00:00.000Z') }),
      );

      expect(deOtroAnio.consecutivo).toBe('2027-0001');
    });
  });

  describe('validaciones', () => {
    it('falla si el producto no existe', async () => {
      await expect(
        useCase.ejecutar(comando({ productoId: 'no-existe' })),
      ).rejects.toThrow(DatosRemisionInvalidosError);
    });

    it('falla si el producto está inactivo', async () => {
      productos.agregar({ ...PRODUCTO, id: 'prod-2', activo: false });

      await expect(
        useCase.ejecutar(comando({ productoId: 'prod-2' })),
      ).rejects.toThrow(DatosRemisionInvalidosError);
    });

    it('propaga las reglas de la entidad', async () => {
      await expect(
        useCase.ejecutar(comando({ cantidadCajas: 0 })),
      ).rejects.toThrow(DatosRemisionInvalidosError);
    });

    it('no guarda nada cuando la validación falla', async () => {
      await expect(
        useCase.ejecutar(comando({ productoId: 'no-existe' })),
      ).rejects.toThrow();

      expect(remisiones.guardadas).toHaveLength(0);
    });
  });
});
