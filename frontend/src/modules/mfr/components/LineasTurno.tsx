/**
 * LÍNEAS DEL TURNO — qué grupo trabaja en qué línea
 * =================================================
 *
 * Por línea: grupos asignados con sus personas, la suma, y la "línea
 * ideal" del DPP (personas que el SKU programado necesita). Si la suma
 * no alcanza, la línea queda INCOMPLETA. Un grupo puede repartirse
 * entre líneas (decisión del área, 2026-09-21).
 */

import { useState, type FormEvent } from 'react'

import { Alerta } from '../../../components/Alerta'
import { Boton } from '../../../components/Boton'
import { Campo } from '../../../components/Campo'
import { Select } from '../../../components/Select'
import { comoErrorApi } from '../../../services/http'
import type { Grupo } from '../../../shared/types/catalogo'
import type { EstadoLinea, PersonalLinea } from '../../../shared/types/mfr'
import { useAsignarGrupoLinea, useQuitarAsignacion } from '../hooks/useMfr'

const ESTILO: Record<EstadoLinea, { texto: string; clase: string }> = {
  CUBIERTA: { texto: 'Cubierta', clase: 'bg-green-100 text-green-800' },
  INCOMPLETA: { texto: 'Incompleta', clase: 'bg-red-100 text-red-800' },
  SIN_DATO: { texto: 'Sin dato', clase: 'bg-slate-100 text-slate-500' },
}

interface Props {
  fecha: string
  turnoId: string
  lineas: PersonalLinea[]
  /** Catálogo de líneas para el selector (id, código, nombre). */
  catalogoLineas: Array<{ lineaId: string; codigo: string; nombre: string }>
  grupos: Grupo[]
  puedeRegistrar: boolean
}

export function LineasTurno({ fecha, turnoId, lineas, catalogoLineas, grupos, puedeRegistrar }: Props) {
  const asignar = useAsignarGrupoLinea()
  const quitar = useQuitarAsignacion()
  const [lineaId, setLineaId] = useState('')
  const [grupoId, setGrupoId] = useState('')
  const [personas, setPersonas] = useState('')

  const yaAsignada = lineas.find((l) => l.lineaId === lineaId)?.grupos.find((g) => g.grupoId === grupoId)

  /** Al escoger una pareja línea+grupo ya asignada se precarga su valor para corregirlo. */
  const escoger = (nuevaLinea: string, nuevoGrupo: string) => {
    setLineaId(nuevaLinea)
    setGrupoId(nuevoGrupo)
    const actual = lineas.find((l) => l.lineaId === nuevaLinea)?.grupos.find((g) => g.grupoId === nuevoGrupo)
    setPersonas(actual ? String(actual.personas) : '')
  }

  const enviar = async (e: FormEvent) => {
    e.preventDefault()
    if (!lineaId || !grupoId || personas === '') return
    await asignar.mutateAsync({ fechaOperativa: fecha, turnoId, lineaId, grupoId, personas: Number(personas) })
    setLineaId('')
    setGrupoId('')
    setPersonas('')
  }

  const quitarAsignacion = async (id: string, texto: string) => {
    if (!window.confirm(`¿Quitar a ${texto} de la línea?`)) return
    await quitar.mutateAsync(id)
  }

  const error = asignar.error ?? quitar.error

  return (
    <div className="mt-3 border-t border-slate-100 pt-3">
      <h4 className="text-xs font-semibold uppercase text-slate-500">Líneas del turno</h4>

      {lineas.length > 0 ? (
        <table className="mt-1 w-full text-left">
          <thead className="text-xs uppercase text-slate-500">
            <tr>
              <th className="py-1">Línea</th>
              <th className="py-1">Grupos asignados</th>
              <th className="py-1 text-right">Personas</th>
              <th className="py-1 text-right">Línea ideal (DPP)</th>
              <th className="py-1">Estado</th>
            </tr>
          </thead>
          <tbody>
            {lineas.map((l) => (
              <tr key={l.lineaId} className="border-t border-slate-100 align-top">
                <td className="py-1 font-medium">{l.nombre}</td>
                <td className="py-1">
                  {l.grupos.length === 0 && <span className="text-slate-400">—</span>}
                  {l.grupos.map((g) => (
                    <span key={g.asignacionId} className="mr-2 inline-flex items-center gap-1 rounded bg-slate-100 px-1.5 py-0.5 text-xs">
                      <button type="button" className="hover:underline" onClick={() => escoger(l.lineaId, g.grupoId)} title="Corregir">
                        {g.nombre} · {g.personas}
                      </button>
                      {puedeRegistrar && (
                        <button
                          type="button"
                          className="text-red-600 hover:text-red-800"
                          title="Quitar"
                          disabled={quitar.isPending}
                          onClick={() => void quitarAsignacion(g.asignacionId, `${g.nombre} (${g.personas})`)}
                        >
                          ×
                        </button>
                      )}
                    </span>
                  ))}
                </td>
                <td className="py-1 text-right">{l.personas}</td>
                <td className="py-1 text-right">{l.requeridasDpp > 0 ? l.requeridasDpp : '—'}</td>
                <td className="py-1">
                  <span className={`rounded-full px-2 py-0.5 text-xs ${ESTILO[l.estado].clase}`}>
                    {ESTILO[l.estado].texto}{l.faltante > 0 && l.estado === 'INCOMPLETA' ? ` · faltan ${l.faltante}` : ''}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : (
        <p className="mt-1 text-slate-500">Este turno no tiene bloques ni grupos asignados a líneas.</p>
      )}

      {puedeRegistrar && (
        <form onSubmit={(e) => void enviar(e)} className="mt-2 grid gap-2 md:grid-cols-[1fr_1fr_7rem_auto] md:items-end">
          <Select etiqueta="Línea" value={lineaId} onChange={(e) => escoger(e.target.value, grupoId)} required>
            <option value="">Seleccione…</option>
            {catalogoLineas.map((l) => (
              <option key={l.lineaId} value={l.lineaId}>{l.nombre}</option>
            ))}
          </Select>
          <Select etiqueta="Grupo" value={grupoId} onChange={(e) => escoger(lineaId, e.target.value)} required>
            <option value="">Seleccione…</option>
            {grupos.filter((g) => g.activo).map((g) => (
              <option key={g.id} value={g.id}>{g.nombre}</option>
            ))}
          </Select>
          <Campo etiqueta="Personas" type="number" min={1} step={1} value={personas} onChange={(e) => setPersonas(e.target.value)} required />
          <Boton type="submit" variante="secundario" cargando={asignar.isPending} disabled={!lineaId || !grupoId || personas === ''}>
            {yaAsignada ? 'Corregir' : 'Asignar'}
          </Boton>
        </form>
      )}
      {error && <Alerta tipo="error">{comoErrorApi(error).mensaje}</Alerta>}
    </div>
  )
}
