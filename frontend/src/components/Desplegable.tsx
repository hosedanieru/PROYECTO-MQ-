import { useId, useLayoutEffect, useRef, useState, type ReactNode } from 'react'

import { animar, DURACION, SUAVIZADO } from '../shared/animacion/animaciones'
import { IconoChevron } from './Iconos'

interface Props {
  titulo: string
  /** Texto pequeño a la derecha ("7 bloques"), para saber qué hay dentro sin abrir. */
  resumen?: string
  /** Abierto desde el principio. */
  inicialmenteAbierto?: boolean
  children: ReactNode
}

/**
 * Sección que se abre y se cierra.
 *
 * Existe para que una tarjeta pueda responder primero "¿vamos bien?" y
 * guardar el detalle hasta que alguien lo pida. La animación de apertura
 * no es adorno: al crecer desde el título, muestra de dónde sale el
 * contenido que aparece, y eso es lo que evita que el usuario pierda el
 * hilo de lo que estaba mirando.
 *
 * El contenido se mantiene en el DOM al cerrar (con `hidden`), para que
 * el navegador pueda encontrarlo al buscar en la página y para no
 * perder el estado de lo que haya dentro.
 */
export function Desplegable({ titulo, resumen, inicialmenteAbierto = false, children }: Props) {
  const [abierto, setAbierto] = useState(inicialmenteAbierto)
  const cuerpo = useRef<HTMLDivElement>(null)
  const primeraVez = useRef(true)
  const id = useId()

  useLayoutEffect(() => {
    const nodo = cuerpo.current
    if (!nodo) return

    // Al montar no se anima: la pantalla ya tiene su propia entrada.
    if (primeraVez.current) {
      primeraVez.current = false
      return
    }
    if (!abierto) return

    // `scrollHeight` mide el alto real del contenido: no se puede animar
    // hacia `auto`, así que se anima hasta ese número y se suelta al final.
    const alto = nodo.scrollHeight
    const animacion = animar(nodo, {
      height: [0, alto],
      opacity: [0, 1],
      duration: DURACION.rapida,
      ease: SUAVIZADO,
      onComplete: () => {
        nodo.style.height = 'auto'
      },
    })

    return () => {
      animacion?.revert()
      nodo.style.height = 'auto'
    }
  }, [abierto])

  return (
    <div className="border-t border-borde">
      <button
        type="button"
        onClick={() => setAbierto((a) => !a)}
        aria-expanded={abierto}
        aria-controls={id}
        className="flex w-full items-center gap-2 py-2.5 text-left text-sm font-semibold text-tinta transition hover:text-marca"
      >
        <IconoChevron
          className={`h-4 w-4 shrink-0 transition-transform duration-200 ${abierto ? 'rotate-90' : ''}`}
        />
        <span className="flex-1">{titulo}</span>
        {resumen && <span className="text-xs font-medium text-tinta-suave">{resumen}</span>}
      </button>

      <div id={id} ref={cuerpo} hidden={!abierto} className="overflow-hidden">
        <div className="pb-3">{children}</div>
      </div>
    </div>
  )
}
