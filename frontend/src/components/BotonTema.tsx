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
export function BotonTema({ sobreOscuro = false }: { sobreOscuro?: boolean }) {
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
      // `sobreOscuro`: en la barra de navegación (marina en los dos temas) el gris no se lee; va en blanco.
      className={`grid h-10 w-10 place-items-center rounded-lg border transition ${
        sobreOscuro
          ? 'border-white/20 text-white/90 hover:bg-white/10 hover:text-white'
          : 'border-borde text-tinta-suave hover:border-marca/40 hover:text-marca'
      }`}
    >
      {aOscuro ? <IconoLuna /> : <IconoSol />}
    </button>
  )
}
