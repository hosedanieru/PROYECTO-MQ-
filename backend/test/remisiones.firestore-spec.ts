/**
 * PRUEBAS DE INTEGRACIÓN — Firestore
 * ==================================
 *
 * Las mismas garantías que se probaron contra PostgreSQL, ahora contra
 * Firestore: consecutivo sin duplicados bajo concurrencia, atomicidad
 * (si la auditoría falla no queda nada), ida y vuelta del mapeo, flujo
 * completo con edición y rectificación, MFR.
 */

import bcrypt from 'bcrypt';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import { CrearRemisionUseCase } from '../src/application/remision/crear-remision.use-case.js';
import { EditarRemisionUseCase } from '../src/application/remision/editar-remision.use-case.js';
import {
  AprobarRemisionUseCase,
  EntregarRemisionUseCase,
  RechazarRemisionUseCase,
  RectificarRemisionUseCase,
  ValidarRemisionUseCase,
} from '../src/application/remision/flujo-remision.use-cases.js';
import { IniciarSesionUseCase } from '../src/application/auth/iniciar-sesion.use-case.js';
import type { AuditoriaRepository } from '../src/domain/auditoria/auditoria.repository.js';
import { BloqueProgramacion } from '../src/domain/mfr/bloque-programacion.js';
import type { UnidadDeTrabajo } from '../src/domain/shared/unidad-de-trabajo.js';
import { ClienteFirestore, COLECCION } from '../src/infrastructure/firestore/cliente-firestore.js';
import { FirestoreService } from '../src/infrastructure/firestore/firestore.service.js';
import { AsignacionFirestoreRepository } from '../src/infrastructure/firestore/repositorios/asignacion.firestore.repository.js';
import { AsistenciaFirestoreRepository } from '../src/infrastructure/firestore/repositorios/asistencia.firestore.repository.js';
import { AuditoriaFirestoreRepository } from '../src/infrastructure/firestore/repositorios/auditoria.firestore.repository.js';
import { GrupoFirestoreRepository } from '../src/infrastructure/firestore/repositorios/grupo.firestore.repository.js';
import {
  BloqueFirestoreRepository,
  EstandarFirestoreRepository,
  LineaFirestoreRepository,
} from '../src/infrastructure/firestore/repositorios/mfr.firestore.repositories.js';
import { ProductoFirestoreRepository } from '../src/infrastructure/firestore/repositorios/producto.firestore.repository.js';
import {
  HistorialRemisionFirestoreRepository,
  RemisionFirestoreRepository,
} from '../src/infrastructure/firestore/repositorios/remision.firestore.repository.js';
import { UsuarioFirestoreRepository } from '../src/infrastructure/firestore/repositorios/usuario.firestore.repository.js';
import { UnidadDeTrabajoFirestore } from '../src/infrastructure/firestore/unidad-de-trabajo.firestore.js';

const RELOJ_FIJO = { ahora: () => new Date('2026-09-14T09:30:00-05:00') };

let servicio: FirestoreService;
let cliente: ClienteFirestore;
let uow: UnidadDeTrabajoFirestore;
let productos: ProductoFirestoreRepository;
let remisiones: RemisionFirestoreRepository;
let productoId: string;
const ADMIN_ID = 'admin-test';

async function vaciar(coleccion: string): Promise<void> {
  const snap = await servicio.db.collection(coleccion).limit(500).get();
  if (snap.empty) return;
  const lote = servicio.db.batch();
  snap.docs.forEach((d) => lote.delete(d.ref));
  await lote.commit();
  await vaciar(coleccion);
}

function comando(extra: Record<string, unknown> = {}) {
  return {
    turnoId: 'T1', grupoId: 'LOGICMARD', lugarId: 'MQ_PEPSICO_SD', productoId,
    fechaVencimiento: new Date('2027-03-01T00:00:00.000Z'),
    cantidadCajas: 36, cantidadUnidades: 144, estibasCompletas: 1, cajasSueltas: 0,
    numerosEstiba: [31], observaciones: null, creadaPorId: ADMIN_ID, ...extra,
  };
}

