/**
 * TABLERO MFR DEL DÍA
 * ===================
 *
 * Lo que un coordinador lee al empezar y al cerrar la jornada:
 *   1. MFR contra el DPP de PepsiCo: total y por SKU, con semáforo (meta 95 %).
 *   2. Turnos: cumplimiento, producción, personal y programación.
 *   3. Kilos hora por hora, con las mismas filas del DPP.
 *   4. Kilos de meta por familia de producto.
 *
 * REGLA DE VOCABULARIO (2026-09-23): el nombre va en español y la sigla
 * del DPP (T, Mx, E, "Target Kilograms"…) queda al lado, en pequeño.
 * Quien entra hoy lee la palabra; quien coteja contra el documento de
 * PepsiCo encuentra su sigla. Ninguna de las dos cosas se sacrifica.
 */

import { useState } from 'react'
import { Link } from 'react-router-dom'

import { Alerta } from '../../../components/Alerta'
import { Badge } from '../../../components/Badge'
import { BarraProgreso } from '../../../components/graficas/BarraProgreso'
import { PantallaCargando } from '../../../components/PantallaCargando'
import { comoErrorApi } from '../../../services/http'
import type { FilaHoraria } from '../../../shared/types/mfr'
import { useSesion } from '../../auth/useSesion'
import { useProductos } from '../../catalogo/hooks/useCatalogos'
import { SemaforoBadge } from '../components/SemaforoBadge'
import { SelectorFecha } from '../components/SelectorFecha'
import { TablaHoraria } from '../components/TablaHoraria'
import { TarjetaTurno } from '../components/TarjetaTurno'
import { useFechaOperativa } from '../hooks/useFechaOperativa'
import { useIndicadoresDia } from '../hooks/useMfr'

const num = (v: number | null | undefined, decimales = 0) => (v === null || v === undefined ? '—' : v.toLocaleString('es-CO', { maximumFractionDigits: decimales }))
const pct = (v: number | null) => (v === null ? '—' : `${v.toFixed(1)} %`)

/** El semáforo del dominio, traducido a los tonos del sistema de diseño. */
const TONO_SEMAFORO = { VERDE: 'exito', AMARILLO: 'alerta', ROJO: 'critico' } as const

/**
 * Las cuatro filas que el DPP de PepsiCo trae por línea y hora. El
 * nombre va en español y debajo queda el del documento original, para
 * poder cotejar sin traducir de cabeza.
 */
type Serie = keyof Pick<FilaHoraria, 'targetKg' | 'instantKg' | 'capacidadKg' | 'overpull'>
const SERIES: Array<{ clave: Serie; etiqueta: string; enElDpp: string; explicacion: string; sufijo: string }> = [
  {
    clave: 'targetKg',
    etiqueta: 'Kilos de meta',
    enElDpp: 'Target Kilograms',
    explicacion: 'Lo que PepsiCo espera que salga de cada línea en cada hora.',
    sufijo: '',
  },
  {
    clave: 'instantKg',
    etiqueta: 'Kilos producidos',
    enElDpp: 'Instant Kilograms',
    explicacion: 'Lo que realmente salió, repartido en las horas del bloque.',
    sufijo: '',
  },
  {
    clave: 'capacidadKg',
    etiqueta: 'Capacidad de la línea',
    enElDpp: 'Capacity',
    explicacion: 'El máximo que la máquina puede dar en una hora, sin importar lo programado.',
    sufijo: '',
  },
  {
    clave: 'overpull',
    etiqueta: 'Sobreproducción',
    enElDpp: 'Pct Overpull',
    explicacion: 'Cuánto se pasó (o faltó) frente a la meta de esa hora, en porcentaje.',
    sufijo: '%',
  },
]

