/**
 * EMPAQUE — bolsa, caja corrugada y estiba
 * ========================================
 *
 * Lo que MQ empaca (bolsas), cómo lo entrega (cajas) y sobre qué lo
 * mueve (estibas). Genéricos, sin marcas de PepsiCo (2026-10-05).
 *
 * La geometría se deforma vértice por vértice: la bolsa se infla y se
 * arruga; la caja se puede abollar (escena de averías).
 */

import { useEffect, useMemo } from 'react'
import { BoxGeometry, Color } from 'three'

import { MEDIDAS } from './medidas'
import { texturaBolsa, texturaCajaCostado, texturaCajaTapa, texturaEtiqueta } from './texturas'

// ------------------------------------------------------------------ Bolsa

const ANCHO_BOLSA = 1
const ALTO_BOLSA = 1.4
/** Desde qué fracción de la altura empieza el sello (la franja aplastada). */
const INICIO_SELLO = 0.86
const INFLADO = 0.24

/** Una sola geometría para todas las bolsas: se calcula una vez. */
let geometriaBolsa: BoxGeometry | null = null

/**
 * Parte de una caja muy delgada y la infla: el centro se abomba, los
 * bordes quedan planos, las puntas (sellos) aplastadas y dentadas, y la
 * superficie lleva arrugas suaves como el plástico real.
 */
function obtenerGeometriaBolsa(): BoxGeometry {
  if (geometriaBolsa) return geometriaBolsa
  const geometria = new BoxGeometry(ANCHO_BOLSA, ALTO_BOLSA, 0.02, 40, 56, 1)
  const posiciones = geometria.attributes.position

  for (let i = 0; i < posiciones.count; i++) {
    const x = posiciones.getX(i)
    const y = posiciones.getY(i)
    const z = posiciones.getZ(i)
    const u = x / (ANCHO_BOLSA / 2)
    const v = y / (ALTO_BOLSA / 2)

    const enAncho = Math.sqrt(Math.max(0, 1 - u * u))
    const enAlto = Math.sqrt(Math.max(0, 1 - Math.min(1, Math.abs(v) / INICIO_SELLO) ** 4))
    const inflado = enAncho * enAlto
    // Arrugas: ondas cruzadas, más marcadas cerca de los sellos, donde el plástico se pliega.
    const cercaDelSello = Math.max(0, Math.abs(v) - 0.55) * 2
    const arruga = (Math.sin(u * 9 + v * 4) * Math.sin(v * 15 - u * 3) * 0.012 + Math.sin(u * 26) * 0.01 * cercaDelSello) * (0.4 + inflado)

    posiciones.setX(i, x * (1 - 0.08 * inflado))
    posiciones.setZ(i, Math.sign(z) * (0.01 + INFLADO * inflado + arruga))

    if (Math.abs(v) > 0.999) {
      const diente = Math.abs((((u + 1) * 14) % 2) - 1)
      posiciones.setY(i, y + Math.sign(v) * 0.025 * diente)
    }
  }

  geometria.computeVertexNormals()
  geometriaBolsa = geometria
  return geometria
}

export function Bolsa({ color }: { color: string }) {
  const geometria = obtenerGeometriaBolsa()
  return (
    <mesh geometry={geometria}>
      {/* Metalizado: brilla como el empaque de snacks, sin llegar a espejo. */}
      <meshPhysicalMaterial map={texturaBolsa(color)} metalness={0.55} roughness={0.28} clearcoat={1} clearcoatRoughness={0.15} />
    </mesh>
  )
}

// ------------------------------------------------------------------ Caja

const CAJA = MEDIDAS.caja

/** Hunde la cara frontal alrededor de un punto: la caja golpeada de un reporte de avería. */
function crearGeometriaCaja(abollada: boolean): BoxGeometry {
  const geometria = new BoxGeometry(CAJA.ancho, CAJA.alto, CAJA.fondo, 16, 12, 12)
  if (!abollada) return geometria
  const posiciones = geometria.attributes.position
  for (let i = 0; i < posiciones.count; i++) {
    const x = posiciones.getX(i)
    const y = posiciones.getY(i)
    const z = posiciones.getZ(i)
    // Golpe en la esquina superior derecha del frente.
    const distancia = Math.hypot(x - 0.35, y - 0.2)
    if (z > CAJA.fondo / 2 - 0.25 && distancia < 0.42) {
      const hundimiento = (1 - distancia / 0.42) ** 2 * 0.16
      posiciones.setZ(i, z - hundimiento * (z / (CAJA.fondo / 2)))
    }
  }
  geometria.computeVertexNormals()
  return geometria
}

