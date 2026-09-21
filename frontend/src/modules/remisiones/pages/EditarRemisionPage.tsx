/**
 * EDITAR REMISIÓN
 * ===============
 *
 * Solo para BORRADOR o EN_RECTIFICACION. Si la remisión ya no es
 * editable (p. ej. alguien la entregó desde otro equipo), se informa y
 * se vuelve al detalle. El backend lo vuelve a comprobar de todas formas.
 */

import { Link, useNavigate, useParams } from 'react-router-dom'

import { Alerta } from '../../../components/Alerta'
import { EstadoBadge } from '../../../components/EstadoBadge'
import { PantallaCargando } from '../../../components/PantallaCargando'
import { comoErrorApi } from '../../../services/http'
import { fechaCorta } from '../../../shared/utils/fechas'
import { RemisionForm } from '../components/RemisionForm'
import { useEditarRemision, useRemision, useVersionesRemision } from '../hooks/useRemisiones'

export function EditarRemisionPage() {
  const { id } = useParams<{ id: string }>()
  const navegar = useNavigate()
  const remision = useRemision(id)
  const editar = useEditarRemision(id!)
  // En rectificación, el motivo del rechazo ya pasó al historial de versiones.
  const versiones = useVersionesRemision(id!, remision.data?.estado === 'EN_RECTIFICACION')

  if (remision.isLoading) return <PantallaCargando />
  if (remision.isError) return <Alerta tipo="error">{comoErrorApi(remision.error).mensaje}</Alerta>
  const r = remision.data!
  const motivoRechazo = r.motivoUltimoRechazo ?? versiones.data?.at(-1)?.motivoRechazo ?? null

  if (!r.esEditable) {
    return (
      <Alerta tipo="info">
        La remisión {r.consecutivo} está en estado <EstadoBadge estado={r.estado} /> y ya no se
        puede editar. <Link to={`/remisiones/${r.id}`} className="underline">Volver al detalle</Link>.
      </Alerta>
    )
  }

  return (
    <section className="mx-auto max-w-3xl space-y-6">
      <header>
        <Link to={`/remisiones/${r.id}`} className="text-sm text-slate-500 hover:underline">
          ← Remisión {r.consecutivo}
        </Link>
        <h1 className="mt-1 text-2xl font-semibold text-slate-900">
          Editar remisión {r.consecutivo}
          {r.version > 1 && <span className="ml-2 text-base font-normal text-slate-500">versión {r.version}</span>}
        </h1>
        <p className="text-sm text-slate-600">
          Día operativo <strong>{fechaCorta(r.fechaOperativa)}</strong> (no cambia al editar).
        </p>
        {motivoRechazo && (
          <Alerta tipo="error">
            <strong>Motivo del rechazo del OPA:</strong> {motivoRechazo}
          </Alerta>
        )}
      </header>

      <RemisionForm
        fechaOperativa={r.fechaOperativa}
        inicial={r}
        textoEnviar="Guardar cambios"
        enviando={editar.isPending}
        error={editar.error}
        onEnviar={async (datos) => {
          // `null` explícito: quitar la marca extraoficial también borra su motivo.
          await editar.mutateAsync({ ...datos, observaciones: datos.observaciones ?? null, motivoExtraoficial: datos.motivoExtraoficial ?? null })
          navegar(`/remisiones/${r.id}`)
        }}
        onCancelar={() => navegar(`/remisiones/${r.id}`)}
      />
    </section>
  )
}
