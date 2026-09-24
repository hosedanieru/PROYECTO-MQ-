import { useContext } from 'react'

import { IdiomaContext } from './idioma-context'

/**
 * Da acceso a los textos y al idioma actual.
 *
 *   const { t, idioma, alternar } = useTextos()
 *   <h1>{t('inicio.remisionesDelDia')}</h1>
 *   <p>{t('inicio.meta', { meta: 95 })}</p>
 */
export function useTextos() {
  const contexto = useContext(IdiomaContext)
  if (!contexto) {
    throw new Error('useTextos debe usarse dentro de <IdiomaProvider>.')
  }
  return contexto
}