export function Caja({ color, abollada = false }: { color: string; abollada?: boolean }) {
  const geometria = useMemo(() => crearGeometriaCaja(abollada), [abollada])
  useEffect(() => () => geometria.dispose(), [geometria])
  // La cinta es el mismo cartón, un poco más oscuro.
  const cinta = useMemo(() => new Color(color).multiplyScalar(0.72), [color])
  const costado = texturaCajaCostado(color)
  const tapa = texturaCajaTapa(color)
  const { alto, fondo, ancho } = CAJA

  return (
    <group>
      <mesh geometry={geometria}>
        {/* Una cara por material, en el orden de three: +x, -x, +y (tapa), -y, +z (frente), -z. */}
        <meshStandardMaterial attach="material-0" map={costado} roughness={0.9} />
        <meshStandardMaterial attach="material-1" map={costado} roughness={0.9} />
        <meshStandardMaterial attach="material-2" map={tapa} roughness={0.9} />
        <meshStandardMaterial attach="material-3" map={tapa} roughness={0.9} />
        <meshStandardMaterial attach="material-4" map={costado} roughness={0.9} />
        <meshStandardMaterial attach="material-5" map={costado} roughness={0.9} />
      </mesh>
      {/* Cinta sobre la unión de las solapas, bajando por el frente y por atrás. */}
      <mesh position={[0, alto / 2 + 0.003, 0]}>
        <boxGeometry args={[0.26, 0.006, fondo + 0.012]} />
        <meshStandardMaterial color={cinta} roughness={0.35} />
      </mesh>
      {[1, -1].map((lado) => (
        <mesh key={lado} position={[0, alto / 2 - 0.12, lado * (fondo / 2 + 0.003)]}>
          <boxGeometry args={[0.26, 0.24, 0.006]} />
          <meshStandardMaterial color={cinta} roughness={0.35} />
        </mesh>
      ))}
      {!abollada && (
        <mesh position={[-ancho / 4, -0.14, fondo / 2 + 0.004]}>
          <planeGeometry args={[0.46, 0.29]} />
          <meshStandardMaterial map={texturaEtiqueta()} roughness={0.6} />
        </mesh>
      )}
    </group>
  )
}

// ------------------------------------------------------------------ Estiba

const ESTIBA = MEDIDAS.estiba

/**
 * Estiba de madera: cinco tablas arriba, nueve tacos y tres tablas abajo.
 * Cada tabla con un tono un poco distinto, como la madera real.
 */
export function Estiba({ madera }: { madera: string }) {
  const tonos = useMemo(() => [1, 0.88, 1.06, 0.94, 1.02].map((f) => new Color(madera).multiplyScalar(f)), [madera])
  const { ancho, fondo } = ESTIBA
  const anchoTabla = fondo / 9

  return (
    <group>
      {/* Tablas de arriba, a lo ancho, con espacio entre ellas. */}
      {tonos.map((tono, i) => (
        <mesh key={`a${i}`} position={[0, 0.17, -fondo / 2 + anchoTabla / 2 + i * (anchoTabla * 2)]}>
          <boxGeometry args={[ancho, 0.05, anchoTabla]} />
          <meshStandardMaterial color={tono} roughness={0.95} />
        </mesh>
      ))}
      {/* Nueve tacos. */}
      {[-1, 0, 1].flatMap((cx) =>
        [-1, 0, 1].map((cz) => (
          <mesh key={`t${cx}${cz}`} position={[cx * (ancho / 2 - 0.12), 0.07, cz * (fondo / 2 - 0.12)]}>
            <boxGeometry args={[0.22, 0.15, 0.22]} />
            <meshStandardMaterial color={tonos[(cx + cz + 4) % 5]} roughness={0.95} />
          </mesh>
        )),
      )}
      {/* Tablas de abajo, a lo largo. */}
      {[-1, 0, 1].map((cx) => (
        <mesh key={`b${cx}`} position={[cx * (ancho / 2 - 0.12), -0.02, 0]}>
          <boxGeometry args={[0.26, 0.04, fondo]} />
          <meshStandardMaterial color={tonos[cx + 2]} roughness={0.95} />
        </mesh>
      ))}
    </group>
  )
}
