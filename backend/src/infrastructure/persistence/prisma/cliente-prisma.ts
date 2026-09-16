/**
 * TIPO DEL CLIENTE PRISMA
 * =======================
 *
 * Los repositorios reciben un cliente que puede ser el cliente normal o
 * el cliente de una transacción abierta. Se excluyen los métodos de
 * gestión de conexión y transacción porque el cliente transaccional no
 * los expone: un repositorio no debe abrir transacciones, eso es
 * responsabilidad de la unidad de trabajo.
 *
 * Gracias a este tipo, la misma clase de repositorio sirve para lecturas
 * sueltas (con PrismaService) y para escrituras dentro de una
 * transacción (con el cliente `tx`).
 */

import type { PrismaClient } from '../../../generated/prisma/client.js';

export type ClientePrisma = Omit<
    PrismaClient,
    '$connect' | '$disconnect' | '$transaction' | '$on' | '$extends' | '$use'
>;