import { useEffect, useState } from 'react'

import { IconoCalendario } from '../../components/Iconos'
import { localeDeFormato } from '../../shared/idioma/locale'
import { useTextos } from '../../shared/idioma/useTextos'
import { fechaCorta, fechaOperativaDe } from '../../shared/utils/fechas'

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

/**
 * En qué día productivo y a qué hora estamos, siempre a la vista.
 *
 * El día operativo se muestra siempre porque NO es el día del
 * calendario: entre las 00:00 y las 06:00 la fecha operativa es la del
 * día anterior. Tenerlo a la vista evita registrar en el día equivocado.
 *
 * Reúne lo que antes eran dos recuadros de la barra (día operativo y
 * "turno en curso" con la hora) para que quepa junto al menú: el punto
 * verde que late es el "turno en curso". Cuánto se escribe depende del
 * ancho: fecha corta (< 1280 px), "Día operativo dd/mm/aaaa" (≥ 1280) y
 * además el día de la semana (≥ 1536). El título siempre lo dice completo.
 */
export function ChipDiaOperativo() {
  const { t } = useTextos()
  const [ahora, setAhora] = useState(() => new Date())

  useEffect(() => {
    // Cada 30 s: suficiente para que el minuto nunca se vea atrasado.
    const temporizador = window.setInterval(() => setAhora(new Date()), 30_000)
    return () => window.clearInterval(temporizador)
  }, [])

  const fecha = fechaOperativaDe(ahora)

  return (
    <span
      className="inline-flex items-center gap-2.5 rounded-xl border border-white/15 bg-white/5 px-3 py-1.5 text-white"
      title={`${t('barra.explicacionDia')} · ${t('barra.turnoEnCurso')} ${horaBogota(ahora)}`}
    >
      <IconoCalendario className="hidden h-5 w-5 text-white/90 xl:block" />
      <span className="leading-tight">
        {/* Día de la semana: solo con espacio de sobra (≥ 1536 px). Mayúscula solo en la primera letra ("lunes, 5 de octubre"). */}
        <span className="hidden text-sm font-semibold first-letter:uppercase 2xl:block">{diaLargo(fecha)}</span>
        <span className="cifra hidden text-xs text-white/90 xl:block">{t('barra.diaOperativo', { fecha: fechaCorta(fecha) })}</span>
        {/* Por debajo de 1280 px, la fecha corta; el texto completo queda para lectores de pantalla y en el título. */}
        <span className="cifra text-sm font-semibold xl:hidden">
          <span className="sr-only">{t('barra.diaOperativo', { fecha: fechaCorta(fecha) })}</span>
          <span aria-hidden="true">{fechaCorta(fecha).slice(0, 5)}</span>
        </span>
      </span>
      <span className="flex items-center gap-1.5 border-l border-white/15 pl-2.5 text-xs font-semibold">
        {/* Punto "en vivo" con onda: el turno está corriendo. */}
        <span className="relative flex h-2 w-2" aria-hidden="true">
          <span className="absolute inset-0 animate-ping rounded-full bg-exito opacity-75" />
          <span className="relative h-2 w-2 rounded-full bg-exito" />
        </span>
        <span className="sr-only">{t('barra.turnoEnCurso')}</span>
        <span className="cifra">{horaBogota(ahora)}</span>
      </span>
    </span>
  )
}
