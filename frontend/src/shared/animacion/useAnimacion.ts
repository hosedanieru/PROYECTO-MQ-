/**
 * HOOKS DE ANIMACIÓN
 * ==================
 *
 * Lo que usan los componentes. La librería queda detrás de
 * `animaciones.ts`; aquí solo está el ciclo de vida de React.
 *
 * Se usa `useLayoutEffect` y no `useEffect` a propósito: `useEffect`
 * corre DESPUÉS de pintar, así que el elemento se vería un instante
 * en su posición final y luego saltaría al inicio de la animación.
 * `useLayoutEffect` corre antes de pintar y evita ese parpadeo.
 */

import { useLayoutEffect, useRef } from 'react'

import { aparecer, contarHasta } from './animaciones'

/**
 * Anima la entrada del contenido de un contenedor.
 *
 * Los hijos marcados con `data-animar` entran en cascada; si no hay
 * ninguno marcado, se anima el contenedor completo.
 *
 *   const contenedor = useAparecer<HTMLDivElement>(fecha)
 *   <div ref={contenedor}>
 *     <Tarjeta data-animar />
 *     <Tarjeta data-animar />
 *   </div>
 *
 * `clave` re-lanza la animación cuando cambia (por ejemplo, al cambiar
 * el día del tablero). Sin ella, la animación ocurre solo al montar.
 */
export function useAparecer<T extends HTMLElement>(clave?: unknown) {
  const contenedor = useRef<T>(null)

  useLayoutEffect(() => {
    const nodo = contenedor.current
    if (!nodo) return

    const marcados = Array.from(nodo.querySelectorAll<HTMLElement>('[data-animar]'))
    const animacion = aparecer(marcados.length > 0 ? marcados : nodo)

    // `revert()` quita los estilos en línea que puso anime.js. Sin esto,
    // un elemento que se desmonta a mitad de la animación quedaría con
    // `opacity` a medias si React lo reutiliza.
    return () => {
      animacion?.revert()
    }
  }, [clave])

  return contenedor
}

/**
 * Cuenta un número hasta su valor. Devuelve la referencia que se pone en
 * el elemento que muestra la cifra.
 *
 *   const valor = useConteo(96, (n) => `${Math.round(n)} %`)
 *   <span ref={valor} className="cifra">96 %</span>
 *
 * El elemento debe traer el valor final escrito en el JSX: así el dato
 * es correcto aunque el JavaScript de la animación no llegue a correr
 * (y lo lee bien un lector de pantalla).
 */
export function useConteo(valor: number, formato?: (n: number) => string) {
  const elemento = useRef<HTMLElement>(null)
  const anterior = useRef(0)

  useLayoutEffect(() => {
    const animacion = contarHasta(elemento.current, valor, {
      desde: anterior.current,
      formato,
    })
    anterior.current = valor

    return () => {
      animacion?.revert()
    }
    // `formato` se omite a propósito: suele ser una función creada en
    // cada render, y depender de ella relanzaría el conteo sin parar.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [valor])

  return elemento
}
