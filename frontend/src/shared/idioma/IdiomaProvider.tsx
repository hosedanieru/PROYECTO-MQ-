import { useCallback, useLayoutEffect, useMemo, useState, type ReactNode } from 'react'

import { fijarLocale } from './locale'
import {
  aplicarIdioma,
  guardarIdioma,
  idiomaGuardado,
  IDIOMA_POR_DEFECTO,
  LOCALE,
  type Idioma,
} from './idioma'
import { IdiomaContext, type Sustituciones } from './idioma-context'
import { en } from './textos/en'
import { es, type ClaveTexto } from './textos/es'

const DICCIONARIOS = { es, en } as const

/** Rellena los huecos `{algo}` del texto. */
function sustituir(texto: string, sustituciones?: Sustituciones): string {
  if (!sustituciones) return texto
  return texto.replace(/\{(\w+)\}/g, (coincidencia, clave: string) =>
    clave in sustituciones ? String(sustituciones[clave]) : coincidencia,
  )
}

/**
 * Mantiene el idioma y lo refleja en el documento.
 *
 * Va por encima de todo lo demás (ver `providers.tsx`) porque cualquier
 * pantalla puede necesitar un texto. El estado se inicializa leyendo lo
 * guardado, no en un efecto, para que la primera pintura ya salga en el
 * idioma correcto y no se vea el cambio.
 */
export function IdiomaProvider({ children }: { children: ReactNode }) {
  const [idioma, setIdioma] = useState<Idioma>(() => idiomaGuardado() ?? IDIOMA_POR_DEFECTO)

  useLayoutEffect(() => {
    aplicarIdioma(idioma)
    // Números y fechas siguen al idioma; ver `locale.ts`.
    fijarLocale(LOCALE[idioma])
  }, [idioma])

  const alternar = useCallback(() => {
    setIdioma((actual) => {
      const siguiente: Idioma = actual === 'es' ? 'en' : 'es'
      guardarIdioma(siguiente)
      return siguiente
    })
  }, [])

  const t = useCallback(
    (clave: ClaveTexto, sustituciones?: Sustituciones) =>
      sustituir(DICCIONARIOS[idioma][clave], sustituciones),
    [idioma],
  )

  const valor = useMemo(() => ({ idioma, alternar, t }), [idioma, alternar, t])

  return <IdiomaContext.Provider value={valor}>{children}</IdiomaContext.Provider>
}
