import { useEffect } from 'react'

import { motion, useReducedMotion, useSpring, useTransform } from '../../shared/animacion/movimiento'
import { porcentaje } from '../../shared/utils/numeros'

interface Props {
  /** Porcentaje 0–100; `null` = sin dato (aguja en 0 y "—"). */
  valor: number | null
  /** Desde dónde es amarillo y desde dónde verde (ver `cortesSemaforo`). */
  cortes: { amarillo: number; verde: number }
  /** Ancho en píxeles; el alto es la mitad y un poco más. */
  ancho?: number
  /** Descripción para lectores de pantalla. */
  titulo: string
}

const GROSOR = 22

/**
 * MEDIDOR DE MEDIO ARCO CON AGUJA — "Cumplimiento general"
 * ========================================================
 *
 * Como el del tablero de Power BI del área (`MQ VISUAL J3.pdf`, pág. 5):
 * medio círculo partido en zonas de color (rojo, amarillo, verde) y una
 * aguja que señala el valor. Se lee de lejos sin leer el número.
 *
 * La aguja se mueve con un resorte de Motion sobre el ÁNGULO (no sobre la
 * punta): así recorre el arco en vez de cortar en línea recta, y si el
 * tablero se refresca a mitad de camino, sigue desde donde iba.
 */
export function MedidorZonas({ valor, cortes, ancho = 320, titulo }: Props) {
  const r = ancho / 2 - GROSOR
  const cx = ancho / 2
  const cy = ancho / 2
  // Bajo el eje: las marcas 0 y 100 y la cifra grande.
  const alto = cy + 54
  const largoAguja = r - 6
  const sinMovimiento = useReducedMotion()

  // 0 % a la izquierda (180°), 100 % a la derecha (0°).
  const avance = valor === null ? 0 : Math.min(Math.max(valor, 0), 100)
  const angulo = useSpring(180, { bounce: 0.3, visualDuration: 1.1 })
  useEffect(() => {
    const destino = 180 - (avance / 100) * 180
    if (sinMovimiento) angulo.jump(destino)
    else angulo.set(destino)
  }, [avance, angulo, sinMovimiento])
  const puntaX = useTransform(angulo, (a) => cx + largoAguja * Math.cos((a * Math.PI) / 180))
  const puntaY = useTransform(angulo, (a) => cy - largoAguja * Math.sin((a * Math.PI) / 180))

  // Punto del arco para un porcentaje dado.
  const punto = (p: number, radio = r) => {
    const a = Math.PI - (p / 100) * Math.PI
    return { x: cx + radio * Math.cos(a), y: cy - radio * Math.sin(a) }
  }
  const tramo = (desde: number, hasta: number) => {
    const a = punto(desde)
    const b = punto(hasta)
    return `M ${a.x} ${a.y} A ${r} ${r} 0 0 1 ${b.x} ${b.y}`
  }
  const zonas = [
    { desde: 0, hasta: cortes.amarillo, color: 'var(--color-critico)' },
    { desde: cortes.amarillo, hasta: cortes.verde, color: 'var(--color-alerta)' },
    { desde: cortes.verde, hasta: 100, color: 'var(--color-exito)' },
  ].filter((z) => z.hasta > z.desde)

  return (
    <svg
      viewBox={`0 0 ${ancho} ${alto}`}
      className="mx-auto h-auto w-full"
      style={{ maxWidth: ancho }}
      role="img"
      aria-label={titulo}
    >
      {zonas.map((z) => (
        <path key={z.desde} d={tramo(z.desde, z.hasta)} fill="none" stroke={z.color} strokeWidth={GROSOR} />
      ))}
      {/*
        Marcas: los cortes por dentro del arco; 0 y 100 debajo de sus extremos. Dentro del arco, el
        100 se montaba sobre el corte verde (la zona verde es angosta: de la meta a 100).
      */}
      {[cortes.amarillo, cortes.verde].map((p) => {
        const dentro = punto(p, r - GROSOR / 2 - 14)
        return (
          <text key={p} x={dentro.x} y={dentro.y + 4} textAnchor="middle" className="cifra fill-tinta-suave text-xs">
            {p}
          </text>
        )
      })}
      <text x={cx - r} y={cy + 18} textAnchor="middle" className="cifra fill-tinta-suave text-xs">
        0
      </text>
      <text x={cx + r} y={cy + 18} textAnchor="middle" className="cifra fill-tinta-suave text-xs">
        100
      </text>
      <motion.line x1={cx} y1={cy} x2={puntaX} y2={puntaY} stroke="var(--color-tinta)" strokeWidth={4} strokeLinecap="round" />
      <circle cx={cx} cy={cy} r={9} fill="var(--color-tinta)" />
      <text x={cx} y={cy + 44} textAnchor="middle" className="cifra fill-tinta text-2xl font-black">
        {porcentaje(valor, '—', 1)}
      </text>
    </svg>
  )
}
