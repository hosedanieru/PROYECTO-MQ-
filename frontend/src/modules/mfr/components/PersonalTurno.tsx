/**
 * PERSONAL DEL TURNO — asistencia por grupo
 * =========================================
 *
 * Muestra, para un turno del día, qué grupos llegaron y con cuántas
 * personas, comparado con las que cada grupo debía enviar
 * (`Grupo.personasEsperadas`). Si algún grupo llegó por debajo, la
 * productividad del turno queda "afectada"; si todos cumplen, "a fin".
 *
 * La "línea ideal" del DPP (personas por línea) se muestra solo como
 * referencia: no decide el estado (decisión del área, 2026-09-21).
 */

import { useState, type FormEvent } from 'react'

import { Alerta } from '../../../components/Alerta'
import { Boton } from '../../../components/Boton'
import { Campo } from '../../../components/Campo'
import { Select } from '../../../components/Select'
import { comoErrorApi } from '../../../services/http'
import type { Grupo } from '../../../shared/types/catalogo'
import type { EstadoPersonal, PersonalTurno as Personal } from '../../../shared/types/mfr'
import { useRegistrarAsistencia } from '../hooks/useMfr'
import { LineasTurno } from './LineasTurno'

const ESTILO: Record<EstadoPersonal, { texto: string; clase: string }> = {
  A_FIN: { texto: 'Personal a fin', clase: 'bg-green-100 text-green-800' },
  AFECTADA: { texto: 'Productividad afectada', clase: 'bg-red-100 text-red-800' },
  SIN_DATO: { texto: 'Sin asistencia', clase: 'bg-slate-100 text-slate-500' },
}

export function PersonalBadge({ personal }: { personal: Personal }) {
  const { texto, clase } = ESTILO[personal.estado]
  const detalle = personal.estado === 'SIN_DATO' ? '' : ` · ${personal.llegaron}/${personal.esperadas}`
  return <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${clase}`}>{texto}{detalle}</span>
}

interface Props {
  fecha: string
  turnoId: string
  codigoTurno: string
  personal: Personal
  grupos: Grupo[]
  /** Líneas del día, para el selector de asignación. */
  lineas: Array<{ lineaId: string; codigo: string; nombre: string }>
  puedeRegistrar: boolean
}

export function PanelPersonalTurno({ fecha, turnoId, codigoTurno, personal, grupos, lineas, puedeRegistrar }: Props) {
  const registrar = useRegistrarAsistencia()
  const [grupoId, setGrupoId] = useState('')
  const [llegaron, setLlegaron] = useState('')
  const [observacion, setObservacion] = useState('')

  const activos = grupos.filter((g) => g.activo)
  const seleccionado = activos.find((g) => g.id === grupoId)

  /** Al escoger un grupo ya registrado se precarga su valor para corregirlo. */
  const escogerGrupo = (id: string) => {
    setGrupoId(id)
    const ya = personal.grupos.find((g) => g.grupoId === id)
    setLlegaron(ya ? String(ya.llegaron) : '')
    setObservacion(ya?.observacion ?? '')
  }

  const enviar = async (e: FormEvent) => {
    e.preventDefault()
    if (!grupoId || llegaron === '') return
    await registrar.mutateAsync({
      fechaOperativa: fecha,
      turnoId,
      grupoId,
      personasLlegaron: Number(llegaron),
      observacion: observacion.trim() || undefined,
    })
    setGrupoId('')
    setLlegaron('')
    setObservacion('')
  }

  return (
    <div className="rounded-lg border border-slate-200 bg-white p-3 text-sm">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="font-semibold text-slate-800">
          Personal {codigoTurno} <PersonalBadge personal={personal} />
        </h3>
        <span className="text-xs text-slate-500">
          Referencia DPP (línea ideal): {personal.requeridasDpp} persona(s)
        </span>
      </div>

      {personal.grupos.length > 0 ? (
        <table className="mt-2 w-full text-left">
          <thead className="text-xs uppercase text-slate-500">
            <tr>
              <th className="py-1">Grupo</th>
              <th className="py-1 text-right">Esperadas</th>
              <th className="py-1 text-right">Llegaron</th>
              <th className="py-1 text-right">Faltan</th>
              <th className="py-1 text-right">En líneas</th>
              <th className="py-1">Estado</th>
              <th className="py-1">Observación</th>
            </tr>
          </thead>
          <tbody>
            {personal.grupos.map((g) => (
              <tr key={g.grupoId} className="border-t border-slate-100">
                <td className="py-1">{g.nombre}</td>
                <td className="py-1 text-right">{g.esperadas ?? '—'}</td>
                <td className="py-1 text-right">{g.llegaron}</td>
                <td className={`py-1 text-right ${g.faltante > 0 ? 'font-semibold text-red-700' : ''}`}>{g.faltante}</td>
                <td
                  className={`py-1 text-right ${g.asignadas !== null && g.asignadas > g.llegaron ? 'font-semibold text-amber-700' : ''}`}
                  title={g.asignadas !== null && g.asignadas > g.llegaron ? 'Hay más personas asignadas a líneas que las que llegaron' : undefined}
                >
                  {g.asignadas ?? '—'}
                </td>
                <td className="py-1"><span className={`rounded-full px-2 py-0.5 text-xs ${ESTILO[g.estado].clase}`}>{ESTILO[g.estado].texto}</span></td>
                <td className="py-1 text-slate-600">{g.observacion ?? ''}</td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : (
        <p className="mt-2 text-slate-500">Ningún grupo registrado en este turno.</p>
      )}

      {puedeRegistrar && (
        <form onSubmit={(e) => void enviar(e)} className="mt-3 grid gap-2 border-t border-slate-100 pt-3 md:grid-cols-[1fr_8rem_1fr_auto] md:items-end">
          <Select etiqueta="Grupo" value={grupoId} onChange={(e) => escogerGrupo(e.target.value)} required>
            <option value="">Seleccione…</option>
            {activos.map((g) => (
              <option key={g.id} value={g.id}>
                {g.nombre}{g.personasEsperadas !== null ? ` (espera ${g.personasEsperadas})` : ''}
              </option>
            ))}
          </Select>
          <Campo
            etiqueta="Llegaron"
            type="number"
            min={0}
            step={1}
            value={llegaron}
            onChange={(e) => setLlegaron(e.target.value)}
            placeholder={seleccionado?.personasEsperadas !== null && seleccionado ? String(seleccionado.personasEsperadas) : '0'}
            required
          />
          <Campo etiqueta="Observación (opcional)" maxLength={300} value={observacion} onChange={(e) => setObservacion(e.target.value)} />
          <Boton type="submit" cargando={registrar.isPending} disabled={!grupoId || llegaron === ''}>
            {personal.grupos.some((g) => g.grupoId === grupoId) ? 'Corregir' : 'Registrar'}
          </Boton>
        </form>
      )}
      {seleccionado && seleccionado.personasEsperadas === null && (
        <p className="mt-1 text-xs text-amber-700">
          Este grupo no tiene personas esperadas definidas; se registra pero no se puede comparar.
        </p>
      )}
      {registrar.error && <Alerta tipo="error">{comoErrorApi(registrar.error).mensaje}</Alerta>}

      <LineasTurno
        fecha={fecha}
        turnoId={turnoId}
        lineas={personal.lineas}
        catalogoLineas={lineas}
        grupos={grupos}
        puedeRegistrar={puedeRegistrar}
      />
    </div>
  )
}
