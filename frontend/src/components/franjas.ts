import type { TonoBadge } from './Badge'

/*
 * Franja izquierda del color del estado. Es el recurso del estilo
 * "tablero de planta" (usuario, 2026-10-05): desde lejos, en una tablet
 * o un televisor, se reconoce el estado por el color antes de leer el
 * texto. El texto sigue ahí: el color nunca es la única pista.
 *
 * Archivo aparte (no dentro de un componente) para que Vite pueda
 * recargar los componentes en caliente.
 */
export const FRANJA_TONO: Record<TonoBadge, string> = {
  neutro: 'border-l-neutro',
  marca: 'border-l-marca',
  exito: 'border-l-exito',
  alerta: 'border-l-alerta',
  critico: 'border-l-critico',
  acento: 'border-l-acento',
}
