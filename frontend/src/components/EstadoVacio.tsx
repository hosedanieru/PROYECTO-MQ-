import type { ComponentType, ReactNode, SVGProps } from 'react'

interface Props {
  Icono: ComponentType<SVGProps<SVGSVGElement>>
  titulo: string
  /** Qué hacer ahora: "Cambie los filtros o cree una remisión". */
  texto?: ReactNode
  /** Botón o enlace con el siguiente paso. */
  accion?: ReactNode
}

/**
 * Lo que se ve cuando una lista no tiene nada.
 *
 * "No hay datos" deja al usuario sin saber qué sigue. Este bloque dice
 * por qué está vacío y ofrece el siguiente paso.
 */
export function EstadoVacio({ Icono, titulo, texto, accion }: Props) {
  return (
    <div className="flex flex-col items-center px-6 py-14 text-center">
      <span className="flotar relative grid h-20 w-20 place-items-center" aria-hidden="true">
        {/* Ondas que se expanden: la pantalla "respira" en vez de verse rota. */}
        <span className="absolute inset-0 animate-ping rounded-full bg-marca/15 [animation-duration:2.4s]" />
        <span className="absolute inset-2 rounded-full bg-marca/10" />
        <span className="relative grid h-14 w-14 place-items-center rounded-2xl bg-linear-to-br from-marca to-acento text-white shadow-[0_12px_30px_-10px_var(--color-marca)]">
          <Icono className="h-7 w-7" />
        </span>
      </span>
      <p className="mt-5 text-lg font-extrabold text-tinta">{titulo}</p>
      {texto && <p className="mt-1 max-w-md text-sm text-tinta-suave">{texto}</p>}
      {accion && <div className="mt-5">{accion}</div>}
    </div>
  )
}
