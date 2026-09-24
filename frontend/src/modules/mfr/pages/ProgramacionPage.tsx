/**
 * PROGRAMACIÓN DEL DÍA (DPP DE PEPSICO)
 * =====================================
 *
 * Una tarjeta por línea con sus bloques (inicio, fin, producto, cajas/h, E)
 * y lo que se deriva: Mx (capacidad), T (target) y kilos. Es la
 * pantalla que el coordinador edita a diario:
 *
 *   - Importar PDF: sube el DPP, revisa la propuesta y la carga.
 *   - Copiar día anterior: cuando el schedule no cambia.
 *   - Agregar / corregir / quitar bloques a mano (corregir y quitar
 *     exigen motivo).
 *   - Cerrar turno: congela sus bloques.
 *
 * El turno de cada bloque lo decide el servidor por la hora de inicio.
 */

import { useState, type ChangeEvent } from 'react'
import { Link } from 'react-router-dom'

import { Alerta } from '../../../components/Alerta'
import { Badge } from '../../../components/Badge'
import { Boton } from '../../../components/Boton'
import { Campo } from '../../../components/Campo'
import { Dialogo } from '../../../components/Dialogo'
import { PantallaCargando } from '../../../components/PantallaCargando'
import { Select } from '../../../components/Select'
import { comoErrorApi } from '../../../services/http'
import type { Producto } from '../../../shared/types/catalogo'
import type {
  BloqueCalculado,
  DatosBloque,
  IndicadoresDia,
  PropuestaDpp,
  ResultadoPeriodo,
  ResumenLinea,
} from '../../../shared/types/mfr'
import { useSesion } from '../../auth/useSesion'
import { useGrupos, useProductos, useTurnos } from '../../catalogo/hooks/useCatalogos'
import { PanelPersonalTurno, PersonalBadge } from '../components/PersonalTurno'
import { SelectorFecha } from '../components/SelectorFecha'
import { useFechaOperativa } from '../hooks/useFechaOperativa'
import {
  useAnalizarDpp,
  useCargarPeriodoPorDia,
  useCerrarTurno,
  useCopiarDia,
  useEliminarBloque,
  useEstandares,
  useGuardarBloque,
  useIndicadoresDia,
} from '../hooks/useMfr'

interface Borrador {
  productoId: string
  horaInicio: string
  horaFin: string
  cajasPorHora: string
  eficiencia: string
  loop: string
  personas: string
  motivo: string
}

const BORRADOR_VACIO: Borrador = { productoId: '', horaInicio: '06:00', horaFin: '13:30', cajasPorHora: '', eficiencia: '85', loop: '', personas: '', motivo: '' }

const num = (v: number | null | undefined, decimales = 0) => (v === null || v === undefined ? '—' : v.toLocaleString('es-CO', { maximumFractionDigits: decimales }))

function diaAnterior(fecha: string): string {
  const d = new Date(`${fecha}T00:00:00.000Z`)
  d.setUTCDate(d.getUTCDate() - 1)
  return d.toISOString().slice(0, 10)
}

