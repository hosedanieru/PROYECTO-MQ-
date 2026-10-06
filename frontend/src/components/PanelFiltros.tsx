import type { ReactNode } from 'react'

import { fechaOperativaDe } from '../shared/utils/fechas'

interface Rango {
  desde?: string
  hasta?: string
}

interface Props extends Rango {
  /** Cambia el rango de fechas operativas de una vez (desde y hasta). */
  cambiarRango?: (rango: Rango) => void
  /** Hay algún filtro puesto: aparece "Limpiar filtros". */
  hayFiltros: boolean
  limpiar: () => void
  /** Los campos del filtro (Campo, Select…). */
  children: ReactNode
}

/** YYYY-MM-DD de `dias` días operativos antes de `fecha`. */
function restarDias(fecha: string, dias: number): string {
  const [a, m, d] = fecha.split('-').map(Number)
  return new Date(Date.UTC(a, m - 1, d - dias)).toISOString().slice(0, 10)
}

/**
 * Atajos de fecha. Se calculan sobre la FECHA OPERATIVA (corte 06:00),
 * no sobre el calendario: a las 02:00, "Hoy" sigue siendo el día que
 * empezó ayer a las 06:00, igual que en el backend.
 */
function atajos(): { texto: string; rango: Required<Rango> }[] {
  const hoy = fechaOperativaDe(new Date())
  return [
    { texto: 'Hoy', rango: { desde: hoy, hasta: hoy } },
    { texto: 'Ayer', rango: { desde: restarDias(hoy, 1), hasta: restarDias(hoy, 1) } },
    { texto: 'Últimos 7 días', rango: { desde: restarDias(hoy, 6), hasta: hoy } },
  ]
}

/**
 * Marco común de los filtros de un listado: atajos de fecha arriba
 * (lo que más se usa, a un toque) y los campos detallados debajo.
 * Sin caja (usuario, 2026-10-05): a la vista, cerrado por una línea fina.
 */
export function PanelFiltros({ desde, hasta, cambiarRango, hayFiltros, limpiar, children }: Props) {
  return (
    <div className="border-b border-borde pb-5">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        {cambiarRango ? (
          <div className="flex flex-wrap gap-1.5" role="group" aria-label="Atajos de fecha">
            {atajos().map(({ texto, rango }) => {
              const activo = rango.desde === desde && rango.hasta === hasta
              return (
                <button
                  key={texto}
                  type="button"
                  aria-pressed={activo}
                  onClick={() => cambiarRango(rango)}
                  className={`rounded-full px-4 py-1.5 text-xs font-bold transition duration-200 pointer-coarse:min-h-9 ${
                    activo
                      ? 'scale-105 bg-linear-to-r from-marca to-acento text-white shadow-[0_6px_18px_-6px_var(--color-marca)]'
                      : 'bg-velo text-tinta-suave hover:-translate-y-0.5 hover:bg-marca-claro hover:text-marca-texto'
                  }`}
                >
                  {texto}
                </button>
              )
            })}
          </div>
        ) : (
          <span className="text-xs font-bold uppercase tracking-wider text-tinta-suave">Filtros</span>
        )}
        {hayFiltros && (
          <button type="button" onClick={limpiar} className="text-xs font-bold text-marca hover:underline">
            Limpiar filtros
          </button>
        )}
      </div>
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-5">{children}</div>
    </div>
  )
}
