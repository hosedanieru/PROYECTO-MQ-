import { NavLink } from 'react-router-dom'

import { BotonIdioma } from '../../components/BotonIdioma'
import { BotonTema } from '../../components/BotonTema'
import { IconoCerrar, IconoMenu } from '../../components/Iconos'
import { Logo } from '../../components/Logo'
import { useSesion } from '../../modules/auth/useSesion'
import { useTextos } from '../../shared/idioma/useTextos'
import { ChipDiaOperativo } from './ChipDiaOperativo'
import { MenuCuenta } from './MenuCuenta'
import { MenuMovil } from './MenuMovil'
import { MenuPrincipal } from './MenuPrincipal'
import { navegacionVisible } from './navegacion'

interface Props {
  menuAbierto: boolean
  alternarMenu: () => void
  cerrarMenu: () => void
}

/**
 * BARRA SUPERIOR — toda la navegación arriba
 * ==========================================
 *
 * Decisión del usuario (2026-10-05): la barra lateral se quitaba 256 px
 * de ancho a todas las pantallas. Ahora todo va arriba, en una sola
 * franja marina (oscura en los dos temas, como era la lateral):
 *
 *   [logo] Inicio · Remisiones · Programación · Averías · Inventario · Tableros ▾ · Administración ▾   [día · hora] [ES] [☾] [cuenta ▾]
 *
 * Para que quepa sin barra de desplazamiento, sin quitar nada:
 * - los enlaces que van juntos se agrupan en desplegables (ver `navegacion.ts`);
 * - planta, nombre, rol, salir y el eslogan pasan al menú de la cuenta;
 * - día operativo + turno en curso + hora se reúnen en un solo chip;
 * - lo que se escribe crece con el ancho:
 *     < 1280 px   símbolo "IN", fecha corta, botones del menú más juntos
 *     ≥ 1280 px   "Día operativo …" en el chip
 *     ≥ 1536 px   logo completo, día de la semana, idioma y tema sueltos
 *     ≥ 1680 px   íconos en el menú
 *   (por debajo, idioma y tema viven en el menú de la cuenta);
 * - por debajo de 1024 px, el menú se abre como panel desde la barra.
 *
 * MEDIR al agregar algo al menú: con la fuente Inter YA CARGADA (sin ella
 * el texto es más angosto y la medida engaña), en 1024, 1280, 1440 y
 * 1536 px. 2026-10-06, con 7 elementos: sin solapes en los cuatro anchos.
 */
export function BarraSuperior({ menuAbierto, alternarMenu, cerrarMenu }: Props) {
  const { tienePermiso } = useSesion()
  const { t } = useTextos()
  const elementos = navegacionVisible(tienePermiso)

  return (
    <header className="sticky top-0 z-40 isolate bg-marina text-white shadow-[0_8px_24px_-12px_rgb(0_0_0/0.5)]">
      {/*
        Halo de luz detrás del logo (decoración, como en la antigua barra
        lateral). Va en su propio recorte: si se recortara la barra entera,
        también se cortarían los menús desplegables.
      */}
      <div className="pointer-events-none absolute inset-0 -z-10 overflow-hidden" aria-hidden="true">
        <span className="luz -left-16 -top-28 h-48 w-48 bg-marca opacity-40" />
      </div>
      <div className="mx-auto flex h-16 max-w-[96rem] items-center gap-2 px-4 sm:px-6 xl:gap-3">
        <button
          type="button"
          onClick={alternarMenu}
          aria-label={menuAbierto ? t('nav.cerrarMenu') : t('nav.abrirMenu')}
          aria-expanded={menuAbierto}
          className="grid h-10 w-10 place-items-center rounded-lg text-white/90 transition hover:bg-white/10 hover:text-white lg:hidden"
        >
          {menuAbierto ? <IconoCerrar /> : <IconoMenu />}
        </button>

        <NavLink to="/" onClick={cerrarMenu} aria-label={t('nav.irAlInicio')} className="shrink-0">
          {/* Por debajo de 1536 px, solo el símbolo: con los 7 elementos del menú el nombre completo no deja espacio. */}
          <span className="2xl:hidden">
            <Logo variante="claro" soloIsotipo />
          </span>
          <span className="hidden 2xl:block">
            <Logo variante="claro" />
          </span>
        </NavLink>

        <div className="ml-2 min-w-0 flex-1">
          <MenuPrincipal elementos={elementos} />
        </div>

        <div className="flex shrink-0 items-center gap-2">
          <ChipDiaOperativo />
          <span className="hidden items-center gap-2 2xl:flex">
            <BotonIdioma sobreOscuro />
            <BotonTema sobreOscuro />
          </span>
          <MenuCuenta />
        </div>
      </div>

      <MenuMovil abierto={menuAbierto} cerrar={cerrarMenu} elementos={elementos} />
    </header>
  )
}
