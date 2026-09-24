/**
 * HISTORIAL DE LA REMISIÓN
 * ========================
 *
 * Dos pestañas:
 *   - Versiones: qué decía el documento antes de cada rectificación y
 *     por qué lo rechazó el OPA. Visible con `remision.consultar`.
 *   - Auditoría: cada escritura con quién, cuándo y qué cambió. Requiere
 *     además `admin.auditoria` (hoy solo el administrador).
 */

import { useState } from 'react'

import { Alerta } from '../../../components/Alerta'
import { comoErrorApi } from '../../../services/http'
import type { EntradaAuditoria, VersionRemision } from '../../../shared/types/remision'
import { fechaHora } from '../../../shared/utils/fechas'
import { useSesion } from '../../auth/useSesion'
import { useAuditoriaRemision, useVersionesRemision } from '../hooks/useRemisiones'

const ETIQUETA_ACCION: Record<EntradaAuditoria['accion'], string> = {
  CREAR: 'Creación',
  ACTUALIZAR: 'Edición de datos',
  CAMBIO_ESTADO: 'Cambio de estado',
  ELIMINAR: 'Eliminación',
}

/** Campos que se muestran del snapshot de una versión. */
const CAMPOS_VERSION: Array<[string, string]> = [
  ['codigoSnapshot', 'Producto'],
  ['cantidadCajas', 'Cajas'],
  ['cantidadUnidades', 'Unidades'],
  ['estibasCompletas', 'Estibas'],
  ['cajasSueltas', 'Sueltas'],
  ['numerosEstiba', 'N° estiba'],
  ['observaciones', 'Observaciones'],
  ['extraoficial', 'Extraoficial'],
  ['motivoExtraoficial', 'Motivo extraoficial'],
]

function valor(v: unknown): string {
  if (v === null || v === undefined || v === '') return '—'
  if (Array.isArray(v)) return v.join(', ')
  return String(v)
}

/** Diferencia entre dos objetos: solo las claves cuyo valor cambió. */
function diferencias(antes: Record<string, unknown> | null, despues: Record<string, unknown> | null) {
  const claves = new Set([...Object.keys(antes ?? {}), ...Object.keys(despues ?? {})])
  return [...claves]
    .filter((k) => JSON.stringify(antes?.[k]) !== JSON.stringify(despues?.[k]))
    .map((k) => ({ clave: k, antes: antes?.[k], despues: despues?.[k] }))
}

function Versiones({ id }: { id: string }) {
  const versiones = useVersionesRemision(id, true)
  if (versiones.isError) return <Alerta tipo="error">{comoErrorApi(versiones.error).mensaje}</Alerta>
  if (!versiones.data?.length) {
    return <p className="text-sm text-tinta-suave">Sin rectificaciones: esta es la primera versión.</p>
  }
  return (
    <ol className="space-y-4">
      {versiones.data.map((v: VersionRemision) => (
        <li key={v.version} className="rounded-md border border-borde p-4 text-sm">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <strong>Versión {v.version}</strong>
            <span className="text-tinta-suave">
              rectificada por {v.rectificadaPor.nombre} · {fechaHora(v.fechaRectificacion)}
            </span>
          </div>
          {v.motivoRechazo && (
            <p className="mt-1 text-critico">Motivo del rechazo: {v.motivoRechazo}</p>
          )}
          <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-1 md:grid-cols-4">
            {CAMPOS_VERSION.map(([clave, etiqueta]) => (
              <div key={clave}>
                <dt className="text-xs uppercase text-tinta-suave">{etiqueta}</dt>
                <dd>{valor(v.datosAnteriores[clave])}</dd>
              </div>
            ))}
          </dl>
        </li>
      ))}
    </ol>
  )
}

function Auditoria({ id }: { id: string }) {
  const auditoria = useAuditoriaRemision(id, true)
  if (auditoria.isError) return <Alerta tipo="error">{comoErrorApi(auditoria.error).mensaje}</Alerta>
  if (!auditoria.data?.length) return <p className="text-sm text-tinta-suave">Sin registros.</p>
  return (
    <ol className="space-y-3">
      {auditoria.data.map((e) => {
        const cambios = e.accion === 'CREAR' ? [] : diferencias(e.valorAnterior, e.valorNuevo)
        return (
          <li key={e.id} className="rounded-md border border-borde p-3 text-sm">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <strong>{ETIQUETA_ACCION[e.accion]}</strong>
              <span className="text-tinta-suave">
                {e.usuario.nombre} · {fechaHora(e.fecha)}
              </span>
            </div>
            {e.motivo && <p className="mt-1 text-tinta">Motivo: {e.motivo}</p>}
            {cambios.length > 0 && (
              <ul className="mt-2 space-y-0.5 text-xs text-tinta-suave">
                {cambios.map((c) => (
                  <li key={c.clave}>
                    <span className="cifra">{c.clave}</span>: {valor(c.antes)} →{' '}
                    <span className="font-medium text-tinta">{valor(c.despues)}</span>
                  </li>
                ))}
              </ul>
            )}
          </li>
        )
      })}
    </ol>
  )
}

export function HistorialRemision({ remisionId }: { remisionId: string }) {
  const { tienePermiso } = useSesion()
  const puedeAuditoria = tienePermiso('admin.auditoria')
  const [pestana, setPestana] = useState<'versiones' | 'auditoria'>('versiones')

  const clase = (activa: boolean) =>
    `border-b-2 px-3 py-2 text-sm ${activa ? 'border-marca font-medium text-marca' : 'border-transparent text-tinta-suave hover:text-tinta'}`

  return (
    <section className="rounded-lg bg-base p-5 shadow-sm">
      <nav className="mb-4 flex gap-2 border-b border-borde">
        <button className={clase(pestana === 'versiones')} onClick={() => setPestana('versiones')}>
          Versiones
        </button>
        {puedeAuditoria && (
          <button className={clase(pestana === 'auditoria')} onClick={() => setPestana('auditoria')}>
            Auditoría
          </button>
        )}
      </nav>
      {pestana === 'versiones' ? <Versiones id={remisionId} /> : <Auditoria id={remisionId} />}
    </section>
  )
}
