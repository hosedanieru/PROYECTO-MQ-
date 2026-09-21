/**
 * TABLERO MFR DEL DÍA
 * ===================
 *
 * Lo que un coordinador lee al empezar y al cerrar la jornada:
 *   1. MFR contra el DPP de PepsiCo: total y por SKU, con semáforo (meta 95 %).
 *   2. Turnos: Mx, T, producido, eficiencia planeada vs real y cumplimiento.
 *   3. Vista horaria en kilogramos, como las filas del DPP
 *      (Target / Instant / Capacity / Pct Overpull por línea y hora).
 */

import { useState } from 'react'
import { Link } from 'react-router-dom'

import { Alerta } from '../../../components/Alerta'
import { PantallaCargando } from '../../../components/PantallaCargando'
import { comoErrorApi } from '../../../services/http'
import type { FilaHoraria } from '../../../shared/types/mfr'
import { useSesion } from '../../auth/useSesion'
import { useProductos } from '../../catalogo/hooks/useCatalogos'
import { PersonalBadge } from '../components/PersonalTurno'
import { SemaforoBadge } from '../components/SemaforoBadge'
import { SelectorFecha } from '../components/SelectorFecha'
import { useFechaOperativa } from '../hooks/useFechaOperativa'
import { useIndicadoresDia } from '../hooks/useMfr'

const num = (v: number | null | undefined, decimales = 0) => (v === null || v === undefined ? '—' : v.toLocaleString('es-CO', { maximumFractionDigits: decimales }))
const pct = (v: number | null) => (v === null ? '—' : `${v.toFixed(1)} %`)

type Serie = keyof Pick<FilaHoraria, 'targetKg' | 'instantKg' | 'capacidadKg' | 'overpull'>
const SERIES: Array<{ clave: Serie; etiqueta: string; sufijo: string }> = [
  { clave: 'targetKg', etiqueta: 'Target Kilograms', sufijo: '' },
  { clave: 'instantKg', etiqueta: 'Instant Kilograms', sufijo: '' },
  { clave: 'capacidadKg', etiqueta: 'Capacity', sufijo: '' },
  { clave: 'overpull', etiqueta: 'Pct Overpull', sufijo: '%' },
]

