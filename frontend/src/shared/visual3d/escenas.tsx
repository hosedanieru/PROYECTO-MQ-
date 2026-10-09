/**
 * ESCENAS POR MÓDULO
 * ==================
 *
 * Cada apartado del aplicativo tiene su propia composición (usuario,
 * 2026-10-05: "más creativo con los apartados"). La escena cuenta de qué
 * trata la pantalla antes de leer el título:
 *
 *   empaque     Inicio, listado de remisiones, login: lo que sale de la planta
 *   remision    detalle / nueva / editar remisión: el documento firmado
 *   averia      averías y causales: cono de seguridad y caja golpeada
 *   inventario  inventario: estiba cargada
 *   produccion  MFR, programación, líneas: la banda transportadora en marcha
 *   correo      correos: el sobre con la remisión
 *   personas    usuarios y grupos: el casco y la planilla
 *   pesos       pesos por caja: la báscula con su caja encima
 *
 * Las posiciones usan `mitad` (medio ancho visible del lienzo) para que la
 * composición se acomode igual en la banda (ancha) que en el login. Las
 * piezas se cargan a la derecha porque en la banda el texto va a la izquierda.
 */

import { Float } from '@react-three/drei'
import { useFrame } from '@react-three/fiber'
import { useContext, useEffect, useRef, useState, type ReactNode } from 'react'
import type { Group } from 'three'

import { animate, motionValue } from '../animacion/movimiento'
import { GiroContexto } from './giro'
import { Bolsa, Caja, Estiba } from './piezas/empaque'
import { MEDIDAS } from './piezas/medidas'
import { Monograma } from './piezas/monograma'
import { Sobre, TablaRemision } from './piezas/oficina'
import { BandaTransportadora, Bascula, Casco, Cono } from './piezas/planta'

export type TemaEscena = 'empaque' | 'remision' | 'averia' | 'inventario' | 'produccion' | 'correo' | 'personas' | 'pesos'

/** Colores ya resueltos desde los tokens de index.css. */
export interface Colores {
  marca: string
  acento: string
  plata: string
  carton: string
  madera: string
  papel: string
  alerta: string
  exito: string
  neutro: string
}

type Vector = [number, number, number]

interface FlotanteProps {
  posicion: Vector
  rotacion?: Vector
  escala?: number
  /** Vueltas propias sobre el eje vertical, en radianes por segundo (0 = no gira). */
  giro?: number
  /** Cada pieza flota a su ritmo; si todas fueran iguales se vería mecánico. */
  ritmo?: number
  /** Cuánto se balancea: las piezas grandes (estiba, banda) se mueven poco. */
  vaiven?: number
  animar: boolean
  children: ReactNode
}

function Flotante({ posicion, rotacion = [0, 0, 0], escala = 1, giro = 0, ritmo = 1.2, vaiven = 1, animar, children }: FlotanteProps) {
  const pieza = useRef<Group>(null)
  const entrada = useRef<Group>(null)
  const vueltasPropias = useRef(0)
  // La mano (giro con inercia, ver giro.ts). Las piezas grandes (estiba, banda) giran menos.
  const mano = useContext(GiroContexto)
  const factorMano = Math.max(0.35, vaiven)

  // Entrada con resorte: la pieza crece desde casi nada girando un cuarto de vuelta.
  // Sin animación arranca ya llegada (1).
  const [llegada] = useState(() => motionValue(animar ? 0 : 1))
  const fondo = posicion[2]
  useEffect(() => {
    if (!animar) {
      llegada.set(1)
      return
    }
    // Las del fondo llegan después: la escena se arma de adelante hacia atrás.
    const resorte = animate(llegada, 1, { type: 'spring', bounce: 0.38, visualDuration: 0.9, delay: 0.15 + Math.max(0, -fondo) * 0.35 })
    return () => resorte.stop()
  }, [animar, llegada, fondo])

  useFrame((_, delta) => {
    if (!pieza.current || !entrada.current) return
    if (animar) vueltasPropias.current += delta * giro
    pieza.current.rotation.y = vueltasPropias.current + (mano ? mano.angulo.get() * factorMano : 0)
    const p = llegada.get()
    entrada.current.scale.setScalar(Math.max(0.001, p))
    entrada.current.rotation.y = (1 - p) * -1.6
  })

  return (
    <Float enabled={animar} speed={ritmo} rotationIntensity={0.4 * vaiven} floatIntensity={0.7 * vaiven}>
      <group position={posicion} rotation={rotacion} scale={escala}>
        <group ref={entrada}>
          <group ref={pieza}>{children}</group>
        </group>
      </group>
    </Float>
  )
}

interface EscenaProps {
  c: Colores
  m: number
  animar: boolean
}

