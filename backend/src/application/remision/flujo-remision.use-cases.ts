/**
 * CASOS DE USO DEL FLUJO DE LA REMISIÓN
 * =====================================
 *
 *   BORRADOR ──► ENTREGADA ──► APROBADA ──► VALIDADA
 *                    ▲              │
 *                    │              ▼
 *                    └── EN_RECTIFICACION ◄── RECHAZADA
 *
 * CAMBIO IMPORTANTE: cada operación se ejecuta dentro de una unidad de
 * trabajo, junto con su auditoría. Si la auditoría falla, el cambio de
 * estado se revierte. Es el requisito del área: la auditoría debe estar
 * completa para que el proceso avance.
 *
 * Los cinco casos de uso comparten el mismo esqueleto —cargar, aplicar
 * la transición, persistir y auditar— por lo que viven en un archivo con
 * una base común. Separarlos repetiría ese esqueleto cinco veces.
 *
 * Ninguno contiene reglas de negocio: qué transiciones son válidas y qué
 * datos exige cada una lo decide la entidad.
 */

import type { AuditoriaRepository } from '../../domain/auditoria/auditoria.repository.js';
import type { Remision } from '../../domain/remision/remision.entity.js';
import { RemisionNoEncontradaError } from '../../domain/remision/remision.errors.js';
import type { RemisionRepository } from '../../domain/remision/remision.repository.js';
import type { UnidadDeTrabajo } from '../../domain/shared/unidad-de-trabajo.js';
import type { Reloj } from './crear-remision.use-case.js';

// ============================================================
// BASE COMPARTIDA
// ============================================================

abstract class CasoUsoFlujoRemision {
    constructor(
        protected readonly uow: UnidadDeTrabajo,
        protected readonly reloj: Reloj,
    ) { }

    /**
     * Ejecuta una transición dentro de una transacción, auditándola.
     *
     * @param transicion Aplica el cambio sobre la entidad. Puede devolver
     *                   un motivo para el registro de auditoría.
     */
    protected async aplicar(parametros: {
        remisionId: string;
        usuarioId: string;
        transicion: (remision: Remision) => string | null | void;
        despues?: (
            remision: Remision,
            repos: RemisionRepository,
        ) => Promise<void>;
    }): Promise<Remision> {
        return this.uow.ejecutar(async ({ remisiones, auditoria }) => {
            const remision = await remisiones.buscarPorId(parametros.remisionId);

            if (!remision) {
                throw new RemisionNoEncontradaError(
                    `No existe la remisión "${parametros.remisionId}".`,
                );
            }

            const estadoAnterior = remision.estado;
            const motivo = parametros.transicion(remision) ?? null;

            const guardada = await remisiones.actualizar(remision);

            if (parametros.despues) {
                await parametros.despues(guardada, remisiones);
            }

            await this.auditar({
                auditoria,
                remision: guardada,
                estadoAnterior,
                usuarioId: parametros.usuarioId,
                motivo,
            });

            return guardada;
        });
    }

    private async auditar(parametros: {
        auditoria: AuditoriaRepository;
        remision: Remision;
        estadoAnterior: string;
        usuarioId: string;
        motivo: string | null;
    }): Promise<void> {
        await parametros.auditoria.registrar({
            entidad: 'remision',
            entidadId: parametros.remision.id,
            accion: 'CAMBIO_ESTADO',
            valorAnterior: { estado: parametros.estadoAnterior },
            valorNuevo: {
                estado: parametros.remision.estado,
                version: parametros.remision.version,
            },
            motivo: parametros.motivo,
            usuarioId: parametros.usuarioId,
        });
    }
}

// ============================================================
// ENTREGAR — el patinador lleva la remisión al OPA
// ============================================================

export interface EntregarRemisionComando {
    remisionId: string;
    entregadaPorId: string;
}

export class EntregarRemisionUseCase extends CasoUsoFlujoRemision {
    async ejecutar(comando: EntregarRemisionComando): Promise<Remision> {
        return this.aplicar({
            remisionId: comando.remisionId,
            usuarioId: comando.entregadaPorId,
            transicion: (remision) => {
                remision.entregar(comando.entregadaPorId, this.reloj.ahora());
            },
        });
    }
}

