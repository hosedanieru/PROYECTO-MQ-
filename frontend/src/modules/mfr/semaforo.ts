import type { TonoBadge } from '../../components/Badge'
import type { Semaforo } from '../../shared/types/mfr'

/**
 * El semáforo del dominio (VERDE / AMARILLO / ROJO), traducido a los
 * tonos del sistema de diseño. Un solo lugar: antes cada pantalla del
 * MFR tenía su copia de esta tabla.
 */
export const TONO_SEMAFORO = { VERDE: 'exito', AMARILLO: 'alerta', ROJO: 'critico' } as const

/**
 * Dónde cambia de color, para DIBUJAR las zonas de un medidor. Espejo de
 * `semaforo()` en `backend/src/domain/mfr/calculo-mfr.ts` (verde desde la
 * meta, amarillo hasta 10 puntos por debajo, rojo de ahí para abajo); el
 * color de cada dato lo sigue decidiendo el backend. Decisión del usuario
 * (2026-10-08): se usa esta escala y no las del PDF de Power BI.
 */
export function cortesSemaforo(meta: number): { amarillo: number; verde: number } {
  return { amarillo: Math.max(0, meta - 10), verde: meta }
}

/** Sin semáforo (no hay dato) se pinta en gris, nunca en rojo. */
export function tonoSemaforo(semaforo: Semaforo | null): TonoBadge {
  return semaforo ? TONO_SEMAFORO[semaforo] : 'neutro'
}

/** Texto que acompaña siempre al color: el color nunca es la única pista. */
export function textoSemaforo(semaforo: Semaforo | null): string {
  if (semaforo === null) return 'Sin dato'
  return { VERDE: 'Cumple', AMARILLO: 'Cerca de la meta', ROJO: 'Bajo la meta' }[semaforo]
}
