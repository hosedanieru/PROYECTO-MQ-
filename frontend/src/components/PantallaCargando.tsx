import { useDemora } from '../shared/useDemora'
import { Hueso } from './Esqueleto'

/** Qué forma tiene lo que está cargando: el esqueleto se parece a lo que va a aparecer. */
export type FormaCarga = 'tablero' | 'lista' | 'detalle'

interface Props {
  /** Lo que lee un lector de pantalla mientras tanto. */
  mensaje?: string
  forma?: FormaCarga
}

/**
 * PANTALLA CARGANDO — esqueleto con brillo, pasado el primer segundo
 * ===================================================================
 *
 * Antes era el texto "Cargando…". Desde 2026-10-08 (usuario): nada durante
 * el primer segundo (la mayoría de las consultas llegan antes y así no
 * parpadea) y, si tarda más, el esqueleto de la forma que va a aparecer,
 * con el brillo del ejemplo de Motion `react-skeleton-shimmer`.
 *
 * El mensaje siempre está para el lector de pantalla (`role="status"`).
 */
export function PantallaCargando({ mensaje = 'Cargando…', forma = 'lista' }: Props) {
  const visible = useDemora(true)
  return (
    <div role="status" aria-busy="true">
      <span className="sr-only">{mensaje}</span>
      {visible && <FormaEsqueleto forma={forma} />}
    </div>
  )
}

/** El dibujo del esqueleto, sin espera (lo usa también `ConCarga`). */
export function FormaEsqueleto({ forma }: { forma: FormaCarga }) {
  if (forma === 'tablero') {
    return (
      <div className="space-y-5">
        {/* Las cinco tarjetas de indicador. */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
          {Array.from({ length: 5 }, (_, i) => (
            <Hueso key={i} className="h-28 rounded-tarjeta" />
          ))}
        </div>
        {/* Dos columnas de paneles. */}
        <div className="grid gap-5 lg:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)]">
          <div className="space-y-5">
            <Hueso className="h-52 rounded-tarjeta" />
            <Hueso className="h-80 rounded-tarjeta" />
          </div>
          <div className="space-y-5">
            <Hueso className="h-72 rounded-tarjeta" />
            <Hueso className="h-60 rounded-tarjeta" />
          </div>
        </div>
      </div>
    )
  }

  if (forma === 'detalle') {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
          {Array.from({ length: 4 }, (_, i) => (
            <div key={i} className="space-y-2">
              <Hueso className="h-3 w-20 rounded" />
              <Hueso className="h-9 w-28 rounded-lg" />
            </div>
          ))}
        </div>
        <Hueso className="h-40 rounded-tarjeta" />
        <Hueso className="h-56 rounded-tarjeta" />
      </div>
    )
  }

  // Lista: filas con su franja, título, datos y la cifra a la derecha (como `FilaRegistro`).
  return (
    <ul className="divide-y divide-borde border-y border-borde">
      {Array.from({ length: 6 }, (_, i) => (
        <li key={i} className="flex items-center gap-4 py-4">
          <Hueso className="h-10 w-1.5 rounded-full" />
          <div className="flex-1 space-y-2">
            <Hueso className="h-4 w-2/5 rounded-md" />
            <Hueso className="h-3 w-1/4 rounded-md" />
          </div>
          <Hueso className="h-8 w-16 rounded-lg" />
        </li>
      ))}
    </ul>
  )
}
