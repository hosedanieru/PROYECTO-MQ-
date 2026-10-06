import { BotonIdioma } from '../../components/BotonIdioma'
import { BotonTema } from '../../components/BotonTema'
import { IconoChevron, IconoPlanta, IconoSalir } from '../../components/Iconos'
import { useSesion } from '../../modules/auth/useSesion'
import { useTextos } from '../../shared/idioma/useTextos'
import { MenuDesplegable } from './MenuDesplegable'

/**
 * Planta donde opera el área. Hoy el catálogo tiene un solo lugar
 * (MAQUILA PEPSICO SANTO DOMINGO), así que se muestra como dato, no
 * como selector: un desplegable de un solo elemento solo estorba.
 * Cuando haya más de una sede se convierte en selector.
 */
const PLANTA = { nombre: 'Maquila PepsiCo', sede: 'Santo Domingo, Mosquera' }

/**
 * Menú de la cuenta: quién soy, en qué planta, idioma y tema, y salir.
 *
 * Reúne lo que antes ocupaba media barra superior (planta, nombre, rol,
 * salir) y el pie de la barra lateral (eslogan), para que la navegación
 * quepa arriba sin amontonarse. Nada se quitó: todo está a un clic.
 * Idioma y tema van sueltos en la barra desde 1536 px; por debajo viven
 * aquí. El nombre no va en el botón (no cabía junto al menú): está
 * arriba de este panel.
 */
export function MenuCuenta() {
  const { usuario, cerrarSesion } = useSesion()
  const { t } = useTextos()
  const inicial = usuario?.nombre?.slice(0, 1).toUpperCase() ?? '?'

  return (
    <MenuDesplegable
      alinear="derecha"
      ancho="w-72"
      etiqueta={t('nav.menuCuenta')}
      claseBoton={(abierto) =>
        `flex items-center gap-2 rounded-xl border py-1 pl-1 pr-2 text-white transition ${
          abierto ? 'border-white/40 bg-white/10' : 'border-white/15 hover:bg-white/10'
        }`
      }
      boton={
        <>
          <span className="grid h-8 w-8 place-items-center rounded-lg bg-marca-relleno text-sm font-black text-white">
            {inicial}
          </span>
          <IconoChevron className="h-4 w-4 rotate-90 opacity-80" />
        </>
      }
    >
      {(cerrar) => (
        <div className="space-y-1">
          <div className="px-3 pb-2 pt-1">
            <p className="font-bold text-tinta">{usuario?.nombre}</p>
            <p className="text-xs text-tinta-suave">{usuario?.rolCodigo}</p>
          </div>

          <div className="flex items-center gap-3 border-t border-borde px-3 py-3">
            <IconoPlanta className="h-5 w-5 shrink-0 text-marca" />
            <span className="leading-tight">
              <span className="block text-xs text-tinta-suave">{t('nav.planta')}</span>
              <span className="block text-sm font-semibold text-tinta">{PLANTA.nombre}</span>
              <span className="block text-xs text-tinta-suave">{PLANTA.sede}</span>
            </span>
          </div>

          {/* En la barra desde 1536 px; por debajo, aquí. */}
          <div className="flex items-center justify-between gap-3 border-t border-borde px-3 py-3 2xl:hidden">
            <span className="text-sm font-semibold text-tinta">{t('nav.preferencias')}</span>
            <span className="flex gap-2">
              <BotonIdioma />
              <BotonTema />
            </span>
          </div>

          <div className="border-t border-borde pt-1">
            <button
              type="button"
              onClick={() => {
                cerrar()
                cerrarSesion()
              }}
              className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold text-critico transition hover:bg-critico-claro"
            >
              <IconoSalir className="h-5 w-5" />
              {t('barra.cerrarSesion')}
            </button>
          </div>

          <div className="border-t border-borde px-3 pb-1 pt-3">
            <p className="text-xs font-semibold leading-snug text-tinta-suave">{t('nav.eslogan')}</p>
            <p className="mt-1 text-xs uppercase tracking-[0.16em] text-tinta-suave">Inlotrans S.A.S.</p>
          </div>
        </div>
      )}
    </MenuDesplegable>
  )
}
