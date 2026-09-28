/**
 * NUEVO REPORTE DE AVERÍAS
 * ========================
 *
 * Réplica del formulario "Inlotrans | Reporte de averías MQ", pensada
 * para usarse desde el celular en la planta.
 *
 *   Encabezado   fecha, hora y turno NO se escriben: los pone el
 *                servidor al enviar (usuario, 2026-09-28). Aquí solo se
 *                muestra a qué día operativo va a quedar. Quien reporta
 *                es el usuario de la sesión.
 *   Averías      se agregan una por una, cada una con sus 3 fotos.
 *   Enviar       una sola petición con todo: o queda el reporte completo
 *                con sus fotos, o no queda nada.
 */

import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'

import { Alerta } from '../../../components/Alerta'
import { Boton } from '../../../components/Boton'
import { Select } from '../../../components/Select'
import { Tarjeta } from '../../../components/Tarjeta'
import { comoErrorApi } from '../../../services/http'
import { NOMBRE_UNIDAD, type RegistroNuevoAveria } from '../../../shared/types/averia'
import { fechaCorta, fechaOperativaDe } from '../../../shared/utils/fechas'
import { useSesion } from '../../auth/useSesion'
import { useGrupos } from '../../catalogo/hooks/useCatalogos'
import { AgregarAveria } from '../components/AgregarAveria'
import { useCausales, useCrearReporteAveria } from '../hooks/useAverias'
import { totalEnUnidades } from '../utils/totales'

export function NuevoReporteAveriaPage() {
  const navegar = useNavigate()
  const { usuario } = useSesion()
  const grupos = useGrupos()
  const causales = useCausales()
  const crear = useCrearReporteAveria()

  const [grupoId, setGrupoId] = useState('')
  const [registros, setRegistros] = useState<RegistroNuevoAveria[]>([])

  const total = totalEnUnidades(registros)
  const nombreCausal = (id: string) => causales.data?.find((c) => c.id === id)?.nombre ?? '—'

  const enviar = () =>
    crear.mutate(
      { grupoId, registros },
      { onSuccess: (reporte) => navegar(`/averias/${reporte.id}`, { replace: true }) },
    )

  return (
    <section className="mx-auto max-w-4xl space-y-5">
      <header className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h1 className="text-2xl font-semibold text-tinta">Reporte de averías MQ</h1>
          <p className="text-sm text-tinta-suave">Producto terminado (PT). Cada avería lleva sus 3 fotos de evidencia.</p>
        </div>
        <Link to="/averias" className="text-sm text-marca hover:underline">← Volver al listado</Link>
      </header>

      <Tarjeta titulo="Encabezado del reporte">
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1 text-sm">
            <p className="text-tinta-suave">Fecha y hora de reporte</p>
            <p className="font-medium text-tinta">Automática al enviar · día operativo {fechaCorta(fechaOperativaDe(new Date()))}</p>
          </div>
          <div className="space-y-1 text-sm">
            <p className="text-tinta-suave">Turno</p>
            <p className="font-medium text-tinta">Automático, según la hora del envío</p>
          </div>
          <Select etiqueta="Operador MQ (grupo) *" value={grupoId} onChange={(e) => setGrupoId(e.target.value)}>
            <option value="">— Seleccione una opción —</option>
            {grupos.data?.filter((g) => g.activo).map((g) => <option key={g.id} value={g.id}>{g.nombre}</option>)}
          </Select>
          <div className="space-y-1 text-sm">
            <p className="text-tinta-suave">Funcionario que reporta</p>
            <p className="font-medium text-tinta">{usuario?.nombre} <span className="text-tinta-suave">· {usuario?.documento}</span></p>
          </div>
        </div>
      </Tarjeta>

      <Tarjeta titulo="Agregar avería">
        <AgregarAveria onAgregar={(r) => setRegistros([...registros, r])} />
      </Tarjeta>

      <Tarjeta titulo={`Averías agregadas (${registros.length})`} descripcion={registros.length === 0 ? 'Todavía no ha agregado averías.' : undefined}>
        {registros.length > 0 && (
          <ul className="divide-y divide-borde">
            {registros.map((r, i) => (
              <li key={i} className="flex items-start justify-between gap-3 py-3 text-sm">
                <div className="min-w-0">
                  <p className="font-medium text-tinta">{i + 1}. {r.productoEtiqueta}</p>
                  <p className="text-tinta-suave">
                    {r.cantidad} {NOMBRE_UNIDAD[r.unidadMedida].toLowerCase()} · {nombreCausal(r.causalId)} · lote {r.lote} · vence {fechaCorta(r.fechaVencimiento)} · 3 fotos
                  </p>
                </div>
                <button type="button" className="shrink-0 text-critico hover:underline" onClick={() => setRegistros(registros.filter((_, j) => j !== i))}>
                  Quitar
                </button>
              </li>
            ))}
          </ul>
        )}
        <div className="mt-3 rounded-lg bg-velo px-4 py-3 text-sm">
          Total de averías: <span className="cifra text-lg font-semibold text-tinta">{total.unidades.toLocaleString('es-CO')}</span> unidades
          {total.bolsas > 0 && <span className="text-alerta"> + {total.bolsas} bolsa(s) sin convertir</span>}
        </div>
      </Tarjeta>

      {crear.isError && <Alerta tipo="error">{comoErrorApi(crear.error).mensaje}</Alerta>}
      <div className="flex justify-end">
        <Boton onClick={enviar} cargando={crear.isPending} disabled={!grupoId || registros.length === 0} className="w-full sm:w-auto">
          Enviar reporte de averías
        </Boton>
      </div>
      {crear.isPending && <p className="text-right text-sm text-tinta-suave">Enviando reporte y fotos, por favor espere…</p>}
    </section>
  )
}
