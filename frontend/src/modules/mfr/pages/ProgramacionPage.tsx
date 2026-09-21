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
import { Boton } from '../../../components/Boton'
import { Campo } from '../../../components/Campo'
import { Dialogo } from '../../../components/Dialogo'
import { PantallaCargando } from '../../../components/PantallaCargando'
import { Select } from '../../../components/Select'
import { comoErrorApi } from '../../../services/http'
import type { Producto } from '../../../shared/types/catalogo'
import type { BloqueCalculado, DatosBloque, IndicadoresDia, PropuestaDpp, ResumenLinea } from '../../../shared/types/mfr'
import { useSesion } from '../../auth/useSesion'
import { useGrupos, useProductos, useTurnos } from '../../catalogo/hooks/useCatalogos'
import { PanelPersonalTurno, PersonalBadge } from '../components/PersonalTurno'
import { SelectorFecha } from '../components/SelectorFecha'
import { useFechaOperativa } from '../hooks/useFechaOperativa'
import {
  useAnalizarDpp,
  useCargarDia,
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
          <Link to={`/mfr?fecha=${fecha}`} className="text-sm text-slate-500 hover:underline">← Tablero MFR</Link>
          <h1 className="mt-1 text-2xl font-semibold text-slate-900">Programación del día (DPP)</h1>
          <p className="text-sm text-slate-600">
            Por línea y bloque horario, como el schedule de PepsiCo. Mx = cajas/h × horas; T = Mx × E.
          </p>
        </div>
        <div className="flex flex-wrap items-end gap-2">
          <SelectorFecha fecha={fecha} onCambiar={setFecha} />
          {puedeEditar && (
            <>
              <label className="cursor-pointer rounded-md bg-marca px-3 py-2 text-sm font-medium text-white hover:opacity-90">
                {analizar.isPending ? 'Leyendo PDF…' : 'Importar PDF del DPP'}
                <input type="file" accept="application/pdf" className="hidden" disabled={analizar.isPending} onChange={(e) => void subirPdf(e)} />
              </label>
              <Boton variante="secundario" cargando={copiar.isPending} onClick={() => void copiarAnterior()}>Copiar otro día</Boton>
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
            <div className="flex flex-wrap items-center gap-2 text-sm">
              <span className="text-slate-600">Turnos:</span>
              {dia.data.turnos.map((t) => (
                <span key={t.turnoId} className="inline-flex items-center gap-2 rounded-md border border-slate-200 bg-white px-2 py-1">
                  <strong>{t.codigo}</strong> {t.bloques.length} bloque(s) · T {num(t.targetCajas)} cajas
                  <PersonalBadge personal={t.personal} />
                  <button
                    className="text-marca hover:underline"
                    onClick={() => setTurnoPersonal(turnoPersonal === t.turnoId ? null : t.turnoId)}
                  >
                    {turnoPersonal === t.turnoId ? 'Ocultar personal' : 'Personal'}
                  </button>
                  {puedeConfigurarTurno && (t.cerrado ? (
                    <span className="text-slate-500">· cerrado</span>
                  ) : t.bloques.length > 0 ? (
                    <button className="text-red-600 hover:underline" onClick={() => void cerrarTurno(t.turnoId, t.codigo)}>Cerrar</button>
                  ) : null)}
                </span>
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
          onCargado={(f) => { setPropuesta(null); if (f !== fecha) setFecha(f) }}
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
      <td className="px-2 py-1 text-slate-400">auto</td>
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
      <td className="px-2 py-1 text-right text-slate-400" colSpan={3}>
        {esCorreccion && <Campo etiqueta="" placeholder="Motivo (obligatorio, mín. 5)" value={b.motivo} onChange={(e) => cambiar({ motivo: e.target.value })} />}
      </td>
    </>
  )

  return (
    <div className="rounded-lg bg-white shadow-sm">
      <div className="flex flex-wrap items-baseline justify-between gap-2 border-b border-slate-100 px-4 py-2">
        <div>
          <span className="text-lg font-semibold text-slate-900">{linea.nombre}</span>
          <span className="ml-2 text-xs uppercase text-slate-500">{linea.tipo}{linea.capacidadKgHora ? ` · ${linea.capacidadKgHora} kg/h` : ''}</span>
        </div>
        <div className="text-sm text-slate-600">
          {linea.horasProgramadas} h · Mx {num(linea.maxCajas)} · <strong>T {num(linea.targetCajas)} cajas</strong>
          {linea.targetKg > 0 && ` · ${num(linea.targetKg)} kg`}
          {linea.bloques.some((b) => b.personasAsignadas !== null) &&
            ` · ${Math.max(...linea.bloques.map((b) => b.personasAsignadas ?? 0))} pers. máx.`}
        </div>
      </div>

      {error && <div className="px-4 pt-2"><Alerta tipo="error">{comoErrorApi(error).mensaje}</Alerta></div>}

      <div className="overflow-x-auto">
        <table className="min-w-full text-sm">
          <thead className="text-left text-xs uppercase text-slate-500">
            <tr>
              <th className="px-2 py-1 w-24">Inicio</th><th className="px-2 py-1 w-24">Fin</th><th className="px-2 py-1 w-14">Turno</th>
              <th className="px-2 py-1">Producto</th><th className="px-2 py-1 w-24">Cajas/h</th><th className="px-2 py-1 w-16">E %</th>
              <th className="px-2 py-1 w-20">Loop</th><th className="px-2 py-1 w-16" title="Personas (línea ideal)">Pers.</th><th className="px-2 py-1 w-16 text-right">Mx</th><th className="px-2 py-1 w-16 text-right">T</th>
              <th className="px-2 py-1 w-20 text-right">kg T</th><th className="px-2 py-1"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {linea.bloques.map((b) => {
              const e = edicion[b.id]
              return (
                <tr key={b.id} className={b.cerrado ? 'text-slate-500' : ''}>
                  {e ? filaEditor(e, (c) => setEdicion({ ...edicion, [b.id]: { ...e, ...c } }), true) : (
                    <>
                      <td className="px-2 py-1 font-mono">{b.horaInicio}</td>
                      <td className="px-2 py-1 font-mono">{b.horaFin}</td>
                      <td className="px-2 py-1">{turno(b.turnoId)}</td>
                      <td className="px-2 py-1">
                        <span className="font-mono text-xs text-slate-500">{producto(b.productoId)?.codigo}</span>{' '}
                        {producto(b.productoId)?.descripcion ?? b.productoId}
                        {b.pesoNetoKg === null && <span className="ml-1 text-xs text-amber-700">(sin peso/caja)</span>}
                      </td>
                      <td className="px-2 py-1">{b.cajasPorHora}</td>
                      <td className="px-2 py-1">{b.eficienciaPorcentaje}</td>
                      <td className="px-2 py-1 text-xs">{b.loop ?? ''}</td>
                      <td className="px-2 py-1">{b.personasAsignadas ?? '—'}</td>
                      <td className="px-2 py-1 text-right">{num(b.maxCajas)}</td>
                      <td className="px-2 py-1 text-right font-medium">{num(b.targetCajas)}</td>
                      <td className="px-2 py-1 text-right">{num(b.targetKg)}</td>
                    </>
                  )}
                  <td className="px-2 py-1 text-right whitespace-nowrap">
                    {puedeEditar && !b.cerrado && !e && (
                      <>
                        <button className="text-marca hover:underline" onClick={() => empezarEdicion(b)}>Corregir</button>
                        <button className="ml-3 text-red-600 hover:underline" onClick={() => void quitar(b)}>Quitar</button>
                      </>
                    )}
                    {e && (
                      <>
                        <button className="text-marca hover:underline" disabled={e.motivo.trim().length < 5} onClick={() => void corregir(b)}>Guardar</button>
                        <button className="ml-3 text-slate-600 hover:underline" onClick={() => setEdicion((x) => { const { [b.id]: _q, ...r } = x; return r })}>Cancelar</button>
                      </>
                    )}
                    {b.cerrado && <span className="text-xs">cerrado</span>}
                  </td>
                </tr>
              )
            })}
            {linea.bloques.length === 0 && !nuevo && (
              <tr><td colSpan={12} className="px-4 py-3 text-center text-slate-500">Sin bloques programados.</td></tr>
            )}
            {nuevo && (
              <tr className="bg-slate-50">
                {filaEditor(nuevo, (c) => setNuevo({ ...nuevo, ...c }), false)}
                <td className="px-2 py-1 text-right whitespace-nowrap">
                  <Boton cargando={guardar.isPending} disabled={!nuevo.productoId || !nuevo.cajasPorHora} onClick={() => void agregar()}>Agregar</Boton>
                  <button className="ml-3 text-slate-600 hover:underline" onClick={() => setNuevo(null)}>Cancelar</button>
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
  const cargar = useCargarDia()
  const [fecha, setFecha] = useState(propuesta.fechaOperativa ?? fechaSeleccionada)
  const [motivo, setMotivo] = useState('')
  const listos = propuesta.bloques.filter((b) => b.lineaId && b.productoId)
  const omitidos = propuesta.bloques.length - listos.length
  const reemplaza = fecha === tablero.fechaOperativa && tablero.bloques.length > 0

  const confirmar = async () => {
    await cargar.mutateAsync({
      fechaOperativa: fecha,
      origen: 'DPP',
      reemplazar: reemplaza,
      motivo: reemplaza ? motivo : undefined,
      bloques: listos.map((b) => ({
        lineaId: b.lineaId!,
        productoId: b.productoId!,
        horaInicio: b.horaInicio,
        horaFin: b.horaFin,
        cajasPorHora: b.cajasPorHora,
        eficienciaPorcentaje: b.eficienciaPorcentaje,
        loop: b.loop,
        personasAsignadas: null,
      })),
    })
    onCargado(fecha)
  }

  return (
    <Dialogo abierto titulo={`Importar DPP — ${propuesta.archivo}`} onCerrar={onCerrar}>
      <div className="max-h-[70vh] space-y-3 overflow-y-auto text-sm">
        <div className="flex items-end gap-3">
          <div className="w-44"><Campo etiqueta="Fecha operativa" type="date" value={fecha} onChange={(e) => setFecha(e.target.value)} /></div>
          <p className="text-slate-600">
            {propuesta.bloques.length} bloques en el PDF · <strong>{listos.length} listos</strong>
            {omitidos > 0 && <span className="text-amber-700"> · {omitidos} se omiten</span>}
          </p>
        </div>

        {propuesta.advertencias.map((a) => <Alerta key={a} tipo="info">{a}</Alerta>)}

        <table className="min-w-full text-xs">
          <thead className="text-left uppercase text-slate-500">
            <tr><th className="py-1 pr-2">Línea</th><th className="py-1 pr-2">Horario</th><th className="py-1 pr-2">Producto</th><th className="py-1 pr-2 text-right">Cajas/h</th><th className="py-1 pr-2">E</th><th className="py-1 pr-2 text-right">Mx</th><th className="py-1 pr-2 text-right">T</th><th></th></tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {propuesta.bloques.map((b, i) => {
              const listo = Boolean(b.lineaId && b.productoId)
              const difiere = b.cajasPorHoraCatalogo !== null && Math.abs(b.cajasPorHoraCatalogo - b.cajasPorHora) > 0.5
              return (
                <tr key={i} className={listo ? '' : 'text-slate-400'}>
                  <td className="py-1 pr-2 font-medium">{b.linea}</td>
                  <td className="py-1 pr-2 font-mono">{b.horaInicio}–{b.horaFin}</td>
                  <td className="py-1 pr-2">
                    <span className="font-mono">{b.productoCodigo ?? `…${b.sufijoItem}`}</span> {productos.find((p) => p.id === b.productoId)?.descripcion ?? b.descripcion}
                  </td>
                  <td className="py-1 pr-2 text-right" title={b.bpm !== null ? `BPM del PDF: ${b.bpm}` : ''}>
                    {b.cajasPorHora}
                    {difiere && <span className="text-amber-700" title={`Estándar del catálogo: ${b.cajasPorHoraCatalogo} cajas/h`}> ≠ {b.cajasPorHoraCatalogo}</span>}
                  </td>
                  <td className="py-1 pr-2">{b.eficienciaPorcentaje} %</td>
                  <td className="py-1 pr-2 text-right">{b.maxCajas}</td>
                  <td className="py-1 pr-2 text-right">{b.targetCajas}</td>
                  <td className="py-1">
                    {listo ? <span className="text-green-700">✓</span> : <span title={b.advertencias.join(' ')}>omitido</span>}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
        <p className="text-xs text-slate-500">
          Las cajas/h salen del PDF (Mx ÷ horas), así el target queda exactamente el de PepsiCo. ≠ indica que el estándar del catálogo es distinto (solo informativo).
        </p>

        {reemplaza && (
          <Alerta tipo="info">
            El {fecha} ya tiene {tablero.bloques.length} bloque(s): se reemplazarán. Indique el motivo.
            <div className="mt-2"><Campo etiqueta="" placeholder="Ej.: PepsiCo reenvió el DPP" value={motivo} onChange={(e) => setMotivo(e.target.value)} /></div>
          </Alerta>
        )}
        {cargar.isError && <Alerta tipo="error">{comoErrorApi(cargar.error).mensaje}</Alerta>}

        <div className="flex justify-end gap-2">
          <Boton variante="secundario" onClick={onCerrar}>Cancelar</Boton>
          <Boton cargando={cargar.isPending} disabled={listos.length === 0 || (reemplaza && motivo.trim().length < 5)} onClick={() => void confirmar()}>
            Cargar {listos.length} bloque(s) en {fecha}
          </Boton>
        </div>
      </div>
    </Dialogo>
  )
}
