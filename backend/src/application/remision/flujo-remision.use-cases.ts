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
import type { HorarioRepository } from '../../domain/mfr/horas-turno.js';
import type { Remision } from '../../domain/remision/remision.entity.js';
import { RemisionNoEncontradaError } from '../../domain/remision/remision.errors.js';
import type { ContextoTransaccional, UnidadDeTrabajo } from '../../domain/shared/unidad-de-trabajo.js';
import { prepararConsumo, registrarConsumo, type ConsumoPreparado, type RemisionAConsumir } from '../inventario/consumo-remision.js';
import { momentoOperativo } from '../shared/momento-operativo.js';
import { verificarContraProgramacion } from './control-programacion.js';
import type { Reloj } from './crear-remision.use-case.js';
import { exigirFirmasPara, verificarPuedeFirmar, type ConfiguracionFirma, type NuevaFirma } from '../../domain/remision/firma-remision.js';
import type { DatosFirma, FirmaDeRemision, FirmanteVerificado } from './firma-remision.use-cases.js';

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
        /** Verificaciones que necesitan leer otros datos, antes de mutar (dentro de la transacción). */
        antes?: (remision: Remision, contexto: ContextoTransaccional) => Promise<void>;
        transicion: (remision: Remision) => string | null | void;
        /** Escrituras adicionales después de guardar (dentro de la transacción; sin lecturas nuevas). */
        despues?: (
            remision: Remision,
            contexto: ContextoTransaccional,
        ) => Promise<void>;
    }): Promise<Remision> {
        return this.uow.ejecutar(async (contexto) => {
            const { remisiones, auditoria } = contexto;
            const remision = await remisiones.buscarPorId(parametros.remisionId);

            if (!remision) {
                throw new RemisionNoEncontradaError(
                    `No existe la remisión "${parametros.remisionId}".`,
                );
            }

            if (parametros.antes) {
                await parametros.antes(remision, contexto);
            }

            const estadoAnterior = remision.estado;
            const motivo = parametros.transicion(remision) ?? null;

            const guardada = await remisiones.actualizar(remision);

            if (parametros.despues) {
                await parametros.despues(guardada, contexto);
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
    /** Sin firma: lo digita quien registra. Con firma: sale de la cuenta del OPA. */
    opaNombre?: string;
    opaCargo?: string | null;
    /** Quien registra la aprobación: un coordinador (transcribe) o el propio OPA (firma). */
    registradaPorId: string;
    /**
     * Fase 2 de la firma electrónica (usuario, 2026-10-03): el OPA aprueba
     * desde su cuenta y firma la casilla "quien recibe" en el mismo paso.
     */
    firma?: DatosFirma;
}

/**
 * Al aprobar, además, el PT DESCUENTA sus PI e insumos del inventario
 * (usuario, 2026-09-29): cajas × receta vigente, también en las
 * extraoficiales. Sin receta o sin existencia suficiente, la aprobación
 * se bloquea. Aprobación y descuento van en la MISMA transacción: o
 * quedan los dos, o ninguno.
 */
export class AprobarRemisionUseCase extends CasoUsoFlujoRemision {
    constructor(
        uow: UnidadDeTrabajo,
        reloj: Reloj,
        private readonly horarios: HorarioRepository,
        /** Para aprobar firmando (fase 2). Sin él solo se puede registrar sin firma. */
        private readonly firma?: FirmaDeRemision,
        /** PILOTO u OBLIGATORIA (fin del piloto: no se aprueba sin firmas). */
        private readonly configuracion: ConfiguracionFirma = { modo: 'PILOTO' },
    ) {
        super(uow, reloj);
    }

    async ejecutar(comando: AprobarRemisionComando): Promise<Remision> {
        // Con firma: contraseña y permiso del OPA se verifican ANTES de la transacción.
        let firmante: FirmanteVerificado | null = null;
        if (comando.firma) {
            if (!this.firma) throw new Error('AprobarRemisionUseCase sin FirmaDeRemision: no puede aprobar firmando.');
            firmante = await this.firma.verificarFirmante(comando.registradaPorId, 'RECIBE', comando.firma);
        }
        const opaNombre = firmante?.usuario.nombre ?? comando.opaNombre ?? '';
        let firmaRecibe: NuevaFirma | null = null;

        // Día operativo y turno de los movimientos del consumo (el de la aprobación).
        const momento = await momentoOperativo(this.reloj, this.horarios);
        let aConsumir: RemisionAConsumir;
        let consumo: ConsumoPreparado;

        return this.aplicar({
            remisionId: comando.remisionId,
            usuarioId: comando.registradaPorId,
            antes: async (remision, contexto) => {
                const d = remision.aObjeto();
                /**
                 * Solo las APROBADAS/VALIDADAS cuentan contra el DPP (área,
                 * 2026-09-18): al aprobar es cuando la remisión entra en la
                 * cuenta, así que aquí se vuelve a verificar el tope. Dos
                 * borradores del mismo SKU no pueden terminar aprobados por
                 * encima de lo programado.
                 */
                await verificarContraProgramacion(contexto, {
                    fechaOperativa: d.fechaOperativa,
                    productoId: d.productoId,
                    codigoProducto: d.codigoSnapshot,
                    cantidadCajas: d.cantidadCajas,
                    extraoficial: d.extraoficial,
                });
                // Lecturas del consumo (receta y existencias) antes de escribir nada.
                aConsumir = {
                    id: remision.id,
                    productoId: d.productoId,
                    codigoProducto: d.codigoSnapshot,
                    cantidadCajas: d.cantidadCajas,
                    consecutivo: remision.consecutivo,
                };
                consumo = await prepararConsumo(contexto, aConsumir, comando.registradaPorId);
                const firmas = await contexto.firmasRemision.listarPorRemision(remision.id);
                // Fin del piloto: solo el OPA firmando, con Inlotrans y verificador ya firmados.
                exigirFirmasPara('APROBAR', this.configuracion.modo, remision, firmas, firmante !== null);
                if (firmante && this.firma) {
                    // El OPA firma después del verificador y una sola vez por versión.
                    verificarPuedeFirmar(remision, 'RECIBE', firmas);
                    // La huella se toma antes de aprobar: el estado no entra en ella.
                    firmaRecibe = this.firma.construir(remision, firmante);
                }
            },
            despues: async (_, contexto) => {
                await registrarConsumo(contexto, aConsumir, consumo, momento, comando.registradaPorId);
                if (firmaRecibe && this.firma) await this.firma.registrar(contexto, firmaRecibe);
            },
            transicion: (remision) => {
                // Sin firma, el OPA se registra como dato (lo transcribe el coordinador);
                // con firma, su nombre sale de su propia cuenta.
                remision.aprobar(opaNombre, comando.opaCargo ?? null, this.reloj.ahora());
                return firmante ? `Aprobada y firmada por el OPA: ${opaNombre}` : `Aprobada por OPA: ${opaNombre}`;
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
            despues: async (guardada, { remisiones }) => {
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
    /** Fase 3 de la firma electrónica: el coordinador valida firmando la casilla VALIDACION. */
    firma?: DatosFirma;
}

/**
 * Validar firmando (fase 3) sigue el mismo patrón que aprobar firmando:
 * contraseña y permiso antes de la transacción; firma y validación en la
 * misma transacción. Al terminar el piloto, validar exige firmar y que el
 * OPA haya firmado.
 */
export class ValidarRemisionUseCase extends CasoUsoFlujoRemision {
    constructor(
        uow: UnidadDeTrabajo,
        reloj: Reloj,
        private readonly firma?: FirmaDeRemision,
        private readonly configuracion: ConfiguracionFirma = { modo: 'PILOTO' },
    ) {
        super(uow, reloj);
    }

    async ejecutar(comando: ValidarRemisionComando): Promise<Remision> {
        let firmante: FirmanteVerificado | null = null;
        if (comando.firma) {
            if (!this.firma) throw new Error('ValidarRemisionUseCase sin FirmaDeRemision: no puede validar firmando.');
            firmante = await this.firma.verificarFirmante(comando.validadaPorId, 'VALIDACION', comando.firma);
        }
        let firmaValidacion: NuevaFirma | null = null;

        return this.aplicar({
            remisionId: comando.remisionId,
            usuarioId: comando.validadaPorId,
            antes: async (remision, contexto) => {
                const firmas = await contexto.firmasRemision.listarPorRemision(remision.id);
                exigirFirmasPara('VALIDAR', this.configuracion.modo, remision, firmas, firmante !== null);
                if (firmante && this.firma) {
                    verificarPuedeFirmar(remision, 'VALIDACION', firmas);
                    firmaValidacion = this.firma.construir(remision, firmante);
                }
            },
            despues: async (_, contexto) => {
                if (firmaValidacion && this.firma) await this.firma.registrar(contexto, firmaValidacion);
            },
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