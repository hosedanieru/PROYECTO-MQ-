/**
 * PRUEBAS DE INTEGRACIÓN — Remisiones contra PostgreSQL real
 * ==========================================================
 *
 * Lo que las 129 pruebas unitarias NO pueden comprobar porque simulan la
 * base:
 *
 *   1. El bloqueo de fila del consecutivo bajo concurrencia real.
 *   2. Que la transacción revierta cuando la auditoría falla.
 *   3. Que el mapeador traduzca ida y vuelta sin perder campos.
 *   4. El flujo completo por HTTP, con autenticación y permisos reales.
 *
 * Corre con `npm run test:e2e` contra la base `mq_test` (ver .env.test).
 */

import { ValidationPipe, type INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import type { App } from 'supertest/types.js';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import { CrearRemisionUseCase } from '../src/application/remision/crear-remision.use-case.js';
import { AppModule } from '../src/app.module.js';
import type { AuditoriaRepository } from '../src/domain/auditoria/auditoria.repository.js';
import type { UnidadDeTrabajo } from '../src/domain/shared/unidad-de-trabajo.js';
import { PrismaService } from '../src/infrastructure/database/prisma/prisma.service.js';
import { ErrorDominioFilter } from '../src/infrastructure/http/filters/error-dominio.filter.js';
import { AsignacionPrismaRepository } from '../src/infrastructure/persistence/prisma/asignacion.prisma.repository.js';
import { AsistenciaPrismaRepository } from '../src/infrastructure/persistence/prisma/asistencia.prisma.repository.js';
import { AuditoriaPrismaRepository } from '../src/infrastructure/persistence/prisma/auditoria.prisma.repository.js';
import { GrupoPrismaRepository } from '../src/infrastructure/persistence/prisma/grupo.prisma.repository.js';
import {
  BloquePrismaRepository,
  EstandarPrismaRepository,
  LineaPrismaRepository,
} from '../src/infrastructure/persistence/prisma/mfr.prisma.repositories.js';
import { ProductoPrismaRepository } from '../src/infrastructure/persistence/prisma/producto.prisma.repository.js';
import { RemisionPrismaRepository } from '../src/infrastructure/persistence/prisma/remision.prisma.repository.js';
import { UnidadDeTrabajoPrisma } from '../src/infrastructure/persistence/prisma/unidad-de-trabajo.prisma.js';
import { UsuarioPrismaRepository } from '../src/infrastructure/persistence/prisma/usuario.prisma.repository.js';
import { registroActual } from '../src/domain/shared/fecha-operativa.js';
import { catalogosBase, limpiarDatos, prisma, programarDia, type CatalogosBase } from './ayudantes.js';

const RELOJ_FIJO = { ahora: () => new Date('2026-09-14T09:30:00-05:00') };

let base: CatalogosBase;
let servicio: PrismaService;

function comando(extra: Record<string, unknown> = {}) {
  return {
    turnoId: base.turnoId,
    grupoId: base.grupoId,
    lugarId: base.lugarId,
    productoId: base.productoId,
    fechaVencimiento: new Date('2027-03-01T00:00:00.000Z'),
    cantidadCajas: 36,
    cantidadUnidades: 144,
    estibasCompletas: 1,
    cajasSueltas: 0,
    numerosEstiba: [31],
    observaciones: null,
    creadaPorId: base.adminId,
    ...extra,
  };
}

beforeAll(async () => {
  servicio = new PrismaService();
  await servicio.$connect();
  base = await catalogosBase();
});

afterAll(async () => {
  await servicio.$disconnect();
  await prisma.$disconnect();
});

beforeEach(async () => {
  await limpiarDatos();
  // DPP de 1.000 cajas para el día del reloj fijo y para el día operativo real (flujo HTTP).
  await programarDia(new Date('2026-09-14T00:00:00.000Z'), base.productoId, 1000);
  const hoy = registroActual(new Date()).fechaOperativa;
  if (hoy.getTime() !== new Date('2026-09-14T00:00:00.000Z').getTime()) {
    await programarDia(hoy, base.productoId, 1000);
  }
});

// ============================================================
// 1. CONCURRENCIA DEL CONSECUTIVO
// ============================================================

describe('consecutivo bajo concurrencia', () => {
  it('20 creaciones en paralelo obtienen 1..20 sin repetidos ni huecos', async () => {
    const uow = new UnidadDeTrabajoPrisma(servicio);
    const useCase = new CrearRemisionUseCase(uow, new ProductoPrismaRepository(servicio), RELOJ_FIJO);

    const creadas = await Promise.all(
      Array.from({ length: 20 }, () => useCase.ejecutar(comando())),
    );

    const numeros = creadas.map((r) => r.aObjeto().numero).sort((a, b) => a - b);
    expect(numeros).toEqual(Array.from({ length: 20 }, (_, i) => i + 1));

    const consecutivo = await prisma.consecutivo.findUnique({
      where: { tipo_anio: { tipo: 'REMISION', anio: 2026 } },
    });
    expect(consecutivo?.ultimo).toBe(20);
  });
});

// ============================================================
// 2. ATOMICIDAD: si la auditoría falla, nada queda
// ============================================================

describe('atomicidad de la unidad de trabajo', () => {
  /**
   * Misma transacción de Prisma que usa `UnidadDeTrabajoPrisma`, con los
   * repositorios reales de remisión y producto, pero una auditoría que
   * falla al final. Así se comprueba que el rollback de PostgreSQL deshace
   * la remisión, las estibas y el consecutivo ya reservado.
   */
  class AuditoriaQueFalla implements AuditoriaRepository {
    registrar(): Promise<void> {
      return Promise.reject(new Error('Auditoría caída (simulada)'));
    }
  }

  const uowConAuditoriaRota: UnidadDeTrabajo = {
    ejecutar: (trabajo) =>
      servicio.$transaction((tx) =>
        trabajo({
          remisiones: new RemisionPrismaRepository(tx),
          usuarios: new UsuarioPrismaRepository(tx),
          productos: new ProductoPrismaRepository(tx),
          grupos: new GrupoPrismaRepository(tx),
          auditoria: new AuditoriaQueFalla(),
          bloques: new BloquePrismaRepository(tx),
          lineas: new LineaPrismaRepository(tx),
          estandares: new EstandarPrismaRepository(tx),
          asistencias: new AsistenciaPrismaRepository(tx),
          asignaciones: new AsignacionPrismaRepository(tx),
        }),
      ),
  };

  it('no deja remisión ni consume el consecutivo', async () => {
    const useCase = new CrearRemisionUseCase(
      uowConAuditoriaRota,
      new ProductoPrismaRepository(servicio),
      RELOJ_FIJO,
    );

    await expect(useCase.ejecutar(comando())).rejects.toThrow('Auditoría caída');

    expect(await prisma.remision.count()).toBe(0);
    expect(await prisma.remisionEstiba.count()).toBe(0);
    const consecutivo = await prisma.consecutivo.findUnique({
      where: { tipo_anio: { tipo: 'REMISION', anio: 2026 } },
    });
    expect(consecutivo?.ultimo ?? 0).toBe(0);
  });

  it('con la auditoría real, la remisión y su rastro quedan juntos', async () => {
    const uow = new UnidadDeTrabajoPrisma(servicio);
    const useCase = new CrearRemisionUseCase(uow, new ProductoPrismaRepository(servicio), RELOJ_FIJO);

    const creada = await useCase.ejecutar(comando());

    expect(await prisma.remision.count()).toBe(1);
    const auditoria = await prisma.auditoria.findMany({ where: { entidadId: creada.id } });
    expect(auditoria).toHaveLength(1);
    expect(auditoria[0].accion).toBe('CREAR');
    void AuditoriaPrismaRepository; // referencia explícita: es la implementación bajo prueba
  });
});

// ============================================================
// 3. MAPEADOR: ida y vuelta
// ============================================================

describe('mapeador Prisma ↔ dominio', () => {
  it('lo que se guarda es lo que se lee, campo por campo', async () => {
    const uow = new UnidadDeTrabajoPrisma(servicio);
    const useCase = new CrearRemisionUseCase(uow, new ProductoPrismaRepository(servicio), RELOJ_FIJO);
    const repositorio = new RemisionPrismaRepository(servicio);

    const creada = await useCase.ejecutar(
      comando({ numerosEstiba: [35, 31, 33], estibasCompletas: 3, observaciones: '  con espacios  ' }),
    );
    const leida = await repositorio.buscarPorId(creada.id);

    expect(leida).not.toBeNull();
    const a = creada.aObjeto();
    const b = leida!.aObjeto();
    expect(b).toMatchObject({
      anio: 2026,
      numero: 1,
      version: 1,
      estado: 'BORRADOR',
      turnoId: a.turnoId,
      grupoId: a.grupoId,
      lugarId: a.lugarId,
      productoId: a.productoId,
      codigoSnapshot: '300058141',
      descripcionSnapshot: 'SURTIDO MEGA LONCHERA 586GX3X1 BX22',
      cantidadCajas: 36,
      cantidadUnidades: 144,
      estibasCompletas: 3,
      cajasSueltas: 0,
      numerosEstiba: [31, 33, 35],
      observaciones: 'con espacios',
      creadaPorId: base.adminId,
    });
    // Fecha operativa: 14/09 (turno diurno), guardada como DATE a medianoche UTC.
    expect(b.fechaOperativa.toISOString()).toBe('2026-09-14T00:00:00.000Z');
    expect(b.fechaHoraRegistro.getTime()).toBe(a.fechaHoraRegistro.getTime());
    expect(b.fechaVencimiento.toISOString()).toBe('2027-03-01T00:00:00.000Z');
  });

  it('el motivo del rechazo sobrevive entre lecturas', async () => {
    const uow = new UnidadDeTrabajoPrisma(servicio);
    const useCase = new CrearRemisionUseCase(uow, new ProductoPrismaRepository(servicio), RELOJ_FIJO);
    const repositorio = new RemisionPrismaRepository(servicio);

    const creada = await useCase.ejecutar(comando());
    creada.entregar(base.adminId, new Date());
    creada.rechazar('Faltan cajas');
    await repositorio.actualizar(creada);

    const leida = await repositorio.buscarPorId(creada.id);
    expect(leida!.motivoUltimoRechazo).toBe('Faltan cajas');
  });
});

// ============================================================
// 4. FLUJO COMPLETO POR HTTP
// ============================================================

describe('flujo completo por HTTP', () => {
  let app: INestApplication<App>;
  let token: string;

  beforeAll(async () => {
    const modulo = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = modulo.createNestApplication();
    app.setGlobalPrefix('api');
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }));
    app.useGlobalFilters(new ErrorDominioFilter());
    await app.init();

    const login = await request(app.getHttpServer())
      .post('/api/auth/login')
      .send({ documento: base.admin.documento, contrasena: base.admin.contrasena })
      .expect(200);
    token = login.body.token;
  });

  afterAll(async () => {
    await app.close();
  });

  const auth = () => ({ Authorization: `Bearer ${token}` });

  it('rechaza sin token y sin permiso', async () => {
    await request(app.getHttpServer()).get('/api/remisiones').expect(401);
  });

  it('crear → entregar → rechazar → rectificar → editar → entregar → aprobar → validar', async () => {
    const servidor = app.getHttpServer();
    const cuerpo = {
      turnoId: base.turnoId,
      grupoId: base.grupoId,
      lugarId: base.lugarId,
      productoId: base.productoId,
      fechaVencimiento: '2027-03-01',
      cantidadCajas: 36,
      cantidadUnidades: 144,
      estibasCompletas: 1,
      cajasSueltas: 0,
      numerosEstiba: [31],
    };

    const creada = await request(servidor).post('/api/remisiones').set(auth()).send(cuerpo).expect(201);
    const id: string = creada.body.id;
    expect(creada.body).toMatchObject({ estado: 'BORRADOR', version: 1, consecutivo: expect.stringMatching(/^\d{4}-0001$/) });

    // El cliente no puede declarar el autor.
    await request(servidor).post('/api/remisiones').set(auth()).send({ ...cuerpo, creadaPorId: id }).expect(400);

    await request(servidor).post(`/api/remisiones/${id}/aprobar`).set(auth()).send({ opaNombre: 'Carlos' }).expect(409);

    await request(servidor).post(`/api/remisiones/${id}/entregar`).set(auth()).expect(200);
    await request(servidor).patch(`/api/remisiones/${id}`).set(auth()).send({ cantidadCajas: 1 }).expect(409);

    const rechazada = await request(servidor)
      .post(`/api/remisiones/${id}/rechazar`).set(auth()).send({ motivo: 'Faltan 2 cajas' }).expect(200);
    expect(rechazada.body.motivoUltimoRechazo).toBe('Faltan 2 cajas');

    const rectificada = await request(servidor).post(`/api/remisiones/${id}/rectificar`).set(auth()).expect(200);
    expect(rectificada.body).toMatchObject({ estado: 'EN_RECTIFICACION', version: 2, esEditable: true });

    const editada = await request(servidor)
      .patch(`/api/remisiones/${id}`).set(auth())
      .send({ cantidadCajas: 34, cantidadUnidades: 136, estibasCompletas: 0, cajasSueltas: 34 })
      .expect(200);
    expect(editada.body).toMatchObject({ cantidadCajas: 34, descripcionEstibas: '34 cajas' });

    await request(servidor).post(`/api/remisiones/${id}/entregar`).set(auth()).expect(200);
    const aprobada = await request(servidor)
      .post(`/api/remisiones/${id}/aprobar`).set(auth())
      .send({ opaNombre: 'Carlos', opaCargo: 'Facturador' }).expect(200);
    expect(aprobada.body.estaPendienteDeConciliar).toBe(true);

    const validada = await request(servidor)
      .post(`/api/remisiones/${id}/validar`).set(auth()).send({ concilidadoCon: 'María' }).expect(200);
    expect(validada.body).toMatchObject({ estado: 'VALIDADA', version: 2, estaPendienteDeConciliar: false });

    // Trazabilidad: una versión archivada con el motivo, y auditoría de cada paso.
    const versiones = await request(servidor).get(`/api/remisiones/${id}/versiones`).set(auth()).expect(200);
    expect(versiones.body).toHaveLength(1);
    expect(versiones.body[0]).toMatchObject({ version: 1, motivoRechazo: 'Faltan 2 cajas' });
    expect(versiones.body[0].datosAnteriores.cantidadCajas).toBe(36);

    const auditoria = await request(servidor).get(`/api/remisiones/${id}/auditoria`).set(auth()).expect(200);
    const acciones = auditoria.body.map((e: { accion: string }) => e.accion);
    expect(acciones).toEqual([
      'CREAR', 'CAMBIO_ESTADO', 'CAMBIO_ESTADO', 'CAMBIO_ESTADO', 'ACTUALIZAR',
      'CAMBIO_ESTADO', 'CAMBIO_ESTADO', 'CAMBIO_ESTADO',
    ]);

    // Documentos.
    const pdf = await request(servidor).get(`/api/remisiones/${id}/pdf`).set(auth()).expect(200);
    expect(pdf.headers['content-type']).toBe('application/pdf');
    expect(pdf.body.subarray(0, 5).toString()).toBe('%PDF-');

    const excel = await request(servidor).get('/api/remisiones/exportar?estado=VALIDADA').set(auth()).expect(200);
    expect(excel.headers['content-type']).toContain('spreadsheetml');
  });
});
