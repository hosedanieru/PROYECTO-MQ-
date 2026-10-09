/**
 * ESCENA 3D — lienzo, luces y movimiento
 * ======================================
 *
 * La carpeta `shared/visual3d/` es la ÚNICA que importa `three`,
 * `@react-three/fiber` y `@react-three/drei`. Las pantallas usan
 * `HeroVisual3D`, que carga esto de forma diferida: el resto del
 * aplicativo nunca descarga three.
 *
 *   Escena3D.tsx       lienzo, luces, inclinación hacia el puntero (este archivo)
 *   EntornoPlanta.tsx  la nave de planta que reflejan las piezas
 *   giro.ts            agarrar y soltar con inercia (Motion)
 *   escenas.tsx        una composición por módulo
 *   piezas/            bolsa, caja, estiba, remisión, sobre, banda, cono, báscula, casco, monograma
 *
 * Basado en el ejemplo de Motion `js-three-orbit` (usuario, 2026-10-07):
 * entorno procedural como mapa de reflejos, metal pulido y giro con inercia.
 *
 * Decisiones:
 * - Los reflejos salen de un entorno dibujado por un shader en la tarjeta
 *   gráfica, sin descargar imágenes HDR (la planta puede no tener
 *   internet estable). Se captura una sola vez.
 * - La animación vive en `useFrame`, FUERA de React: mover refs 60 veces
 *   por segundo no provoca renders.
 */

import { Environment, PerformanceMonitor } from '@react-three/drei'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { useEffect, useRef, useState, type RefObject } from 'react'
import { MathUtils, type Group } from 'three'

import { EntornoPlanta } from './EntornoPlanta'
import { EscenaDelTema, type Colores, type TemaEscena } from './escenas'
import { GiroContexto, useArrastreConInercia, useGiro, type Giro } from './giro'

/** Inclinación máxima del conjunto hacia el puntero, en radianes (~14°). */
const INCLINACION_MAXIMA = 0.25
/** Qué tan rápido alcanza el conjunto la inclinación del puntero (más alto = más rápido). */
const SUAVIDAD = 2.5

interface Puntero {
  x: number
  y: number
}

/**
 * Posición del puntero en TODA la ventana, de -1 a 1. La escena va detrás
 * del contenido (sin eventos propios), así que escucha la ventana y no el
 * lienzo. Se guarda en un ref: se lee en cada cuadro sin re-renderizar.
 */
function usePunteroVentana(): RefObject<Puntero> {
  const puntero = useRef<Puntero>({ x: 0, y: 0 })
  useEffect(() => {
    const alMover = (evento: PointerEvent) => {
      puntero.current.x = (evento.clientX / window.innerWidth) * 2 - 1
      puntero.current.y = -((evento.clientY / window.innerHeight) * 2 - 1)
    }
    window.addEventListener('pointermove', alMover, { passive: true })
    return () => window.removeEventListener('pointermove', alMover)
  }, [])
  return puntero
}

interface ConjuntoProps {
  tema: TemaEscena
  colores: Colores
  animar: boolean
  puntero: RefObject<Puntero>
}

/** Toda la escena se inclina un poco hacia el puntero, como si siguiera la mirada. */
function Conjunto({ tema, colores, animar, puntero, giro }: ConjuntoProps & { giro: Giro }) {
  const conjunto = useRef<Group>(null)
  const { viewport } = useThree()

  useFrame((_, delta) => {
    if (!animar || !conjunto.current) return
    // Inercia: después de soltar, el impulso sigue girando las piezas mientras Motion lo frena.
    // Igual que el ejemplo, el paso se acota a 0,05 s: al volver de otra pestaña no da un salto.
    const impulso = giro.impulso.get()
    if (!giro.arrastrando.actual && impulso !== 0) giro.angulo.set(giro.angulo.get() + impulso * Math.min(delta, 0.05))
    // damp depende del tiempo, no de los cuadros: igual a 60 Hz que a 144 Hz.
    const objetivoX = -puntero.current.y * INCLINACION_MAXIMA
    const objetivoY = puntero.current.x * INCLINACION_MAXIMA
    conjunto.current.rotation.x = MathUtils.damp(conjunto.current.rotation.x, objetivoX, SUAVIDAD, delta)
    conjunto.current.rotation.y = MathUtils.damp(conjunto.current.rotation.y, objetivoY, SUAVIDAD, delta)
  })

  const mitad = viewport.width / 2
  return (
    // Corrida a la izquierda: en la banda, los botones de acción ocupan el borde derecho.
    <group position={[-mitad * 0.22, 0, 0]}>
      <group ref={conjunto}>
        <EscenaDelTema tema={tema} colores={colores} mitad={mitad} animar={animar} />
      </group>
    </group>
  )
}

export interface Escena3DProps {
  tema: TemaEscena
  /** Colores ya resueltos desde los tokens de index.css; `fondo` tiñe los reflejos. */
  colores: Colores & { fondo: string }
  /** false = las piezas quedan quietas (el sistema pide menos movimiento). */
  animar: boolean
  /** false = fuera de pantalla: no se dibuja nada. */
  visible: boolean
  /** Se llama cuando el lienzo está listo, para aparecerlo con un fundido. */
  alEstarLista: () => void
  /** El contenedor de la figura: donde se puede agarrar para girarla (su padre recibe el arrastre). */
  zona: HTMLElement | null
}

export default function Escena3D({ tema, colores, animar, visible, alEstarLista, zona }: Escena3DProps) {
  const puntero = usePunteroVentana()
  const giro = useGiro()
  useArrastreConInercia(giro, zona, animar && visible)
  // Más de 1,5× no se nota en piezas pequeñas y cuesta el doble de píxeles.
  const [dpr, setDpr] = useState(() => Math.min(window.devicePixelRatio, 1.5))

  // 'never' = no dibuja; 'demand' = dibuja una vez y queda quieta; 'always' = 60 FPS.
  const frameloop = !visible ? 'never' : animar ? 'always' : 'demand'

  return (
    <Canvas
      frameloop={frameloop}
      dpr={dpr}
      // A esta distancia las piezas (y su flotación) caben con margen en el lienzo.
      camera={{ position: [0, 0, 6.8], fov: 38 }}
      gl={{ antialias: true, alpha: true, powerPreference: 'high-performance' }}
      onCreated={alEstarLista}
      fallback={null}
    >
      {/* En equipos que no sostienen los 60 FPS (tablet de piso) baja la resolución. */}
      <PerformanceMonitor
        onDecline={() => setDpr(1)}
        onIncline={() => setDpr(Math.min(window.devicePixelRatio, 1.5))}
      />

      {/* Luz principal desde arriba a la derecha (volumen del cartón y la madera) y un relleno suave. */}
      <directionalLight position={[4, 5, 6]} intensity={1.6} />
      <ambientLight intensity={0.4} />

      {/*
        Reflejos: la nave de planta procedural (EntornoPlanta), capturada una
        sola vez en un cubo, como el cielo del ejemplo de Motion. La clave lo
        vuelve a capturar al cambiar de tema (cambian los colores).
      */}
      {/* 256 px por cara: los reflejos son difusos y a 512 costaba 4 veces más (se nota en la tablet de piso). */}
      <Environment key={`${colores.fondo}${colores.marca}`} resolution={256} frames={1}>
        <EntornoPlanta colores={colores} />
      </Environment>

      <GiroContexto.Provider value={giro}>
        <Conjunto tema={tema} colores={colores} animar={animar} puntero={puntero} giro={giro} />
      </GiroContexto.Provider>
    </Canvas>
  )
}
