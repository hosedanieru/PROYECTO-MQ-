/**
 * PERSONAL DEL TURNO — asistencia por grupo
 * =========================================
 *
 * Muestra, para un turno del día, qué grupos se esperan, cuántas personas
 * llegaron y cuántas están en líneas. Desde el 2026-09-30 (usuario) el
 * turno se compara dos veces y queda AFECTADO si falla cualquiera:
 *   - contra lo que pide el DPP: Σ por línea del máximo de personas de
 *     sus bloques en el turno, con la cobertura %;
 *   - contra lo que cada grupo debía enviar a ESTE turno (fijo por grupo y
 *     turno, o el ajuste del día con motivo; usuario, 2026-10-03).
 * Llegar de más se registra solo con observación. El cálculo lo hace el
 * backend; aquí solo se explica.
 */

import { useState, type FormEvent } from 'react'

import { Alerta } from '../../../components/Alerta'
import { Boton } from '../../../components/Boton'
import { Campo } from '../../../components/Campo'
import { Select } from '../../../components/Select'
import { comoErrorApi } from '../../../services/http'
import type { Grupo } from '../../../shared/types/catalogo'
import type { EstadoPersonal, PersonalDia, PersonalGrupo, PersonalTurno as Personal } from '../../../shared/types/mfr'
import { porcentaje } from '../../../shared/utils/numeros'
import { useAjustarEsperadas, useRegistrarAsistencia } from '../hooks/useMfr'
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
const ESTILO_DE_MAS = { clase: 'bg-alerta-claro text-alerta', punto: 'bg-alerta' }

/** Estado de un grupo suelto: cabe en una celda, así que va corto. */
function estadoGrupo(g: PersonalGrupo): { texto: string; clase: string; punto: string } {
  if (!g.registrado) return { texto: 'Falta registrar', ...ESTILO.SIN_DATO }
  if (g.deMas > 0) return { texto: `De más (+${g.deMas})`, ...ESTILO_DE_MAS }
  if (g.estado === 'SIN_DATO') return { texto: 'Sin esperadas', ...ESTILO.SIN_DATO }
  return { texto: g.estado === 'A_FIN' ? 'Completo' : 'Incompleto', ...ESTILO[g.estado] }
}

/** Dice el hecho y la causa: contra el DPP, contra los grupos, o las dos. */
function textoPersonal(p: Personal): string {
  if (p.estado === 'SIN_DATO') return 'Falta registrar la asistencia'
  const causas: string[] = []
  if (p.estadoDpp === 'AFECTADA') causas.push(`Faltan ${p.faltanteDpp} de las ${p.requeridasDpp} que pide el DPP (${porcentaje(p.coberturaDpp)})`)
  if (p.estadoGrupos === 'AFECTADA') causas.push(`${causas.length ? 'y ' : 'Faltaron '}${p.faltante} de lo que debían enviar los grupos`)
  if (causas.length > 0) return causas.join(' ')
  return p.estadoDpp === 'A_FIN'
    ? `Cubre el DPP: ${p.llegaron} de ${p.requeridasDpp} (${porcentaje(p.coberturaDpp)})`
    : `Llegaron ${p.llegaron} de ${p.esperadas} esperadas`
}

