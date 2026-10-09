/**
 * MONOGRAMA "IN" — la pieza estrella, en metal pulido
 * ===================================================
 *
 * Homenaje directo al ejemplo de Motion (`js-three-orbit`), donde el logo
 * se extruye con bisel y se pule como espejo (`metalness 1`,
 * `roughness 0,055`): sin un entorno que reflejar, ese metal se vería
 * negro. Aquí refleja la nave de `EntornoPlanta`.
 *
 * Es el isotipo PROVISIONAL de `components/Logo.tsx` (placa azul con "IN").
 * Cuando lleguen los archivos de marca de Inlotrans, se cambian estas
 * formas por las del SVG.
 */

import { useEffect, useMemo } from 'react'
import { Color, ExtrudeGeometry, Shape } from 'three'

/** Letras dibujadas en una cuadrícula de 5 de alto (unidades libres; se escalan al final). */
function formasLetras(): Shape[] {
  const i = new Shape()
  i.moveTo(0, 0)
  i.lineTo(1.3, 0)
  i.lineTo(1.3, 5)
  i.lineTo(0, 5)

  // La N en un solo contorno: dos astas y la diagonal de arriba-izquierda a abajo-derecha.
  const n = new Shape()
  n.moveTo(2.1, 0)
  n.lineTo(3.4, 0)
  n.lineTo(3.4, 2.9)
  n.lineTo(5.3, 0)
  n.lineTo(6.6, 0)
  n.lineTo(6.6, 5)
  n.lineTo(5.3, 5)
  n.lineTo(5.3, 2.1)
  n.lineTo(3.4, 5)
  n.lineTo(2.1, 5)
  return [i, n]
}

/** Cuadrado de esquinas redondeadas, como la placa del isotipo. */
function formaPlaca(lado: number, radio: number): Shape {
  const m = lado / 2
  const s = new Shape()
  s.moveTo(-m + radio, -m)
  s.lineTo(m - radio, -m)
  s.quadraticCurveTo(m, -m, m, -m + radio)
  s.lineTo(m, m - radio)
  s.quadraticCurveTo(m, m, m - radio, m)
  s.lineTo(-m + radio, m)
  s.quadraticCurveTo(-m, m, -m, m - radio)
  s.lineTo(-m, -m + radio)
  s.quadraticCurveTo(-m, -m, -m + radio, -m)
  return s
}

const LADO_PLACA = 1.6
const GROSOR_PLACA = 0.22

export function Monograma({ marca, metal }: { marca: string; metal: string }) {
  const letras = useMemo(() => {
    // Bisel como el del ejemplo, pero proporcional a trazos de 1,3 de ancho: con 0,22 se cruzaba
    // consigo mismo en los ángulos cerrados de la N y las tapas frontales salían negras (2026-10-07).
    const g = new ExtrudeGeometry(formasLetras(), {
      depth: 1.4,
      bevelEnabled: true,
      bevelThickness: 0.18,
      bevelSize: 0.08,
      bevelSegments: 5,
      curveSegments: 12,
    })
    g.center()
    const escala = 0.95 / 6.6
    g.scale(escala, escala, escala)
    return g
  }, [])

  const placa = useMemo(() => {
    const g = new ExtrudeGeometry(formaPlaca(LADO_PLACA, 0.36), {
      depth: GROSOR_PLACA,
      bevelEnabled: true,
      bevelThickness: 0.05,
      bevelSize: 0.05,
      bevelSegments: 5,
      curveSegments: 16,
    })
    g.translate(0, 0, -GROSOR_PLACA / 2)
    return g
  }, [])

  const azulPlaca = useMemo(() => new Color(marca).multiplyScalar(0.5), [marca])

  useEffect(
    () => () => {
      letras.dispose()
      placa.dispose()
    },
    [letras, placa],
  )

  return (
    <group>
      <mesh geometry={placa}>

        {/*
          Esmalte azul mate: la placa es plana y mira de frente a la luz; con barniz o brillo
          se blanqueaba a lila. Mate, el azul de marca se conserva y el cromo resalta encima.
        */}
        {/* Oscurecido: la luz de la escena lo aclara y así en pantalla se lee el azul de marca. */}
        <meshStandardMaterial color={azulPlaca} metalness={0} roughness={0.7} envMapIntensity={0.5} />
      </mesh>
      {/* Las letras sobresalen de la placa: mitad hundidas, mitad afuera. */}
      <mesh geometry={letras} position={[0, 0, GROSOR_PLACA / 2 + 0.06]}>
        {/*
          Metal pulido como el del ejemplo, pero no espejo perfecto (0,12 y no 0,055): el cielo del
          ejemplo es claro en casi todas las direcciones y nuestra nave es oscura; un poco de
          rugosidad junta la luz del ventanal y las lámparas y el cromo se lee plateado.
        */}
        <meshPhysicalMaterial color={metal} metalness={1} roughness={0.12} envMapIntensity={1.5} />
      </mesh>
    </group>
  )
}
