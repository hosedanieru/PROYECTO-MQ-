import type { TonoBadge } from '../../components/Badge'
import type { Semaforo } from '../../shared/types/mfr'

/**
 * El semáforo del dominio (VERDE / AMARILLO / ROJO), traducido a los
 * tonos del sistema de diseño. Un solo lugar: antes cada pantalla del
 * MFR tenía su copia de esta tabla.
 */
export const TONO_SEMAFORO = { VERDE: 'exito', AMARILLO: 'alerta', ROJO: 'critico' } as const

/** Sin semáforo (no hay dato) se pinta en gris, nunca en rojo. */
export function tonoSemaforo(semaforo: Semaforo | null): TonoBadge {
  return semaforo ? TONO_SEMAFORO[semaforo] : 'neutro'
}

/** Texto que acompaña siempre al color: el color nunca es la única pista. */
export function textoSemaforo(semaforo: Semaforo | null): string {
  if (semaforo === null) return 'Sin dato'
  return { VERDE: 'Cumple', AMARILLO: 'Cerca de la meta', ROJO: 'Bajo la meta' }[semaforo]
}
