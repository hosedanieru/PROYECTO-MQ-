/**
 * OFICINA — la remisión en su tabla y el sobre de correo
 * ======================================================
 */

import { RoundedBox } from '@react-three/drei'
import { useMemo } from 'react'
import { Color, DoubleSide, Shape } from 'three'

import { texturaRemision, texturaSobre } from './texturas'

interface TablaRemisionProps {
  madera: string
  metal: string
  marca: string
  exito: string
}

/** Tabla de apoyo (clipboard) con la remisión firmada y sellada, y su pinza metálica. */
export function TablaRemision({ madera, metal, marca, exito }: TablaRemisionProps) {
  const tabla = useMemo(() => new Color(madera).multiplyScalar(0.75), [madera])
  return (
    <group>
      <RoundedBox args={[1.05, 1.42, 0.04]} radius={0.03} smoothness={3}>
        <meshStandardMaterial color={tabla} roughness={0.7} />
      </RoundedBox>
      <mesh position={[0, -0.04, 0.022]}>
        <planeGeometry args={[0.9, 1.18]} />
        <meshStandardMaterial map={texturaRemision(marca, exito)} roughness={0.85} />
      </mesh>
      {/* Pinza: base y palanca. */}
      <RoundedBox args={[0.42, 0.12, 0.05]} radius={0.02} smoothness={3} position={[0, 0.64, 0.04]}>
        <meshPhysicalMaterial color={metal} metalness={1} roughness={0.25} />
      </RoundedBox>
      <mesh position={[0, 0.6, 0.075]} rotation={[0.35, 0, 0]}>
        <boxGeometry args={[0.3, 0.12, 0.012]} />
        <meshPhysicalMaterial color={metal} metalness={1} roughness={0.2} />
      </mesh>
    </group>
  )
}

/** Sobre de papel con su solapa levemente abierta. */
export function Sobre({ papel, marca }: { papel: string; marca: string }) {
  // Triángulo de la solapa: base en el borde de arriba, punta hacia abajo.
  const solapa = useMemo(() => {
    const forma = new Shape()
    forma.moveTo(-0.75, 0)
    forma.lineTo(0.75, 0)
    forma.lineTo(0, -0.55)
    forma.closePath()
    return forma
  }, [])
  return (
    <group>
      <mesh>
        <boxGeometry args={[1.5, 1, 0.03]} />
        <meshStandardMaterial attach="material-0" color={papel} roughness={0.9} />
        <meshStandardMaterial attach="material-1" color={papel} roughness={0.9} />
        <meshStandardMaterial attach="material-2" color={papel} roughness={0.9} />
        <meshStandardMaterial attach="material-3" color={papel} roughness={0.9} />
        <meshStandardMaterial attach="material-4" map={texturaSobre(papel, marca)} roughness={0.9} />
        <meshStandardMaterial attach="material-5" color={papel} roughness={0.9} />
      </mesh>
      {/* Solapa trasera, entreabierta: gira sobre el borde de arriba hacia atrás. */}
      <group position={[0, 0.5, -0.016]} rotation={[2.4, 0, 0]}>
        <mesh>
          <shapeGeometry args={[solapa]} />
          <meshStandardMaterial color={papel} roughness={0.9} side={DoubleSide} />
        </mesh>
      </group>
    </group>
  )
}
