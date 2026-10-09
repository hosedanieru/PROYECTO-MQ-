import { useState } from 'react'

import { COLOR_TONO, type TonoBadge } from '../../../components/Badge'
import { motion, RESORTE_GRAFICA } from '../../../shared/animacion/movimiento'
import type { Producto } from '../../../shared/types/catalogo'
import type { IndicadoresDia, MfrPorProducto } from '../../../shared/types/mfr'
import { miles, porcentaje } from '../../../shared/utils/numeros'
import { BarraVista } from '../../../components/BarraVista'
import { resumenPt } from '../resumen-vistas'
import { textoSemaforo, tonoSemaforo } from '../semaforo'

interface Props {
  mfr: IndicadoresDia['mfr']
  meta: number
  productos: Producto[] | undefined
}

type Orden = 'atencion' | 'dpp'

/**
 * CUMPLIMIENTO POR PT, COMO RANKING
 * =================================
 *
 * Cada PT es una fila a todo el ancho (sin tarjetas, decisión del
 * usuario 2026-10-05): nombre, barra contra lo programado con la marca
 * de la meta, porcentaje y lo que falta. Por defecto van primero los que
 * más faltan: lo que hay que perseguir queda arriba. El orden del DPP
 * sigue a un clic, para cotejar con el documento de PepsiCo.
 *
 * Los PT fuera del DPP y los pedidos de emergencia van aparte, debajo:
 * no cuentan para el cumplimiento y mezclarlos confundiría.
 */
