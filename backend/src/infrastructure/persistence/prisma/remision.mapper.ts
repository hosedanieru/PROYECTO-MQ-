/**
 * MAPEADOR REMISIÓN — Dominio ↔ Prisma
 * ====================================
 *
 * Traduce entre la entidad de dominio y el registro de base de datos.
 *
 * Esta pieza es la que permite que el dominio no importe nada de Prisma:
 * toda la dependencia del ORM queda concentrada aquí. Si mañana se
 * cambia de base de datos, se escribe otro mapeador y el dominio no se
 * toca.
 *
 * Los enums coinciden en texto entre dominio y Prisma, pero se traducen
 * explícitamente en lugar de hacer un cast. Así, si alguien agrega un
 * estado en un solo lado, TypeScript lo reporta en vez de fallar en
 * ejecución.
 */

import {
    EstadoRemision as EstadoPrisma,
    type Prisma,
} from '../../../generated/prisma/client.js';

import {
    Remision,
    type EstadoRemision,
    type EstadoPersistidoRemision,
} from '../../../domain/remision/remision.entity.js';

const A_PRISMA: Record<EstadoRemision, EstadoPrisma> = {
    BORRADOR: EstadoPrisma.BORRADOR,
    ENTREGADA: EstadoPrisma.ENTREGADA,
    APROBADA: EstadoPrisma.APROBADA,
    RECHAZADA: EstadoPrisma.RECHAZADA,
    EN_RECTIFICACION: EstadoPrisma.EN_RECTIFICACION,
    VALIDADA: EstadoPrisma.VALIDADA,
};

const A_DOMINIO: Record<EstadoPrisma, EstadoRemision> = {
    [EstadoPrisma.BORRADOR]: 'BORRADOR',
    [EstadoPrisma.ENTREGADA]: 'ENTREGADA',
    [EstadoPrisma.APROBADA]: 'APROBADA',
    [EstadoPrisma.RECHAZADA]: 'RECHAZADA',
    [EstadoPrisma.EN_RECTIFICACION]: 'EN_RECTIFICACION',
    [EstadoPrisma.VALIDADA]: 'VALIDADA',
};

/** Registro de remisión con sus estibas, tal como lo devuelve Prisma. */
export type RegistroRemision = Prisma.RemisionGetPayload<{
    include: { estibas: true };
}>;

export const RemisionMapper = {
    /** Convierte un registro de base de datos en entidad de dominio. */
    aDominio(registro: RegistroRemision): Remision {
        const estado: EstadoPersistidoRemision = {
            id: registro.id,
            anio: registro.anio,
            numero: registro.numero,
            version: registro.version,
            estado: A_DOMINIO[registro.estado],
            fechaOperativa: registro.fechaOperativa,
            fechaHoraRegistro: registro.fechaHoraRegistro,
            turnoId: registro.turnoId,
            grupoId: registro.grupoId,
            lugarId: registro.lugarId,
            productoId: registro.productoId,
            codigoSnapshot: registro.codigoSnapshot,
            descripcionSnapshot: registro.descripcionSnapshot,
            fechaVencimiento: registro.fechaVencimiento,
            cantidadCajas: registro.cantidadCajas,
            cantidadUnidades: registro.cantidadUnidades,
            estibasCompletas: registro.estibasCompletas,
            cajasSueltas: registro.cajasSueltas,
            numerosEstiba: registro.estibas
                .map((e) => e.numeroEstiba)
                .sort((a, b) => a - b),
            observaciones: registro.observaciones,
            extraoficial: registro.extraoficial,
            motivoExtraoficial: registro.motivoExtraoficial,
            creadaPorId: registro.creadaPorId,
            entregadaPorId: registro.entregadaPorId,
            fechaEntrega: registro.fechaEntrega,
            opaNombre: registro.opaNombre,
            opaCargo: registro.opaCargo,
            fechaAprobacion: registro.fechaAprobacion,
            motivoRechazo: registro.motivoUltimoRechazo,
            motivoUltimoRechazo: registro.motivoUltimoRechazo,
            validadaPorId: registro.validadaPorId,
            fechaValidacion: registro.fechaValidacion,
            conciliadoCon: registro.conciliadoCon,
        };

        return Remision.desdePersistencia(estado);
    },

    /** Arma el payload de creación, incluyendo las estibas anidadas. */
    aCreacion(remision: Remision): Prisma.RemisionUncheckedCreateInput {
        const datos = remision.aObjeto();

        return {
            anio: datos.anio,
            numero: datos.numero,
            version: datos.version,
            estado: A_PRISMA[datos.estado],
            fechaOperativa: datos.fechaOperativa,
            fechaHoraRegistro: datos.fechaHoraRegistro,
            turnoId: datos.turnoId,
            grupoId: datos.grupoId,
            lugarId: datos.lugarId,
            productoId: datos.productoId,
            codigoSnapshot: datos.codigoSnapshot,
            descripcionSnapshot: datos.descripcionSnapshot,
            fechaVencimiento: datos.fechaVencimiento,
            cantidadCajas: datos.cantidadCajas,
            cantidadUnidades: datos.cantidadUnidades,
            estibasCompletas: datos.estibasCompletas,
            cajasSueltas: datos.cajasSueltas,
            observaciones: datos.observaciones ?? null,
            extraoficial: datos.extraoficial,
            motivoExtraoficial: datos.motivoExtraoficial,
            creadaPorId: datos.creadaPorId,
            estibas: {
                create: datos.numerosEstiba.map((numeroEstiba) => ({ numeroEstiba })),
            },
        };
    },

    /** Arma el payload de actualización de los campos de flujo. */
    aActualizacion(remision: Remision): Prisma.RemisionUncheckedUpdateInput {
        const datos = remision.aObjeto();

        return {
            version: datos.version,
            estado: A_PRISMA[datos.estado],
            // Editables mientras el documento no sale a entrega.
            turnoId: datos.turnoId,
            grupoId: datos.grupoId,
            lugarId: datos.lugarId,
            productoId: datos.productoId,
            codigoSnapshot: datos.codigoSnapshot,
            descripcionSnapshot: datos.descripcionSnapshot,
            cantidadCajas: datos.cantidadCajas,
            cantidadUnidades: datos.cantidadUnidades,
            estibasCompletas: datos.estibasCompletas,
            cajasSueltas: datos.cajasSueltas,
            fechaVencimiento: datos.fechaVencimiento,
            observaciones: datos.observaciones ?? null,
            extraoficial: datos.extraoficial,
            motivoExtraoficial: datos.motivoExtraoficial,
            entregadaPorId: datos.entregadaPorId ?? null,
            fechaEntrega: datos.fechaEntrega ?? null,
            opaNombre: datos.opaNombre ?? null,
            opaCargo: datos.opaCargo ?? null,
            fechaAprobacion: datos.fechaAprobacion ?? null,
            // Se persiste para que el motivo sobreviva entre peticiones: el
            // detalle lo muestra y la rectificación lo copia al historial.
            motivoUltimoRechazo: datos.motivoUltimoRechazo ?? null,
            validadaPorId: datos.validadaPorId ?? null,
            fechaValidacion: datos.fechaValidacion ?? null,
            conciliadoCon: datos.conciliadoCon ?? null,
        };
    },

    estadoAPrisma(estado: EstadoRemision): EstadoPrisma {
        return A_PRISMA[estado];
    },

    estadoADominio(estado: EstadoPrisma): EstadoRemision {
        return A_DOMINIO[estado];
    },
};