beforeAll(async () => {
  servicio = new FirestoreService();
  cliente = new ClienteFirestore(servicio.db);
  uow = new UnidadDeTrabajoFirestore(servicio);
  productos = new ProductoFirestoreRepository(cliente);
  remisiones = new RemisionFirestoreRepository(cliente);

  for (const c of Object.values(COLECCION)) await vaciar(c);

  await servicio.db.collection(COLECCION.roles).doc('ADMINISTRADOR').set({
    codigo: 'ADMINISTRADOR', nombre: 'Administrador', activo: true, permisos: ['remision.crear'],
  });
  await servicio.db.collection(COLECCION.usuarios).doc(ADMIN_ID).set({
    documento: 'admin-test', nombre: 'Admin de pruebas', email: null,
    passwordHash: await bcrypt.hash('clave-de-pruebas', 4), activo: true, rolId: 'ADMINISTRADOR',
  });
  await servicio.db.collection(COLECCION.turnos).doc('T1').set({
    codigo: 'T1', nombre: 'Turno 1', activo: true,
    horarios: [{ diaSemana: 'LUNES', horaInicio: '06:00', horaFin: '13:30', cruzaMedianoche: false, vigenteDesde: new Date('2026-01-01T00:00:00Z'), vigenteHasta: null }],
  });
  const producto = await productos.crear({
    codigo: '300058141', descripcion: 'SURTIDO MEGA LONCHERA', proceso: 'MANUAL',
    unidadesPorCaja: 4, cajasPorEstiba: 36, personasIdeal: 13, subdescripcion: 'SURTIDO',
  });
  productoId = producto.id;

  // DPP de 1.000 cajas el 14/09: sin programación no se puede remisionar.
  await servicio.db.collection(COLECCION.lineasProduccion).doc('L1').set({ codigo: 'L1', nombre: 'L1', tipo: 'MULTIPACK', capacidadKgHora: 306, orden: 1, activo: true });
  await new BloqueFirestoreRepository(cliente).crear(
    BloqueProgramacion.crear(
      { fechaOperativa: new Date('2026-09-14T00:00:00.000Z'), lineaId: 'L1', productoId, horaInicio: '06:00', horaFin: '13:30', cajasPorHora: 1000 / 7.5, eficienciaPorcentaje: 100, loop: null, personasAsignadas: null },
      'T1', 'MANUAL', ADMIN_ID, new Date(),
    ),
  );
});

afterAll(async () => {
  await servicio.db.terminate();
});

beforeEach(async () => {
  for (const c of [COLECCION.remisiones, COLECCION.remisionVersiones, COLECCION.consecutivos, COLECCION.auditoria]) await vaciar(c);
});

describe('consecutivo bajo concurrencia (transacción optimista)', () => {
  it('20 creaciones en paralelo obtienen 1..20 sin repetidos ni huecos', async () => {
    const useCase = new CrearRemisionUseCase(uow, productos, RELOJ_FIJO);
    const creadas = await Promise.all(Array.from({ length: 20 }, () => useCase.ejecutar(comando())));

    const numeros = creadas.map((r) => r.aObjeto().numero).sort((a, b) => a - b);
    expect(numeros).toEqual(Array.from({ length: 20 }, (_, i) => i + 1));
    const consecutivo = await servicio.db.collection(COLECCION.consecutivos).doc('REMISION-2026').get();
    expect(consecutivo.get('ultimo')).toBe(20);
    expect((await servicio.db.collection(COLECCION.auditoria).get()).size).toBe(20);
  });
});

describe('atomicidad', () => {
  class AuditoriaQueFalla implements AuditoriaRepository {
    registrar(): Promise<void> {
      return Promise.reject(new Error('Auditoría caída (simulada)'));
    }
  }
  const uowRota: UnidadDeTrabajo = {
    ejecutar: (trabajo) =>
      servicio.db.runTransaction((tx) => {
        const c = new ClienteFirestore(servicio.db, tx);
        return trabajo({
          remisiones: new RemisionFirestoreRepository(c), usuarios: new UsuarioFirestoreRepository(c),
          productos: new ProductoFirestoreRepository(c), grupos: new GrupoFirestoreRepository(c), auditoria: new AuditoriaQueFalla(),
          bloques: new BloqueFirestoreRepository(c),
          lineas: new LineaFirestoreRepository(c), estandares: new EstandarFirestoreRepository(c),
          asistencias: new AsistenciaFirestoreRepository(c),
          asignaciones: new AsignacionFirestoreRepository(c),
        });
      }),
  };

  it('si la auditoría falla, no queda remisión ni se consume el consecutivo', async () => {
    const useCase = new CrearRemisionUseCase(uowRota, productos, RELOJ_FIJO);
    await expect(useCase.ejecutar(comando())).rejects.toThrow('Auditoría caída');

    expect((await servicio.db.collection(COLECCION.remisiones).get()).size).toBe(0);
    expect((await servicio.db.collection(COLECCION.consecutivos).doc('REMISION-2026').get()).exists).toBe(false);
  });
});

