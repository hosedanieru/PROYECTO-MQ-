/**
 * CONTROL CONTRA LA PROGRAMACIÓN DEL DÍA (DPP)
 * ============================================
 *
 * Arma la "situación programada" de un SKU en un día operativo —lo que
 * PepsiCo programó (Σ T de los bloques) y lo que ya está aprobado— y
 * aplica la regla del dominio `verificarTopeProgramacion`.
 *
 * Lo usan crear, editar y aprobar remisión. Recibe los repositorios
 * (del contexto transaccional o de lectura) para que la verificación
 * ocurra dentro de la misma transacción cuando hace falta. Solo lee.
 */

import { calcularBloques, ESTADOS_QUE_CUENTAN } from '../../domain/mfr/calculo-mfr.js';
import type { BloqueRepository } from '../../domain/mfr/bloque-programacion.js';
import type { EstandarRepository } from '../../domain/mfr/estandar-produccion.js';
import type { RemisionRepository } from '../../domain/remision/remision.repository.js';
import { verificarTopeProgramacion, type SituacionProgramada } from '../../domain/remision/tope-programacion.js';

export interface RepositoriosControl {
  bloques: BloqueRepository;
  estandares: EstandarRepository;
  remisiones: RemisionRepository;
}

export async function situacionProgramada(
  repos: RepositoriosControl,
  fechaOperativa: Date,
  productoId: string,
): Promise<SituacionProgramada> {
  const [bloques, estandares, produccion] = await Promise.all([
    repos.bloques.listarPorFecha(fechaOperativa),
    repos.estandares.listar(),
    repos.remisiones.totalizarCajas(fechaOperativa, ESTADOS_QUE_CUENTAN),
  ]);

  const delSku = calcularBloques(bloques.map((b) => b.aObjeto()), estandares).filter((b) => b.productoId === productoId);
  const programadoCajas = delSku.length === 0 ? null : delSku.reduce((s, b) => s + b.targetCajas, 0);

  return {
    fecha: fechaOperativa.toISOString().slice(0, 10),
    hayProgramacionDelDia: bloques.length > 0,
    programadoCajas,
    aprobadasCajas: produccion
      .filter((p) => p.productoId === productoId && !p.extraoficial)
      .reduce((s, p) => s + p.cajas, 0),
  };
}

/** Verifica el tope para una remisión (nueva, editada o por aprobar). Sale sin leer nada si es extraoficial. */
export async function verificarContraProgramacion(
  repos: RepositoriosControl,
  remision: { fechaOperativa: Date; productoId: string; codigoProducto: string; cantidadCajas: number; extraoficial: boolean },
): Promise<void> {
  if (remision.extraoficial) return;
  const situacion = await situacionProgramada(repos, remision.fechaOperativa, remision.productoId);
  verificarTopeProgramacion(situacion, remision);
}
