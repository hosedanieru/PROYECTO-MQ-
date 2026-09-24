import { createContext } from 'react'

import type { Tema } from './tema'

export interface EstadoTema {
  tema: Tema
  alternar: () => void
}

export const TemaContext = createContext<EstadoTema | null>(null)
