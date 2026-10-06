import { useEffect } from 'react'
import { useLocation } from 'react-router-dom'

import { useTextos } from '../../shared/idioma/useTextos'
import { OpcionMenu } from './MenuPrincipal'
import { enlaceActivo, type ElementoNav } from './navegacion'

interface Props {
  abierto: boolean
  cerrar: () => void
  elementos: ElementoNav[]
}

/**
 * Panel de navegación para celular y tablet angosta (< 1024 px).
 *
 * Baja desde la barra superior y muestra TODO a la vez, agrupado: los
 * enlaces sueltos en dos columnas y cada grupo con su título. Sin barra
 * de desplazamiento horizontal; si la pantalla es muy baja, el panel se
 * desplaza hacia abajo como cualquier página.
 *
 * Se cierra al elegir un enlace, al tocar el velo o con Escape.
 */
export function MenuMovil({ abierto, cerrar, elementos }: Props) {
  const { t } = useTextos()
  const { pathname } = useLocation()

  useEffect(() => {
    if (!abierto) return
    const alPulsarTecla = (e: KeyboardEvent) => {
      if (e.key === 'Escape') cerrar()
    }
    document.addEventListener('keydown', alPulsarTecla)
    return () => document.removeEventListener('keydown', alPulsarTecla)
  }, [abierto, cerrar])

  if (!abierto) return null

  const sueltos = elementos.flatMap((el) => ('enlace' in el ? [el.enlace] : []))
  const grupos = elementos.flatMap((el) => ('grupo' in el ? [el.grupo] : []))

  return (
    <>
      <button
        type="button"
        aria-label={t('nav.cerrarMenu')}
        onClick={cerrar}
        className="fixed inset-0 top-16 z-30 bg-marina/50 backdrop-blur-sm lg:hidden"
      />
      <nav
        aria-label={t('nav.navegacionPrincipal')}
        className="fixed inset-x-0 top-16 z-40 max-h-[calc(100dvh-4rem)] origin-top animate-[desplegar_180ms_ease-out] overflow-y-auto border-b border-borde bg-base px-4 pb-6 pt-4 shadow-elevada lg:hidden"
      >
        <div className="mx-auto max-w-2xl space-y-5">
          <div className="grid grid-cols-2 gap-1">
            {sueltos.map((e) => (
              <OpcionMenu key={e.a} enlace={e} activo={enlaceActivo(e, pathname)} cerrar={cerrar} />
            ))}
          </div>
          {grupos.map((g) => (
            <div key={g.texto}>
              <p className="px-3 pb-2 text-xs font-bold uppercase tracking-[0.16em] text-tinta-suave">{t(g.texto)}</p>
              <div className="grid grid-cols-2 gap-1">
                {g.enlaces.map((e) => (
                  <OpcionMenu key={e.a} enlace={e} activo={enlaceActivo(e, pathname)} cerrar={cerrar} />
                ))}
              </div>
            </div>
          ))}
          <div className="border-t border-borde px-3 pt-4">
            <p className="text-sm font-semibold leading-snug text-tinta-suave">{t('nav.eslogan')}</p>
            <p className="mt-1 text-xs uppercase tracking-[0.16em] text-tinta-suave">Inlotrans S.A.S.</p>
          </div>
        </div>
      </nav>
    </>
  )
}