export function PersonalBadge({ personal }: { personal: Personal }) {
  const { clase, punto } = ESTILO[personal.estado]
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold ${clase}`}
      title="Afectada si llegaron menos personas de las que pide el DPP (máximo por línea en el turno) o si algún grupo envió menos de las que debía."
    >
      <span className={`h-1.5 w-1.5 rounded-full ${punto}`} aria-hidden="true" />
      {textoPersonal(personal)}
    </span>
  )
}

/**
 * Total del día contra los grupos (usuario, 2026-10-03): esperadas de todos
 * los turnos frente a las que llegaron, en total y por grupo. Va arriba de
 * las tarjetas de turno en la programación.
 */
export function PersonalDiaResumen({ personal }: { personal: PersonalDia }) {
  if (personal.esperadasDia === 0 && personal.llegaronDia === 0) return null
  const faltan = personal.porGrupo.reduce((s, g) => s + g.faltante, 0)
  const deMas = personal.porGrupo.reduce((s, g) => s + g.deMas, 0)
  return (
    // Franja abierta, sin caja (usuario, 2026-10-05).
    <div className="border-l-4 border-l-marca py-1 pl-4 text-sm">
      <div className="flex flex-wrap items-baseline gap-x-6 gap-y-1">
        <span className="font-semibold text-tinta">Personal del día</span>
        <span className="text-tinta-suave">
          Esperadas <strong className="cifra text-tinta">{personal.esperadasDia}</strong>
        </span>
        <span className="text-tinta-suave">
          Llegaron <strong className="cifra text-tinta">{personal.llegaronDia}</strong>
        </span>
        {faltan > 0 && <span className="font-semibold text-critico">Faltaron {faltan}</span>}
        {deMas > 0 && <span className="font-semibold text-alerta">{deMas} de más</span>}
        {personal.coberturaDpp !== null && (
          <span className="text-tinta-suave">
            Cobertura del DPP <strong className="cifra text-tinta">{porcentaje(personal.coberturaDpp)}</strong>
          </span>
        )}
      </div>
      {personal.porGrupo.length > 0 && (
        <div className="mt-1.5 flex flex-wrap gap-x-4 gap-y-1 text-xs text-tinta-suave">
          {personal.porGrupo.map((g) => (
            <span key={g.grupoId}>
              {g.nombre}: <span className="cifra text-tinta">{g.llegaron}</span> de <span className="cifra">{g.esperadas}</span>
            </span>
          ))}
        </div>
      )}
      <p className="mt-1 text-xs text-tinta-suave">Las esperadas suman los tres turnos; las llegadas, solo lo ya registrado.</p>
    </div>
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
  const [ajustando, setAjustando] = useState(false)

  const activos = grupos.filter((g) => g.activo)
  /** Las esperadas de HOY en este turno: las resuelve el backend (con el ajuste del día); si el grupo no aparece, lo fijo del grupo. */
  const esperadasHoy = (id: string): number | null =>
    personal.grupos.find((g) => g.grupoId === id)?.esperadas ?? activos.find((g) => g.id === id)?.esperadasPorTurno[turnoId] ?? null
  const esperadasElegido = grupoId ? esperadasHoy(grupoId) : null
  const llegaDeMas = esperadasElegido !== null && llegaron !== '' && Number(llegaron) > esperadasElegido
  const faltaMotivo = llegaDeMas && observacion.trim() === ''

  /** Al escoger un grupo ya registrado se precarga su valor para corregirlo. */
  const escogerGrupo = (id: string) => {
    setGrupoId(id)
    const ya = personal.grupos.find((g) => g.grupoId === id && g.registrado)
    setLlegaron(ya ? String(ya.llegaron) : '')
    setObservacion(ya?.observacion ?? '')
  }

  const enviar = async (e: FormEvent) => {
    e.preventDefault()
    if (!grupoId || llegaron === '' || faltaMotivo) return
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

  const registrados = personal.grupos.filter((g) => g.registrado)
  const total = {
    esperadas: personal.grupos.reduce((s, g) => s + (g.esperadas ?? 0), 0),
    llegaron: personal.llegaron,
    faltante: personal.faltante,
    deMas: personal.grupos.reduce((s, g) => s + g.deMas, 0),
    asignadas: personal.grupos.reduce((s, g) => s + (g.asignadas ?? 0), 0),
  }

  return (
    <div className="border-y border-borde py-4 text-sm">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="font-semibold text-tinta">
          Personal {codigoTurno} <PersonalBadge personal={personal} />
        </h3>
        <span className="text-xs text-tinta-suave" title="Por cada línea, el máximo de personas que piden sus productos en el turno; se suman las líneas.">
          Esperadas de los grupos: <strong className="text-tinta">{total.esperadas}</strong> · Pide el DPP:{' '}
          <strong className="text-tinta">{personal.requeridasDpp}</strong>
          {personal.coberturaDpp !== null && <> · cobertura <strong className="text-tinta">{porcentaje(personal.coberturaDpp)}</strong></>}
        </span>
      </div>
      {personal.lineasSinDato > 0 && (
        <p className="mt-1 text-xs text-alerta">
          {personal.lineasSinDato} línea(s) tienen bloques sin personas definidas: lo que pide el DPP queda corto. Complételo en la programación.
        </p>
      )}

      {personal.grupos.length > 0 ? (
        <div className="overflow-x-auto">
          <table className="mt-2 w-full text-left">
            <thead className="text-xs uppercase text-tinta-suave">
              <tr>
                <th className="py-1 pr-3">Grupo</th>
                <th className="py-1 pr-3 text-right">Esperadas</th>
                <th className="py-1 pr-3 text-right">Llegaron</th>
                <th className="py-1 pr-3 text-right">Faltan</th>
                <th className="py-1 pr-3 text-right">En líneas</th>
                <th className="py-1 pl-3 pr-3">Estado</th>
                <th className="py-1">Observación</th>
              </tr>
            </thead>
            <tbody>
              {personal.grupos.map((g) => {
                const estado = estadoGrupo(g)
                return (
                  <tr key={g.grupoId} className={`border-t border-borde ${g.registrado ? '' : 'text-tinta-suave'}`}>
                    <td className="py-1 pr-3">{g.nombre}</td>
                    <td className="py-1 pr-3 text-right cifra">
                      {g.esperadas ?? '—'}
                      {g.origenEsperadas === 'AJUSTE' && (
                        <span className="ml-1 text-xs font-semibold text-marca" title={`Ajustado para hoy: ${g.motivoAjuste ?? ''}`}>
                          (ajuste)
                        </span>
                      )}
                    </td>
                    <td className="py-1 pr-3 text-right cifra">{g.registrado ? g.llegaron : '—'}</td>
                    <td className={`py-1 pr-3 text-right cifra ${g.faltante > 0 ? 'font-semibold text-critico' : ''}`}>{g.registrado ? g.faltante : '—'}</td>
                    <td className="py-1 pr-3 text-right cifra" title="Personas del grupo repartidas en líneas / las que llegaron">
                      {g.registrado ? `${g.asignadas ?? 0}/${g.llegaron}` : '—'}
                    </td>
                    <td className="py-1 pl-3 pr-3">
                      <span className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2 py-0.5 text-xs font-semibold ${estado.clase}`}>
                        <span className={`h-1.5 w-1.5 rounded-full ${estado.punto}`} aria-hidden="true" />
                        {estado.texto}
                      </span>
                    </td>
                    <td className="py-1 text-tinta-suave">{g.observacion ?? ''}</td>
                  </tr>
                )
              })}
            </tbody>
            <tfoot className="border-t-2 border-borde font-semibold text-tinta">
              <tr>
                <td className="py-1 pr-3">Total {codigoTurno}</td>
                <td className="py-1 pr-3 text-right cifra">{total.esperadas}</td>
                <td className="py-1 pr-3 text-right cifra">{total.llegaron}</td>
                <td className={`py-1 pr-3 text-right cifra ${total.faltante > 0 ? 'text-critico' : ''}`}>{total.faltante}</td>
                <td className="py-1 pr-3 text-right cifra">{total.asignadas}/{total.llegaron}</td>
                <td className="py-1 pl-3 pr-3 text-xs font-normal text-tinta-suave">{total.deMas > 0 ? `${total.deMas} de más` : ''}</td>
                <td />
              </tr>
            </tfoot>
          </table>
        </div>
      ) : (
        <p className="mt-2 text-tinta-suave">
          Ningún grupo se espera ni está registrado en este turno. Configure las personas esperadas por turno en Administración → Grupos.
        </p>
      )}

      {puedeRegistrar && (
        <form onSubmit={(e) => void enviar(e)} className="mt-3 grid gap-2 border-t border-borde pt-3 md:grid-cols-[1fr_8rem_1fr_auto] md:items-end">
          <Select etiqueta="Grupo" value={grupoId} onChange={(e) => escogerGrupo(e.target.value)} required>
            <option value="">Seleccione…</option>
            {activos.map((g) => {
              const esperadas = esperadasHoy(g.id)
              return (
                <option key={g.id} value={g.id}>
                  {g.nombre}{esperadas !== null ? ` (espera ${esperadas})` : ' (no se espera en este turno)'}
                </option>
              )
            })}
          </Select>
          <Campo
            etiqueta="Llegaron"
            type="number"
            min={0}
            step={1}
            value={llegaron}
            onChange={(e) => setLlegaron(e.target.value)}
            placeholder={esperadasElegido !== null ? String(esperadasElegido) : '0'}
            required
          />
          <Campo
            etiqueta={llegaDeMas ? `Observación (obligatoria: llegaron ${Number(llegaron) - esperadasElegido!} de más)` : 'Observación (opcional)'}
            maxLength={300}
            value={observacion}
            onChange={(e) => setObservacion(e.target.value)}
            error={faltaMotivo ? 'Explique por qué llegaron más personas de las esperadas.' : undefined}
          />
          <Boton type="submit" cargando={registrar.isPending} disabled={!grupoId || llegaron === '' || faltaMotivo}>
            {registrados.some((g) => g.grupoId === grupoId) ? 'Corregir' : 'Registrar'}
          </Boton>
        </form>
      )}
      {grupoId && esperadasElegido === null && (
        <p className="mt-1 text-xs text-alerta">
          Este grupo no tiene personas esperadas para el {codigoTurno}; se registra pero no se puede comparar.
        </p>
      )}
      {registrar.error && <Alerta tipo="error">{comoErrorApi(registrar.error).mensaje}</Alerta>}

      {puedeRegistrar && (
        <div className="mt-2">
          <button type="button" className="text-xs font-semibold text-marca hover:underline" onClick={() => setAjustando(!ajustando)}>
            {ajustando ? 'Cancelar ajuste' : 'Ajustar las esperadas de hoy'}
          </button>
          {ajustando && (
            <AjusteEsperadas
              fecha={fecha}
              turnoId={turnoId}
              codigoTurno={codigoTurno}
              grupos={activos}
              esperadasHoy={esperadasHoy}
              onListo={() => setAjustando(false)}
            />
          )}
        </div>
      )}

      <LineasTurno
        fecha={fecha}
        turnoId={turnoId}
        lineas={personal.lineas}
        catalogoLineas={lineas}
        gruposConAsistencia={registrados}
        puedeRegistrar={puedeRegistrar}
      />
    </div>
  )
}