export function RankingPt({ mfr, meta, productos }: Props) {
  const [orden, setOrden] = useState<Orden>('atencion')
  const producto = (id: string) => productos?.find((p) => p.id === id)

  const filas =
    orden === 'dpp'
      ? mfr.porProducto
      : [...mfr.porProducto].sort((a, b) => (a.cumplimiento ?? -1) - (b.cumplimiento ?? -1))

  return (
    <div>
      <BarraVista
        texto={`${resumenPt(mfr, meta)}. La raya vertical de cada barra es la meta del ${meta} %.`}
        acciones={
          <div className="flex gap-1 rounded-xl bg-velo p-1" role="group" aria-label="Orden">
            {(
              [
                ['atencion', 'Primero lo que falta'],
                ['dpp', 'Orden del DPP'],
              ] as const
            ).map(([clave, etiqueta]) => (
              <button
                key={clave}
                type="button"
                aria-pressed={orden === clave}
                onClick={() => setOrden(clave)}
                className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition pointer-coarse:min-h-9 ${
                  orden === clave ? 'bg-marca-relleno text-white shadow-sm' : 'text-tinta-suave hover:text-tinta'
                }`}
              >
                {etiqueta}
              </button>
            ))}
          </div>
        }
      />

      <ul className="divide-y divide-borde border-y border-borde">
        {filas.map((p, i) => (
          <FilaPt
            key={p.productoId}
            fila={p}
            meta={meta}
            codigo={producto(p.productoId)?.codigo}
            descripcion={producto(p.productoId)?.descripcion ?? 'PT fuera del catálogo'}
            retraso={i * 40}
          />
        ))}
      </ul>

      {(mfr.producidoSinProgramar.length > 0 || mfr.extraoficiales.length > 0) && (
        <div className="mt-8 grid gap-8 md:grid-cols-2">
          <ListaAparte
            titulo="Producido sin estar en el DPP"
            nota="Remisiones aprobadas de PT que PepsiCo no programó ese día."
            tono="neutro"
            items={mfr.producidoSinProgramar.map((p) => ({ ...p, producto: producto(p.productoId) }))}
          />
          <ListaAparte
            titulo="Pedidos de emergencia"
            nota="Remisiones extraoficiales: no cuentan para el cumplimiento."
            tono="acento"
            items={mfr.extraoficiales.map((p) => ({ ...p, producto: producto(p.productoId) }))}
          />
        </div>
      )}
    </div>
  )
}

function FilaPt({
  fila,
  meta,
  codigo,
  descripcion,
  retraso,
}: {
  fila: MfrPorProducto
  meta: number
  codigo: string | undefined
  descripcion: string
  retraso: number
}) {
  const tono = tonoSemaforo(fila.semaforo)
  const avance = Math.min(fila.cumplimiento ?? 0, 100)
  const faltan = Math.max(0, fila.programadoCajas - fila.producidoCajas)

  return (
    // `layout`: al cambiar el orden (botones o un refresco que mueve un PT de puesto), la fila se
    // DESLIZA a su nuevo lugar en vez de saltar; se ve qué PT subió y cuál bajó (Motion, 2026-10-07).
    <motion.li
      layout="position"
      transition={RESORTE_GRAFICA}
      className="relative grid items-center gap-x-6 gap-y-2 py-4 pl-5 pr-1 transition-colors hover:bg-marca-claro/30 md:grid-cols-[minmax(0,2fr)_minmax(0,3fr)_7rem_9rem]"
    >
      {/* Franja del semáforo a la izquierda de la fila. */}
      <span className="absolute inset-y-3 left-0 w-1.5 rounded-full" style={{ backgroundColor: COLOR_TONO[tono] }} aria-hidden="true" />

      <div className="min-w-0">
        <p className="truncate font-bold text-tinta" title={descripcion}>
          {descripcion}
        </p>
        {codigo && <p className="codigo text-xs text-tinta-suave">{codigo}</p>}
      </div>

      {/* Pista = lo programado; relleno = lo producido; raya vertical = la meta. */}
      <div>
        <div
          className="relative h-3.5 rounded-full bg-velo"
          role="progressbar"
          aria-valuenow={Math.round(avance)}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label={`${descripcion}: ${porcentaje(fila.cumplimiento)} de lo programado`}
        >
          {/* Entra creciendo en cascada; con cada refresco el resorte va del valor anterior al nuevo, sin volver a 0. */}
          <motion.span
            className="absolute inset-y-0 left-0 rounded-full"
            style={{ backgroundColor: COLOR_TONO[tono] }}
            initial={{ width: '0%' }}
            animate={{ width: `${avance}%` }}
            transition={{ ...RESORTE_GRAFICA, delay: retraso / 1000 }}
          />
          <span className="absolute -inset-y-1 w-0.5 rounded-full bg-tinta" style={{ left: `${meta}%` }} aria-hidden="true" />
        </div>
        <p className="mt-1 text-xs text-tinta-suave">
          <span className="cifra font-bold text-tinta">{miles(fila.producidoCajas)}</span> de{' '}
          <span className="cifra">{miles(fila.programadoCajas)}</span> cajas
          {fila.programadoKg !== null && fila.programadoKg > 0 && (
            <> · {miles(fila.producidoKg ?? 0)} de {miles(fila.programadoKg)} kg</>
          )}
        </p>
      </div>

      <div className="md:text-right">
        <p className="cifra text-3xl font-black leading-none text-tinta">{porcentaje(fila.cumplimiento)}</p>
        <p className="mt-0.5 text-xs font-semibold text-tinta-suave">{textoSemaforo(fila.semaforo)}</p>
      </div>

      <div className="md:text-right">
        {faltan > 0 ? (
          <>
            <p className="cifra text-xl font-black leading-none text-tinta">{miles(faltan)}</p>
            <p className="mt-0.5 text-xs font-semibold text-tinta-suave">cajas por producir</p>
          </>
        ) : (
          <p className="text-sm font-bold text-exito">Completo</p>
        )}
      </div>
    </motion.li>
  )
}

function ListaAparte({
  titulo,
  nota,
  tono,
  items,
}: {
  titulo: string
  nota: string
  tono: TonoBadge
  items: Array<{ productoId: string; cajas: number; producto: Producto | undefined }>
}) {
  if (items.length === 0) return null
  const total = items.reduce((s, p) => s + p.cajas, 0)

  return (
    <section>
      <div className="flex items-baseline justify-between gap-3 border-b-2 pb-2" style={{ borderColor: COLOR_TONO[tono] }}>
        {/* text-[1rem] y no text-base: text-base también pinta de blanco (ver index.css). */}
        <h3 className="text-[1rem] font-black text-tinta">{titulo}</h3>
        <span className="cifra text-lg font-black text-tinta">
          {miles(total)} <span className="text-xs font-semibold text-tinta-suave">cajas</span>
        </span>
      </div>
      <p className="mt-1 text-xs text-tinta-suave">{nota}</p>
      <ul className="mt-2 divide-y divide-borde">
        {items.map((p) => (
          <li key={p.productoId} className="flex items-baseline justify-between gap-3 py-2 text-sm">
            <span className="min-w-0 truncate text-tinta">{p.producto?.descripcion ?? 'PT fuera del catálogo'}</span>
            <span className="cifra shrink-0 font-semibold text-tinta">{miles(p.cajas)}</span>
          </li>
        ))}
      </ul>
    </section>
  )
}
