import { NavLink, useLocation } from 'react-router-dom'

import { IconoChevron } from '../../components/Iconos'
import { useTextos } from '../../shared/idioma/useTextos'
import { MenuDesplegable } from './MenuDesplegable'
import { enlaceActivo, type ElementoNav, type EnlaceNav } from './navegacion'

/*
 * Botón de la barra (fondo marina en los dos temas). Activo: relleno con
 * --marca-relleno, el único azul donde el blanco da 6,7:1. Inactivo:
 * blanco al 90 % (regla de legibilidad sobre fondos oscuros).
 * Los íconos solo aparecen desde 1680 px y, por debajo de 1280 px, los
 * botones van más juntos: con los 7 elementos del menú (2026-10-06) era
 * lo que hacía falta para no montarse sobre el chip del día. Por debajo
 * de 1680 px, el texto es lo que cabe y lo que se lee.
 */
const BOTON = 'flex items-center gap-2 rounded-xl px-2.5 py-2 text-sm font-semibold transition duration-150 whitespace-nowrap xl:px-3'
const ACTIVO = 'bg-marca-relleno text-white shadow-[0_8px_24px_-8px_var(--color-marca)]'
const INACTIVO = 'text-white/90 hover:bg-white/10 hover:text-white'

/** Enlaces y grupos en fila, para pantallas desde 1024 px. */
export function MenuPrincipal({ elementos }: { elementos: ElementoNav[] }) {
  const { t } = useTextos()
  const { pathname } = useLocation()

  return (
    <nav aria-label={t('nav.navegacionPrincipal')} className="hidden items-center gap-0.5 lg:flex xl:gap-1">
      {elementos.map((el) => {
        if ('enlace' in el) {
          const { a, texto, Icono, exacta } = el.enlace
          return (
            <NavLink key={a} to={a} end={exacta} className={({ isActive }) => `${BOTON} ${isActive ? ACTIVO : INACTIVO}`}>
              <Icono className="hidden h-[18px] w-[18px] min-[1680px]:block" />
              {t(texto)}
            </NavLink>
          )
        }
        const { texto, Icono, enlaces } = el.grupo
        const activo = enlaces.some((e) => enlaceActivo(e, pathname))
        return (
          <MenuDesplegable
            key={texto}
            ancho={enlaces.length > 3 ? 'w-[30rem]' : 'w-72'}
            // Los paneles anchos (Tableros, Administración: los últimos del menú) se abren hacia la izquierda: a 1024 px se salían por la derecha.
            alinear={enlaces.length > 3 ? 'derecha' : 'izquierda'}
            claseBoton={(abierto) => `${BOTON} ${activo ? ACTIVO : abierto ? 'bg-white/10 text-white' : INACTIVO}`}
            boton={
              <>
                <Icono className="hidden h-[18px] w-[18px] min-[1680px]:block" />
                {t(texto)}
                <IconoChevron className="h-4 w-4 rotate-90 opacity-80" />
              </>
            }
          >
            {(cerrar) => (
              // Más de 3 enlaces (Administración): rejilla de 2 columnas, todo a la vista sin desplazarse.
              <div className={`grid gap-1 ${enlaces.length > 3 ? 'grid-cols-2' : ''}`}>
                {enlaces.map((e) => (
                  <OpcionMenu key={e.a} enlace={e} activo={enlaceActivo(e, pathname)} cerrar={cerrar} />
                ))}
              </div>
            )}
          </MenuDesplegable>
        )
      })}
    </nav>
  )
}

/** Una opción dentro de un menú desplegable o del panel del celular. */
export function OpcionMenu({ enlace, activo, cerrar }: { enlace: EnlaceNav; activo: boolean; cerrar: () => void }) {
  const { t } = useTextos()
  const { a, texto, Icono, exacta } = enlace
  return (
    <NavLink
      to={a}
      end={exacta}
      onClick={cerrar}
      className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold transition pointer-coarse:min-h-11 ${
        activo ? 'bg-marca-claro text-marca-texto' : 'text-tinta hover:bg-velo'
      }`}
    >
      <span
        className={`grid h-8 w-8 shrink-0 place-items-center rounded-lg ${
          activo ? 'bg-marca-relleno text-white' : 'bg-velo text-tinta-suave'
        }`}
      >
        <Icono className="h-[18px] w-[18px]" />
      </span>
      {t(texto)}
    </NavLink>
  )
}
