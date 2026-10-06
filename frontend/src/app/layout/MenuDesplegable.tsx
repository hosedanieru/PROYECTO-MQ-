import { useEffect, useId, useRef, useState, type ReactNode } from 'react'

interface Props {
  /** Contenido del botón (texto, ícono, flecha). */
  boton: ReactNode
  /** Nombre para lectores de pantalla cuando el botón no tiene texto (menú de la cuenta). */
  etiqueta?: string
  /** Clases del botón: cada barra le da su aspecto. */
  claseBoton: (abierto: boolean) => string
  /** Hacia qué lado se abre el panel. */
  alinear?: 'izquierda' | 'derecha'
  /** Ancho del panel (clase de Tailwind). */
  ancho?: string
  /** El contenido recibe `cerrar` para cerrarse al elegir una opción. */
  children: (cerrar: () => void) => ReactNode
}

/**
 * Botón con un panel que se despliega debajo.
 *
 * Se cierra al elegir una opción, al hacer clic afuera o con Escape. Al
 * cerrar con Escape el foco vuelve al botón, para no dejar perdido a
 * quien navega con teclado.
 */
export function MenuDesplegable({ boton, etiqueta, claseBoton, alinear = 'izquierda', ancho = 'w-64', children }: Props) {
  const [abierto, setAbierto] = useState(false)
  const raiz = useRef<HTMLDivElement>(null)
  const disparador = useRef<HTMLButtonElement>(null)
  const idPanel = useId()

  useEffect(() => {
    if (!abierto) return
    const alTocarFuera = (e: PointerEvent) => {
      if (!raiz.current?.contains(e.target as Node)) setAbierto(false)
    }
    const alPulsarTecla = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setAbierto(false)
        disparador.current?.focus()
      }
    }
    document.addEventListener('pointerdown', alTocarFuera)
    document.addEventListener('keydown', alPulsarTecla)
    return () => {
      document.removeEventListener('pointerdown', alTocarFuera)
      document.removeEventListener('keydown', alPulsarTecla)
    }
  }, [abierto])

  return (
    <div ref={raiz} className="relative">
      <button
        ref={disparador}
        type="button"
        aria-expanded={abierto}
        aria-controls={idPanel}
        aria-label={etiqueta}
        onClick={() => setAbierto((a) => !a)}
        className={claseBoton(abierto)}
      >
        {boton}
      </button>
      {abierto && (
        <div
          id={idPanel}
          className={`absolute top-full z-50 mt-2 ${ancho} ${alinear === 'derecha' ? 'right-0' : 'left-0'} origin-top animate-[desplegar_160ms_ease-out] rounded-2xl border border-borde bg-base p-2 text-tinta shadow-elevada`}
        >
          {children(() => setAbierto(false))}
        </div>
      )}
    </div>
  )
}
