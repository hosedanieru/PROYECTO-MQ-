/**
 * ENTORNO DE PLANTA — lo que reflejan las piezas
 * ===============================================
 *
 * Basado en el ejemplo de Motion `js-three-orbit` (usuario, 2026-10-07):
 * allí un cielo dibujado por un shader se captura en un cubo y se usa como
 * mapa de reflejos, y por eso el metal se ve real. Aquí, en vez de cielo,
 * hay una NAVE DE PLANTA:
 *
 *   techo      marina hacia azul, con hileras de lámparas industriales
 *   claraboya  ventanal de luz frente a las piezas, un poco arriba (las caras que
 *              miran a la cámara reflejan lo que hay detrás de ella; sin esto el cromo se ve negro)
 *   portón     luz cálida arriba a la izquierda (como el sol del ejemplo)
 *   acento     un resplandor morado del lado contrario: el color de la marca secundaria
 *   piso       epóxico a cuadros (la función `checkerBox` del ejemplo), con
 *              manchas suaves de ruido FBM para que no se vea perfecto
 *
 * Nada de esto se ve directamente: el lienzo es transparente y detrás está
 * la banda. Solo aparece reflejado en las bolsas metalizadas, el monograma
 * cromado y el metal de las máquinas. Se dibuja UNA vez (drei
 * `<Environment frames={1}>`), así que no cuesta nada por cuadro.
 */

import { useMemo } from 'react'
import { BackSide, Color, Vector3 } from 'three'

const VERTICES = /* glsl */ `
  varying vec3 vDireccion;
  void main() {
    vDireccion = position;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`

const FRAGMENTOS = /* glsl */ `
  varying vec3 vDireccion;

  uniform vec3 cenit;
  uniform vec3 horizonte;
  uniform vec3 lampara;
  uniform vec3 calido;
  uniform vec3 acento;
  uniform vec3 piso;
  uniform vec3 dirPorton;
  uniform vec3 dirAcento;

  // Ruido del ejemplo: hash + ruido de valor + FBM de 5 octavas.
  float hash(vec2 p) {
    vec3 q = fract(vec3(p.x, p.y, p.x) * 0.1031);
    q += dot(q, q.yzx + 33.33);
    return fract((q.x + q.y) * q.z);
  }
  float ruido(vec2 p) {
    vec2 c = floor(p);
    vec2 l = fract(p);
    vec2 w = l * l * (3.0 - 2.0 * l);
    return mix(mix(hash(c), hash(c + vec2(1.0, 0.0)), w.x), mix(hash(c + vec2(0.0, 1.0)), hash(c + vec2(1.0, 1.0)), w.x), w.y);
  }
  float fbm(vec2 p) {
    float suma = 0.0;
    float amplitud = 0.5;
    for (int i = 0; i < 5; i++) {
      suma += amplitud * ruido(p);
      p = p * 2.03 + vec2(17.0, 9.0);
      amplitud *= 0.5;
    }
    return suma;
  }

  // Cuadrícula antialias del ejemplo (checkerBox): las baldosas del piso.
  float cuadros(vec2 p, vec2 w) {
    vec2 i = 2.0 * (abs(fract((p - 0.5 * w) * 0.5) - 0.5) - abs(fract((p + 0.5 * w) * 0.5) - 0.5)) / w;
    return 0.5 - 0.5 * i.x * i.y;
  }

  vec3 techo(vec3 d) {
    float alto = max(d.y, 0.04);
    vec2 plano = d.xz / alto;
    // Hileras de lámparas: franjas angostas a lo largo de la nave, cortadas en tramos.
    float franja = 1.0 - smoothstep(0.035, 0.07, abs(fract(plano.x * 0.55) - 0.5));
    float tramo = 1.0 - smoothstep(0.30, 0.36, abs(fract(plano.y * 0.28) - 0.5));
    float lejos = smoothstep(0.06, 0.35, d.y);
    vec3 color = mix(horizonte, cenit, pow(clamp(d.y, 0.0, 1.0), 0.75));
    color *= 0.85 + fbm(plano * 0.4) * 0.3;
    return color + lampara * franja * tramo * lejos * 3.2;
  }

  vec3 suelo(vec3 d) {
    float hondo = max(-d.y, 0.001);
    vec2 plano = d.xz / hondo * 2.4;
    float desvanecer = 1.0 / (1.0 + dot(plano, plano) * 0.006);
    vec3 color = piso * (1.0 + cuadros(plano, fwidth(plano) + vec2(1e-3)) * 1.6);
    color *= 0.8 + fbm(plano * 0.3) * 0.5;
    return mix(horizonte * 0.25, color, desvanecer);
  }

  void main() {
    vec3 d = normalize(vDireccion);
    vec3 color = techo(d);

    // Claraboya: panel de luz suave arriba y hacia el frente. Las caras que miran a la
    // cámara reflejan lo que hay DETRÁS de ella; sin esta luz el cromo se ve negro.
    // Fuerte y bajo, casi al horizonte, a propósito: el metal de las letras vive solo de reflejos
    // y sus caras frontales miran hacia la cámara y apenas por encima del piso (comprobado con
    // un mapa de direcciones, 2026-10-07).
    float claraboya = clamp(dot(d, normalize(vec3(-0.2, 0.12, 0.97))), 0.0, 1.0);
    color += lampara * (pow(claraboya, 2.0) * 2.4 + pow(claraboya, 16.0) * 4.0);

    // Portón: halo ancho + núcleo intenso, como el sol del ejemplo.
    float porton = clamp(dot(d, normalize(dirPorton)), 0.0, 1.0);
    color += calido * (pow(porton, 18.0) * 0.6 + pow(porton, 400.0) * 6.0);

    // Resplandor de acento del lado contrario.
    float brillo = clamp(dot(d, normalize(dirAcento)), 0.0, 1.0);
    color += acento * pow(brillo, 10.0) * 1.4;

    float horizon = smoothstep(-0.12, 0.02, d.y);
    gl_FragColor = vec4(mix(suelo(d), color, horizon), 1.0);  }
`

export interface ColoresEntorno {
  fondo: string
  marca: string
  papel: string
  acento: string
  neutro: string
}

/** Esfera vista por dentro: se dibuja solo dentro de `<Environment>`, nunca en pantalla. */
export function EntornoPlanta({ colores }: { colores: ColoresEntorno }) {
  const uniformes = useMemo(
    () => ({
      cenit: { value: new Color(colores.fondo).lerp(new Color(colores.marca), 0.2) },
      horizonte: { value: new Color(colores.fondo).lerp(new Color(colores.marca), 0.65) },
      lampara: { value: new Color('white') },
      calido: { value: new Color(colores.papel) },
      acento: { value: new Color(colores.acento) },
      piso: { value: new Color(colores.neutro).multiplyScalar(0.25) },
      // Arriba a la izquierda y hacia el frente: el destello cálido cae sobre las caras visibles.
      dirPorton: { value: new Vector3(-0.55, 0.3, 0.78) },
      dirAcento: { value: new Vector3(0.8, 0.05, 0.6) },
    }),
    [colores.fondo, colores.marca, colores.papel, colores.acento, colores.neutro],
  )

  return (
    <mesh frustumCulled={false}>
      <sphereGeometry args={[50, 64, 32]} />
      <shaderMaterial
        key={JSON.stringify(colores)}
        uniforms={uniformes}
        vertexShader={VERTICES}
        fragmentShader={FRAGMENTOS}
        side={BackSide}
        depthWrite={false}
        toneMapped={false}
      />
    </mesh>
  )
}
