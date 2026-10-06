/**
 * HERO VISUAL 3D — puerta de entrada a la escena 3D
 * ==================================================
 *
 * Lo que usan las pantallas. Decide SI se dibuja la escena y la carga de
 * forma diferida (`lazy`): three viaja en un archivo aparte que solo se
 * descarga la primera vez que aparece una figura.
 *
 * No se dibuja:
 * - en pantallas de menos de 640 px (celular): gasta batería y no cabe;
 * - si el navegador no tiene WebGL (equipo viejo): no aparece, nada se rompe.
 *
 * Con "reducir movimiento" activado en el sistema, la figura queda quieta.
 * Fuera de pantalla se pausa. Es decoración pura: `aria-hidden` y sin
 * eventos, para no estorbar a un lector de pantalla ni a un clic.
 */

import { lazy, Suspense, useEffect, useRef, useState } from 'react'

// Solo el tipo: se borra al compilar y no arrastra three al archivo principal.
import type { TemaEscena } from './escenas'

export type { TemaEscena }

const Escena3D = lazy(() => import('./Escena3D'))

let soporteWebGL: boolean | undefined

function hayWebGL(): boolean {
  if (soporteWebGL === undefined) {
    try {
      const lienzo = document.createElement('canvas')
      const contexto = lienzo.getContext('webgl2') ?? lienzo.getContext('webgl')
      soporteWebGL = contexto !== null
      // Se suelta el contexto de prueba: el navegador permite pocos a la vez.
      contexto?.getExtension('WEBGL_lose_context')?.loseContext()
    } catch {
      soporteWebGL = false
    }
  }
  return soporteWebGL
}

function useConsultaMedia(consulta: string): boolean {
  const [cumple, setCumple] = useState(() => window.matchMedia(consulta).matches)
  useEffect(() => {
    const media = window.matchMedia(consulta)
    const alCambiar = () => setCumple(media.matches)
    alCambiar()
    media.addEventListener('change', alCambiar)
    return () => media.removeEventListener('change', alCambiar)
  }, [consulta])
  return cumple
}

function leerToken(nombre: string): string {
  return getComputedStyle(document.documentElement).getPropertyValue(nombre).trim() || 'white'
}

/** Colores de las piezas, leídos de index.css y releídos al cambiar de tema. */
function useColoresFigura() {
  const leer = () => ({
    marca: leerToken('--marca-relleno'),
    acento: leerToken('--acento'),
    plata: leerToken('--plata'),
    carton: leerToken('--carton'),
    madera: leerToken('--madera'),
    papel: leerToken('--papel'),
    alerta: leerToken('--alerta'),
    exito: leerToken('--exito'),
    neutro: leerToken('--neutro'),
    fondo: leerToken('--marina'),
  })
  const [colores, setColores] = useState(leer)
  useEffect(() => {
    const observador = new MutationObserver(() => setColores(leer()))
    observador.observe(document.documentElement, { attributes: true, attributeFilter: ['data-tema'] })
    return () => observador.disconnect()
  }, [])
  return colores
}

interface Props {
  /** Qué escena mostrar: cada módulo tiene la suya (ver `escenas.tsx`). */
  tema?: TemaEscena
  /** Posición y tamaño. El contenedor necesita alto y ancho definidos. */
  className?: string
}

export function HeroVisual3D({ tema = 'empaque', className = '' }: Props) {
  const pantallaAmplia = useConsultaMedia('(min-width: 640px)')
  const menosMovimiento = useConsultaMedia('(prefers-reduced-motion: reduce)')
  const colores = useColoresFigura()
  const contenedor = useRef<HTMLDivElement>(null)
  const [visible, setVisible] = useState(true)
  const [lista, setLista] = useState(false)

  const dibujar = pantallaAmplia && hayWebGL()

  useEffect(() => {
    const nodo = contenedor.current
    if (!nodo) return
    const observador = new IntersectionObserver(([entrada]) => setVisible(entrada.isIntersecting))
    observador.observe(nodo)
    return () => observador.disconnect()
  }, [dibujar])

  if (!dibujar) return null

  return (
    <div
      ref={contenedor}
      aria-hidden="true"
      className={`pointer-events-none transition-opacity duration-1000 ${lista ? 'opacity-100' : 'opacity-0'} ${className}`}
    >
      <Suspense fallback={null}>
        <Escena3D
          tema={tema}
          colores={colores}
          animar={!menosMovimiento}
          visible={visible}
          alEstarLista={() => setLista(true)}
        />
      </Suspense>
    </div>
  )
}
