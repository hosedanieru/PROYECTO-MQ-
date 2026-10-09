/**
 * MOVIMIENTO — puerta de entrada a Motion (motion.dev)
 * ====================================================
 *
 * Único archivo que importa `motion`. Misma regla que `animaciones.ts`
 * con anime.js: la librería vive en un solo lugar.
 *
 * Decisión del usuario (2026-10-07): Motion convive con anime.js.
 *   anime.js  lo que ya existía (entradas en cascada, conteo de cifras, desplegables)
 *   Motion    lo nuevo: escenas 3D (giro con inercia, entrada con resorte) y
 *             gráficas (resortes que conservan la velocidad, reordenamiento
 *             animado, curvas que se dibujan)
 *
 * Por qué Motion para lo nuevo: sus animaciones se pueden interrumpir sin
 * saltos. Si el tablero se refresca a mitad de una animación, el resorte
 * sigue desde donde iba y con la velocidad que llevaba, en vez de
 * reiniciar desde cero.
 */

// Núcleo (sin React): valores animables, gestos y el reloj de cuadros.
export { animate, motionValue, press, type MotionValue } from 'motion'

// Componentes y hooks de React.
export { LayoutGroup, motion, MotionConfig, useReducedMotion, useSpring, useTransform } from 'motion/react'
/**
 * Curva del ejemplo de referencia (js-three-orbit): arranca rápido y se
 * posa muy suave al final. Se usa para frenar el giro y para trazar curvas.
 */
export const FRENADO_SUAVE = [0.16, 1, 0.3, 1] as const

/** Resorte de las gráficas: llega rápido, rebota apenas. */
export const RESORTE_GRAFICA = { type: 'spring', bounce: 0.18, visualDuration: 0.9 } as const
