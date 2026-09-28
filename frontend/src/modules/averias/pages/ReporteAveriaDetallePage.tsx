/**
 * DETALLE DEL REPORTE DE AVERÍAS
 * ==============================
 *
 * Muestra el reporte tal como quedó, con sus fotos. Con `averia.corregir`
 * (administrador) se puede corregir un registro o anular el reporte con
 * motivo; las fotos no se cambian y todo queda auditado.
 */

import { useState } from 'react'
import { Link, useParams } from 'react-router-dom'

import { Alerta } from '../../../components/Alerta'
import { Badge } from '../../../components/Badge'
import { Boton } from '../../../components/Boton'
import { Dato } from '../../../components/Dato'
import { PantallaCargando } from '../../../components/PantallaCargando'
import { Tarjeta } from '../../../components/Tarjeta'
import { comoErrorApi } from '../../../services/http'
import { NOMBRE_UNIDAD, TIPOS_EVIDENCIA, type RegistroAveria } from '../../../shared/types/averia'
import { fechaCorta, fechaHora } from '../../../shared/utils/fechas'
import { useSesion } from '../../auth/useSesion'
import { useGrupos, useTurnos } from '../../catalogo/hooks/useCatalogos'
import { AnularReporteDialogo } from '../components/AnularReporteDialogo'
import { CorregirRegistroDialogo } from '../components/CorregirRegistroDialogo'
import { FotoEvidencia } from '../components/FotoEvidencia'
import { useCausales, useReporteAveria } from '../hooks/useAverias'

export function ReporteAveriaDetallePage() {
  const { id = '' } = useParams()
  const reporte = useReporteAveria(id)
  const { tienePermiso } = useSesion()
  const turnos = useTurnos()
  const grupos = useGrupos()
  const causales = useCausales()
  const [corrigiendo, setCorrigiendo] = useState<RegistroAveria | null>(null)
  const [anulando, setAnulando] = useState(false)

  if (reporte.isLoading) return <PantallaCargando />
  if (reporte.isError || !reporte.data) {
    return <Alerta tipo="error">{reporte.error ? comoErrorApi(reporte.error).mensaje : 'No se encontró el reporte.'}</Alerta>
  }
  const r = reporte.data
  const puedeCorregir = tienePermiso('averia.corregir') && r.estado === 'REGISTRADO'
  const turno = turnos.data?.find((t) => t.id === r.turnoId)
  const nombreCausal = (cid: string) => causales.data?.find((c) => c.id === cid)?.nombre ?? '—'
  return (
    <section className="mx-auto max-w-5xl space-y-5">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <Link to="/averias" className="text-sm text-marca hover:underline">← Averías</Link>
          <h1 className="mt-1 flex items-center gap-3 text-2xl font-semibold text-tinta">
            Reporte de averías
            <Badge tono={r.estado === 'REGISTRADO' ? 'exito' : 'neutro'}>{r.estado === 'REGISTRADO' ? 'Registrado' : 'Anulado'}</Badge>
          </h1>
        </div>
        {puedeCorregir && <Boton variante="peligro" onClick={() => setAnulando(true)}>Anular reporte</Boton>}
      </header>

      {r.estado === 'ANULADO' && (
        <Alerta tipo="advertencia">
          Anulado el {r.fechaAnulacion ? fechaHora(r.fechaAnulacion) : '—'}. Motivo: {r.motivoAnulacion}
        </Alerta>
      )}

      <Tarjeta titulo="Encabezado">
        <dl className="grid gap-4 sm:grid-cols-3">
          <Dato etiqueta="Fecha y hora de reporte" valor={fechaHora(r.fechaHoraRegistro)} />
          <Dato etiqueta="Día operativo" valor={fechaCorta(r.fechaOperativa)} />
          <Dato etiqueta="Turno" valor={turno ? `${turno.codigo} · ${turno.nombre}` : '—'} />
          <Dato etiqueta="Operador MQ" valor={grupos.data?.find((g) => g.id === r.grupoId)?.nombre ?? '—'} />
          <Dato etiqueta="Funcionario que reporta" valor={r.reportadoPorNombre} />
          <Dato
            etiqueta="Total de averías"
            valor={`${r.total.unidades.toLocaleString('es-CO')} unidades${r.total.sinConvertir.BOLSA ? ` + ${r.total.sinConvertir.BOLSA} bolsa(s)` : ''}`}
          />
        </dl>
      </Tarjeta>

      {r.registros.map((reg, i) => (
        <Tarjeta
          key={reg.id}
          titulo={`${i + 1}. ${reg.productoCodigo} · ${reg.productoDescripcion}`}
          accion={puedeCorregir ? <Boton variante="sutil" tamano="sm" onClick={() => setCorrigiendo(reg)}>Corregir</Boton> : undefined}
        >
          <dl className="grid gap-4 sm:grid-cols-3">
            <Dato etiqueta="Causal" valor={nombreCausal(reg.causalId)} />
            <Dato etiqueta="Cantidad" valor={`${reg.cantidad} ${NOMBRE_UNIDAD[reg.unidadMedida].toLowerCase()}`} />
            <Dato etiqueta="Lote" valor={reg.lote} />
            <Dato etiqueta="Vencimiento" valor={fechaCorta(reg.fechaVencimiento)} />
          </dl>
          <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
            {TIPOS_EVIDENCIA.map((t) => <FotoEvidencia key={t} reporteId={r.id} registroId={reg.id} tipo={t} />)}
          </div>
        </Tarjeta>
      ))}

      {corrigiendo && <CorregirRegistroDialogo reporteId={r.id} registro={corrigiendo} onCerrar={() => setCorrigiendo(null)} />}
      <AnularReporteDialogo reporteId={r.id} abierto={anulando} onCerrar={() => setAnulando(false)} />
    </section>
  )
}