describe('mapeo ida y vuelta', () => {
  it('lo que se guarda es lo que se lee', async () => {
    const useCase = new CrearRemisionUseCase(uow, productos, RELOJ_FIJO);
    const creada = await useCase.ejecutar(comando({ numerosEstiba: [35, 31, 33], estibasCompletas: 3, observaciones: '  con espacios  ' }));
    const leida = (await remisiones.buscarPorId(creada.id))!;

    expect(leida.aObjeto()).toMatchObject({
      anio: 2026, numero: 1, version: 1, estado: 'BORRADOR', codigoSnapshot: '300058141',
      cantidadCajas: 36, estibasCompletas: 3, numerosEstiba: [31, 33, 35], observaciones: 'con espacios', creadaPorId: ADMIN_ID,
      extraoficial: false, motivoExtraoficial: null,
    });
    expect(leida.aObjeto().fechaOperativa.toISOString()).toBe('2026-09-14T00:00:00.000Z');
    expect((await remisiones.buscarPorConsecutivo(2026, 1))?.id).toBe(creada.id);
  });
});

describe('flujo completo', () => {
  it('crear → entregar → rechazar → rectificar → editar → entregar → aprobar → validar; historial y MFR', async () => {
    const crear = new CrearRemisionUseCase(uow, productos, RELOJ_FIJO);
    const editar = new EditarRemisionUseCase(uow, productos);
    const entregar = new EntregarRemisionUseCase(uow, RELOJ_FIJO);
    const rechazar = new RechazarRemisionUseCase(uow, RELOJ_FIJO);
    const rectificar = new RectificarRemisionUseCase(uow, RELOJ_FIJO);
    const aprobar = new AprobarRemisionUseCase(uow, RELOJ_FIJO);
    const validar = new ValidarRemisionUseCase(uow, RELOJ_FIJO);

    const r = await crear.ejecutar(comando());
    await entregar.ejecutar({ remisionId: r.id, entregadaPorId: ADMIN_ID });
    await rechazar.ejecutar({ remisionId: r.id, motivo: 'Faltan 2 cajas', registradaPorId: ADMIN_ID });
    expect((await remisiones.buscarPorId(r.id))!.motivoUltimoRechazo).toBe('Faltan 2 cajas');

    const rectificada = await rectificar.ejecutar({ remisionId: r.id, rectificadaPorId: ADMIN_ID });
    expect(rectificada.version).toBe(2);
    const editada = await editar.ejecutar({ remisionId: r.id, cambios: { cantidadCajas: 34, cantidadUnidades: 136, estibasCompletas: 0, cajasSueltas: 34 }, editadaPorId: ADMIN_ID });
    expect(editada.aObjeto().cantidadCajas).toBe(34);
    await entregar.ejecutar({ remisionId: r.id, entregadaPorId: ADMIN_ID });
    await aprobar.ejecutar({ remisionId: r.id, opaNombre: 'Carlos', opaCargo: 'Facturador', registradaPorId: ADMIN_ID });
    const validada = await validar.ejecutar({ remisionId: r.id, validadaPorId: ADMIN_ID, concilidadoCon: 'María' });
    expect(validada.estado).toBe('VALIDADA');

    const historial = new HistorialRemisionFirestoreRepository(cliente);
    const versiones = await historial.versiones(r.id);
    expect(versiones).toHaveLength(1);
    expect(versiones[0]).toMatchObject({ version: 1, motivoRechazo: 'Faltan 2 cajas', rectificadaPor: { nombre: 'Admin de pruebas' } });
    const auditoria = await historial.auditoria(r.id);
    expect(auditoria.map((e) => e.accion)).toEqual([
      'CREAR', 'CAMBIO_ESTADO', 'CAMBIO_ESTADO', 'CAMBIO_ESTADO', 'ACTUALIZAR', 'CAMBIO_ESTADO', 'CAMBIO_ESTADO', 'CAMBIO_ESTADO',
    ]);

    const totales = await remisiones.totalizarCajas(new Date('2026-09-14T00:00:00.000Z'), ['APROBADA', 'VALIDADA']);
    expect(totales).toEqual([{ turnoId: 'T1', productoId, extraoficial: false, cajas: 34 }]);

    const listado = await remisiones.listar({ estado: 'VALIDADA', pagina: 1, porPagina: 10 });
    expect(listado.total).toBe(1);
  });
});

describe('sesión', () => {
  it('login por documento contra usuarios de Firestore', async () => {
    const usuarios = new UsuarioFirestoreRepository(cliente);
    const hash = { hashear: (c: string) => bcrypt.hash(c, 4), verificar: (c: string, h: string) => bcrypt.compare(c, h) };
    const tokens = { emitir: async () => 'token', verificar: async () => null };
    const sesion = await new IniciarSesionUseCase(usuarios, hash, tokens).ejecutar({ documento: 'admin-test', contrasena: 'clave-de-pruebas' });

    expect(sesion.usuario).toMatchObject({ rolCodigo: 'ADMINISTRADOR', permisos: ['remision.crear'] });
    expect(sesion.usuario.id).toBe(ADMIN_ID);
  });
});
