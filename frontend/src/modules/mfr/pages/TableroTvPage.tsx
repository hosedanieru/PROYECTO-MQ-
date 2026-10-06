/**
 * MODO TV DEL TABLERO MFR
 * =======================
 *
 * Para el televisor de planta (decisión del usuario, 2026-10-05): sin
 * menú, letra grande, alto contraste y se refresca sola. Nadie la
 * maneja: siempre muestra el día operativo EN CURSO (corte 06:00), así
 * que a las 6 de la mañana pasa sola al día nuevo.
 *
 * Responde tres preguntas legibles a varios metros:
 *   1. ¿Cómo va el día?      → medidor grande contra la meta
 *   2. ¿Cómo va cada turno?  → una columna por turno
 *   3. ¿Qué falta?           → los PT con más cajas pendientes
 *
 * Es solo lectura: reutiliza la misma consulta del tablero normal.
 */

import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'

import { COLOR_TONO } from '../../../components/Badge'
import { Medidor } from '../../../components/graficas/Medidor'
import { Logo } from '../../../components/Logo'
import { REFRESCO_TABLERO } from '../../../shared/refresco'
import type { ResumenTurno } from '../../../shared/types/mfr'
import { fechaCorta, fechaOperativaDe } from '../../../shared/utils/fechas'
import { miles, porcentaje, proporcion } from '../../../shared/utils/numeros'
import { useProductos } from '../../catalogo/hooks/useCatalogos'
import { useIndicadoresDia } from '../hooks/useMfr'
import { textoSemaforo, tonoSemaforo } from '../semaforo'

/** Cuántos PT pendientes caben legibles en un televisor. */
const PT_EN_PANTALLA = 6

/** Reloj de la esquina; también hace avanzar el día operativo a las 06:00. */
function useAhora(intervaloMs = 15_000) {
  const [ahora, setAhora] = useState(() => new Date())
  useEffect(() => {
    const id = window.setInterval(() => setAhora(new Date()), intervaloMs)
    return () => window.clearInterval(id)
  }, [intervaloMs])
  return ahora
}

const hora = (d: Date) =>
  new Intl.DateTimeFormat('es-CO', { timeZone: 'America/Bogota', hour: '2-digit', minute: '2-digit', hour12: false }).format(d)

