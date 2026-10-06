/**
 * DETALLE DEL REPORTE DE AVERÍAS
 * ==============================
 *
 * Muestra el reporte tal como quedó, con sus fotos. Con `averia.corregir`
 * (administrador) se puede corregir un registro o anular el reporte con
 * motivo; las fotos no se cambian y todo queda auditado.
 */

import { useState } from 'react'
import { useParams } from 'react-router-dom'

import { Alerta } from '../../../components/Alerta'
import { Badge } from '../../../components/Badge'
import { Boton } from '../../../components/Boton'
import { Dato } from '../../../components/Dato'
import { Ficha } from '../../../components/Ficha'
import { MetaDato } from '../../../components/ListaRegistros'
import { Seccion } from '../../../components/Seccion'
import { EncabezadoPagina } from '../../../components/EncabezadoPagina'
import { IconoAveria } from '../../../components/Iconos'
import { PantallaCargando } from '../../../components/PantallaCargando'
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
    return (
      <Alerta tipo="error">
        {reporte.error ? comoErrorApi(reporte.error).mensaje : 'No se encontró el reporte.'}
      </Alerta>
    )
  }
  const r = reporte.data
  const puedeCorregir = tienePermiso('averia.corregir') && r.estado === 'REGISTRADO'
  const turno = turnos.data?.find((t) => t.id === r.turnoId)
  const nombreCausal = (cid: string) => causales.data?.find((c) => c.id === cid)?.nombre ?? '—'
  return (
    <section className="mx-auto max-w-5xl space-y-5">
      <EncabezadoPagina
        Icono={IconoAveria}
        escena="averia"
        volver={{ a: '/averias', texto: 'Averías' }}
        titulo="Reporte de averías"
        insignia={
          <Badge tono={r.estado === 'REGISTRADO' ? 'exito' : 'neutro'}>
            {r.estado === 'REGISTRADO' ? 'Registrado' : 'Anulado'}
          </Badge>
        }
        descripcion={`Día operativo ${fechaCorta(r.fechaOperativa)} · reportado por ${r.reportadoPorNombre}`}
        acciones={
          puedeCorregir && (
            <Boton variante="peligro" onClick={() => setAnulando(true)}>
              Anular reporte
            </Boton>
          )
        }
      />

      {r.estado === 'ANULADO' && (
        <Alerta tipo="advertencia">
          Anulado el {r.fechaAnulacion ? fechaHora(r.fechaAnulacion) : '—'}. Motivo: {r.motivoAnulacion}
        </Alerta>
      )}

      {/* Rediseño (usuario, 2026-10-05: fuera las tarjetas): ficha abierta y cada avería como un bloque separado por líneas. */}
      <Ficha>
        <Dato
          etiqueta="Total de averías"
          valor={r.total.unidades.toLocaleString('es-CO')}
          unidad={`unidades${r.total.sinConvertir.BOLSA ? ` + ${r.total.sinConvertir.BOLSA} bolsa(s)` : ''}`}
          destacado
        />
        <Dato etiqueta="Fecha y hora de reporte" valor={fechaHora(r.fechaHoraRegistro)} />
        <Dato etiqueta="Turno" valor={turno ? `${turno.codigo} · ${turno.nombre}` : '—'} />
        <Dato etiqueta="Operador MQ" valor={grupos.data?.find((g) => g.id === r.grupoId)?.nombre ?? '—'} />
        <Dato etiqueta="Funcionario que reporta" valor={r.reportadoPorNombre} />
      </Ficha>

      <Seccion
        titulo="Averías del reporte"
        contador={r.registros.length}
        tono={r.estado === 'REGISTRADO' ? 'alerta' : 'neutro'}
        descripcion="Cada una con sus tres fotos de evidencia."
      >
        <ol className="divide-y divide-borde border-y border-borde">
          {r.registros.map((reg, i) => (
            <li key={reg.id} className="grid gap-5 py-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.5fr)]">
              <div className="space-y-4">
                <div className="flex items-start gap-4">
                  <span className="cifra grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-alerta-claro text-xl font-black text-alerta">
                    {i + 1}
                  </span>
                  <div className="min-w-0">
                    <p className="text-lg font-black leading-snug text-tinta">{reg.productoDescripcion}</p>
                    <p className="cifra text-sm text-tinta-suave">{reg.productoCodigo}</p>
                  </div>
                </div>
                <div className="flex flex-wrap items-end gap-x-6 gap-y-2">
                  <p className="cifra text-3xl font-black leading-none text-tinta">
                    {reg.cantidad}
                    <span className="ml-1.5 text-sm font-semibold text-tinta-suave">{NOMBRE_UNIDAD[reg.unidadMedida].toLowerCase()}</span>
                  </p>
                  <Badge tono="alerta">{nombreCausal(reg.causalId)}</Badge>
                </div>
                <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-tinta-suave">
                  <MetaDato etiqueta="Lote">{reg.lote}</MetaDato>
                  <MetaDato etiqueta="Vence">{fechaCorta(reg.fechaVencimiento)}</MetaDato>
                </div>
                {puedeCorregir && (
                  <Boton variante="secundario" tamano="sm" onClick={() => setCorrigiendo(reg)}>
                    Corregir esta avería
                  </Boton>
                )}
              </div>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                {TIPOS_EVIDENCIA.map((t) => (
                  <FotoEvidencia key={t} reporteId={r.id} registroId={reg.id} tipo={t} />
                ))}
              </div>
            </li>
          ))}
        </ol>
      </Seccion>

      {corrigiendo && (
        <CorregirRegistroDialogo
          reporteId={r.id}
          registro={corrigiendo}
          onCerrar={() => setCorrigiendo(null)}
        />
      )}
      <AnularReporteDialogo reporteId={r.id} abierto={anulando} onCerrar={() => setAnulando(false)} />
    </section>
  )
}
