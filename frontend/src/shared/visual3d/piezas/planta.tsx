/**
 * PLANTA — banda transportadora, cono, báscula y casco
 * ====================================================
 *
 * El piso de MQ: la línea que mueve las bolsas (producción), el cono de
 * seguridad (averías), la báscula de piso (pesos por caja) y el casco
 * (personal).
 */

import { RoundedBox } from '@react-three/drei'
import { useFrame } from '@react-three/fiber'
import { useMemo, useRef } from 'react'
import { Color, DoubleSide, type Group } from 'three'

import { Bolsa } from './empaque'
import { texturaPantallaBascula } from './texturas'

// ------------------------------------------------------- Banda transportadora

const LARGO_BANDA = 4.2
const BOLSAS_EN_BANDA = 4
/** Unidades por segundo que avanza la banda. */
const VELOCIDAD_BANDA = 0.45

interface BandaProps {
  metal: string
  banda: string
  coloresBolsa: string[]
  animar: boolean
}

/**
 * Bastidor de metal, rodillos, banda oscura y patas. Las bolsas viajan
 * de izquierda a derecha; al salir por un extremo vuelven a entrar por el
 * otro (posición = tiempo módulo largo), así nunca se acaban.
 */
export function BandaTransportadora({ metal, banda, coloresBolsa, animar }: BandaProps) {
  const bolsas = useRef<(Group | null)[]>([])
  const recorrido = useRef(0)
  const rodillos = useMemo(() => Array.from({ length: 12 }, (_, i) => -LARGO_BANDA / 2 + 0.2 + i * ((LARGO_BANDA - 0.4) / 11)), [])

  useFrame((_, delta) => {
    if (!animar) return
    recorrido.current += delta * VELOCIDAD_BANDA
    bolsas.current.forEach((bolsa, i) => {
      if (!bolsa) return
      const avance = (recorrido.current + (i * LARGO_BANDA) / BOLSAS_EN_BANDA) % LARGO_BANDA
      bolsa.position.x = avance - LARGO_BANDA / 2
    })
  })

  return (
    <group>
      {/* Banda. */}
      <mesh position={[0, 0.02, 0]}>
        <boxGeometry args={[LARGO_BANDA, 0.04, 0.9]} />
        <meshStandardMaterial color={banda} roughness={0.75} />
      </mesh>
      {/* Rieles laterales. */}
      {[1, -1].map((lado) => (
        <mesh key={lado} position={[0, 0.06, lado * 0.5]}>
          <boxGeometry args={[LARGO_BANDA + 0.1, 0.14, 0.06]} />
          <meshPhysicalMaterial color={metal} metalness={0.9} roughness={0.3} />
        </mesh>
      ))}
      {/* Rodillos bajo la banda. */}
      {rodillos.map((x) => (
        <mesh key={x} position={[x, -0.05, 0]} rotation={[Math.PI / 2, 0, 0]}>
          <cylinderGeometry args={[0.06, 0.06, 0.92, 16]} />
          <meshPhysicalMaterial color={metal} metalness={1} roughness={0.2} />
        </mesh>
      ))}
      {/* Patas. */}
      {[-1, 1].flatMap((cx) =>
        [-1, 1].map((cz) => (
          <mesh key={`${cx}${cz}`} position={[cx * (LARGO_BANDA / 2 - 0.25), -0.55, cz * 0.45]}>
            <boxGeometry args={[0.08, 1, 0.08]} />
            <meshPhysicalMaterial color={metal} metalness={0.9} roughness={0.35} />
          </mesh>
        )),
      )}
      {/* Bolsas acostadas sobre la banda. */}
      {Array.from({ length: BOLSAS_EN_BANDA }, (_, i) => (
        <group
          key={i}
          ref={(g) => {
            bolsas.current[i] = g
          }}
          position={[(i * LARGO_BANDA) / BOLSAS_EN_BANDA - LARGO_BANDA / 2, 0.2, 0]}
          rotation={[-Math.PI / 2, 0, Math.PI / 2 + (i % 2 ? 0.15 : -0.1)]}
          scale={0.45}
        >
          <Bolsa color={coloresBolsa[i % coloresBolsa.length]} />
        </group>
      ))}
    </group>
  )
}

// ------------------------------------------------------- Cono de seguridad