export function TableroTvPage() {
  const ahora = useAhora()
  const fecha = fechaOperativaDe(ahora)
  const dia = useIndicadoresDia(fecha, true, REFRESCO_TABLERO)
  const productos = useProductos()
  const [pantallaCompleta, setPantallaCompleta] = useState(false)

  useEffect(() => {
    const alCambiar = () => setPantallaCompleta(Boolean(document.fullscreenElement))
    document.addEventListener('fullscreenchange', alCambiar)
    return () => document.removeEventListener('fullscreenchange', alCambiar)
  }, [])

  const alternarPantalla = () => {
    if (document.fullscreenElement) void document.exitFullscreen()
    else void document.documentElement.requestFullscreen?.()
  }

  const datos = dia.data
  const mfr = datos?.mfr
  const pendientes = (mfr?.porProducto ?? [])
    .map((p) => ({ ...p, faltan: Math.max(0, p.programadoCajas - p.producidoCajas) }))
    .filter((p) => p.faltan > 0)
    .sort((a, b) => b.faltan - a.faltan)
    .slice(0, PT_EN_PANTALLA)

  return (
    <main className="hero relative isolate flex min-h-screen flex-col gap-6 overflow-hidden p-6 text-white lg:p-10">
      <div className="hero-rejilla pointer-events-none absolute inset-0 -z-10" aria-hidden="true" />
      <span className="luz -right-24 -top-24 -z-10 h-[28rem] w-[28rem] bg-marca opacity-60" aria-hidden="true" />
      <span className="luz -bottom-32 left-1/4 -z-10 h-96 w-96 bg-acento opacity-30 [animation-delay:-7s]" aria-hidden="true" />

      {/* ---------- Cabecera ---------- */}
      <header className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-5">
          <Logo variante="claro" />
          <div>
            <p className="text-2xl font-black tracking-tight lg:text-3xl">Cumplimiento del día</p>
            <p className="text-base text-white/90">Día operativo {fechaCorta(fecha)} · meta {datos?.meta ?? 95} %</p>
          </div>
        </div>
        <div className="flex items-center gap-4">
          <span className="flex items-center gap-2 rounded-full bg-white/10 px-3 py-1.5 text-sm font-bold">
            <span className="h-2.5 w-2.5 animate-pulse rounded-full bg-exito" aria-hidden="true" />
            En vivo
          </span>
          <span className="cifra text-4xl font-black lg:text-5xl">{hora(ahora)}</span>
          {/* Controles discretos: en la TV nadie los usa, pero hay que poder salir. */}
          <div className="flex gap-2 opacity-40 transition hover:opacity-100 focus-within:opacity-100">
            <button type="button" onClick={alternarPantalla} className="vidrio rounded-lg px-3 py-2 text-xs font-semibold">
              {pantallaCompleta ? 'Salir de pantalla completa' : 'Pantalla completa'}
            </button>
            <Link to="/mfr" className="vidrio rounded-lg px-3 py-2 text-xs font-semibold">
              Volver
            </Link>
          </div>
        </div>
      </header>

      {dia.isError && (
        <p className="rounded-2xl bg-critico/30 px-5 py-4 text-xl font-bold">
          Sin conexión con el servidor. Se reintenta solo; los datos de abajo pueden estar atrasados.
        </p>
      )}

      {datos && mfr && datos.bloques.length === 0 && (
        <div className="grid flex-1 place-items-center text-center">
          <div>
            <p className="text-5xl font-black">Sin DPP cargado</p>
            <p className="mt-3 text-2xl text-white/90">Cuando se cargue la programación del día, el tablero se llena solo.</p>
          </div>
        </div>
      )}

      {datos && mfr && datos.bloques.length > 0 && (
        <div className="grid flex-1 gap-6 xl:grid-cols-[auto_1fr]">
          {/* ---------- 1. El día ---------- */}
          <section className="vidrio flex flex-col items-center justify-center gap-4 rounded-[2rem] p-8">
            <Medidor
              valor={mfr.cumplimiento}
              meta={datos.meta}
              tono={tonoSemaforo(mfr.semaforo)}
              variante="vidrio"
              tamano={320}
              leyenda={textoSemaforo(mfr.semaforo)}
              titulo={`Cumplimiento del día ${porcentaje(mfr.cumplimiento)}`}
            />
            <p className="text-center text-2xl">
              <span className="cifra font-black">{miles(mfr.producidoCajas)}</span>
              <span className="text-white/90"> de </span>
              <span className="cifra font-bold">{miles(mfr.programadoCajas)}</span>
              <span className="text-white/90"> cajas</span>
            </p>
          </section>

          <div className="flex flex-col gap-6">
            {/* ---------- 2. Los turnos ---------- */}
            <section className="grid gap-4 md:grid-cols-3" aria-label="Turnos">
              {datos.turnos.map((t) => (
                <TurnoTv key={t.turnoId} turno={t} meta={datos.meta} />
              ))}
            </section>

            {/* ---------- 3. Lo que falta ---------- */}
            <section className="vidrio flex-1 rounded-[2rem] p-6">
              <h2 className="text-xl font-black uppercase tracking-wider text-white/90">PT con más cajas pendientes</h2>
              {pendientes.length === 0 ? (
                <p className="mt-6 text-3xl font-black text-exito">Todo lo programado está producido.</p>
              ) : (
                <ul className="mt-4 grid gap-x-8 gap-y-4 lg:grid-cols-2">
                  {pendientes.map((p) => {
                    const tono = COLOR_TONO[tonoSemaforo(p.semaforo)]
                    return (
                      <li key={p.productoId}>
                        <div className="flex items-baseline justify-between gap-4">
                          <span className="truncate text-xl font-semibold">
                            {productos.data?.find((x) => x.id === p.productoId)?.descripcion ?? 'PT fuera del catálogo'}
                          </span>
                          <span className="cifra shrink-0 text-2xl font-black">
                            faltan {miles(p.faltan)}
                          </span>
                        </div>
                        <div className="relative mt-2 h-4 rounded-full bg-white/10">
                          <span
                            className="absolute inset-y-0 left-0 rounded-full transition-[width] duration-700"
                            style={{ width: `${Math.min(p.cumplimiento ?? 0, 100)}%`, backgroundColor: tono, boxShadow: `0 0 14px ${tono}` }}
                          />
                          <span className="absolute -inset-y-1 w-1 rounded-full bg-white" style={{ left: `${datos.meta}%` }} aria-hidden="true" />
                        </div>
                      </li>
                    )
                  })}
                </ul>
              )}
            </section>
          </div>
        </div>
      )}
    </main>
  )
}

function TurnoTv({ turno, meta }: { turno: ResumenTurno; meta: number }) {
  const tono = COLOR_TONO[tonoSemaforo(turno.semaforo)]
  const avance = proporcion(turno.producidoCajas, turno.targetCajas) ?? 0

  return (
    <article className="vidrio relative overflow-hidden rounded-[2rem] p-6">
      <span className="absolute inset-x-6 top-0 h-1.5 rounded-b-full" style={{ backgroundColor: tono, boxShadow: `0 0 20px 2px ${tono}` }} aria-hidden="true" />
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-2xl font-black">{turno.codigo}</h2>
        <span className="rounded-full bg-white/10 px-3 py-1 text-sm font-bold">
          {turno.horasTurno === null ? 'No opera' : turno.cerrado ? 'Cerrado' : 'Abierto'}
        </span>
      </div>
      <p className="cifra mt-3 text-6xl font-black leading-none lg:text-7xl">{porcentaje(turno.cumplimiento)}</p>
      <p className="mt-1 text-lg font-semibold text-white/90">{textoSemaforo(turno.semaforo)}</p>
      <div className="relative mt-4 h-3 rounded-full bg-white/10">
        <span className="absolute inset-y-0 left-0 rounded-full transition-[width] duration-700" style={{ width: `${Math.min(avance, 100)}%`, backgroundColor: tono }} />
        <span className="absolute -inset-y-1 w-1 rounded-full bg-white" style={{ left: `${meta}%` }} aria-hidden="true" />
      </div>
      <p className="mt-2 text-lg text-white/90">
        <span className="cifra font-bold text-white">{miles(turno.producidoCajas)}</span> de{' '}
        <span className="cifra">{miles(turno.targetCajas)}</span> cajas
      </p>
    </article>
  )
}
