/**
 * DETALLE DE REMISIÓN
 * ===================
 *
 * Datos completos, historial de estado y botones de acción según el
 * estado y los permisos. El documento se lee como se firmó: el producto
 * mostrado es el snapshot, no el catálogo actual.
 */

import { useState } from 'react'
import { Link, useParams } from 'react-router-dom'

import { Alerta } from '../../../components/Alerta'
import { Boton } from '../../../components/Boton'
import { abrirPdf } from '../../../services/archivos'
import { EstadoBadge } from '../../../components/EstadoBadge'
import { PantallaCargando } from '../../../components/PantallaCargando'
import { comoErrorApi } from '../../../services/http'
import { fechaCorta, fechaHora } from '../../../shared/utils/fechas'
import { useSesion } from '../../auth/useSesion'
import { useGrupos, useTurnos } from '../../catalogo/hooks/useCatalogos'
import { AccionesRemision } from '../components/AccionesRemision'
import { HistorialRemision } from '../components/HistorialRemision'
import { useRemision } from '../hooks/useRemisiones'

function Dato({ etiqueta, children }: { etiqueta: string; children: React.ReactNode }) {
  return (
    <div>
      <dt className="text-xs uppercase text-slate-500">{etiqueta}</dt>
      <dd className="text-sm text-slate-900">{children ?? '—'}</dd>
    </div>
  )
}

export function RemisionDetallePage() {
  const { id } = useParams<{ id: string }>()
  const remision = useRemision(id)
  const turnos = useTurnos()
  const grupos = useGrupos()
  const { tienePermiso } = useSesion()
  const [imprimiendo, setImprimiendo] = useState(false)
  const [errorPdf, setErrorPdf] = useState<string | null>(null)

  if (remision.isLoading) return <PantallaCargando />
  if (remision.isError) {
    return <Alerta tipo="error">{comoErrorApi(remision.error).mensaje}</Alerta>
  }
  const r = remision.data!

  const turno = turnos.data?.find((t) => t.id === r.turnoId)
  const grupo = grupos.data?.find((p) => p.id === r.grupoId)

  return (
    <section className="space-y-6">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <Link to="/remisiones" className="text-sm text-slate-500 hover:underline">
            ← Remisiones
          </Link>
          <h1 className="mt-1 text-2xl font-semibold text-slate-900">
            Remisión {r.consecutivo}
            {r.version > 1 && (
              <span className="ml-2 text-base font-normal text-slate-500">versión {r.version}</span>
            )}
          </h1>
          <div className="mt-1 flex items-center gap-2">
            <EstadoBadge estado={r.estado} />
            {r.estaPendienteDeConciliar && (
              <span className="text-xs text-amber-700">Aprobada por PepsiCo, pendiente de conciliar</span>
            )}
          </div>
        </div>
        <div className="flex flex-col items-end gap-2">
          <div className="flex gap-2">
            <Boton
              variante="secundario"
              cargando={imprimiendo}
              onClick={async () => {
                setErrorPdf(null)
                setImprimiendo(true)
                try {
                  await abrirPdf(`/remisiones/${r.id}/pdf`)
                } catch (e) {
                  setErrorPdf(comoErrorApi(e).mensaje)
                } finally {
                  setImprimiendo(false)
                }
              }}
            >
              Imprimir PDF
            </Boton>
            {r.esEditable && tienePermiso('remision.editar') && (
              <Link
                to={`/remisiones/${r.id}/editar`}
                className="rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
              >
                Editar datos
              </Link>
            )}
          </div>
          <AccionesRemision remision={r} />
        </div>
      </header>

      {errorPdf && <Alerta tipo="error">{errorPdf}</Alerta>}

      {r.motivoUltimoRechazo && (
        <Alerta tipo="error">
          <strong>Último rechazo del OPA:</strong> {r.motivoUltimoRechazo}
        </Alerta>
      )}

      <div className="grid gap-6 md:grid-cols-2">
        <dl className="grid grid-cols-2 gap-4 rounded-lg bg-white p-5 shadow-sm">
          <Dato etiqueta="Fecha operativa">{fechaCorta(r.fechaOperativa)}</Dato>
          <Dato etiqueta="Registrada">{fechaHora(r.fechaHoraRegistro)}</Dato>
          <Dato etiqueta="Turno">{turno ? `${turno.codigo} · ${turno.nombre}` : '—'}</Dato>
          <Dato etiqueta="Grupo">{grupo?.nombre}</Dato>
          <div className="col-span-2">
            <Dato etiqueta="Producto (como se firmó)">
              <span className="font-mono text-xs text-slate-500">{r.producto.codigo}</span>
              <br />
              {r.producto.descripcion}
            </Dato>
          </div>
          <Dato etiqueta="Vencimiento">{fechaCorta(r.fechaVencimiento)}</Dato>
          <Dato etiqueta="Cajas / Unidades">
            {r.cantidadCajas} / {r.cantidadUnidades}
          </Dato>
          <Dato etiqueta="Estibas">{r.descripcionEstibas}</Dato>
          <Dato etiqueta="Números de estiba">
            {r.numerosEstiba.length ? r.numerosEstiba.join(', ') : '—'}
          </Dato>
          <div className="col-span-2">
            <Dato etiqueta="Observaciones">{r.observaciones}</Dato>
          </div>
          {r.extraoficial && (
            <div className="col-span-2 rounded-md border border-amber-200 bg-amber-50 p-3">
              <Dato etiqueta="Pedido de emergencia (extraoficial, fuera del MFR)">{r.motivoExtraoficial}</Dato>
            </div>
          )}
        </dl>

        <dl className="space-y-4 rounded-lg bg-white p-5 shadow-sm">
          <h2 className="text-sm font-semibold text-slate-700">Trazabilidad</h2>
          <Dato etiqueta="Entrega al OPA">
            {r.entrega.fecha ? fechaHora(r.entrega.fecha) : 'Pendiente'}
          </Dato>
          <Dato etiqueta="Aprobación de PepsiCo">
            {r.aprobacion.fecha ? (
              <>
                {fechaHora(r.aprobacion.fecha)} · {r.aprobacion.opaNombre}
                {r.aprobacion.opaCargo && ` (${r.aprobacion.opaCargo})`}
              </>
            ) : (
              'Pendiente'
            )}
          </Dato>
          <Dato etiqueta="Validación interna">
            {r.validacion.fecha ? (
              <>
                {fechaHora(r.validacion.fecha)} · conciliado con {r.validacion.conciliadoCon}
              </>
            ) : (
              'Pendiente'
            )}
          </Dato>
        </dl>
      </div>

      <HistorialRemision remisionId={r.id} />
    </section>
  )
}
