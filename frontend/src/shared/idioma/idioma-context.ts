import { createContext } from 'react'

import type { Idioma } from './idioma'
import type { ClaveTexto } from './textos/es'

/** Valores que se meten en los huecos `{algo}` de un texto. */
export type Sustituciones = Record<string, string | number>

export interface EstadoIdioma {
  idioma: Idioma
  alternar: () => void
  /** Traduce una clave. `t('inicio.meta', { meta: 95 })` */
  t: (clave: ClaveTexto, sustituciones?: Sustituciones) => string
}

export const IdiomaContext = createContext<EstadoIdioma | null>(null)
