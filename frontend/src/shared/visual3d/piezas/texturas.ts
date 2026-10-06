/**
 * TEXTURAS PINTADAS CON CÓDIGO
 * ============================
 *
 * Cada estampado (bolsa, caja, remisión, sobre, báscula) se dibuja en un
 * `<canvas>` y se usa como imagen sobre la pieza 3D. Sin archivos que
 * descargar y sin marcas ajenas: todo es genérico (decisión 2026-10-05).
 *
 * Se guardan en caché por color: cinco cajas iguales comparten una sola
 * textura en la tarjeta gráfica. Son pocas y pequeñas, así que la caché
 * vive mientras la página esté abierta.
 *
 * Los blancos y negros de aquí son papel y tinta de impresión, no colores
 * de interfaz: no cambian con el tema.
 */

import { CanvasTexture, SRGBColorSpace } from 'three'

const cache = new Map<string, CanvasTexture>()

function pintar(clave: string, ancho: number, alto: number, dibujo: (g: CanvasRenderingContext2D) => void): CanvasTexture {
  const existente = cache.get(clave)
  if (existente) return existente
  const lienzo = document.createElement('canvas')
  lienzo.width = ancho
  lienzo.height = alto
  const g = lienzo.getContext('2d')
  if (g) dibujo(g)
  const textura = new CanvasTexture(lienzo)
  textura.colorSpace = SRGBColorSpace
  textura.anisotropy = 4
  cache.set(clave, textura)
  return textura
}

function rectRedondeado(g: CanvasRenderingContext2D, x: number, y: number, a: number, h: number, r: number) {
  g.beginPath()
  g.roundRect(x, y, a, h, r)
  g.fill()
}

/**
 * Bolsa de snack: degradado, brillo de metalizado, franja diagonal (donde
 * iría la marca), "ventana" del producto, recuadro de tabla nutricional y
 * las rayas de los sellos arriba y abajo.
 */
export function texturaBolsa(color: string): CanvasTexture {
  return pintar(`bolsa-${color}`, 256, 384, (g) => {
    g.fillStyle = color
    g.fillRect(0, 0, 256, 384)
    const sombra = g.createLinearGradient(0, 0, 256, 384)
    sombra.addColorStop(0, 'rgba(255,255,255,0.22)')
    sombra.addColorStop(0.5, 'rgba(255,255,255,0)')
    sombra.addColorStop(1, 'rgba(0,0,0,0.38)')
    g.fillStyle = sombra
    g.fillRect(0, 0, 256, 384)

    // Brillo vertical del metalizado.
    const brillo = g.createLinearGradient(40, 0, 110, 0)
    brillo.addColorStop(0, 'rgba(255,255,255,0)')
    brillo.addColorStop(0.5, 'rgba(255,255,255,0.18)')
    brillo.addColorStop(1, 'rgba(255,255,255,0)')
    g.fillStyle = brillo
    g.fillRect(40, 30, 70, 324)

    // Franja diagonal con "texto" (barras) del color de la bolsa.
    g.save()
    g.translate(128, 170)
    g.rotate(-0.32)
    g.fillStyle = 'rgba(255,255,255,0.9)'
    g.fillRect(-220, -36, 440, 72)
    g.fillStyle = color
    rectRedondeado(g, -92, -14, 130, 11, 5)
    rectRedondeado(g, -92, 5, 84, 8, 4)
    g.restore()

    // Ventana del producto, con hojuelas sugeridas.
    g.fillStyle = 'rgba(255,255,255,0.3)'
    g.beginPath()
    g.ellipse(160, 268, 48, 40, 0, 0, Math.PI * 2)
    g.fill()
    g.fillStyle = 'rgba(255,220,150,0.75)'
    for (const [x, y, r] of [[146, 262, 13], [170, 276, 11], [166, 254, 9], [150, 282, 8]]) {
      g.beginPath()
      g.ellipse(x, y, r, r * 0.7, x / 30, 0, Math.PI * 2)
      g.fill()
    }

    // Recuadro de tabla nutricional.
    g.fillStyle = 'rgba(255,255,255,0.75)'
    g.fillRect(28, 300, 54, 34)
    g.fillStyle = 'rgba(0,0,0,0.35)'
    for (let i = 0; i < 4; i++) g.fillRect(32, 305 + i * 7, 46, 2)

    // Rayas de los sellos.
    g.fillStyle = 'rgba(255,255,255,0.25)'
    for (let x = 0; x < 256; x += 8) {
      g.fillRect(x, 0, 3, 26)
      g.fillRect(x, 358, 3, 26)
    }
  })
}

