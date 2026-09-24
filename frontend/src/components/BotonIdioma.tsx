import { useTextos } from '../shared/idioma/useTextos'

/**
 * Cambia entre español e inglés de un clic.
 *
 * Muestra el código del idioma al que se va a cambiar, no el actual: el
 * botón dice lo que hace. El `aria-label` lo escribe con palabras y ya
 * en el idioma de destino, que es como se lee mejor ("Switch to
 * English" cuando estás en español).
 */
export function BotonIdioma() {
  const { idioma, alternar, t } = useTextos()
  const destino = idioma === 'es' ? 'EN' : 'ES'

  return (
    <button
      type="button"
      onClick={alternar}
      aria-label={t('barra.cambiarIdioma')}
      title={t('barra.cambiarIdioma')}
      className="grid h-10 w-10 place-items-center rounded-lg border border-borde text-xs font-bold tracking-wide text-tinta-suave transition hover:border-marca/40 hover:text-marca"
    >
      {destino}
    </button>
  )
}
