import { useTextos } from '../shared/idioma/useTextos'
import { useTema } from '../shared/tema/useTema'
import { IconoLuna, IconoSol } from './Iconos'

/**
 * Cambia entre tema claro y oscuro.
 *
 * Muestra el ícono del tema al que se va a cambiar (sol = "pasar a
 * claro"), que es lo que el botón hace, no el estado actual. El
 * `aria-label` lo dice con palabras, porque un ícono solo no lo explica.
 */
export function BotonTema() {
  const { tema, alternar } = useTema()
  const { t } = useTextos()
  const aOscuro = tema === 'claro'
  const etiqueta = aOscuro ? t('barra.temaOscuro') : t('barra.temaClaro')

  return (
    <button
      type="button"
      onClick={alternar}
      aria-label={etiqueta}
      title={etiqueta}
      className="grid h-10 w-10 place-items-center rounded-lg border border-borde text-tinta-suave transition hover:border-marca/40 hover:text-marca"
    >
      {aOscuro ? <IconoLuna /> : <IconoSol />}
    </button>
  )
}