function Empaque({ c, m, animar }: EscenaProps) {
  return (
    <>
      {/*
        La pieza estrella: el monograma cromado, como el logo del ejemplo de Motion.
        Sin giro propio (de canto no se lee "IN"): mira al frente, se mece y gira solo con la mano.
        Va en la mitad derecha del lienzo: la banda funde la izquierda con una máscara y ahí el cromo se apagaba.
      */}
      {/* Inclinado un poco hacia arriba (x negativo): así el cromo refleja el ventanal y no el piso oscuro. */}
      <Flotante posicion={[m * 0.5, 0, 0.4]} rotacion={[-0.14, -0.28, 0.04]} escala={0.8} ritmo={0.9} vaiven={0.6} animar={animar}>
        <Monograma marca={c.marca} metal={c.plata} />
      </Flotante>
      <Flotante posicion={[m * 0.08, 0.7, -0.6]} rotacion={[0.1, -0.3, -0.22]} escala={0.85} giro={0.18} animar={animar}>
        <Bolsa color={c.marca} />
      </Flotante>
      <Flotante posicion={[m * 0.62, -1.0, -0.4]} rotacion={[0.35, -0.65, 0.08]} escala={0.7} ritmo={0.9} animar={animar}>
        <Caja color={c.carton} />
      </Flotante>
      <Flotante posicion={[m * 0.82, 0.2, -1.1]} rotacion={[0.2, 0.4, 0.5]} escala={0.5} giro={-0.25} ritmo={1.6} animar={animar}>
        <Bolsa color={c.acento} />
      </Flotante>
      <Flotante posicion={[-m * 0.38, -0.95, -1]} rotacion={[-0.2, 0.5, -0.6]} escala={0.5} giro={0.3} ritmo={1.4} animar={animar}>
        <Bolsa color={c.plata} />
      </Flotante>
    </>
  )
}

function Remision({ c, m, animar }: EscenaProps) {
  return (
    <>
      <Flotante posicion={[m * 0.2, 0.1, 0.3]} rotacion={[-0.1, -0.4, 0.1]} escala={1.35} ritmo={1} animar={animar}>
        <TablaRemision madera={c.madera} metal={c.plata} marca={c.marca} exito={c.exito} />
      </Flotante>
      <Flotante posicion={[m * 0.66, -0.9, -0.6]} rotacion={[0.35, -0.7, 0.05]} escala={0.7} ritmo={0.8} animar={animar}>
        <Caja color={c.carton} />
      </Flotante>
      <Flotante posicion={[m * 0.68, 1.1, -0.9]} rotacion={[0.2, 0.5, 0.6]} escala={0.5} giro={-0.3} ritmo={1.7} animar={animar}>
        <Bolsa color={c.acento} />
      </Flotante>
      <Flotante posicion={[-m * 0.3, -1.1, -1.2]} rotacion={[0.2, 0.2, -0.5]} escala={0.45} giro={0.3} ritmo={1.4} animar={animar}>
        <Bolsa color={c.marca} />
      </Flotante>
    </>
  )
}

function Averia({ c, m, animar }: EscenaProps) {
  return (
    <>
      <Flotante posicion={[m * 0.3, -0.05, 0.2]} rotacion={[0.25, 0.4, -0.12]} escala={1.25} ritmo={0.9} animar={animar}>
        <Cono naranja={c.alerta} />
      </Flotante>
      <Flotante posicion={[-m * 0.05, -0.85, -0.7]} rotacion={[0.4, -0.5, 0.2]} escala={0.8} ritmo={0.7} animar={animar}>
        <Caja color={c.carton} abollada />
      </Flotante>
      {/* La bolsa "cae" girando: el producto que se averió. */}
      <Flotante posicion={[m * 0.7, 0.9, -0.5]} rotacion={[0.6, 0.3, 1.1]} escala={0.55} giro={0.6} ritmo={2} animar={animar}>
        <Bolsa color={c.plata} />
      </Flotante>
    </>
  )
}

function Inventario({ c, m, animar }: EscenaProps) {
  const { caja, alturaEstiba } = MEDIDAS
  const y0 = alturaEstiba + caja.alto / 2
  // 2 × 2 cajas en la base y una arriba: la estiba que entra a bodega.
  const cajas: Vector[] = [
    [-0.62, y0, -0.45],
    [0.68, y0, -0.45],
    [-0.62, y0, 0.47],
    [0.68, y0, 0.47],
    [0.03, y0 + caja.alto + 0.01, 0],
  ]
  return (
    <>
      <Flotante posicion={[m * 0.3, -0.35, -0.5]} rotacion={[0.18, -0.6, 0]} escala={0.62} ritmo={0.6} vaiven={0.35} animar={animar}>
        <Estiba madera={c.madera} />
        {cajas.map((p, i) => (
          <group key={i} position={p}>
            <Caja color={c.carton} />
          </group>
        ))}
      </Flotante>
      <Flotante posicion={[-m * 0.2, 1.05, -0.6]} rotacion={[0.2, -0.3, -0.4]} escala={0.55} giro={0.25} ritmo={1.5} animar={animar}>
        <Bolsa color={c.marca} />
      </Flotante>
      <Flotante posicion={[m * 0.75, 1.15, -1]} rotacion={[0.1, 0.4, 0.5]} escala={0.45} giro={-0.3} ritmo={1.8} animar={animar}>
        <Bolsa color={c.acento} />
      </Flotante>
    </>
  )
}

