import { beforeEach, describe, expect, it } from 'vitest';

import type { Producto } from '../../domain/producto/producto.repository.js';
import { Remision, type EstadoRemision } from '../../domain/remision/remision.entity.js';
import {
  DatosRemisionInvalidosError,
  ProductoNoProgramadoError,
  RemisionExcedeProgramacionError,
  SinProgramacionDelDiaError,
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
import {
  CrearRemisionUseCase,
  type CrearRemisionComando,
  type Reloj,
} from './crear-remision.use-case.js';

// ============================================================
// DOBLES DE PRUEBA
// ============================================================

/**
 * Implementación en memoria del repositorio de remisiones. Los dobles
 * transversales (productos, usuarios, auditoría, unidad de trabajo)
 * viven en `application/pruebas/dobles-en-memoria.ts`.
 *
 * Esto es lo que compra la arquitectura: el caso de uso se prueba
 * completo, sin PostgreSQL, sin Prisma y sin levantar NestJS.
 */

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

  listarTodas(): Promise<Remision[]> {
    return Promise.resolve([...this.guardadas]);
  }

  buscarPorIds(): Promise<Remision[]> {
    return Promise.resolve([]);
  }

  contarPorEstado(): Promise<ConteoPorEstado> {
    const conteo = conteoEnCero();
    for (const r of this.guardadas) conteo[r.aObjeto().estado] += 1;
    return Promise.resolve(conteo);
  }

  /** Igual que la base: suma cajas por turno, producto y extraoficial, solo de los estados pedidos. */
  totalizarCajas(fechaOperativa: Date, estados: readonly EstadoRemision[]): Promise<CajasAgrupadas[]> {
    const grupos = new Map<string, CajasAgrupadas>();
    for (const r of this.guardadas) {
      const d = r.aObjeto();
      if (d.fechaOperativa.getTime() !== fechaOperativa.getTime() || !estados.includes(d.estado)) continue;
      const clave = `${d.turnoId}|${d.productoId}|${d.extraoficial}`;
      const g = grupos.get(clave) ?? { turnoId: d.turnoId, productoId: d.productoId, extraoficial: d.extraoficial, cajas: 0 };
      g.cajas += d.cantidadCajas;
      grupos.set(clave, g);
    }
    return Promise.resolve([...grupos.values()]);
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
  proceso: 'MANUAL',
  activo: true,
  unidadesPorCaja: 4,
  cajasPorEstiba: 36,
  personasIdeal: null,
  subdescripcion: null,
  cajasPorHora: null,
  pesoNetoKg: null,
};

function comando(
  sobrescribir: Partial<CrearRemisionComando> = {},
): CrearRemisionComando {
  return {
    turnoId: 'turno-t1',
    grupoId: 'prov-logicmard',
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
  let bloques: BloqueRepositorioFalso;
  let auditoria: AuditoriaRepositorioFalso;
  let reloj: RelojFijo;
  let useCase: CrearRemisionUseCase;

  beforeEach(async () => {
    productos = new ProductoRepositorioFalso();
    productos.agregar(PRODUCTO);

    remisiones = new RemisionRepositorioFalso();
    auditoria = new AuditoriaRepositorioFalso();
    reloj = new RelojFijo(new Date('2026-09-14T09:30:00-05:00'));

    // "Ni una caja más de lo programado": cada día operativo de las
    // pruebas tiene un DPP con 1.000 cajas del producto.
    bloques = new BloqueRepositorioFalso();
    const estandares = new EstandarRepositorioFalso();
    estandares.agregar({ productoId: 'prod-1', codigo: PRODUCTO.codigo, descripcion: PRODUCTO.descripcion, subdescripcion: null, unidadesPorCaja: 4, cajasPorHora: null, pesoNetoKg: null });
    for (const dia of ['2026-09-14', '2026-12-31', '2027-06-15']) {
      await programarTarget(bloques, new Date(`${dia}T00:00:00.000Z`), 'prod-1', 1000);
    }

    useCase = new CrearRemisionUseCase(
      new UnidadDeTrabajoFalsa({
        remisiones,
        auditoria,
        usuarios: new UsuarioRepositorioFalso(),
        productos,
        bloques,
        estandares,
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

  describe('tope de lo programado (DPP)', () => {
    /** Deja una remisión APROBADA del día con las cajas dadas. */
    const aprobada = (cajas: number, extraoficial = false) =>
      remisiones.guardadas.push(
        Remision.desdePersistencia({
          ...comando(), id: `r-${cajas}`, anio: 2026, numero: 99, version: 1, estado: 'APROBADA',
          fechaOperativa: new Date('2026-09-14T00:00:00.000Z'), fechaHoraRegistro: new Date(),
          codigoSnapshot: PRODUCTO.codigo, descripcionSnapshot: PRODUCTO.descripcion,
          cantidadCajas: cajas, extraoficial, motivoExtraoficial: extraoficial ? 'Emergencia OPA' : null,
        }),
      );

    it('permite remisionar hasta completar lo programado, ni una caja más', async () => {
      aprobada(900);
      await expect(useCase.ejecutar(comando({ cantidadCajas: 100 }))).resolves.toBeDefined();
      await expect(useCase.ejecutar(comando({ cantidadCajas: 101 }))).rejects.toThrow(RemisionExcedeProgramacionError);
      // La que acaba de crearse es BORRADOR: todavía no cuenta (solo aprobadas y validadas).
      await expect(useCase.ejecutar(comando({ cantidadCajas: 100 }))).resolves.toBeDefined();
      // El número no se consume cuando el tope rechaza la remisión.
      expect(remisiones.guardadas.filter((r) => r.estado === 'BORRADOR').map((r) => r.consecutivo)).toEqual(['2026-0001', '2026-0002']);
    });

    it('las extraoficiales no cuentan para el tope y pasan aunque lo superen (con motivo)', async () => {
      aprobada(1000);
      aprobada(500, true);
      await expect(useCase.ejecutar(comando({ cantidadCajas: 1 }))).rejects.toThrow(RemisionExcedeProgramacionError);

      const emergencia = await useCase.ejecutar(comando({ cantidadCajas: 200, extraoficial: true, motivoExtraoficial: 'Pedido de emergencia del OPA' }));
      expect(emergencia.esExtraoficial).toBe(true);
      expect(emergencia.aObjeto().motivoExtraoficial).toBe('Pedido de emergencia del OPA');

      await expect(useCase.ejecutar(comando({ cantidadCajas: 200, extraoficial: true }))).rejects.toThrow(DatosRemisionInvalidosError);
    });

    it('sin DPP del día se bloquea; un producto fuera del DPP también', async () => {
      reloj.mover(new Date('2026-09-20T09:00:00-05:00')); // día sin programación
      await expect(useCase.ejecutar(comando())).rejects.toThrow(SinProgramacionDelDiaError);
      await expect(useCase.ejecutar(comando({ extraoficial: true, motivoExtraoficial: 'Emergencia' }))).resolves.toBeDefined();

      reloj.mover(new Date('2026-09-14T09:00:00-05:00'));
      productos.agregar({ ...PRODUCTO, id: 'prod-2', codigo: '300000002' });
      await expect(useCase.ejecutar(comando({ productoId: 'prod-2' }))).rejects.toThrow(ProductoNoProgramadoError);
    });
  });
});
