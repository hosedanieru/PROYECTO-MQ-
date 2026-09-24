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

/**
 * "Productividad afectada" no decía por qué ni cuánto. Ahora el texto
 * cuenta el hecho ("faltaron 8 personas") y el estado va en el color y
 * en el punto, no solo en una etiqueta que hay que interpretar.
 */
const ESTILO: Record<EstadoPersonal, { clase: string; punto: string }> = {
  A_FIN: { clase: 'bg-exito-claro text-exito', punto: 'bg-exito' },
  AFECTADA: { clase: 'bg-critico-claro text-critico', punto: 'bg-critico' },
  SIN_DATO: { clase: 'bg-velo text-tinta-suave', punto: 'bg-neutro' },
}

/** Estado de un grupo suelto: cabe en una celda, así que va corto. */
const ETIQUETA_ESTADO_GRUPO: Record<EstadoPersonal, string> = {
  A_FIN: 'Completo',
  AFECTADA: 'Incompleto',
  SIN_DATO: 'Sin registrar',
}

function textoPersonal(personal: Personal): string {
  if (personal.estado === 'SIN_DATO') return 'Falta registrar la asistencia'
  if (personal.faltante > 0) {
    return `Faltaron ${personal.faltante} de ${personal.esperadas} personas`
  }
  return `Llegaron las ${personal.esperadas} personas esperadas`
}

export function PersonalBadge({ personal }: { personal: Personal }) {
  const { clase, punto } = ESTILO[personal.estado]
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold ${clase}`}
      title="Se compara contra las personas que cada grupo debe enviar por turno, no contra la línea ideal del DPP."
    >
      <span className={`h-1.5 w-1.5 rounded-full ${punto}`} aria-hidden="true" />
      {textoPersonal(personal)}
    </span>
  )
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
    <div className="rounded-lg border border-borde bg-base p-3 text-sm">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="font-semibold text-tinta">
          Personal {codigoTurno} <PersonalBadge personal={personal} />
        </h3>
        <span className="text-xs text-tinta-suave">
          Referencia DPP (línea ideal): {personal.requeridasDpp} persona(s)
        </span>
      </div>

      {personal.grupos.length > 0 ? (
        <table className="mt-2 w-full text-left">
          <thead className="text-xs uppercase text-tinta-suave">
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
              <tr key={g.grupoId} className="border-t border-borde">
                <td className="py-1">{g.nombre}</td>
                <td className="py-1 text-right">{g.esperadas ?? '—'}</td>
                <td className="py-1 text-right">{g.llegaron}</td>
                <td className={`py-1 text-right ${g.faltante > 0 ? 'font-semibold text-critico' : ''}`}>{g.faltante}</td>
                <td className="py-1 text-right" title="Personas del grupo repartidas en líneas / las que llegaron">
                  {g.asignadas ?? 0}/{g.llegaron}
                </td>
                <td className="py-1">
                  <span className={`inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-xs font-semibold ${ESTILO[g.estado].clase}`}>
                    <span className={`h-1.5 w-1.5 rounded-full ${ESTILO[g.estado].punto}`} aria-hidden="true" />
                    {ETIQUETA_ESTADO_GRUPO[g.estado]}
                  </span>
                </td>
                <td className="py-1 text-tinta-suave">{g.observacion ?? ''}</td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : (
        <p className="mt-2 text-tinta-suave">Ningún grupo registrado en este turno.</p>
      )}

      {puedeRegistrar && (
        <form onSubmit={(e) => void enviar(e)} className="mt-3 grid gap-2 border-t border-borde pt-3 md:grid-cols-[1fr_8rem_1fr_auto] md:items-end">
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
        <p className="mt-1 text-xs text-alerta">
          Este grupo no tiene personas esperadas definidas; se registra pero no se puede comparar.
        </p>
      )}
      {registrar.error && <Alerta tipo="error">{comoErrorApi(registrar.error).mensaje}</Alerta>}

      <LineasTurno
        fecha={fecha}
        turnoId={turnoId}
        lineas={personal.lineas}
        catalogoLineas={lineas}
        gruposConAsistencia={personal.grupos}
        puedeRegistrar={puedeRegistrar}
      />
    </div>
  )
}
