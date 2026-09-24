import type { ReactNode } from 'react'

interface Props {
  /** Nombre en español. Es lo que se lee primero. */
  etiqueta: string
  /**
   * Sigla del DPP de PepsiCo (T, Mx, E). Va en pequeño al lado, para
   * poder cotejar con el documento sin tener que traducir de cabeza.
   */
  sigla?: string
  valor: ReactNode
  unidad?: string
  /** Texto de apoyo bajo el valor. */
  nota?: string
  /** Resalta el dato principal de un grupo. */
  destacado?: boolean
}

/**
 * Un dato con su nombre.
 *
 * Nace de un problema concreto: el tablero decía `T 5.283` y `Mx 6.321`,
 * y quien no conoce el DPP de PepsiCo no tenía forma de saber qué era
 * cada cosa. Aquí el nombre va completo y la sigla queda como apoyo
 * para quien sí lo conoce.
 */
export function Dato({ etiqueta, sigla, valor, unidad, nota, destacado = false }: Props) {
  return (
    <div>
      <dt className="flex items-baseline gap-1.5 text-xs font-medium text-tinta-suave">
        {etiqueta}
        {sigla && (
          <span
            className="codigo rounded bg-velo px-1 text-[10px] font-semibold text-tinta-suave"
            title={`En el DPP de PepsiCo aparece como "${sigla}"`}
          >
            {sigla}
          </span>
        )}
      </dt>
      <dd className="mt-0.5 flex items-baseline gap-1">
        <span className={`cifra font-bold text-tinta ${destacado ? 'text-xl' : 'text-base'}`}>
          {valor}
        </span>
        {unidad && <span className="text-xs text-tinta-suave">{unidad}</span>}
      </dd>
      {nota && <p className="mt-0.5 text-xs text-tinta-suave">{nota}</p>}
    </div>
  )
}