/** Cono naranja con dos franjas reflectivas blancas sobre su base cuadrada. */
export function Cono({ naranja }: { naranja: string }) {
  const base = useMemo(() => new Color(naranja).multiplyScalar(0.55), [naranja])
  // Radio del cono a una altura dada (de 0,38 abajo a 0,06 arriba, alto 1,1).
  const radioEn = (y: number) => 0.38 - (0.32 * (y + 0.55)) / 1.1
  return (
    <group>
      <RoundedBox args={[0.95, 0.07, 0.95]} radius={0.02} smoothness={2} position={[0, -0.585, 0]}>
        <meshStandardMaterial color={base} roughness={0.8} />
      </RoundedBox>
      <mesh>
        <cylinderGeometry args={[0.06, 0.38, 1.1, 40, 1, true]} />
        <meshPhysicalMaterial color={naranja} roughness={0.45} clearcoat={0.6} side={DoubleSide} />
      </mesh>
      {[0.12, -0.22].map((y) => (
        <mesh key={y} position={[0, y, 0]}>
          <cylinderGeometry args={[radioEn(y + 0.08) + 0.004, radioEn(y - 0.08) + 0.004, 0.16, 40, 1, true]} />
          <meshPhysicalMaterial color="white" roughness={0.3} clearcoat={1} />
        </mesh>
      ))}
    </group>
  )
}

// ------------------------------------------------------- Báscula de piso

/** Plataforma metálica con su visor de dígitos verdes al frente. */
export function Bascula({ metal, cuerpo, exito }: { metal: string; cuerpo: string; exito: string }) {
  return (
    <group>
      <RoundedBox args={[1.7, 0.14, 1.3]} radius={0.04} smoothness={3}>
        <meshStandardMaterial color={cuerpo} roughness={0.6} />
      </RoundedBox>
      {/* Plataforma con estrías antideslizantes. */}
      <mesh position={[0, 0.09, 0]}>
        <boxGeometry args={[1.58, 0.03, 1.18]} />
        <meshPhysicalMaterial color={metal} metalness={1} roughness={0.35} />
      </mesh>
      {Array.from({ length: 9 }, (_, i) => (
        <mesh key={i} position={[-0.7 + i * 0.175, 0.108, 0]}>
          <boxGeometry args={[0.03, 0.006, 1.1]} />
          <meshPhysicalMaterial color={metal} metalness={1} roughness={0.2} />
        </mesh>
      ))}
      {/* Visor. */}
      <group position={[0, 0.02, 0.72]} rotation={[-0.5, 0, 0]}>
        <RoundedBox args={[0.7, 0.3, 0.1]} radius={0.03} smoothness={3}>
          <meshStandardMaterial color={cuerpo} roughness={0.5} />
        </RoundedBox>
        <mesh position={[0, 0.01, 0.051]}>
          <planeGeometry args={[0.56, 0.2]} />
          <meshBasicMaterial map={texturaPantallaBascula(exito)} toneMapped={false} />
        </mesh>
      </group>
    </group>
  )
}

// ------------------------------------------------------- Casco de seguridad

/** Casco: cúpula brillante, cresta central y ala. */
export function Casco({ color }: { color: string }) {
  return (
    <group>
      {/* Cúpula alta, un poco más larga de adelante hacia atrás, como la cabeza. */}
      <mesh scale={[0.92, 1.12, 1.08]}>
        <sphereGeometry args={[0.55, 48, 24, 0, Math.PI * 2, 0, Math.PI / 2]} />
        <meshPhysicalMaterial color={color} roughness={0.25} clearcoat={1} clearcoatRoughness={0.1} />
      </mesh>
      {/* Cresta central de refuerzo. */}
      <mesh position={[0, 0.02, 0]} scale={[0.2, 1.2, 1.12]}>
        <sphereGeometry args={[0.55, 24, 12, 0, Math.PI * 2, 0, Math.PI / 2]} />
        <meshPhysicalMaterial color={color} roughness={0.25} clearcoat={1} />
      </mesh>
      {/* Ala angosta a los lados y visera al frente. */}
      <mesh position={[0, 0.01, 0.1]} scale={[0.86, 1, 1.18]}>
        <cylinderGeometry args={[0.6, 0.63, 0.03, 48]} />
        <meshPhysicalMaterial color={color} roughness={0.3} clearcoat={1} />
      </mesh>
    </group>
  )
}
