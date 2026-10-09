import type { ComponentType, ReactNode, SVGProps } from 'react'

interface Props {
  titulo: string
  Icono: ComponentType<SVGProps<SVGSVGElement>>
  /** A la derecha del título: leyenda, selector u otra acción pequeña. */
  extra?: ReactNode
  className?: string
  children: ReactNode
}

/**
 * PANEL DE INDICADOR — la caja de cada gráfica del tablero
 * ========================================================
 *
 * Como en el tablero de Power BI del área (`MQ VISUAL J3.pdf`): fondo
 * claro, sombra suave, título en mayúsculas con su ícono y la gráfica
 * debajo. Solo para los tableros de indicadores (decisión del usuario,
 * 2026-10-07); las pantallas de operación siguen sin cajas.
 */
export function PanelIndicador({ titulo, Icono, extra, className = '', children }: Props) {
  return (
    <section className={`flex min-w-0 flex-col rounded-tarjeta border border-borde bg-base p-5 shadow-tarjeta ${className}`}>
      <header className="mb-4 flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
        <h2 className="flex items-center gap-2 text-sm font-black uppercase tracking-wider text-tinta">
          <Icono className="h-5 w-5 text-marca" aria-hidden="true" />
          {titulo}
        </h2>
        {extra}
      </header>
      <div className="min-w-0 flex-1">{children}</div>
    </section>
  )
}
