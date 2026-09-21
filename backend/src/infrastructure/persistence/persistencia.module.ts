/**
 * MÓDULO DE PERSISTENCIA — selector de base de datos
 * ==================================================
 *
 * Aquí, y solo aquí, se decide qué implementación de cada puerto del
 * dominio usa la aplicación:
 *
 *   PERSISTENCIA=postgres    Prisma + PostgreSQL (por defecto)
 *   PERSISTENCIA=firestore   firebase-admin + Firestore
 *
 * Los casos de uso, los controladores y el frontend no se enteran. Las
 * dos implementaciones conviven en el código; se elige al arrancar.
 *
 * Los tokens exportados son los mismos en ambos casos: la unidad de
 * trabajo y los repositorios de lectura (fuera de transacción).
 */

import { Module, type Provider } from '@nestjs/common';

import { CATALOGO_REPOSITORY } from '../../domain/catalogo/catalogo.repository.js';
import { GRUPO_REPOSITORY } from '../../domain/grupo/grupo.repository.js';
import { ASIGNACION_REPOSITORY } from '../../domain/mfr/asignacion-linea.js';
import { ASISTENCIA_REPOSITORY } from '../../domain/mfr/asistencia-turno.js';
import { ESTANDAR_REPOSITORY } from '../../domain/mfr/estandar-produccion.js';
import { HORARIO_REPOSITORY } from '../../domain/mfr/horas-turno.js';
import { LINEA_REPOSITORY } from '../../domain/mfr/linea-produccion.js';
import { BLOQUE_REPOSITORY } from '../../domain/mfr/bloque-programacion.js';
import { PRODUCTO_REPOSITORY } from '../../domain/producto/producto.repository.js';
import { HISTORIAL_REMISION_REPOSITORY } from '../../domain/remision/historial.repository.js';
import { REMISION_REPOSITORY } from '../../domain/remision/remision.repository.js';
import { UNIDAD_DE_TRABAJO } from '../../domain/shared/unidad-de-trabajo.js';
import { USUARIO_REPOSITORY } from '../../domain/usuario/usuario.repository.js';
import { PrismaModule } from '../database/prisma/prisma.module.js';
import { PrismaService } from '../database/prisma/prisma.service.js';
import { ClienteFirestore } from '../firestore/cliente-firestore.js';
import { FirestoreService } from '../firestore/firestore.service.js';
import { CatalogoFirestoreRepository } from '../firestore/repositorios/catalogo.firestore.repository.js';
import { AsignacionFirestoreRepository } from '../firestore/repositorios/asignacion.firestore.repository.js';
import { AsistenciaFirestoreRepository } from '../firestore/repositorios/asistencia.firestore.repository.js';
import { GrupoFirestoreRepository } from '../firestore/repositorios/grupo.firestore.repository.js';
import {
  BloqueFirestoreRepository,
  EstandarFirestoreRepository,
  LineaFirestoreRepository,
} from '../firestore/repositorios/mfr.firestore.repositories.js';
import { ProductoFirestoreRepository } from '../firestore/repositorios/producto.firestore.repository.js';
import {
  HistorialRemisionFirestoreRepository,
  RemisionFirestoreRepository,
} from '../firestore/repositorios/remision.firestore.repository.js';
import { UsuarioFirestoreRepository } from '../firestore/repositorios/usuario.firestore.repository.js';
import { UnidadDeTrabajoFirestore } from '../firestore/unidad-de-trabajo.firestore.js';
import { CatalogoPrismaRepository } from './prisma/catalogo.prisma.repository.js';
import { AsignacionPrismaRepository } from './prisma/asignacion.prisma.repository.js';
import { AsistenciaPrismaRepository } from './prisma/asistencia.prisma.repository.js';
import { GrupoPrismaRepository } from './prisma/grupo.prisma.repository.js';
import { HistorialRemisionPrismaRepository } from './prisma/historial-remision.prisma.repository.js';
import {
  BloquePrismaRepository,
  EstandarPrismaRepository,
  HorarioPrismaRepository,
  LineaPrismaRepository,
} from './prisma/mfr.prisma.repositories.js';
import { ProductoPrismaRepository } from './prisma/producto.prisma.repository.js';
import { RemisionPrismaRepository } from './prisma/remision.prisma.repository.js';
import { UnidadDeTrabajoPrisma } from './prisma/unidad-de-trabajo.prisma.js';
import { UsuarioPrismaRepository } from './prisma/usuario.prisma.repository.js';

