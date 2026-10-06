import type { ReactNode } from 'react'

import { COLOR_TONO, type TonoBadge } from './Badge'

export interface EventoTiempo {
  clave: string
  /** Color del punto: el sentido del evento (entra, sale, ajuste). */
  tono: TonoBadge
  contenido: ReactNode
}

export interface GrupoTiempo {
  clave: string
  /** Normalmente el día operativo. */
  titulo: ReactNode
  /** Resumen del grupo ("3 movimientos · +120"). */
  resumen?: ReactNode
  eventos: EventoTiempo[]
}

/**
 * LÍNEA DE TIEMPO
 * ===============
 *
 * Para lo que es historia (kardex, entradas de mercancía): un hilo
 * vertical con un punto de color por evento, agrupado por día operativo.
 * Se lee de arriba a abajo como pasaron las cosas, en vez de buscar la
 * fecha en una columna de tabla (usuario, 2026-10-05: fuera las tarjetas).
 */
export function LineaTiempo({ grupos }: { grupos: GrupoTiempo[] }) {
  return (
    <ol className="space-y-7">
      {grupos.map((g) => (
        <li key={g.clave}>
          <div className="mb-3 flex flex-wrap items-baseline gap-x-3 gap-y-1 border-b border-borde pb-2">
            <h3 className="text-sm font-black uppercase tracking-wider text-tinta">{g.titulo}</h3>
            {g.resumen && <span className="text-xs text-tinta-suave">{g.resumen}</span>}
          </div>
          <ol className="relative ml-2 border-l-2 border-borde">
            {g.eventos.map((e) => (
              <li key={e.clave} className="relative pb-5 pl-7 last:pb-1">
                <span
                  className="absolute -left-[9px] top-1.5 h-4 w-4 rounded-full ring-4 ring-fondo"
                  style={{ backgroundColor: COLOR_TONO[e.tono] }}
                  aria-hidden="true"
                />
                {e.contenido}
              </li>
            ))}
          </ol>
        </li>
      ))}
    </ol>
  )
}