export function ProgramacionPage() {
  const [fecha, setFecha] = useFechaOperativa()
  const { tienePermiso } = useSesion()
  const dia = useIndicadoresDia(fecha)
  const productos = useProductos({ soloActivos: true })
  const turnos = useTurnos()
  const grupos = useGrupos()
  const copiar = useCopiarDia()
  const cerrar = useCerrarTurno()
  const analizar = useAnalizarDpp()
  const [propuesta, setPropuesta] = useState<PropuestaDpp | null>(null)

  const puedeEditar = tienePermiso('mfr.cargar_programacion')
  const puedeConfigurarTurno = tienePermiso('mfr.configurar_turno')
  const hayBloques = (dia.data?.bloques.length ?? 0) > 0
  const [turnoPersonal, setTurnoPersonal] = useState<string | null>(null)

  const copiarAnterior = async () => {
    const desde = window.prompt('Copiar la programación de la fecha (YYYY-MM-DD):', diaAnterior(fecha))
    if (!desde) return
    let motivo: string | undefined
    if (hayBloques) {
      const m = window.prompt('Este día ya tiene bloques. Se reemplazarán. Motivo (obligatorio):')
      if (!m || m.trim().length < 5) return
      motivo = m
    }
    await copiar.mutateAsync({ desde, hacia: fecha, reemplazar: hayBloques, motivo })
  }

  const subirPdf = async (e: ChangeEvent<HTMLInputElement>) => {
    const archivo = e.target.files?.[0]
    e.target.value = ''
    if (!archivo) return
    setPropuesta(await analizar.mutateAsync(archivo))
  }

  /**
   * Cierra el turno. Si el backend responde que hay SKU por debajo del
   * target ("ni menos de lo planeado"), muestra los faltantes, pide el
   * motivo y reintenta con él.
   */
  const cerrarTurno = async (turnoId: string, codigo: string) => {
    if (!window.confirm(`Cerrar el ${codigo} congela sus bloques; no se podrán editar después. ¿Continuar?`)) return
    try {
      await cerrar.mutateAsync({ fechaOperativa: fecha, turnoId })
    } catch (e) {
      const error = comoErrorApi(e)
      if (error.codigo !== 'MFR_FALTANTE_SIN_MOTIVO') return
      const faltantes = (error.detalle?.faltantes ?? []) as Array<{ productoId: string; programadoCajas: number; producidoCajas: number; faltanteCajas: number }>
      const lista = faltantes
        .map((f) => `  • ${productos.data?.find((p) => p.id === f.productoId)?.codigo ?? f.productoId}: ${f.producidoCajas} de ${f.programadoCajas} (faltan ${f.faltanteCajas})`)
        .join('\n')
      const motivo = window.prompt(`El ${codigo} cierra por debajo de lo programado:\n${lista}\n\nMotivo del faltante (obligatorio, queda auditado):`)
      if (!motivo || motivo.trim().length < 5) return
      await cerrar.mutateAsync({ fechaOperativa: fecha, turnoId, motivoFaltante: motivo })
    }
  }

  const error = copiar.error ?? cerrar.error ?? analizar.error

  return (
    <section className="space-y-4">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <Link
            to={`/mfr?fecha=${fecha}`}
            className="text-sm font-medium text-tinta-suave transition hover:text-marca"
          >
            ← Volver al cumplimiento del día
          </Link>
          <h1 className="mt-1 text-2xl font-bold tracking-tight text-tinta">Programación del día</h1>
          <p className="mt-1 max-w-2xl text-sm text-tinta-suave">
            Qué producto corre en cada línea y en qué horas, tal como lo manda PepsiCo en el DPP.
            De cada bloque salen el <strong className="font-semibold text-tinta">máximo teórico</strong>{' '}
            (cajas por hora × horas) y la <strong className="font-semibold text-tinta">meta</strong>{' '}
            (máximo × eficiencia).
          </p>
        </div>
        <div className="flex flex-wrap items-end gap-2">
          <SelectorFecha fecha={fecha} onCambiar={setFecha} />
          {puedeEditar && (
            <>
              <label className="cursor-pointer rounded-lg bg-marca px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-marca-hover">
                {analizar.isPending ? 'Leyendo el PDF…' : 'Importar PDF del DPP'}
                <input type="file" accept="application/pdf" className="hidden" disabled={analizar.isPending} onChange={(e) => void subirPdf(e)} />
              </label>
              <Boton variante="secundario" cargando={copiar.isPending} onClick={() => void copiarAnterior()}>
                Copiar de otro día
              </Boton>
            </>
          )}
        </div>
      </header>

      {error && <Alerta tipo="error">{comoErrorApi(error).mensaje}</Alerta>}
      {dia.isLoading && <PantallaCargando />}
      {dia.isError && <Alerta tipo="error">{comoErrorApi(dia.error).mensaje}</Alerta>}

      {dia.data && (
        <>
          {dia.data.advertencias.map((a) => <Alerta key={a} tipo="info">{a}</Alerta>)}

          {hayBloques && (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {dia.data.turnos.map((t) => (
                <div key={t.turnoId} className="rounded-tarjeta border border-borde bg-base p-4 shadow-tarjeta">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="font-semibold text-tinta">{t.nombre}</p>
                      <p className="text-xs text-tinta-suave">
                        {t.bloques.length === 0
                          ? 'Sin bloques programados'
                          : `${t.bloques.length} ${t.bloques.length === 1 ? 'bloque' : 'bloques'}`}
                      </p>
                    </div>
                    {t.cerrado ? (
                      <Badge tono="neutro">Cerrado</Badge>
                    ) : (
                      <Badge tono="marca" punto>
                        Abierto
                      </Badge>
                    )}
                  </div>

                  <p className="mt-2.5 text-sm text-tinta-suave">
                    Meta del turno:{' '}
                    <span className="cifra font-bold text-tinta">{num(t.targetCajas)}</span> cajas
                  </p>

                  <div className="mt-1.5">
                    <PersonalBadge personal={t.personal} />
                  </div>

                  <div className="mt-3 flex flex-wrap gap-2 border-t border-borde pt-3">
                    <button
                      type="button"
                      className="text-sm font-semibold text-marca transition hover:underline"
                      onClick={() => setTurnoPersonal(turnoPersonal === t.turnoId ? null : t.turnoId)}
                    >
                      {turnoPersonal === t.turnoId ? 'Ocultar personal' : 'Registrar personal'}
                    </button>
                    {puedeConfigurarTurno && !t.cerrado && t.bloques.length > 0 && (
                      <button
                        type="button"
                        className="ml-auto text-sm font-semibold text-critico transition hover:underline"
                        onClick={() => void cerrarTurno(t.turnoId, t.codigo)}
                      >
                        Cerrar el turno
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}

          {turnoPersonal && dia.data.turnos.filter((t) => t.turnoId === turnoPersonal).map((t) => (
            <PanelPersonalTurno
              key={t.turnoId}
              fecha={fecha}
              turnoId={t.turnoId}
              codigoTurno={t.codigo}
              personal={t.personal}
              grupos={grupos.data ?? []}
              lineas={dia.data!.lineas}
              puedeRegistrar={puedeConfigurarTurno}
            />
          ))}

          {dia.data.lineas.map((linea) => (
            <TarjetaLinea
              key={`${linea.lineaId}-${dia.dataUpdatedAt}`}
              fecha={fecha}
              linea={linea}
              productos={productos.data ?? []}
              turnos={turnos.data ?? []}
              puedeEditar={puedeEditar}
            />
          ))}
          {dia.data.lineas.length === 0 && (
            <Alerta tipo="info">
              No hay líneas de producción activas. <Link to="/admin/lineas" className="underline">Crear líneas</Link>.
            </Alerta>
          )}
        </>
      )}

      {propuesta && dia.data && (
        <DialogoImportar
          propuesta={propuesta}
          fechaSeleccionada={fecha}
          tablero={dia.data}
          productos={productos.data ?? []}
          onCerrar={() => setPropuesta(null)}
          // No cierra el diálogo: primero se muestra qué pasó con cada día.
          onCargado={(f) => { if (f !== fecha) setFecha(f) }}
        />
      )}
    </section>
  )
}

// ------------------------------------------------------------
// Tarjeta de una línea con sus bloques
// ------------------------------------------------------------

function TarjetaLinea({
  fecha, linea, productos, turnos, puedeEditar,
}: {
  fecha: string
  linea: ResumenLinea
  productos: Producto[]
  turnos: Array<{ id: string; codigo: string }>
  puedeEditar: boolean
}) {
  const guardar = useGuardarBloque()
  const eliminar = useEliminarBloque()
  const estandares = useEstandares()
  const [nuevo, setNuevo] = useState<Borrador | null>(null)
  const [edicion, setEdicion] = useState<Record<string, Borrador>>({})

  const producto = (id: string) => productos.find((p) => p.id === id)
  const turno = (id: string) => turnos.find((t) => t.id === id)?.codigo ?? '—'

  const aDatos = (b: Borrador): DatosBloque => ({
    lineaId: linea.lineaId,
    productoId: b.productoId,
    horaInicio: b.horaInicio,
    horaFin: b.horaFin,
    cajasPorHora: Number(b.cajasPorHora),
    eficienciaPorcentaje: Number(b.eficiencia),
    loop: b.loop.trim() || null,
    // Vacío = el servidor toma la "línea ideal" del producto.
    personasAsignadas: b.personas.trim() === '' ? null : Number(b.personas),
  })

  const agregar = async () => {
    if (!nuevo) return
    await guardar.mutateAsync({ fechaOperativa: fecha, ...aDatos(nuevo) })
    setNuevo(null)
  }

  const corregir = async (b: BloqueCalculado) => {
    const borrador = edicion[b.id]
    await guardar.mutateAsync({ fechaOperativa: fecha, id: b.id, motivo: borrador.motivo, ...aDatos(borrador) })
    setEdicion((e) => { const { [b.id]: _q, ...resto } = e; return resto })
  }

  const quitar = async (b: BloqueCalculado) => {
    const motivo = window.prompt(`Motivo para quitar el bloque ${b.horaInicio}–${b.horaFin} de ${linea.codigo} (obligatorio):`)
    if (!motivo || motivo.trim().length < 5) return
    await eliminar.mutateAsync({ id: b.id, motivo })
  }

  const empezarEdicion = (b: BloqueCalculado) =>
    setEdicion({ ...edicion, [b.id]: { productoId: b.productoId, horaInicio: b.horaInicio, horaFin: b.horaFin, cajasPorHora: String(b.cajasPorHora), eficiencia: String(b.eficienciaPorcentaje), loop: b.loop ?? '', personas: b.personasAsignadas?.toString() ?? '', motivo: '' } })

  /** Al elegir producto se proponen sus cajas/h del catálogo (hoja TIEMPOS); el usuario puede cambiarlas. */
  const cajasPorHoraPorDefecto = (productoId: string): string => {
    const e = estandares.data?.find((x) => x.productoId === productoId)
    return e?.cajasPorHora ? String(e.cajasPorHora) : ''
  }

  const error = guardar.error ?? eliminar.error

  const filaEditor = (b: Borrador, cambiar: (c: Partial<Borrador>) => void, esCorreccion: boolean) => (
    <>
      <td className="px-2 py-1"><Campo etiqueta="" type="time" value={b.horaInicio} onChange={(e) => cambiar({ horaInicio: e.target.value })} /></td>
      <td className="px-2 py-1"><Campo etiqueta="" type="time" value={b.horaFin} onChange={(e) => cambiar({ horaFin: e.target.value })} /></td>
      <td className="px-2 py-1 text-tinta-suave">auto</td>
      <td className="px-2 py-1">
        <Select
          etiqueta=""
          value={b.productoId}
          onChange={(e) =>
            cambiar({
              productoId: e.target.value,
              cajasPorHora: b.cajasPorHora || cajasPorHoraPorDefecto(e.target.value),
              personas: b.personas || (productos.find((p) => p.id === e.target.value)?.personasIdeal?.toString() ?? ''),
            })
          }
        >
          <option value="">Producto…</option>
          {productos.map((p) => <option key={p.id} value={p.id}>{p.codigo} · {p.descripcion}</option>)}
        </Select>
      </td>
      <td className="px-2 py-1"><Campo etiqueta="" type="number" min={0.01} step="0.01" value={b.cajasPorHora} onChange={(e) => cambiar({ cajasPorHora: e.target.value })} /></td>
      <td className="px-2 py-1"><Campo etiqueta="" type="number" min={1} max={100} value={b.eficiencia} onChange={(e) => cambiar({ eficiencia: e.target.value })} /></td>
      <td className="px-2 py-1"><Campo etiqueta="" placeholder="LOOP1" value={b.loop} onChange={(e) => cambiar({ loop: e.target.value })} /></td>
      <td className="px-2 py-1"><Campo etiqueta="" type="number" min={0} placeholder="ideal" title="Vacío = línea ideal del producto" value={b.personas} onChange={(e) => cambiar({ personas: e.target.value })} /></td>
      <td className="px-2 py-1 text-right text-tinta-suave" colSpan={3}>
        {esCorreccion && <Campo etiqueta="" placeholder="Motivo (obligatorio, mín. 5)" value={b.motivo} onChange={(e) => cambiar({ motivo: e.target.value })} />}
      </td>
    </>
  )

  return (
    <div className="rounded-tarjeta border border-borde bg-base shadow-tarjeta">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-borde px-4 py-3">
        <div>
          <span className="text-base font-bold text-tinta">{linea.nombre}</span>
          <span className="ml-2 text-xs font-medium uppercase tracking-wide text-tinta-suave">
            {linea.tipo}
            {linea.capacidadKgHora ? ` · hasta ${linea.capacidadKgHora} kg por hora` : ''}
          </span>
        </div>
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm">
          <span className="text-tinta-suave">
            <span className="cifra font-semibold text-tinta">{linea.horasProgramadas}</span> horas
          </span>
          <span className="text-tinta-suave">
            Meta: <span className="cifra font-bold text-tinta">{num(linea.targetCajas)}</span> cajas
          </span>
          {linea.targetKg > 0 && (
            <span className="text-tinta-suave">
              <span className="cifra font-semibold text-tinta">{num(linea.targetKg)}</span> kg
            </span>
          )}
        </div>
      </div>

      {error && <div className="px-4 pt-2"><Alerta tipo="error">{comoErrorApi(error).mensaje}</Alerta></div>}

      <div className="overflow-x-auto">
        <table className="min-w-full text-sm">
          <thead className="border-b border-borde text-left text-[11px] font-semibold uppercase tracking-wide text-tinta-suave">
            <tr>
              <th className="w-24 px-2 py-2">Desde</th>
              <th className="w-24 px-2 py-2">Hasta</th>
              <th className="w-14 px-2 py-2">Turno</th>
              <th className="px-2 py-2">Producto</th>
              <th className="w-24 px-2 py-2">Cajas por hora</th>
              <th className="w-16 px-2 py-2" title="Eficiencia esperada del bloque. En el DPP aparece como «E».">
                Eficiencia
              </th>
              <th className="w-20 px-2 py-2">Loop</th>
              <th className="w-16 px-2 py-2" title="Personas que el DPP considera necesarias en la línea para ese producto (línea ideal).">
                Personas
              </th>
              <th className="w-16 px-2 py-2 text-right" title="Máximo teórico: cajas por hora × horas del bloque. En el DPP, «Mx».">
                Máximo
              </th>
              <th className="w-16 px-2 py-2 text-right" title="Meta del bloque: máximo × eficiencia. En el DPP, «T».">
                Meta
              </th>
              <th className="w-20 px-2 py-2 text-right">Kilos de meta</th>
              <th className="px-2 py-2"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-borde">
            {linea.bloques.map((b) => {
              const e = edicion[b.id]
              return (
                <tr key={b.id} className={b.cerrado ? 'text-tinta-suave' : ''}>
                  {e ? filaEditor(e, (c) => setEdicion({ ...edicion, [b.id]: { ...e, ...c } }), true) : (
                    <>
                      <td className="px-2 py-1 cifra">{b.horaInicio}</td>
                      <td className="px-2 py-1 cifra">{b.horaFin}</td>
                      <td className="px-2 py-1">{turno(b.turnoId)}</td>
                      <td className="px-2 py-1">
                        <span className="codigo text-xs text-tinta-suave">{producto(b.productoId)?.codigo}</span>{' '}
                        {producto(b.productoId)?.descripcion ?? b.productoId}
                        {b.pesoNetoKg === null && (
                          <span
                            className="ml-1.5 text-xs font-semibold text-alerta"
                            title="Sin el peso neto por caja, este bloque no suma kilos en el tablero. Se confirma en Administración → Pesos por caja."
                          >
                            falta el peso por caja
                          </span>
                        )}
                      </td>
                      <td className="cifra px-2 py-1">{b.cajasPorHora}</td>
                      <td className="cifra px-2 py-1">{b.eficienciaPorcentaje} %</td>
                      <td className="px-2 py-1 text-xs">{b.loop ?? ''}</td>
                      <td className="cifra px-2 py-1">{b.personasAsignadas ?? '—'}</td>
                      <td className="cifra px-2 py-1 text-right text-tinta-suave">{num(b.maxCajas)}</td>
                      <td className="cifra px-2 py-1 text-right font-bold text-tinta">{num(b.targetCajas)}</td>
                      <td className="cifra px-2 py-1 text-right">{num(b.targetKg)}</td>
                    </>
                  )}
                  <td className="px-2 py-1 text-right whitespace-nowrap">
                    {puedeEditar && !b.cerrado && !e && (
                      <>
                        <button className="text-marca hover:underline" onClick={() => empezarEdicion(b)}>Corregir</button>
                        <button className="ml-3 text-critico hover:underline" onClick={() => void quitar(b)}>Quitar</button>
                      </>
                    )}
                    {e && (
                      <>
                        <button className="text-marca hover:underline" disabled={e.motivo.trim().length < 5} onClick={() => void corregir(b)}>Guardar</button>
                        <button className="ml-3 text-tinta-suave hover:underline" onClick={() => setEdicion((x) => { const { [b.id]: _q, ...r } = x; return r })}>Cancelar</button>
                      </>
                    )}
                    {b.cerrado && <span className="text-xs">cerrado</span>}
                  </td>
                </tr>
              )
            })}
            {linea.bloques.length === 0 && !nuevo && (
              <tr><td colSpan={12} className="px-4 py-3 text-center text-tinta-suave">Sin bloques programados.</td></tr>
            )}
            {nuevo && (
              <tr className="bg-velo">
                {filaEditor(nuevo, (c) => setNuevo({ ...nuevo, ...c }), false)}
                <td className="px-2 py-1 text-right whitespace-nowrap">
                  <Boton cargando={guardar.isPending} disabled={!nuevo.productoId || !nuevo.cajasPorHora} onClick={() => void agregar()}>Agregar</Boton>
                  <button className="ml-3 text-tinta-suave hover:underline" onClick={() => setNuevo(null)}>Cancelar</button>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {puedeEditar && !nuevo && (
        <div className="px-4 py-2">
          <button className="text-sm text-marca hover:underline" onClick={() => setNuevo({ ...BORRADOR_VACIO })}>+ Agregar bloque</button>
        </div>
      )}
    </div>
  )
}

// ------------------------------------------------------------
// Importación del PDF: revisar la propuesta y cargarla
// ------------------------------------------------------------

function DialogoImportar({
  propuesta, fechaSeleccionada, tablero, productos, onCerrar, onCargado,
}: {
  propuesta: PropuestaDpp
  fechaSeleccionada: string
  tablero: IndicadoresDia
  productos: Producto[]
  onCerrar: () => void
  onCargado: (fecha: string) => void
}) {
  const cargar = useCargarPeriodoPorDia()
  /**
   * `dias` lo agrega el backend desde el 2026-09-22. Si la API responde sin
   * él (backend viejo todavía corriendo), la pantalla no debe romperse:
   * se comporta como antes, con un solo día y la fecha elegida a mano.
   */
  const dias = propuesta.dias ?? []
  const variosDias = dias.length > 1
  /** Solo tiene sentido redirigir el archivo a otra fecha cuando trae un único día. */
  const [fecha, setFecha] = useState(propuesta.fechaOperativa ?? fechaSeleccionada)
  const [diasElegidos, setDiasElegidos] = useState<string[]>(() => dias.map((d) => d.fechaOperativa))
  const [reemplazar, setReemplazar] = useState(false)
  const [motivo, setMotivo] = useState('')
  const [resultado, setResultado] = useState<ResultadoPeriodo | null>(null)

  const listos = propuesta.bloques.filter((b) => b.lineaId && b.productoId)
  const omitidos = propuesta.bloques.length - listos.length
  /** Con un solo día sí sabemos si pisa algo: el tablero de esa fecha está cargado. */
  const pisaElDiaVisible = !variosDias && fecha === tablero.fechaOperativa && tablero.bloques.length > 0
  const aEnviar = variosDias ? listos.filter((b) => diasElegidos.includes(b.fechaOperativa)) : listos
  const exigeMotivo = variosDias ? reemplazar : pisaElDiaVisible

  const alternarDia = (dia: string) =>
    setDiasElegidos((previos) => (previos.includes(dia) ? previos.filter((d) => d !== dia) : [...previos, dia]))

  /**
   * `mutate` en vez de `mutateAsync`: si la carga falla, el error queda en
   * `cargar.isError` y se muestra dentro del diálogo. Con `mutateAsync` sin
   * `catch`, el rechazo se escapaba como promesa no atendida y lo capturaba
   * el error boundary del router, que tumbaba la pantalla entera.
   */
  const confirmar = () => {
    cargar.mutate(
      {
        origen: 'DPP',
        reemplazar: exigeMotivo,
        motivo: exigeMotivo ? motivo : undefined,
        bloques: aEnviar.map((b) => ({
          // Con varios días manda el día del bloque; con uno solo, el que se eligió arriba.
          fechaOperativa: variosDias ? b.fechaOperativa : fecha,
          lineaId: b.lineaId!,
          productoId: b.productoId!,
          horaInicio: b.horaInicio,
          horaFin: b.horaFin,
          cajasPorHora: b.cajasPorHora,
          eficienciaPorcentaje: b.eficienciaPorcentaje,
          loop: b.loop,
          personasAsignadas: null,
        })),
      },
      {
        onSuccess: (r) => {
          setResultado(r)
          // Deja al usuario en el primer día que sí entró, para que lo vea.
          const primero = r.dias.find((d) => d.estado === 'CARGADO')
          if (primero) onCargado(primero.fechaOperativa)
        },
      },
    )
  }

  return (
    <Dialogo abierto titulo={`Importar DPP — ${propuesta.archivo}`} onCerrar={onCerrar}>
      <div className="max-h-[70vh] space-y-3 overflow-y-auto text-sm">
        <div className="flex items-end gap-3">
          {!variosDias && (
            <div className="w-44"><Campo etiqueta="Fecha operativa" type="date" value={fecha} onChange={(e) => setFecha(e.target.value)} /></div>
          )}
          <p className="text-tinta-suave">
            {propuesta.bloques.length} bloques en el PDF · <strong>{listos.length} listos</strong>
            {omitidos > 0 && <span className="text-alerta"> · {omitidos} se omiten</span>}
          </p>
        </div>

        {propuesta.advertencias.map((a) => <Alerta key={a} tipo="info">{a}</Alerta>)}

        {variosDias && (
          <fieldset className="rounded-md border border-borde p-3">
            <legend className="px-1 text-xs font-semibold uppercase text-tinta-suave">
              Días del archivo ({dias.length}) — cada uno se carga por separado
            </legend>
            <div className="grid gap-1 sm:grid-cols-2">
              {dias.map((d) => (
                <label key={d.fechaOperativa} className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={diasElegidos.includes(d.fechaOperativa)}
                    onChange={() => alternarDia(d.fechaOperativa)}
                  />
                  <span className="cifra">{d.fechaOperativa}</span>
                  <span className="text-tinta-suave">
                    {d.listos} de {d.bloques} bloque(s)
                    {d.listos < d.bloques && <span className="text-alerta"> · {d.bloques - d.listos} se omiten</span>}
                  </span>
                </label>
              ))}
            </div>
            <div className="mt-2 flex gap-3 text-xs">
              <button type="button" className="text-marca hover:underline" onClick={() => setDiasElegidos(dias.map((d) => d.fechaOperativa))}>
                Marcar todos
              </button>
              <button type="button" className="text-tinta-suave hover:underline" onClick={() => setDiasElegidos([])}>
                Desmarcar todos
              </button>
            </div>
          </fieldset>
        )}

        <table className="min-w-full text-xs">
          <thead className="text-left uppercase text-tinta-suave">
            <tr>
              {variosDias && <th className="py-1 pr-2">Día</th>}
              <th className="py-1 pr-2">Línea</th><th className="py-1 pr-2">Horario</th><th className="py-1 pr-2">Producto</th><th className="py-1 pr-2 text-right">Cajas/h</th><th className="py-1 pr-2">E</th><th className="py-1 pr-2 text-right">Mx</th><th className="py-1 pr-2 text-right">T</th><th></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-borde">
            {propuesta.bloques.map((b, i) => {
              const listo = Boolean(b.lineaId && b.productoId)
              const entra = listo && (!variosDias || diasElegidos.includes(b.fechaOperativa))
              const difiere = b.cajasPorHoraCatalogo !== null && Math.abs(b.cajasPorHoraCatalogo - b.cajasPorHora) > 0.5
              return (
                <tr key={i} className={entra ? '' : 'text-tinta-suave'}>
                  {variosDias && <td className="py-1 pr-2 cifra">{b.fechaOperativa}</td>}
                  <td className="py-1 pr-2 font-medium">{b.linea}</td>
                  <td className="py-1 pr-2 cifra">{b.horaInicio}–{b.horaFin}</td>
                  <td className="py-1 pr-2">
                    <span className="cifra">{b.productoCodigo ?? `…${b.sufijoItem}`}</span> {productos.find((p) => p.id === b.productoId)?.descripcion ?? b.descripcion}
                  </td>
                  <td className="py-1 pr-2 text-right" title={b.bpm !== null ? `BPM del PDF: ${b.bpm}` : ''}>
                    {b.cajasPorHora}
                    {difiere && <span className="text-alerta" title={`Estándar del catálogo: ${b.cajasPorHoraCatalogo} cajas/h`}> ≠ {b.cajasPorHoraCatalogo}</span>}
                  </td>
                  <td className="py-1 pr-2">{b.eficienciaPorcentaje} %</td>
                  <td className="py-1 pr-2 text-right">{b.maxCajas}</td>
                  <td className="py-1 pr-2 text-right">{b.targetCajas}</td>
                  <td className="py-1">
                    {!listo ? (
                      <span title={b.advertencias.join(' ')}>omitido</span>
                    ) : entra ? (
                      <span className="text-exito">✓</span>
                    ) : (
                      <span title="Su día está desmarcado">día sin marcar</span>
                    )}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
        <p className="text-xs text-tinta-suave">
          Las cajas/h salen del PDF (Mx ÷ horas), así el target queda exactamente el de PepsiCo. ≠ indica que el estándar del catálogo es distinto (solo informativo).
        </p>

        {variosDias && (
          <label className="flex items-center gap-2">
            <input type="checkbox" checked={reemplazar} onChange={(e) => setReemplazar(e.target.checked)} />
            Reemplazar la programación que ya tengan esos días
            <span className="text-xs text-tinta-suave">(sin marcar, los días que ya tienen bloques se omiten)</span>
          </label>
        )}

        {exigeMotivo && (
          <Alerta tipo="info">
            {variosDias
              ? 'Se reemplazará lo que ya exista en los días marcados, incluidas las correcciones hechas a mano. Indique el motivo.'
              : `El ${fecha} ya tiene ${tablero.bloques.length} bloque(s): se reemplazarán. Indique el motivo.`}
            <div className="mt-2"><Campo etiqueta="" placeholder="Ej.: PepsiCo reenvió el DPP" value={motivo} onChange={(e) => setMotivo(e.target.value)} /></div>
          </Alerta>
        )}
        {cargar.isError && <Alerta tipo="error">{comoErrorApi(cargar.error).mensaje}</Alerta>}

        {cargar.avance && (
          <div className="space-y-1">
            <p className="text-tinta">
              Cargando día {cargar.avance.hechos} de {cargar.avance.total}…
            </p>
            <div className="h-2 w-full overflow-hidden rounded bg-borde">
              <div
                className="h-full bg-marca transition-all"
                style={{ width: `${Math.round((cargar.avance.hechos / cargar.avance.total) * 100)}%` }}
              />
            </div>
            <p className="text-xs text-tinta-suave">Cada día se guarda completo por separado; no cierre esta ventana.</p>
          </div>
        )}

        {resultado && (
          <div className="space-y-2 rounded-md border border-borde p-3">
            <p className="font-medium text-tinta">
              {resultado.diasCargados} día(s) cargados · {resultado.totalBloquesCreados} bloque(s)
            </p>
            <ul className="space-y-1">
              {resultado.dias.map((d) => (
                <li key={d.fechaOperativa} className="flex items-start gap-2">
                  <span className="cifra">{d.fechaOperativa}</span>
                  {d.estado === 'CARGADO' && <span className="text-exito">✓ {d.bloquesCreados} bloque(s)</span>}
                  {d.estado === 'OMITIDO' && <span className="text-alerta">ya tenía programación: no se tocó</span>}
                  {d.estado === 'ERROR' && <span className="text-critico">{d.mensaje}</span>}
                </li>
              ))}
            </ul>
          </div>
        )}

        <div className="flex justify-end gap-2">
          <Boton variante="secundario" onClick={onCerrar}>{resultado ? 'Cerrar' : 'Cancelar'}</Boton>
          {!resultado && (
            <Boton
              cargando={cargar.isPending}
              disabled={aEnviar.length === 0 || (exigeMotivo && motivo.trim().length < 5)}
              onClick={confirmar}
            >
              Cargar {aEnviar.length} bloque(s)
              {variosDias ? ` en ${diasElegidos.length} día(s)` : ` en ${fecha}`}
            </Boton>
          )}
        </div>
      </div>
    </Dialogo>
  )
}