export type TipoPersistencia = 'postgres' | 'firestore';

export function tipoPersistencia(): TipoPersistencia {
  const valor = (process.env.PERSISTENCIA ?? 'postgres').toLowerCase();
  if (valor !== 'postgres' && valor !== 'firestore') {
    throw new Error(`PERSISTENCIA="${valor}" no es válido. Use "postgres" o "firestore".`);
  }
  return valor;
}

const TOKENS = [
  UNIDAD_DE_TRABAJO,
  REMISION_REPOSITORY,
  HISTORIAL_REMISION_REPOSITORY,
  PRODUCTO_REPOSITORY,
  USUARIO_REPOSITORY,
  CATALOGO_REPOSITORY,
  GRUPO_REPOSITORY,
  ASISTENCIA_REPOSITORY,
  ASIGNACION_REPOSITORY,
  BLOQUE_REPOSITORY,
  LINEA_REPOSITORY,
  ESTANDAR_REPOSITORY,
  HORARIO_REPOSITORY,
];

// ---------- PostgreSQL ----------

const conPrisma = <T>(token: symbol, Repo: new (p: PrismaService) => T): Provider => ({
  provide: token,
  inject: [PrismaService],
  useFactory: (prisma: PrismaService) => new Repo(prisma),
});

const REGISTROS_POSTGRES: Provider[] = [
  { provide: UNIDAD_DE_TRABAJO, useClass: UnidadDeTrabajoPrisma },
  conPrisma(REMISION_REPOSITORY, RemisionPrismaRepository),
  conPrisma(HISTORIAL_REMISION_REPOSITORY, HistorialRemisionPrismaRepository),
  conPrisma(PRODUCTO_REPOSITORY, ProductoPrismaRepository),
  conPrisma(USUARIO_REPOSITORY, UsuarioPrismaRepository),
  conPrisma(CATALOGO_REPOSITORY, CatalogoPrismaRepository),
  conPrisma(GRUPO_REPOSITORY, GrupoPrismaRepository),
  conPrisma(ASISTENCIA_REPOSITORY, AsistenciaPrismaRepository),
  conPrisma(ASIGNACION_REPOSITORY, AsignacionPrismaRepository),
  conPrisma(BLOQUE_REPOSITORY, BloquePrismaRepository),
  conPrisma(LINEA_REPOSITORY, LineaPrismaRepository),
  conPrisma(ESTANDAR_REPOSITORY, EstandarPrismaRepository),
  conPrisma(HORARIO_REPOSITORY, HorarioPrismaRepository),
];

// ---------- Firestore ----------

const conFirestore = <T>(token: symbol, Repo: new (c: ClienteFirestore) => T): Provider => ({
  provide: token,
  inject: [FirestoreService],
  useFactory: (servicio: FirestoreService) => new Repo(new ClienteFirestore(servicio.db)),
});

const REGISTROS_FIRESTORE: Provider[] = [
  FirestoreService,
  { provide: UNIDAD_DE_TRABAJO, useClass: UnidadDeTrabajoFirestore },
  conFirestore(REMISION_REPOSITORY, RemisionFirestoreRepository),
  conFirestore(HISTORIAL_REMISION_REPOSITORY, HistorialRemisionFirestoreRepository),
  conFirestore(PRODUCTO_REPOSITORY, ProductoFirestoreRepository),
  conFirestore(USUARIO_REPOSITORY, UsuarioFirestoreRepository),
  conFirestore(CATALOGO_REPOSITORY, CatalogoFirestoreRepository),
  conFirestore(GRUPO_REPOSITORY, GrupoFirestoreRepository),
  conFirestore(ASISTENCIA_REPOSITORY, AsistenciaFirestoreRepository),
  conFirestore(ASIGNACION_REPOSITORY, AsignacionFirestoreRepository),
  conFirestore(HORARIO_REPOSITORY, CatalogoFirestoreRepository),
  conFirestore(BLOQUE_REPOSITORY, BloqueFirestoreRepository),
  conFirestore(LINEA_REPOSITORY, LineaFirestoreRepository),
  conFirestore(ESTANDAR_REPOSITORY, EstandarFirestoreRepository),
];

const tipo = tipoPersistencia();

@Module({
  imports: tipo === 'postgres' ? [PrismaModule] : [],
  providers: tipo === 'postgres' ? REGISTROS_POSTGRES : REGISTROS_FIRESTORE,
  exports: TOKENS,
})
export class PersistenciaModule {}