export function TableroMfrPage() {
  const [fecha, setFecha] = useFechaOperativa()
  const { tienePermiso } = useSesion()
  const dia = useIndicadoresDia(fecha)
  const productos = useProductos()
  const [serie, setSerie] = useState<Serie>('targetKg')

  const producto = (id: string) => productos.data?.find((p) => p.id === id)

  return (
    <section className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">MFR — Cumplimiento del día</h1>
          <p className="text-sm text-slate-600">
            Contra el DPP de PepsiCo. Cuentan las remisiones <strong>aprobadas por el OPA</strong>. Meta: {dia.data?.meta ?? 95} %.
          </p>
        </div>
        <div className="flex flex-wrap items-end gap-3">
          <SelectorFecha fecha={fecha} onCambiar={setFecha} />
          {tienePermiso('mfr.consultar') && (
            <Link to={`/mfr/programacion?fecha=${fecha}`} className="rounded-md border border-slate-300 bg-white px-3 py-2 text-sm hover:bg-slate-50">
              Programación del día (DPP)
            </Link>
          )}
        </div>
      </header>

      {dia.isLoading && <PantallaCargando />}
      {dia.isError && <Alerta tipo="error">{comoErrorApi(dia.error).mensaje}</Alerta>}

      {dia.data && (
        <>
          {dia.data.bloques.length === 0 && (
            <Alerta tipo="info">No hay programación (DPP) cargada para este día.</Alerta>
          )}
          {dia.data.advertencias.map((a) => <Alerta key={a} tipo="info">{a}</Alerta>)}

          <div className="grid gap-4 md:grid-cols-4">
            <Tarjeta titulo="MFR del día">
              <div className="flex items-baseline gap-3">
                <span className="text-4xl font-semibold text-slate-900">{pct(dia.data.mfr.cumplimiento)}</span>
                <SemaforoBadge valor={dia.data.mfr.semaforo} porcentaje={dia.data.mfr.cumplimiento} />
              </div>
              <p className="mt-1 text-sm text-slate-600">
                {num(dia.data.mfr.producidoCajas)} de {num(dia.data.mfr.programadoCajas)} cajas programadas
                {dia.data.mfr.programadoKg > 0 && ` · ${num(dia.data.mfr.producidoKg)} de ${num(dia.data.mfr.programadoKg)} kg`}
              </p>
            </Tarjeta>
            <Tarjeta titulo="Programado (Σ T del DPP)">
              <span className="text-4xl font-semibold text-slate-900">{num(dia.data.mfr.programadoCajas)}</span>
              <p className="mt-1 text-sm text-slate-600">
                cajas · {dia.data.bloques.length} bloques en {dia.data.lineas.filter((l) => l.bloques.length > 0).length} líneas
                {dia.data.mfr.programadoKg > 0 && ` · ${num(dia.data.mfr.programadoKg)} kg`}
              </p>
            </Tarjeta>
            <Tarjeta titulo="Producido sin programar">
              <span className="text-4xl font-semibold text-slate-900">
                {num(dia.data.mfr.producidoSinProgramar.reduce((s, p) => s + p.cajas, 0))}
              </span>
              <p className="mt-1 text-sm text-slate-600">
                cajas de {dia.data.mfr.producidoSinProgramar.length} SKU que PepsiCo no programó
              </p>
            </Tarjeta>
            <Tarjeta titulo="Pedidos de emergencia">
              <span className="text-4xl font-semibold text-slate-900">{num(dia.data.mfr.extraoficialesCajas)}</span>
              <p className="mt-1 text-sm text-slate-600">
                cajas extraoficiales en {dia.data.mfr.extraoficiales.length} SKU · fuera del MFR
              </p>
            </Tarjeta>
          </div>

          <div className="overflow-x-auto rounded-lg bg-white shadow-sm">
            <table className="min-w-full text-sm">
              <thead className="bg-slate-50 text-left text-xs uppercase text-slate-500">
                <tr>
                  <th className="px-4 py-2">Producto</th>
                  <th className="px-4 py-2 text-right">Programado</th>
                  <th className="px-4 py-2 text-right">Producido</th>
                  <th className="px-4 py-2 text-right">Faltante</th>
                  <th className="px-4 py-2 text-right">kg prog.</th>
                  <th className="px-4 py-2 text-right">kg prod.</th>
                  <th className="px-4 py-2">Cumplimiento</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {dia.data.mfr.porProducto.map((p) => (
                  <tr key={p.productoId}>
                    <td className="px-4 py-2">
                      <div className="font-mono text-xs text-slate-500">{producto(p.productoId)?.codigo}</div>
                      {producto(p.productoId)?.descripcion ?? p.productoId}
                    </td>
                    <td className="px-4 py-2 text-right">{num(p.programadoCajas)}</td>
                    <td className="px-4 py-2 text-right">{num(p.producidoCajas)}</td>
                    <td className="px-4 py-2 text-right">{num(Math.max(0, p.programadoCajas - p.producidoCajas))}</td>
                    <td className="px-4 py-2 text-right">{num(p.programadoKg)}</td>
                    <td className="px-4 py-2 text-right">{num(p.producidoKg)}</td>
                    <td className="px-4 py-2"><SemaforoBadge valor={p.semaforo} porcentaje={p.cumplimiento} /></td>
                  </tr>
                ))}
                {dia.data.mfr.producidoSinProgramar.map((p) => (
                  <tr key={p.productoId} className="text-slate-500">
                    <td className="px-4 py-2">
                      <div className="font-mono text-xs">{producto(p.productoId)?.codigo}</div>
                      {producto(p.productoId)?.descripcion ?? p.productoId} <em>(sin programar)</em>
                    </td>
                    <td className="px-4 py-2 text-right">—</td>
                    <td className="px-4 py-2 text-right">{num(p.cajas)}</td>
                    <td className="px-4 py-2 text-right" colSpan={4}>—</td>
                  </tr>
                ))}
                {dia.data.mfr.extraoficiales.map((p) => (
                  <tr key={`extra-${p.productoId}`} className="bg-amber-50 text-amber-900">
                    <td className="px-4 py-2">
                      <div className="font-mono text-xs">{producto(p.productoId)?.codigo}</div>
                      {producto(p.productoId)?.descripcion ?? p.productoId} <em>(pedido de emergencia, fuera del MFR)</em>
                    </td>
                    <td className="px-4 py-2 text-right">—</td>
                    <td className="px-4 py-2 text-right">{num(p.cajas)}</td>
                    <td className="px-4 py-2 text-right" colSpan={4}>—</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <h2 className="text-lg font-semibold text-slate-900">Turnos</h2>
          <div className="grid gap-4 md:grid-cols-3">
            {dia.data.turnos.map((t) => (
              <Tarjeta key={t.turnoId} titulo={`${t.codigo} · ${t.nombre}${t.horasTurno === null ? ' · no opera' : ` · ${t.horasTurno} h`}${t.cerrado ? ' · cerrado' : ''}`}>
                <div className="flex items-baseline justify-between">
                  <span className="text-3xl font-semibold text-slate-900">{pct(t.cumplimiento)}</span>
                  <SemaforoBadge valor={t.semaforo} porcentaje={t.cumplimiento} />
                </div>
                <p className="mt-1 text-sm text-slate-600">
                  {num(t.producidoCajas)} de <strong>T {num(t.targetCajas)}</strong> cajas (Mx {num(t.maxCajas)})
                  {t.targetKg > 0 && ` · ${num(t.producidoKg)} / ${num(t.targetKg)} kg`}
                </p>
                <p className="mt-1 text-xs text-slate-600">
                  Eficiencia planeada {pct(t.eficienciaPlaneada)} · real {pct(t.eficienciaReal)}
                  {t.personasAsignadas > 0 && ` · ${t.personasAsignadas} personas (línea ideal)`}
                </p>
                <p className="mt-1 flex flex-wrap items-center gap-1 text-xs text-slate-600">
                  <PersonalBadge personal={t.personal} />
                  {t.personal.grupos.map((g) => (
                    <span key={g.grupoId}>{g.nombre} {g.llegaron}{g.esperadas !== null ? `/${g.esperadas}` : ''}</span>
                  ))}
                </p>
                {t.personal.lineas.some((l) => l.grupos.length > 0) && (
                  <p className="mt-1 text-xs text-slate-600">
                    {t.personal.lineas
                      .filter((l) => l.grupos.length > 0)
                      .map((l) => `${l.codigo}: ${l.grupos.map((g) => `${g.nombre} ${g.personas}`).join(' + ')}${l.estado === 'INCOMPLETA' ? ` (faltan ${l.faltante})` : ''}`)
                      .join(' · ')}
                  </p>
                )}
                <ul className="mt-2 space-y-0.5 text-xs text-slate-600">
                  {t.bloques.map((b) => (
                    <li key={b.id}>
                      <span className="font-medium">{dia.data!.lineas.find((l) => l.lineaId === b.lineaId)?.nombre ?? b.lineaId}</span>{' '}
                      {b.horaInicio}–{b.horaFin} · {producto(b.productoId)?.codigo} · {b.cajasPorHora} cajas/h · E {b.eficienciaPorcentaje} % → T {num(b.targetCajas)}
                    </li>
                  ))}
                  {t.bloques.length === 0 && <li>Sin bloques.</li>}
                </ul>
              </Tarjeta>
            ))}
          </div>

          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-lg font-semibold text-slate-900">Vista horaria (kg) — como el DPP</h2>
            <div className="flex gap-1 text-xs">
              {SERIES.map((s) => (
                <button
                  key={s.clave}
                  className={`rounded-md border px-2 py-1 ${serie === s.clave ? 'border-marca bg-marca text-white' : 'border-slate-300 bg-white hover:bg-slate-50'}`}
                  onClick={() => setSerie(s.clave)}
                >
                  {s.etiqueta}
                </button>
              ))}
            </div>
          </div>
          <div className="overflow-x-auto rounded-lg bg-white shadow-sm">
            <table className="min-w-full text-xs">
              <thead className="bg-slate-50 text-slate-500">
                <tr>
                  <th className="sticky left-0 bg-slate-50 px-2 py-1 text-left">Línea</th>
                  {dia.data.horario.horas.map((h) => <th key={h} className="px-1 py-1 text-right font-mono">{h}</th>)}
                  <th className="px-2 py-1 text-right">Total</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {dia.data.horario.lineas.map((fila) => {
                  const valores = fila[serie]
                  const total = serie === 'overpull' ? null : (valores as number[]).reduce((s, v) => s + v, 0)
                  return (
                    <tr key={fila.lineaId}>
                      <td className="sticky left-0 bg-white px-2 py-1 font-medium">{dia.data!.lineas.find((l) => l.lineaId === fila.lineaId)?.nombre ?? fila.lineaId}</td>
                      {valores.map((v, i) => (
                        <td key={i} className={`px-1 py-1 text-right font-mono ${v === 0 || v === null ? 'text-slate-300' : ''}`}>
                          {v === null ? '' : `${v}${serie === 'overpull' ? '%' : ''}`}
                        </td>
                      ))}
                      <td className="px-2 py-1 text-right font-mono font-medium">{total === null ? '' : num(total)}</td>
                    </tr>
                  )
                })}
                {serie !== 'overpull' && serie !== 'capacidadKg' && (
                  <tr className="bg-slate-50 font-medium">
                    <td className="sticky left-0 bg-slate-50 px-2 py-1">Total</td>
                    {(serie === 'targetKg' ? dia.data.horario.totalTargetKg : dia.data.horario.totalInstantKg).map((v, i) => (
                      <td key={i} className="px-1 py-1 text-right font-mono">{v}</td>
                    ))}
                    <td className="px-2 py-1 text-right font-mono">
                      {num((serie === 'targetKg' ? dia.data.horario.totalTargetKg : dia.data.horario.totalInstantKg).reduce((s, v) => s + v, 0))}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {dia.data.familias.length > 0 && (
            <>
              <h2 className="text-lg font-semibold text-slate-900">Flavor Breakdown — kg target por familia</h2>
              <div className="overflow-x-auto rounded-lg bg-white shadow-sm">
                <table className="min-w-full text-xs">
                  <thead className="bg-slate-50 text-slate-500">
                    <tr>
                      <th className="sticky left-0 bg-slate-50 px-2 py-1 text-left">Familia</th>
                      {dia.data.horario.horas.map((h) => <th key={h} className="px-1 py-1 text-right font-mono">{h}</th>)}
                      <th className="px-2 py-1 text-right">Total</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {dia.data.familias.map((f) => (
                      <tr key={f.familia}>
                        <td className="sticky left-0 bg-white px-2 py-1 font-medium">{f.familia}</td>
                        {f.targetKg.map((v, i) => (
                          <td key={i} className={`px-1 py-1 text-right font-mono ${v === 0 ? 'text-slate-300' : ''}`}>{v}</td>
                        ))}
                        <td className="px-2 py-1 text-right font-mono font-medium">{num(f.totalKg)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </>
      )}
    </section>
  )
}

function Tarjeta({ titulo, children }: { titulo: string; children: React.ReactNode }) {
  return (
    <div className="rounded-lg bg-white p-5 shadow-sm">
      <h3 className="mb-2 text-xs font-semibold uppercase text-slate-500">{titulo}</h3>
      {children}
    </div>
  )
}
