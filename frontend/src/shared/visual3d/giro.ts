/**
 * GIRO CON INERCIA — agarrar la escena y soltarla
 * ===============================================
 *
 * La idea central del ejemplo de Motion `js-three-orbit` (usuario,
 * 2026-10-07): se arrastra, y al soltar el giro conserva la velocidad de
 * la mano y frena solo, sin un corte brusco.
 *
 *   arrastrando   el ángulo sigue al puntero (píxeles × SENSIBILIDAD)
 *   al soltar     se mide la velocidad de la mano (últimos 100 ms), se le
 *                 pasa a `impulso` y Motion la anima hasta 0 en 2,4 s con
 *                 la curva del ejemplo
 *   cada cuadro   la escena suma `impulso × delta` al ángulo (en `Escena3D`)
 *
 * Dónde se agarra: la escena va DETRÁS del contenido de la banda (sin
 * eventos propios, para no tapar botones), así que se escucha la banda
 * entera (`superficie`) y solo cuenta un toque que cae sobre la zona del
 * lienzo y NO sobre algo que se pueda pulsar o seleccionar.
 */

import { createContext, useEffect, useMemo } from 'react'

import { animate, FRENADO_SUAVE, motionValue, press, type MotionValue } from '../animacion/movimiento'

/** Radianes por píxel arrastrado: cruzar la banda (~600 px) da algo más de una vuelta. */
const SENSIBILIDAD = 0.012
/** Tope de velocidad al soltar, en radianes por segundo (un manotazo no la vuelve un ventilador). */
const VELOCIDAD_MAXIMA = 7
/** Cuánto tarda en frenar del todo, como en el ejemplo. */
const DURACION_FRENADO = 2.4

/** Lo que no se agarra: lo que se pulsa, se escribe o se selecciona. */
const INTERACTIVO = 'a, button, input, select, textarea, label, summary, [role="button"], [role="tab"], [contenteditable]'

export interface Giro {
  /** Ángulo acumulado, en radianes (sin envolver: puede pasar de 2π). */
  angulo: MotionValue<number>
  /** Velocidad que queda después de soltar, en radianes por segundo. */
  impulso: MotionValue<number>
  /** Mientras se arrastra, el impulso no suma: manda la mano. */
  arrastrando: { actual: boolean }
}

export function useGiro(): Giro {
  return useMemo(() => ({ angulo: motionValue(0), impulso: motionValue(0), arrastrando: { actual: false } }), [])
}

/** Cada pieza lee el giro de aquí (`Flotante` en escenas.tsx). Sin proveedor, las piezas no giran con la mano. */
export const GiroContexto = createContext<Giro | null>(null)

interface Muestra {
  t: number
  angulo: number
}

/** Solo cuentan los últimos movimientos: lo que la mano hacía justo antes de soltar. */
const VENTANA_VELOCIDAD_MS = 100

/**
 * Velocidad de la mano al soltar, en radianes por segundo.
 *
 * Por qué no `angulo.getVelocity()` como el ejemplo: Motion mide con el
 * reloj de su propio bucle de cuadros, que en el ejemplo está siempre
 * encendido (`frame.update`). Aquí el bucle lo lleva three (React Three
 * Fiber), el reloj de Motion no avanza entre movimientos y la velocidad
 * salía 0 (comprobado con un arrastre simulado, 2026-10-07).
 */
function velocidadAlSoltar(muestras: Muestra[]): number {
  const ahora = performance.now()
  const recientes = muestras.filter((m) => ahora - m.t <= VENTANA_VELOCIDAD_MS)
  if (recientes.length < 2) return 0 // la mano ya estaba quieta al soltar
  const primera = recientes[0]
  const ultima = recientes[recientes.length - 1]
  const segundos = (ultima.t - primera.t) / 1000
  return segundos > 0 ? (ultima.angulo - primera.angulo) / segundos : 0
}

/**
 * Estilos de la banda mientras escucha el giro. Devuelve cómo dejarla como estaba.
 * En tablet, el arrastre horizontal es del giro y el vertical sigue siendo de la página.
 */
function prepararSuperficie(superficie: HTMLElement): () => void {
  const toqueAnterior = superficie.style.touchAction
  superficie.style.touchAction = 'pan-y'
  return () => {
    superficie.style.cursor = ''
    superficie.style.userSelect = ''
    superficie.style.touchAction = toqueAnterior
  }
}

function dentro(zona: HTMLElement, x: number, y: number): boolean {
  const r = zona.getBoundingClientRect()
  return x >= r.left && x <= r.right && y >= r.top && y <= r.bottom
}

function agarrable(evento: PointerEvent, zona: HTMLElement): boolean {
  const objetivo = evento.target as Element | null
  if (objetivo?.closest(INTERACTIVO)) return false
  // Sobre texto (título, descripción) se deja seleccionar: no se agarra.
  if (objetivo && objetivo !== evento.currentTarget && objetivo.closest('h1, h2, p')) return false
  return dentro(zona, evento.clientX, evento.clientY)
}

/**
 * Conecta el arrastre de la banda con el giro. `activo = false` (menos
 * movimiento, o escena fuera de pantalla) no escucha nada.
 */
export function useArrastreConInercia(giro: Giro, zona: HTMLElement | null, activo: boolean) {
  useEffect(() => {
    const superficie = zona?.parentElement
    if (!zona || !superficie || !activo) return

    const { angulo, impulso, arrastrando } = giro
    let frenado: ReturnType<typeof animate> | undefined

    // Manito de "agarrar" solo donde de verdad se puede agarrar.
    const alPasar = (e: PointerEvent) => {
      if (arrastrando.actual) return
      superficie.style.cursor = agarrable(e, zona) ? 'grab' : ''
    }
    superficie.addEventListener('pointermove', alPasar)
    const restaurar = prepararSuperficie(superficie)

    const cancelar = press(superficie, (_elemento, inicio) => {
      if (!agarrable(inicio, zona)) return

      arrastrando.actual = true
      frenado?.stop()
      impulso.set(0)
      superficie.style.cursor = 'grabbing'
      superficie.style.userSelect = 'none'
      let x = inicio.clientX
      const muestras: Muestra[] = [{ t: performance.now(), angulo: angulo.get() }]

      const mover = (e: PointerEvent) => {
        angulo.set(angulo.get() + (e.clientX - x) * SENSIBILIDAD)
        x = e.clientX
        muestras.push({ t: performance.now(), angulo: angulo.get() })
      }
      window.addEventListener('pointermove', mover)

      return () => {
        window.removeEventListener('pointermove', mover)
        arrastrando.actual = false
        superficie.style.cursor = 'grab'
        superficie.style.userSelect = ''
        // Igual que el ejemplo: la velocidad de la mano pasa al impulso y frena con suavidad.
        const velocidad = Math.max(-VELOCIDAD_MAXIMA, Math.min(VELOCIDAD_MAXIMA, velocidadAlSoltar(muestras)))
        impulso.set(velocidad)
        frenado = animate(impulso, 0, { duration: DURACION_FRENADO, ease: [...FRENADO_SUAVE] })
      }
    })

    return () => {
      cancelar()
      frenado?.stop()
      superficie.removeEventListener('pointermove', alPasar)
      restaurar()
    }
  }, [giro, zona, activo])
}
