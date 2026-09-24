/**
 * ANIMACIONES — envoltorio sobre anime.js
 * =======================================
 *
 * Único archivo de la aplicación que importa `animejs`. El resto usa los
 * hooks de `useAnimacion.ts`. Misma regla que con axios: la librería vive
 * en un solo lugar, para poder cambiarla o quitarla sin tocar pantallas.
 *
 * Todas las funciones devuelven `undefined` cuando el sistema operativo
 * pide menos movimiento. Quien las llama no tiene que preguntarlo.
 *
 * Nota de versión: anime.js 4 cambió la API respecto a la 3. Ya no es
 * `anime({ targets })` sino `animate(objetivos, parametros)`, y el
 * suavizado se llama `ease`, no `easing`.
 */

import {
  animate,
  stagger,
  type AnimationParams,
  type JSAnimation,
  type TargetsParam,
} from 'animejs'

/** Duraciones en milisegundos. Una escala corta evita el "cada cual la suya". */
export const DURACION = {
  rapida: 200,
  normal: 420,
  lenta: 700,
} as const

/**
 * Suavizado por defecto: arranca rápido y frena al final. Es el que
 * percibimos como "natural" para algo que entra a la pantalla.
 */
export const SUAVIZADO = 'out(3)'

/** Desfase entre elementos de una lista, para que entren en cascada. */
export const CASCADA = 55

export function prefiereMenosMovimiento(): boolean {
  if (typeof window === 'undefined' || !window.matchMedia) return false
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches
}

/**
 * Animación a medida, para los casos que no encajan en las de abajo.
 *
 * Es la única puerta directa a anime.js, y sigue respetando la
 * preferencia de menos movimiento: quien la use no tiene que
 * preguntarlo. Si se repite el mismo uso tres veces, conviene darle
 * nombre propio aquí en vez de copiar los parámetros.
 */
export function animar(
  objetivos: TargetsParam | null,
  parametros: AnimationParams,
): JSAnimation | undefined {
  if (!objetivos || prefiereMenosMovimiento()) return undefined
  return animate(objetivos, parametros)
}

interface OpcionesAparecer {
  /** Píxeles de desplazamiento vertical inicial. Negativo = entra desde abajo. */
  desplazamiento?: number
  duracion?: number
  retraso?: number
  /** Desfase entre elementos. 0 los anima todos a la vez. */
  cascada?: number
}

/**
 * Entrada estándar: desvanecido + desplazamiento vertical.
 *
 * Si se pasan varios elementos entran en cascada, que es lo que da la
 * sensación de "el tablero se está armando" del mockup.
 */
export function aparecer(
  objetivos: TargetsParam,
  { desplazamiento = 12, duracion = DURACION.normal, retraso = 0, cascada = CASCADA }: OpcionesAparecer = {},
): JSAnimation | undefined {
  if (prefiereMenosMovimiento()) return undefined

  return animate(objetivos, {
    opacity: [0, 1],
    translateY: [desplazamiento, 0],
    duration: duracion,
    delay: cascada > 0 ? stagger(cascada, { start: retraso }) : retraso,
    ease: SUAVIZADO,
  })
}

interface OpcionesConteo {
  desde?: number
  duracion?: number
  /** Cómo se escribe el número en pantalla (separador de miles, decimales, %). */
  formato?: (valor: number) => string
}

/**
 * Cuenta un número hasta su valor final. Es la animación de los KPI del
 * mockup ("12 camiones", "96 %").
 *
 * anime.js no puede animar el texto de un nodo directamente, así que se
 * anima un objeto intermedio y en cada fotograma se escribe el resultado.
 * Cuando hay menos movimiento se escribe el valor final de una vez: el
 * dato nunca deja de verse.
 */
export function contarHasta(
  elemento: HTMLElement | null,
  valor: number,
  { desde = 0, duracion = DURACION.lenta, formato = (n) => String(Math.round(n)) }: OpcionesConteo = {},
): JSAnimation | undefined {
  if (!elemento) return undefined

  if (prefiereMenosMovimiento()) {
    elemento.textContent = formato(valor)
    return undefined
  }

  const contador = { n: desde }
  return animate(contador, {
    n: valor,
    duration: duracion,
    ease: 'outExpo',
    onUpdate: () => {
      elemento.textContent = formato(contador.n)
    },
  })
}

/**
 * Crece una barra o un arco desde cero hasta su valor.
 *
 * Sirve tanto para una barra horizontal (`propiedad: 'width'`) como para
 * el trazo de una dona en SVG (`propiedad: 'strokeDashoffset'`).
 */
export function crecerHasta(
  /** Acepta `null` para poder pasarle `ref.current` sin comprobarlo fuera. */
  objetivos: TargetsParam | null,
  propiedad: string,
  valorInicial: string | number,
  valorFinal: string | number,
  retraso = 0,
): JSAnimation | undefined {
  if (!objetivos || prefiereMenosMovimiento()) return undefined

  return animate(objetivos, {
    [propiedad]: [valorInicial, valorFinal],
    duration: DURACION.lenta,
    delay: retraso,
    ease: SUAVIZADO,
  })
}
