/**
 * PANEL DE FIRMA — se dibuja con el mouse, el dedo o un lápiz
 * ===========================================================
 *
 * Un `<canvas>` con eventos de puntero (sirven para mouse y pantalla
 * táctil). Entrega la firma como PNG (data URL) cada vez que se termina
 * un trazo, o null si se borra. Tamaño fijo y fondo transparente: el PNG
 * queda pequeño (10–40 KB), dentro del límite del backend.
 */

import { useEffect, useRef } from 'react'

const ANCHO = 480
const ALTO = 160

interface Props {
  onCambio: (png: string | null) => void
}

export function PanelFirma({ onCambio }: Props) {
  const lienzo = useRef<HTMLCanvasElement>(null)
  const dibujando = useRef(false)
  const hayTrazo = useRef(false)

  useEffect(() => {
    const ctx = lienzo.current?.getContext('2d')
    if (!ctx) return
    ctx.lineWidth = 2.2
    ctx.lineCap = 'round'
    ctx.lineJoin = 'round'
    ctx.strokeStyle = '#0b1f4d'
  }, [])

  /** Coordenadas del puntero dentro del lienzo, aunque el CSS lo escale. */
  const punto = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const r = e.currentTarget.getBoundingClientRect()
    return { x: ((e.clientX - r.left) / r.width) * ANCHO, y: ((e.clientY - r.top) / r.height) * ALTO }
  }

  const empezar = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const ctx = e.currentTarget.getContext('2d')
    if (!ctx) return
    e.currentTarget.setPointerCapture(e.pointerId)
    dibujando.current = true
    const { x, y } = punto(e)
    ctx.beginPath()
    ctx.moveTo(x, y)
  }

  const mover = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!dibujando.current) return
    const ctx = e.currentTarget.getContext('2d')
    if (!ctx) return
    const { x, y } = punto(e)
    ctx.lineTo(x, y)
    ctx.stroke()
    hayTrazo.current = true
  }

  const terminar = () => {
    if (!dibujando.current) return
    dibujando.current = false
    if (hayTrazo.current && lienzo.current) onCambio(lienzo.current.toDataURL('image/png'))
  }

  const borrar = () => {
    const c = lienzo.current
    c?.getContext('2d')?.clearRect(0, 0, ANCHO, ALTO)
    hayTrazo.current = false
    onCambio(null)
  }

  return (
    <div className="space-y-1">
      <canvas
        ref={lienzo}
        width={ANCHO}
        height={ALTO}
        aria-label="Espacio para firmar"
        className="w-full touch-none rounded-lg border-2 border-dashed border-borde bg-white"
        style={{ aspectRatio: `${ANCHO} / ${ALTO}` }}
        onPointerDown={empezar}
        onPointerMove={mover}
        onPointerUp={terminar}
        onPointerLeave={terminar}
        onPointerCancel={terminar}
      />
      <div className="flex justify-between text-xs text-tinta-suave">
        <span>Firme dentro del recuadro</span>
        <button type="button" className="font-semibold text-marca hover:underline" onClick={borrar}>
          Borrar y repetir
        </button>
      </div>
    </div>
  )
}