/** Costado de caja corrugada: ondas del cartón, flechas "este lado arriba" y sello de reciclaje. */
export function texturaCajaCostado(color: string): CanvasTexture {
  return pintar(`caja-costado-${color}`, 256, 192, (g) => {
    g.fillStyle = color
    g.fillRect(0, 0, 256, 192)
    // Vetas del corrugado.
    g.fillStyle = 'rgba(0,0,0,0.05)'
    for (let x = 0; x < 256; x += 6) g.fillRect(x, 0, 2, 192)
    // Borde de las solapas.
    g.fillStyle = 'rgba(0,0,0,0.18)'
    g.fillRect(0, 0, 256, 3)
    g.fillRect(0, 189, 256, 3)

    // Flechas "este lado arriba", impresas en tinta oscura.
    g.strokeStyle = 'rgba(40,25,10,0.7)'
    g.fillStyle = 'rgba(40,25,10,0.7)'
    g.lineWidth = 5
    for (const x of [26, 52]) {
      g.beginPath()
      g.moveTo(x, 64)
      g.lineTo(x, 30)
      g.stroke()
      g.beginPath()
      g.moveTo(x - 10, 34)
      g.lineTo(x, 20)
      g.lineTo(x + 10, 34)
      g.fill()
    }
    g.fillRect(16, 70, 46, 4)

    // Sello de reciclaje: tres flechas en triángulo.
    g.save()
    g.translate(222, 160)
    for (let i = 0; i < 3; i++) {
      g.rotate((Math.PI * 2) / 3)
      g.fillRect(-3, -18, 6, 14)
      g.beginPath()
      g.moveTo(-8, -6)
      g.lineTo(0, 2)
      g.lineTo(8, -6)
      g.fill()
    }
    g.restore()
  })
}

/** Tapa de la caja: las dos solapas con su unión al centro. */
export function texturaCajaTapa(color: string): CanvasTexture {
  return pintar(`caja-tapa-${color}`, 256, 256, (g) => {
    g.fillStyle = color
    g.fillRect(0, 0, 256, 256)
    g.fillStyle = 'rgba(0,0,0,0.05)'
    for (let x = 0; x < 256; x += 6) g.fillRect(x, 0, 2, 256)
    g.fillStyle = 'rgba(0,0,0,0.3)'
    g.fillRect(126, 0, 4, 256)
  })
}

/** Etiqueta de logística con código de barras (barras pseudoaleatorias fijas). */
export function texturaEtiqueta(): CanvasTexture {
  return pintar('etiqueta', 256, 160, (g) => {
    g.fillStyle = '#ffffff'
    g.fillRect(0, 0, 256, 160)
    g.fillStyle = '#111111'
    g.fillRect(20, 16, 120, 10)
    g.fillRect(20, 34, 80, 8)
    g.fillRect(170, 14, 66, 30)
    let x = 20
    let semilla = 7
    while (x < 236) {
      semilla = (semilla * 9301 + 49297) % 233280
      const grosor = 2 + (semilla % 4)
      g.fillRect(x, 58, grosor, 72)
      x += grosor + 2 + (semilla % 3)
    }
    g.font = '14px monospace'
    g.fillText('0 000000 000000', 62, 150)
  })
}

/**
 * Hoja de remisión: encabezado de color, renglones, tabla, firma a mano
 * y sello redondo de aprobado. Texto genérico, no un documento real.
 */
