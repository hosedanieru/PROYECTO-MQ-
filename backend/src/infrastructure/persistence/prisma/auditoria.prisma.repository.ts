/**
 * AUDITORÍA — Implementación con Prisma
 * =====================================
 *
 * CAMBIO IMPORTANTE frente a la versión anterior: ya no tolera fallos.
 *
 * Antes, un error al auditar se registraba en el log y la operación de
 * negocio continuaba. El área de MQ definió que la auditoría debe estar
 * completa para que el proceso avance, así que el error se propaga: al
 * ejecutarse dentro de la unidad de trabajo, eso revierte la operación
 * completa.
 *
 * Consecuencia práctica: una remisión no puede quedar guardada sin su
 * rastro de auditoría.
 */

import { Injectable } from '@nestjs/common';

import type {
    AccionAuditada,
    AuditoriaRepository,
    EntradaAuditoria,
} from '../../../domain/auditoria/auditoria.repository.js';
import {
    AccionAuditoria as AccionPrisma,
    type Prisma,
} from '../../../generated/prisma/client.js';
import type { ClientePrisma } from './cliente-prisma.js';

const A_PRISMA: Record<AccionAuditada, AccionPrisma> = {
    CREAR: AccionPrisma.CREAR,
    ACTUALIZAR: AccionPrisma.ACTUALIZAR,
    CAMBIO_ESTADO: AccionPrisma.CAMBIO_ESTADO,
    ELIMINAR: AccionPrisma.ELIMINAR,
};

@Injectable()
export class AuditoriaPrismaRepository implements AuditoriaRepository {
    constructor(private readonly cliente: ClientePrisma) { }

    async registrar(entrada: EntradaAuditoria): Promise<void> {
        if (!entrada.usuarioId?.trim()) {
            throw new Error(
                'La auditoría requiere el usuario que ejecuta la acción.',
            );
        }

        // Sin try/catch: si esto falla, la transacción se revierte y la
        // operación de negocio no se completa. Es el comportamiento pedido.
        await this.cliente.auditoria.create({
            data: {
                entidad: entrada.entidad,
                entidadId: entrada.entidadId,
                accion: A_PRISMA[entrada.accion],
                valorAnterior: this.aJson(entrada.valorAnterior),
                valorNuevo: this.aJson(entrada.valorNuevo),
                motivo: entrada.motivo ?? null,
                usuarioId: entrada.usuarioId,
                ip: entrada.ip ?? null,
            },
        });
    }

    private aJson(valor: unknown): Prisma.InputJsonValue | undefined {
        if (valor === undefined || valor === null) {
            return undefined;
        }
        // Serializar y reparsear convierte Date a texto ISO y descarta
        // cualquier valor que JSON no admita.
        return JSON.parse(JSON.stringify(valor)) as Prisma.InputJsonValue;
    }
}