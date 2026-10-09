/**
 * DETALLE DE REMISIÓN
 * ===================
 *
 * Datos completos, historial de estado y botones de acción según el
 * estado y los permisos. El documento se lee como se firmó: el producto
 * mostrado es el snapshot, no el catálogo actual.
 *
 * Sin cajas (usuario, 2026-10-05): cifras de lo que se entrega, recorrido
 * del documento en pasos, ficha de registro, firmas e historial, cada uno
 * como sección abierta.
 */

import { useState } from 'react'
import { Link, useParams } from 'react-router-dom'

import { Alerta } from '../../../components/Alerta'
import { Badge } from '../../../components/Badge'
import { Boton } from '../../../components/Boton'
import { abrirPdf } from '../../../services/archivos'
import { Dato } from '../../../components/Dato'
import { EncabezadoPagina } from '../../../components/EncabezadoPagina'
import { EstadoBadge } from '../../../components/EstadoBadge'
import { Ficha } from '../../../components/Ficha'
import { IconoRemision } from '../../../components/Iconos'
import { PantallaCargando } from '../../../components/PantallaCargando'
import { Seccion } from '../../../components/Seccion'
import { comoErrorApi } from '../../../services/http'
import { fechaCorta } from '../../../shared/utils/fechas'
import { miles } from '../../../shared/utils/numeros'
import { useSesion } from '../../auth/useSesion'
import { useGrupos, useTurnos } from '../../catalogo/hooks/useCatalogos'
import { AccionesRemision } from '../components/AccionesRemision'
import { FirmasRemision } from '../components/FirmasRemision'
import { HistorialRemision } from '../components/HistorialRemision'
import { RecorridoRemision } from '../components/RecorridoRemision'
import { useRemision } from '../hooks/useRemisiones'

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
      <EncabezadoPagina
        Icono={IconoRemision}
        escena="remision"
        volver={{ a: '/remisiones', texto: 'Remisiones' }}
        titulo={`Remisión ${r.consecutivo}`}
        insignia={
          <>
            <EstadoBadge estado={r.estado} />
            {r.version > 1 && (
              <span className="text-[1rem] font-medium text-white/90">versión {r.version}</span>
            )}
            {r.estaPendienteDeConciliar && (
              <Badge tono="alerta">Aprobada por PepsiCo, pendiente de conciliar</Badge>
            )}
          </>
        }
        descripcion={`PT ${r.producto.codigo} · ${r.producto.descripcion}`}
        acciones={
          <>
            <Boton
              variante="vidrio"
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
              <Link to={`/remisiones/${r.id}/editar`}>
                <Boton variante="claro">Editar datos</Boton>
              </Link>
            )}
          </>
        }
      />

      {/* Las acciones del flujo (entregar, aprobar…) van fuera de la banda: sus botones son azules y se perderían en ella. */}
      <div className="flex justify-end">
        <AccionesRemision remision={r} />
      </div>

      {errorPdf && <Alerta tipo="error">{errorPdf}</Alerta>}

      {r.motivoUltimoRechazo && (
        <Alerta tipo="error">
          <strong>Último rechazo del OPA:</strong> {r.motivoUltimoRechazo}
        </Alerta>
      )}

      {/*
        Rediseño (usuario, 2026-10-05: fuera las tarjetas). Arriba, lo que
        se entrega en cifras grandes; luego el recorrido del documento como
        pasos; después los datos de registro en una ficha abierta.
      */}
      <Ficha>
        <Dato etiqueta="Cajas" valor={miles(r.cantidadCajas)} destacado />
        <Dato etiqueta="Unidades" valor={miles(r.cantidadUnidades)} destacado />
        <Dato etiqueta="Estibas" valor={r.descripcionEstibas} destacado />
        <Dato etiqueta="Vencimiento" valor={fechaCorta(r.fechaVencimiento)} destacado />
      </Ficha>

      {r.extraoficial && (
        <Alerta tipo="advertencia">
          <strong>Pedido de emergencia (extraoficial, fuera del MFR):</strong> {r.motivoExtraoficial}
        </Alerta>
      )}

      <Seccion titulo="Recorrido del documento" tono={r.estado === 'RECHAZADA' || r.estado === 'EN_RECTIFICACION' ? 'critico' : 'marca'}>
        <div className="border-y border-borde py-6">
          <RecorridoRemision remision={r} />
        </div>
      </Seccion>

      <Seccion titulo="Datos de registro">
        <Ficha>
          <Dato etiqueta="Fecha operativa" valor={fechaCorta(r.fechaOperativa)} />
          <Dato etiqueta="Turno" valor={turno ? `${turno.codigo} · ${turno.nombre}` : '—'} />
          <Dato etiqueta="Grupo" valor={grupo?.nombre ?? '—'} />
          <Dato etiqueta="Números de estiba" valor={r.numerosEstiba.length ? r.numerosEstiba.join(', ') : '—'} />
          <Dato etiqueta="PT (como se firmó)" valor={r.producto.codigo} nota={r.producto.descripcion} />
        </Ficha>
        {r.observaciones && (
          <p className="text-sm text-tinta-suave">
            <span className="font-semibold text-tinta">Observaciones:</span> {r.observaciones}
          </p>
        )}
      </Seccion>

      <FirmasRemision remision={r} />

      <HistorialRemision remisionId={r.id} />
    </section>
  )
}