function Produccion({ c, m, animar }: EscenaProps) {
  return (
    <>
      <Flotante posicion={[m * 0.15, -0.2, -0.4]} rotacion={[0.5, -0.45, 0.04]} escala={0.82} ritmo={0.5} vaiven={0.25} animar={animar}>
        <BandaTransportadora metal={c.plata} banda={c.neutro} coloresBolsa={[c.marca, c.acento, c.plata]} animar={animar} />
      </Flotante>
      <Flotante posicion={[m * 0.75, -1.15, 0.2]} rotacion={[0.35, -0.6, 0.05]} escala={0.6} ritmo={0.9} animar={animar}>
        <Caja color={c.carton} />
      </Flotante>
      <Flotante posicion={[m * 0.62, 1.2, -0.8]} rotacion={[0.2, 0.4, 0.5]} escala={0.45} giro={-0.3} ritmo={1.6} animar={animar}>
        <Bolsa color={c.marca} />
      </Flotante>
    </>
  )
}

function Correo({ c, m, animar }: EscenaProps) {
  return (
    <>
      <Flotante posicion={[m * 0.25, 0.1, 0.2]} rotacion={[0.15, -0.45, 0.14]} escala={1.25} ritmo={1.1} animar={animar}>
        <Sobre papel={c.papel} marca={c.marca} />
      </Flotante>
      <Flotante posicion={[m * 0.72, 1.05, -0.8]} rotacion={[0.1, -0.3, -0.25]} escala={0.6} ritmo={1.5} animar={animar}>
        <Sobre papel={c.papel} marca={c.acento} />
      </Flotante>
      <Flotante posicion={[-m * 0.1, -1.0, -0.9]} rotacion={[-0.2, 0.35, 0.2]} escala={0.6} ritmo={0.9} animar={animar}>
        <TablaRemision madera={c.madera} metal={c.plata} marca={c.marca} exito={c.exito} />
      </Flotante>
    </>
  )
}

function Personas({ c, m, animar }: EscenaProps) {
  return (
    <>
      <Flotante posicion={[m * 0.3, 0.05, 0.2]} rotacion={[0.4, -0.5, 0.15]} escala={1.45} giro={0.2} ritmo={1} animar={animar}>
        <Casco color={c.plata} />
      </Flotante>
      <Flotante posicion={[m * 0.72, -0.95, -0.7]} rotacion={[0.3, 0.6, -0.12]} escala={0.8} ritmo={0.8} animar={animar}>
        <Casco color={c.alerta} />
      </Flotante>
      <Flotante posicion={[-m * 0.15, 1.0, -1]} rotacion={[-0.1, 0.3, 0.2]} escala={0.55} ritmo={1.4} animar={animar}>
        <TablaRemision madera={c.madera} metal={c.plata} marca={c.marca} exito={c.exito} />
      </Flotante>
    </>
  )
}

function Pesos({ c, m, animar }: EscenaProps) {
  return (
    <>
      <Flotante posicion={[m * 0.3, -0.75, 0]} rotacion={[0.45, -0.55, 0]} escala={0.95} ritmo={0.6} vaiven={0.4} animar={animar}>
        <Bascula metal={c.plata} cuerpo={c.neutro} exito={c.exito} />
        <group position={[0, 0.11 + MEDIDAS.caja.alto / 2, 0]} rotation={[0, 0.15, 0]}>
          <Caja color={c.carton} />
        </group>
      </Flotante>
      <Flotante posicion={[m * 0.7, 1.05, -0.8]} rotacion={[0.2, 0.4, 0.5]} escala={0.5} giro={-0.3} ritmo={1.7} animar={animar}>
        <Bolsa color={c.acento} />
      </Flotante>
      <Flotante posicion={[-m * 0.2, 0.95, -1]} rotacion={[0.1, -0.3, -0.4]} escala={0.45} giro={0.25} ritmo={1.3} animar={animar}>
        <Bolsa color={c.marca} />
      </Flotante>
    </>
  )
}

const ESCENAS: Record<TemaEscena, (props: EscenaProps) => ReactNode> = {
  empaque: Empaque,
  remision: Remision,
  averia: Averia,
  inventario: Inventario,
  produccion: Produccion,
  correo: Correo,
  personas: Personas,
  pesos: Pesos,
}

export function EscenaDelTema({ tema, colores, mitad, animar }: { tema: TemaEscena; colores: Colores; mitad: number; animar: boolean }) {
  const Escena = ESCENAS[tema]
  return <Escena c={colores} m={mitad} animar={animar} />
}
