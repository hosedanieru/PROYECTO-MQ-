import { useEffect, useState } from 'react'

import { BotonIdioma } from '../../components/BotonIdioma'
import { BotonTema } from '../../components/BotonTema'
import { IconoCalendario, IconoMenu, IconoPlanta, IconoSalir } from '../../components/Iconos'
import { useSesion } from '../../modules/auth/useSesion'
import { localeDeFormato } from '../../shared/idioma/locale'
import { useTextos } from '../../shared/idioma/useTextos'
import { fechaCorta, fechaOperativaDe } from '../../shared/utils/fechas'

/**
 * Planta donde opera el área. Hoy el catálogo tiene un solo lugar
 * (MAQUILA PEPSICO SANTO DOMINGO), así que se muestra como dato, no
 * como selector: un desplegable de un solo elemento solo estorba.
 * Cuando haya más de una sede se convierte en selector.
 */
const PLANTA = { nombre: 'Maquila PepsiCo', sede: 'Santo Domingo, Mosquera' }

function horaBogota(instante: Date): string {
  return new Intl.DateTimeFormat(localeDeFormato(), {
    timeZone: 'America/Bogota',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(instante)
}

/**
 * La fecha operativa es solo día (sin hora): se formatea en UTC. En zona
 * Bogotá retrocedería un día, igual que en el PDF y en el Excel.
 *
 * El formateador se construye en cada llamada, y no una vez fuera del
 * componente, porque el idioma puede cambiar mientras la aplicación
 * está abierta.
 */
function diaLargo(fechaOperativa: string): string {
  return new Intl.DateTimeFormat(localeDeFormato(), {
    timeZone: 'UTC',
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  }).format(new Date(`${fechaOperativa}T00:00:00.000Z`))
}

interface Props {
  abrirMenu: () => void
}

/**
 * Barra superior: dónde estás, en qué día productivo estás y quién eres.
 *
 * El día operativo se muestra siempre porque NO es el día del
 * calendario: entre las 00:00 y las 06:00 la fecha operativa es la del
 * día anterior. Tenerlo a la vista evita registrar en el día equivocado.
 */
export function BarraSuperior({ abrirMenu }: Props) {
  const { usuario, cerrarSesion } = useSesion()
  const { t } = useTextos()
  const [ahora, setAhora] = useState(() => new Date())

  useEffect(() => {
    // Cada 30 s: suficiente para que el minuto nunca se vea atrasado.
    const temporizador = window.setInterval(() => setAhora(new Date()), 30_000)
    return () => window.clearInterval(temporizador)
  }, [])

  const fecha = fechaOperativaDe(ahora)
  const inicial = usuario?.nombre?.slice(0, 1).toUpperCase() ?? '?'

  return (
    <header className="sticky top-0 z-20 border-b border-borde bg-base/85 backdrop-blur">
      <div className="flex h-16 items-center gap-2 px-4 sm:gap-3 sm:px-6">
        <button
          type="button"
          onClick={abrirMenu}
          aria-label={t('nav.abrirMenu')}
          className="rounded-lg p-2 text-tinta-suave transition hover:bg-velo lg:hidden"
        >
          <IconoMenu />
        </button>

        <span className="hidden items-center gap-2.5 rounded-xl border border-borde px-3 py-1.5 lg:inline-flex">
          <IconoPlanta className="h-5 w-5 text-marca" />
          <span className="leading-tight">
            <span className="block text-sm font-semibold text-tinta">{PLANTA.nombre}</span>
            <span className="block text-xs text-tinta-suave">{PLANTA.sede}</span>
          </span>
        </span>

        <span
          className="inline-flex items-center gap-2.5 rounded-xl border border-borde px-3 py-1.5"
          title={t('barra.explicacionDia')}
        >
          <IconoCalendario className="h-5 w-5 text-marca" />
          <span className="leading-tight">
            <span className="block text-sm font-semibold capitalize text-tinta">{diaLargo(fecha)}</span>
            <span className="cifra block text-xs text-tinta-suave">
              {t('barra.diaOperativo', { fecha: fechaCorta(fecha) })}
            </span>
          </span>
        </span>

        <span className="ml-auto hidden items-center gap-2 rounded-full border border-exito/30 bg-exito-claro px-3 py-1.5 text-xs font-semibold text-exito md:inline-flex">
          <span className="h-2 w-2 rounded-full bg-exito" aria-hidden="true" />
          {t('barra.turnoEnCurso')}
          <span className="cifra text-tinta-suave">{horaBogota(ahora)}</span>
        </span>

        <div className="ml-auto flex items-center gap-2 md:ml-0 md:gap-3">
          <BotonIdioma />
          <BotonTema />

          <span className="flex items-center gap-2.5 rounded-xl border border-borde py-1.5 pl-1.5 pr-3">
            <span className="grid h-8 w-8 place-items-center rounded-lg bg-marca-claro text-sm font-bold text-marca-texto">
              {inicial}
            </span>
            <span className="hidden leading-tight lg:block">
              <span className="block text-sm font-semibold text-tinta">{usuario?.nombre}</span>
              <span className="block text-xs text-tinta-suave">{usuario?.rolCodigo}</span>
            </span>
          </span>

          <button
            type="button"
            onClick={cerrarSesion}
            aria-label={t('barra.cerrarSesion')}
            className="grid h-10 w-10 place-items-center rounded-lg border border-borde text-tinta-suave transition hover:border-critico/40 hover:bg-critico-claro hover:text-critico"
          >
            <IconoSalir />
          </button>
        </div>
      </div>
    </header>
  )
}
