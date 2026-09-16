/**
 * AUDITORÍA — Puerto del dominio
 * ==============================
 *
 * Toda acción sobre una entidad sensible deja rastro: quién, qué, cuándo,
 * qué valor tenía antes y qué valor tiene ahora.
 *
 * Es un puerto del dominio y no un detalle técnico porque la
 * trazabilidad es un requisito del negocio (sección 13 del documento
 * maestro), no una comodidad de infraestructura. Los casos de uso
 * dependen de esta interfaz; que por debajo se escriba en PostgreSQL,
 * en un archivo o en un servicio externo es indiferente.
 */

export type AccionAuditada =
    | 'CREAR'
    | 'ACTUALIZAR'
    | 'CAMBIO_ESTADO'
    | 'ELIMINAR';

export interface EntradaAuditoria {
    /** Nombre de la entidad afectada: "remision", "producto", etc. */
    entidad: string;
    entidadId: string;
    accion: AccionAuditada;

    valorAnterior?: unknown;
    valorNuevo?: unknown;

    /**
     * Obligatorio en las acciones sensibles: rechazo, rectificación y
     * edición de estándares de producción. En esos casos, saber QUÉ
     * cambió sin saber POR QUÉ no sirve para nada.
     */
    motivo?: string | null;

    usuarioId: string;
    ip?: string | null;
}

export interface AuditoriaRepository {
    registrar(entrada: EntradaAuditoria): Promise<void>;
}

export const AUDITORIA_REPOSITORY = Symbol('AuditoriaRepository');