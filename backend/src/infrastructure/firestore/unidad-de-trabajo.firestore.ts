/**
 * UNIDAD DE TRABAJO — Implementación con Firestore
 * ================================================
 *
 * `db.runTransaction` da atomicidad: o se confirman todas las escrituras
 * o ninguna. Si otra transacción tocó un documento leído, Firestore
 * reintenta automáticamente el callback (hasta 5 veces). Eso reemplaza
 * al `SELECT ... FOR UPDATE` de PostgreSQL para el consecutivo:
 * bloqueo optimista con reintento en lugar de bloqueo de fila.
 *
 * Límites de Firestore a tener presentes: 500 escrituras por
 * transacción y lecturas siempre antes que escrituras. Ningún caso de
 * uso actual se acerca a 500.
 */

import { Injectable } from '@nestjs/common';

import type {
  ContextoTransaccional,
  UnidadDeTrabajo,
} from '../../domain/shared/unidad-de-trabajo.js';
import { ClienteFirestore } from './cliente-firestore.js';
import { FirestoreService } from './firestore.service.js';
import { AsignacionFirestoreRepository } from './repositorios/asignacion.firestore.repository.js';
import { AsistenciaFirestoreRepository } from './repositorios/asistencia.firestore.repository.js';
import { AuditoriaFirestoreRepository } from './repositorios/auditoria.firestore.repository.js';
import { GrupoFirestoreRepository } from './repositorios/grupo.firestore.repository.js';
import {
  BloqueFirestoreRepository,
  EstandarFirestoreRepository,
  LineaFirestoreRepository,
} from './repositorios/mfr.firestore.repositories.js';
import { ProductoFirestoreRepository } from './repositorios/producto.firestore.repository.js';
import { RemisionFirestoreRepository } from './repositorios/remision.firestore.repository.js';
import { UsuarioFirestoreRepository } from './repositorios/usuario.firestore.repository.js';

@Injectable()
export class UnidadDeTrabajoFirestore implements UnidadDeTrabajo {
  constructor(private readonly firestore: FirestoreService) {}

  ejecutar<T>(trabajo: (contexto: ContextoTransaccional) => Promise<T>): Promise<T> {
    return this.firestore.db.runTransaction((tx) => {
      const cliente = new ClienteFirestore(this.firestore.db, tx);
      return trabajo({
        remisiones: new RemisionFirestoreRepository(cliente),
        usuarios: new UsuarioFirestoreRepository(cliente),
        productos: new ProductoFirestoreRepository(cliente),
        grupos: new GrupoFirestoreRepository(cliente),
        auditoria: new AuditoriaFirestoreRepository(cliente),
        bloques: new BloqueFirestoreRepository(cliente),
        lineas: new LineaFirestoreRepository(cliente),
        estandares: new EstandarFirestoreRepository(cliente),
        asistencias: new AsistenciaFirestoreRepository(cliente),
        asignaciones: new AsignacionFirestoreRepository(cliente),
      });
    });
  }
}