export function texturaRemision(marca: string, exito: string): CanvasTexture {
  return pintar(`remision-${marca}-${exito}`, 320, 420, (g) => {
    g.fillStyle = '#ffffff'
    g.fillRect(0, 0, 320, 420)
    g.fillStyle = marca
    g.fillRect(0, 0, 320, 58)
    g.fillStyle = '#ffffff'
    g.font = 'bold 24px sans-serif'
    g.fillText('REMISIÓN', 20, 38)
    g.font = '15px monospace'
    g.fillText('N.º 0000', 216, 37)

    g.fillStyle = 'rgba(15,23,42,0.28)'
    for (let i = 0; i < 4; i++) g.fillRect(20, 82 + i * 20, i % 2 ? 180 : 240, 7)

    // Tabla de cajas y estibas.
    g.strokeStyle = 'rgba(15,23,42,0.35)'
    g.lineWidth = 1.5
    g.strokeRect(20, 172, 280, 110)
    for (let i = 1; i < 4; i++) {
      g.beginPath()
      g.moveTo(20, 172 + i * 27.5)
      g.lineTo(300, 172 + i * 27.5)
      g.stroke()
    }
    g.beginPath()
    g.moveTo(190, 172)
    g.lineTo(190, 282)
    g.stroke()
    g.fillStyle = 'rgba(15,23,42,0.22)'
    for (let i = 0; i < 4; i++) {
      g.fillRect(30, 182 + i * 27.5, 120, 7)
      g.fillRect(205, 182 + i * 27.5, 50, 7)
    }

    // Firma.
    g.strokeStyle = 'rgba(20,40,120,0.85)'
    g.lineWidth = 2.5
    g.beginPath()
    g.moveTo(30, 372)
    g.bezierCurveTo(60, 330, 75, 395, 100, 360)
    g.bezierCurveTo(118, 336, 128, 384, 150, 366)
    g.bezierCurveTo(165, 354, 175, 372, 190, 362)
    g.stroke()
    g.fillStyle = 'rgba(15,23,42,0.35)'
    g.fillRect(24, 384, 180, 2)

    // Sello de aprobado.
    g.save()
    g.translate(258, 360)
    g.rotate(-0.3)
    g.strokeStyle = exito
    g.lineWidth = 4
    g.globalAlpha = 0.85
    g.beginPath()
    g.arc(0, 0, 40, 0, Math.PI * 2)
    g.stroke()
    g.beginPath()
    g.arc(0, 0, 32, 0, Math.PI * 2)
    g.stroke()
    g.lineWidth = 6
    g.beginPath()
    g.moveTo(-16, 0)
    g.lineTo(-4, 13)
    g.lineTo(18, -12)
    g.stroke()
    g.restore()
  })
}

/** Sobre de correo: papel, solapa en V, sello postal y renglones de dirección. */
export function texturaSobre(papel: string, marca: string): CanvasTexture {
  return pintar(`sobre-${papel}-${marca}`, 384, 256, (g) => {
    g.fillStyle = papel
    g.fillRect(0, 0, 384, 256)
    g.strokeStyle = 'rgba(15,23,42,0.18)'
    g.lineWidth = 2
    g.beginPath()
    g.moveTo(0, 0)
    g.lineTo(192, 130)
    g.lineTo(384, 0)
    g.stroke()
    g.beginPath()
    g.moveTo(0, 256)
    g.lineTo(150, 120)
    g.moveTo(384, 256)
    g.lineTo(234, 120)
    g.stroke()
    // Sello postal.
    g.fillStyle = marca
    g.fillRect(310, 20, 52, 62)
    g.strokeStyle = '#ffffff'
    g.setLineDash([4, 3])
    g.strokeRect(314, 24, 44, 54)
    g.setLineDash([])
    // Dirección.
    g.fillStyle = 'rgba(15,23,42,0.35)'
    g.fillRect(120, 170, 150, 8)
    g.fillRect(120, 188, 110, 8)
    g.fillRect(120, 206, 130, 8)
  })
}

/** Pantalla de la báscula: dígitos de siete segmentos en verde sobre negro (decorativos). */
export function texturaPantallaBascula(exito: string): CanvasTexture {
  return pintar(`bascula-${exito}`, 256, 96, (g) => {
    g.fillStyle = '#0b1220'
    g.fillRect(0, 0, 256, 96)
    g.fillStyle = exito
    g.font = 'bold 54px monospace'
    g.fillText('0.00', 26, 68)
    g.font = 'bold 24px sans-serif'
    g.fillText('kg', 196, 66)
  })
}
