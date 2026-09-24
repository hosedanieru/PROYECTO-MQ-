import { NavLink } from 'react-router-dom'

import { IconoCerrar } from '../../components/Iconos'
import { Logo } from '../../components/Logo'
import { useSesion } from '../../modules/auth/useSesion'
import { useAparecer } from '../../shared/animacion/useAnimacion'
import { useTextos } from '../../shared/idioma/useTextos'
import { NAVEGACION } from './navegacion'

interface Props {
  /** Solo aplica en móvil: en pantalla grande la barra está siempre fija. */
  abierta: boolean
  cerrar: () => void
}

const ENLACE_BASE =
  'flex items-center gap-3 rounded-xl py-2 pl-2 pr-3 text-sm font-medium transition duration-150'

/** El ícono va en su propio cuadro, como en el diseño. */
const CUADRO_ICONO = 'grid h-8 w-8 shrink-0 place-items-center rounded-lg transition'

/**
 * Barra lateral de navegación.
 *
 * En pantalla grande es una columna fija. En móvil es un cajón que
 * entra desde la izquierda sobre un velo oscuro; cualquier enlace lo
 * cierra, para no dejarlo tapando la pantalla a la que acabas de entrar.
 */
export function BarraLateral({ abierta, cerrar }: Props) {
  const { tienePermiso } = useSesion()
  const { t } = useTextos()
  const menu = useAparecer<HTMLElement>()

  const secciones = NAVEGACION.map((seccion) => ({
    ...seccion,
    enlaces: seccion.enlaces.filter((enlace) => !enlace.permiso || tienePermiso(enlace.permiso)),
  })).filter((seccion) => seccion.enlaces.length > 0)

  return (
    <>
      {abierta && (
        <button
          type="button"
          aria-label={t('nav.cerrarMenu')}
          onClick={cerrar}
          className="fixed inset-0 z-30 bg-marina/50 backdrop-blur-sm lg:hidden"
        />
      )}

      <aside
        className={`fixed inset-y-0 left-0 z-40 flex w-64 flex-col bg-marina transition-transform duration-300 lg:sticky lg:top-0 lg:h-screen lg:translate-x-0 ${
          abierta ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div className="flex h-16 shrink-0 items-center justify-between px-5">
          <NavLink to="/" onClick={cerrar} aria-label={t('nav.irAlInicio')}>
            <Logo variante="claro" />
          </NavLink>
          <button
            type="button"
            onClick={cerrar}
            aria-label={t('nav.cerrarMenu')}
            className="rounded-lg p-1.5 text-white/70 transition hover:bg-white/10 hover:text-white lg:hidden"
          >
            <IconoCerrar />
          </button>
        </div>

        <nav ref={menu} className="flex-1 space-y-6 overflow-y-auto px-3 py-4">
          {secciones.map((seccion, indice) => (
            <div key={seccion.titulo ?? `seccion-${indice}`} data-animar>
              {seccion.titulo && (
                <p className="px-3 pb-2 text-[11px] font-semibold uppercase tracking-[0.16em] text-white/40">
                  {t(seccion.titulo)}
                </p>
              )}
              <div className="space-y-1">
                {seccion.enlaces.map(({ a, texto, Icono, exacta }) => (
                  <NavLink
                    key={a}
                    to={a}
                    end={exacta}
                    onClick={cerrar}
                    className={({ isActive }) =>
                      `${ENLACE_BASE} ${
                        isActive
                          ? 'bg-marca text-white shadow-sm'
                          : 'text-white/65 hover:bg-white/10 hover:text-white'
                      }`
                    }
                  >
                    {({ isActive }) => (
                      <>
                        <span className={`${CUADRO_ICONO} ${isActive ? 'bg-white/20' : 'bg-white/5'}`}>
                          <Icono />
                        </span>
                        {t(texto)}
                      </>
                    )}
                  </NavLink>
                ))}
              </div>
            </div>
          ))}
        </nav>

        <div className="shrink-0 border-t border-white/10 px-5 py-5">
          <p className="text-sm font-semibold leading-snug text-white/45">{t('nav.eslogan')}</p>
          <p className="mt-2 text-[11px] uppercase tracking-[0.16em] text-white/25">Inlotrans S.A.S.</p>
        </div>
      </aside>
    </>
  )
}
