import type { ReactNode } from 'react'

interface Props {
  /** Qué muestra la vista o qué hacer con ella, en una frase. */
  texto: ReactNode
  /** Controles de la vista a la derecha (orden, qué serie mirar…). */
  acciones?: ReactNode
}

/**
 * Renglón de arriba de una vista (ver `PestanasVista`): la frase de
 * ayuda a la izquierda y los controles a la derecha. Sin caja: va
 * directo sobre el fondo, como el resto de la vista.
 */
export function BarraVista({ texto, acciones }: Props) {
  return (
    <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
      <p className="text-sm text-tinta-suave">{texto}</p>
      {acciones && <div className="flex flex-wrap items-center gap-2">{acciones}</div>}
    </div>
  )
}