// ============================================================
// APROBAR — el OPA de PepsiCo acepta la entrega
// ============================================================

export interface AprobarRemisionComando {
    remisionId: string;
    opaNombre: string;
    opaCargo?: string | null;
    /** Usuario de Inlotrans que registra la respuesta del OPA. */
    registradaPorId: string;
}

export class AprobarRemisionUseCase extends CasoUsoFlujoRemision {
    async ejecutar(comando: AprobarRemisionComando): Promise<Remision> {
        return this.aplicar({
            remisionId: comando.remisionId,
            usuarioId: comando.registradaPorId,
            transicion: (remision) => {
                // El OPA no es usuario del sistema: se registra como dato.
                remision.aprobar(
                    comando.opaNombre,
                    comando.opaCargo ?? null,
                    this.reloj.ahora(),
                );
                return `Aprobada por OPA: ${comando.opaNombre}`;
            },
        });
    }
}

// ============================================================
// RECHAZAR — el OPA no acepta; debe verificarse y rectificarse
// ============================================================

export interface RechazarRemisionComando {
    remisionId: string;
    motivo: string;
    registradaPorId: string;
}

export class RechazarRemisionUseCase extends CasoUsoFlujoRemision {
    async ejecutar(comando: RechazarRemisionComando): Promise<Remision> {
        return this.aplicar({
            remisionId: comando.remisionId,
            usuarioId: comando.registradaPorId,
            transicion: (remision) => {
                remision.rechazar(comando.motivo);
                return comando.motivo;
            },
        });
    }
}

// ============================================================
// RECTIFICAR — se corrige la remisión rechazada
// ============================================================

export interface RectificarRemisionComando {
    remisionId: string;
    rectificadaPorId: string;
}

export class RectificarRemisionUseCase extends CasoUsoFlujoRemision {
    async ejecutar(comando: RectificarRemisionComando): Promise<Remision> {
        let datosAnteriores: unknown;
        let motivoRechazo: string | null = null;
        let versionAnterior = 0;

        return this.aplicar({
            remisionId: comando.remisionId,
            usuarioId: comando.rectificadaPorId,
            transicion: (remision) => {
                /**
                 * El snapshot se toma ANTES de mutar: es lo que queda guardado
                 * como "lo que decía el documento en la versión anterior".
                 * Tomarlo después guardaría el estado nuevo y el historial no
                 * serviría para nada.
                 */
                datosAnteriores = remision.aObjeto();
                motivoRechazo = remision.motivoUltimoRechazo;
                versionAnterior = remision.version;

                remision.iniciarRectificacion();
                return motivoRechazo;
            },
            // El registro de versión ocurre en la misma transacción.
            despues: async (guardada, remisiones) => {
                await remisiones.registrarVersion({
                    remisionId: guardada.id,
                    version: versionAnterior,
                    motivoRechazo,
                    datosAnteriores,
                    rectificadaPorId: comando.rectificadaPorId,
                });
            },
        });
    }
}

// ============================================================
// VALIDAR — conciliación interna (cuaderno virtual)
// ============================================================

export interface ValidarRemisionComando {
    remisionId: string;
    validadaPorId: string;
    /** Contacto de PepsiCo con quien se concilió. */
    concilidadoCon: string;
}

export class ValidarRemisionUseCase extends CasoUsoFlujoRemision {
    async ejecutar(comando: ValidarRemisionComando): Promise<Remision> {
        return this.aplicar({
            remisionId: comando.remisionId,
            usuarioId: comando.validadaPorId,
            transicion: (remision) => {
                /**
                 * La entidad ya impide validar algo que el OPA no aprobó. Esa
                 * regla vive allá y no se repite aquí: duplicarla sería
                 * garantizar que algún día las dos copias digan cosas distintas.
                 */
                remision.validar(
                    comando.validadaPorId,
                    comando.concilidadoCon,
                    this.reloj.ahora(),
                );
                return `Conciliada con ${comando.concilidadoCon}`;
            },
        });
    }
}