export function TableroMfrPage() {
  const [fecha, setFecha] = useFechaOperativa()
  const { tienePermiso } = useSesion()
  const dia = useIndicadoresDia(fecha)
  const productos = useProductos()
  const [serie, setSerie] = useState<Serie>('targetKg')

  const producto = (id: string) => productos.data?.find((p) => p.id === id)
  const serieActual = SERIES.find((s) => s.clave === serie)!

  return (
    <section className="space-y-5">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-tinta">Cumplimiento del día</h1>
          <p className="mt-1 max-w-2xl text-sm text-tinta-suave">
            Cuánto se produjo frente a lo que PepsiCo programó en el DPP. Solo cuentan las
            remisiones <strong className="font-semibold text-tinta">aprobadas por el OPA</strong>;
            la meta del área es {dia.data?.meta ?? 95} %.
          </p>
        </div>
        <div className="flex flex-wrap items-end gap-2">
          <SelectorFecha fecha={fecha} onCambiar={setFecha} />
          {tienePermiso('mfr.consultar') && (
            <Link
              to={`/mfr/programacion?fecha=${fecha}`}
              className="rounded-lg border border-borde bg-base px-3 py-2 text-sm font-semibold text-tinta-suave transition hover:border-marca/40 hover:text-marca"
            >
              Ver la programación
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
            <Tarjeta titulo="Cumplimiento del día">
              <div className="flex items-baseline gap-3">
                <span className="cifra text-4xl font-bold text-tinta">{pct(dia.data.mfr.cumplimiento)}</span>
                <SemaforoBadge valor={dia.data.mfr.semaforo} porcentaje={dia.data.mfr.cumplimiento} />
              </div>
              <p className="mt-1 text-sm text-tinta-suave">
                {num(dia.data.mfr.producidoCajas)} de {num(dia.data.mfr.programadoCajas)} cajas programadas
                {dia.data.mfr.programadoKg > 0 && ` · ${num(dia.data.mfr.producidoKg)} de ${num(dia.data.mfr.programadoKg)} kg`}
              </p>
            </Tarjeta>

            <Tarjeta titulo="Lo que PepsiCo programó">
              <span className="cifra text-4xl font-bold text-tinta">{num(dia.data.mfr.programadoCajas)}</span>
              <p className="mt-1 text-sm text-tinta-suave">
                cajas en {dia.data.bloques.length} bloques y{' '}
                {dia.data.lineas.filter((l) => l.bloques.length > 0).length} líneas
                {dia.data.mfr.programadoKg > 0 && ` · ${num(dia.data.mfr.programadoKg)} kg`}
              </p>
              <p className="mt-1 text-xs text-tinta-suave">
                Es la suma de la meta (T) de todos los bloques del día.
              </p>
            </Tarjeta>

            <Tarjeta titulo="Producido sin estar programado">
              <span className="cifra text-4xl font-bold text-tinta">
                {num(dia.data.mfr.producidoSinProgramar.reduce((s, p) => s + p.cajas, 0))}
              </span>
              <p className="mt-1 text-sm text-tinta-suave">
                cajas de {dia.data.mfr.producidoSinProgramar.length} productos que no venían en el DPP
              </p>
            </Tarjeta>

            <Tarjeta titulo="Pedidos de emergencia">
              <span className="cifra text-4xl font-bold text-tinta">{num(dia.data.mfr.extraoficialesCajas)}</span>
              <p className="mt-1 text-sm text-tinta-suave">
                cajas en {dia.data.mfr.extraoficiales.length} productos
              </p>
              <p className="mt-1 text-xs text-tinta-suave">
                Remisiones extraoficiales: no cuentan para el cumplimiento.
              </p>
            </Tarjeta>
          </div>

          <div>
            <h2 className="text-lg font-semibold text-tinta">Cumplimiento por producto</h2>
            <p className="text-sm text-tinta-suave">
              Cada SKU frente a lo que el DPP programó para él en todo el día.
            </p>
          </div>
          <div className="overflow-x-auto rounded-tarjeta border border-borde bg-base shadow-tarjeta">
            <table className="min-w-full text-sm">
              <thead className="border-b border-borde text-left text-xs font-semibold uppercase tracking-wide text-tinta-suave">
                <tr>
                  <th className="px-4 py-2">Producto</th>
                  <th className="px-4 py-2 text-right">Cajas programadas</th>
                  <th className="px-4 py-2 text-right">Cajas producidas</th>
                  <th className="px-4 py-2 text-right">Faltan</th>
                  <th className="px-4 py-2 text-right">Kilos programados</th>
                  <th className="px-4 py-2 text-right">Kilos producidos</th>
                  <th className="px-4 py-2">Cumplimiento</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-borde">
                {dia.data.mfr.porProducto.map((p) => (
                  <tr key={p.productoId}>
                    <td className="px-4 py-2">
                      <div className="codigo text-xs text-tinta-suave">{producto(p.productoId)?.codigo}</div>
                      {producto(p.productoId)?.descripcion ?? p.productoId}
                    </td>
                    <td className="cifra px-4 py-2 text-right">{num(p.programadoCajas)}</td>
                    <td className="cifra px-4 py-2 text-right font-semibold text-tinta">{num(p.producidoCajas)}</td>
                    <td className="cifra px-4 py-2 text-right">{num(Math.max(0, p.programadoCajas - p.producidoCajas))}</td>
                    <td className="cifra px-4 py-2 text-right">{num(p.programadoKg)}</td>
                    <td className="cifra px-4 py-2 text-right">{num(p.producidoKg)}</td>
                    <td className="px-4 py-2">
                      {/* La barra deja comparar filas de un vistazo; el número solo
                          obliga a leerlos uno por uno. */}
                      <div className="flex min-w-[9rem] items-center gap-2">
                        <span className="flex-1">
                          <BarraProgreso
                            valor={p.cumplimiento ?? 0}
                            tono={TONO_SEMAFORO[p.semaforo ?? 'ROJO']}
                            titulo={`${producto(p.productoId)?.descripcion ?? ''}: ${pct(p.cumplimiento)}`}
                          />
                        </span>
                        <SemaforoBadge valor={p.semaforo} porcentaje={p.cumplimiento} />
                      </div>
                    </td>
                  </tr>
                ))}
                {dia.data.mfr.producidoSinProgramar.map((p) => (
                  <tr key={p.productoId}>
                    <td className="px-4 py-2">
                      <div className="codigo text-xs text-tinta-suave">{producto(p.productoId)?.codigo}</div>
                      <span className="text-tinta-suave">
                        {producto(p.productoId)?.descripcion ?? p.productoId}
                      </span>
                      <Badge tono="neutro" className="ml-2">
                        No estaba en el DPP
                      </Badge>
                    </td>
                    <td className="px-4 py-2 text-right text-tinta-suave">—</td>
                    <td className="cifra px-4 py-2 text-right font-semibold text-tinta">{num(p.cajas)}</td>
                    <td className="px-4 py-2 text-right text-tinta-suave" colSpan={4}>—</td>
                  </tr>
                ))}
                {dia.data.mfr.extraoficiales.map((p) => (
                  <tr key={`extra-${p.productoId}`}>
                    <td className="px-4 py-2">
                      <div className="codigo text-xs text-tinta-suave">{producto(p.productoId)?.codigo}</div>
                      <span className="text-tinta-suave">
                        {producto(p.productoId)?.descripcion ?? p.productoId}
                      </span>
                      <Badge tono="acento" className="ml-2">
                        Pedido de emergencia
                      </Badge>
                    </td>
                    <td className="px-4 py-2 text-right text-tinta-suave">—</td>
                    <td className="cifra px-4 py-2 text-right font-semibold text-tinta">{num(p.cajas)}</td>
                    <td className="px-4 py-2 text-right text-tinta-suave" colSpan={4}>—</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div>
            <h2 className="text-lg font-semibold text-tinta">Turnos</h2>
            <p className="text-sm text-tinta-suave">
              Cada turno frente a su meta. Abre las secciones para ver el personal y la
              programación.
            </p>
          </div>
          <div className="grid gap-4 md:grid-cols-3">
            {dia.data.turnos.map((t) => (
              <TarjetaTurno
                key={t.turnoId}
                turno={t}
                meta={dia.data!.meta}
                productos={productos.data}
                lineas={dia.data!.lineas}
              />
            ))}
          </div>

          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <h2 className="text-lg font-semibold text-tinta">Kilos hora por hora</h2>
              <p className="text-sm text-tinta-suave">{serieActual.explicacion}</p>
            </div>
            <div className="flex flex-wrap gap-1" role="group" aria-label="Qué mostrar">
              {SERIES.map((s) => (
                <button
                  key={s.clave}
                  type="button"
                  title={`${s.explicacion} En el DPP de PepsiCo: "${s.enElDpp}".`}
                  aria-pressed={serie === s.clave}
                  className={`rounded-lg border px-2.5 py-1.5 text-xs font-semibold transition ${
                    serie === s.clave
                      ? 'border-marca bg-marca text-white'
                      : 'border-borde bg-base text-tinta-suave hover:border-marca/40 hover:text-tinta'
                  }`}
                  onClick={() => setSerie(s.clave)}
                >
                  {s.etiqueta}
                </button>
              ))}
            </div>
          </div>

          <TablaHoraria
            etiquetaFila="Línea"
            horas={dia.data.horario.horas}
            unidad={serie === 'overpull' ? 'sobre la meta' : 'kilos'}
            sufijo={serieActual.sufijo}
            divergente={serie === 'overpull'}
            filas={dia.data.horario.lineas.map((fila) => ({
              id: fila.lineaId,
              nombre:
                dia.data!.lineas.find((l) => l.lineaId === fila.lineaId)?.nombre ?? fila.lineaId,
              valores: fila[serie],
            }))}
            totales={
              serie === 'targetKg'
                ? dia.data.horario.totalTargetKg
                : serie === 'instantKg'
                  ? dia.data.horario.totalInstantKg
                  : undefined
            }
          />

          {dia.data.familias.length > 0 && (
            <>
              <div>
                <h2 className="text-lg font-semibold text-tinta">Kilos de meta por familia de producto</h2>
                <p className="text-sm text-tinta-suave">
                  Agrupa los SKU por su familia (surtido, multipack, reempaque…). En el DPP de
                  PepsiCo esta tabla se llama <em>Flavor Breakdown</em>.
                </p>
              </div>
              <TablaHoraria
                etiquetaFila="Familia"
                horas={dia.data.horario.horas}
                unidad="kilos"
                filas={dia.data.familias.map((f) => ({
                  id: f.familia,
                  nombre: f.familia,
                  valores: f.targetKg,
                }))}
              />
            </>
          )}
        </>
      )}
    </section>
  )
}

function Tarjeta({ titulo, children }: { titulo: string; children: React.ReactNode }) {
  return (
    <div className="rounded-tarjeta border border-borde bg-base p-5 shadow-tarjeta">
      <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-tinta-suave">{titulo}</h3>
      {children}
    </div>
  )
}
