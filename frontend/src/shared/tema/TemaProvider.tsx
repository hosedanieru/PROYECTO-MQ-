import { useCallback, useLayoutEffect, useState, type ReactNode } from 'react'

import { aplicarTema, guardarTema, temaGuardado, TEMA_POR_DEFECTO, type Tema } from './tema'
import { TemaContext } from './tema-context'

/**
 * Mantiene el tema y lo refleja en el `<html>`.
 *
 * El estado se inicializa leyendo lo guardado (no en un efecto): así la
 * primera pintura ya es del tema correcto y no hay un destello claro
 * antes de pasar a oscuro.
 */
export function TemaProvider({ children }: { children: ReactNode }) {
  const [tema, setTema] = useState<Tema>(() => temaGuardado() ?? TEMA_POR_DEFECTO)

  useLayoutEffect(() => {
    aplicarTema(tema)
  }, [tema])

  const alternar = useCallback(() => {
    setTema((actual) => {
      const siguiente: Tema = actual === 'claro' ? 'oscuro' : 'claro'
      guardarTema(siguiente)
      return siguiente
    })
  }, [])

  return <TemaContext.Provider value={{ tema, alternar }}>{children}</TemaContext.Provider>
}