/** Ajuste de un día puntual: manda sobre lo fijo del grupo. Motivo obligatorio (queda auditado). */
function AjusteEsperadas({
  fecha, turnoId, codigoTurno, grupos, esperadasHoy, onListo,
}: {
  fecha: string
  turnoId: string
  codigoTurno: string
  grupos: Grupo[]
  esperadasHoy: (grupoId: string) => number | null
  onListo: () => void
}) {
  const ajustar = useAjustarEsperadas()
  const [grupoId, setGrupoId] = useState('')
  const [personas, setPersonas] = useState('')
  const [motivo, setMotivo] = useState('')

  const enviar = (e: FormEvent) => {
    e.preventDefault()
    ajustar.mutate({ fechaOperativa: fecha, turnoId, grupoId, personas: Number(personas), motivo: motivo.trim() }, { onSuccess: onListo })
  }

  return (
    <form onSubmit={enviar} className="mt-2 grid gap-2 rounded-md border border-borde p-2 md:grid-cols-[1fr_8rem_1fr_auto] md:items-end">
      <Select etiqueta={`Grupo (${codigoTurno}, solo hoy)`} value={grupoId} onChange={(e) => setGrupoId(e.target.value)} required>
        <option value="">Seleccione…</option>
        {grupos.map((g) => (
          <option key={g.id} value={g.id}>
            {g.nombre} (hoy {esperadasHoy(g.id) ?? '—'})
          </option>
        ))}
      </Select>
      <Campo etiqueta="Esperadas hoy" type="number" min={0} max={500} step={1} value={personas} onChange={(e) => setPersonas(e.target.value)} placeholder="0 = no viene" required />
      <Campo etiqueta="Motivo (obligatorio)" maxLength={300} value={motivo} onChange={(e) => setMotivo(e.target.value)} placeholder="Ej.: festivo, pedido especial" />
      <Boton type="submit" cargando={ajustar.isPending} disabled={!grupoId || personas === '' || motivo.trim().length < 5}>
        Ajustar
      </Boton>
      {ajustar.error && <div className="md:col-span-4"><Alerta tipo="error">{comoErrorApi(ajustar.error).mensaje}</Alerta></div>}
    </form>
  )
}
