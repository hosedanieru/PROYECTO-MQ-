import { motion, RESORTE_GRAFICA } from '../../shared/animacion/movimiento'
import { COLOR_TONO, type TonoBadge } from '../Badge'

type Variante = 'tarjeta' | 'vidrio'

interface Props {
  /** Porcentaje 0–100; `null` = sin dato (se escribe "—", no 0 %). */
  valor: number | null
  /** Porcentaje donde se dibuja la marca de la meta (ej. 95). */
  meta?: number
  tono?: TonoBadge
  /** Diámetro en píxeles. */
  tamano?: number
  /** Texto pequeño debajo de la cifra ("del DPP"). */
  leyenda?: string
  /** `vidrio` para ir sobre la banda oscura del encabezado o el modo TV. */
  variante?: Variante
  /** Descripción para lectores de pantalla. */
  titulo: string
}

/** El arco ocupa 270°: deja abierta la parte de abajo, como un velocímetro. */
const ABERTURA = 0.75
/** El arco empieza abajo a la izquierda (135° medidos desde las 3 en punto). */
const GIRO_INICIAL = 135

/**
 * MEDIDOR CONTRA LA META
 * ======================
 *
 * Responde de lejos "¿vamos bien?": el arco se llena con el avance y una
 * marca fija dice dónde está la meta. Entre las dos se ve cuánto falta
 * sin leer un solo número; el número grande está en el centro para
 * quien sí lo quiere.
 *
 * El arco es un `motion.circle` con `pathLength` (Motion, 2026-10-07):
 * entra creciendo desde 0 y, cuando el tablero se refresca, un resorte
 * lo lleva del valor anterior al nuevo SIN volver a cero; si llega otro
 * dato a mitad de camino, sigue desde donde iba con su velocidad.
 */
export function Medidor({
  valor,
  meta,
  tono = 'marca',
  tamano = 180,
  leyenda,
  variante = 'tarjeta',
  titulo,
}: Props) {
  const vidrio = variante === 'vidrio'

  const grosor = Math.max(8, Math.round(tamano / 14))
  const centro = tamano / 2
  const radio = (tamano - grosor) / 2 - 4
  const perimetro = 2 * Math.PI * radio
  const recorrido = perimetro * ABERTURA
  const porcion = valor === null ? 0 : Math.min(Math.max(valor, 0), 100) / 100

  // Marca de la meta: un trazo radial que cruza el arco.
  const anguloMeta = meta === undefined ? null : ((GIRO_INICIAL + 360 * ABERTURA * (meta / 100)) * Math.PI) / 180
  const punto = (r: number) =>
    anguloMeta === null ? null : { x: centro + r * Math.cos(anguloMeta), y: centro + r * Math.sin(anguloMeta) }
  const metaDentro = punto(radio - grosor)
  const metaFuera = punto(radio + grosor / 2 + 2)

  const color = COLOR_TONO[tono]

  return (
    <div className="relative shrink-0" style={{ width: tamano, height: tamano }}>
      <svg width={tamano} height={tamano} role="img" aria-label={titulo}>
        <g transform={`rotate(${GIRO_INICIAL} ${centro} ${centro})`}>
          <circle
            cx={centro}
            cy={centro}
            r={radio}
            fill="none"
            stroke={vidrio ? 'rgb(255 255 255 / 0.14)' : 'var(--color-borde)'}
            strokeWidth={grosor}
            strokeLinecap="round"
            strokeDasharray={`${recorrido} ${perimetro}`}
          />
          {valor !== null && porcion > 0 && (
            // pathLength va de 0 a 1 sobre la vuelta entera: el arco lleno (270°) es ABERTURA.
            <motion.circle
              cx={centro}
              cy={centro}
              r={radio}
              fill="none"
              stroke={color}
              strokeWidth={grosor}
              strokeLinecap="round"
              initial={{ pathLength: 0 }}
              animate={{ pathLength: ABERTURA * porcion }}
              transition={RESORTE_GRAFICA}
              style={{ filter: vidrio ? `drop-shadow(0 0 10px ${color})` : undefined }}
            />
          )}
        </g>
        {metaDentro && metaFuera && (
          <line
            x1={metaDentro.x}
            y1={metaDentro.y}
            x2={metaFuera.x}
            y2={metaFuera.y}
            stroke={vidrio ? '#ffffff' : 'var(--color-tinta)'}
            strokeWidth={3}
            strokeLinecap="round"
          />
        )}
      </svg>

      <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
        <span
          className={`cifra font-black leading-none ${vidrio ? 'text-white' : 'text-tinta'}`}
          style={{ fontSize: tamano / 4.6 }}
        >
          {valor === null ? '—' : `${valor.toFixed(1)}%`}
        </span>
        {leyenda && (
          <span className={`mt-1 text-xs font-semibold ${vidrio ? 'text-white/90' : 'text-tinta-suave'}`}>{leyenda}</span>
        )}
        {meta !== undefined && (
          <span
            className={`mt-1 text-xs font-bold uppercase tracking-wider ${vidrio ? 'text-white/80' : 'text-tinta-suave'}`}
          >
            ▲ meta {meta} %
          </span>
        )}
      </div>
    </div>
  )
}
