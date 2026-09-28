/**
 * LISTADO DE REPORTES DE AVERÍAS
 * ==============================
 *
 * Filtros en la URL (igual que remisiones): se pueden compartir y
 * sobreviven a recargar. Por defecto, los últimos 7 días operativos.
 * Los totales de arriba cuentan solo reportes vigentes (no anulados).
 */

import { Link, useSearchParams } from 'react-router-dom'

import { Alerta } from '../../../components/Alerta'
import { Badge } from '../../../components/Badge'
import { Campo } from '../../../components/Campo'
import { Select } from '../../../components/Select'
import { Tarjeta } from '../../../components/Tarjeta'
import { comoErrorApi } from '../../../services/http'
import type { EstadoReporteAveria, FiltroAverias } from '../../../shared/types/averia'
import { fechaCorta, fechaHora, fechaOperativaDe } from '../../../shared/utils/fechas'
import { useSesion } from '../../auth/useSesion'
import { useGrupos, useTurnos } from '../../catalogo/hooks/useCatalogos'
import { useReportesAveria } from '../hooks/useAverias'

const DIA_MS = 24 * 60 * 60 * 1000

function leerFiltro(params: URLSearchParams): FiltroAverias {
  const hoy = fechaOperativaDe(new Date())
  const haceSeis = fechaOperativaDe(new Date(Date.now() - 6 * DIA_MS))
  return {
    desde: params.get('desde') ?? haceSeis,
    hasta: params.get('hasta') ?? hoy,
    turnoId: params.get('turnoId') || undefined,
    grupoId: params.get('grupoId') || undefined,
    estado: (params.get('estado') as EstadoReporteAveria | null) || undefined,
  }
}

export function AveriasListaPage() {
  const [params, setParams] = useSearchParams()
  const filtro = leerFiltro(params)
  const { tienePermiso } = useSesion()
  const reportes = useReportesAveria(filtro)
  const turnos = useTurnos()
  const grupos = useGrupos()

  const cambiar = (clave: keyof FiltroAverias, valor: string) => {
    const siguiente = new URLSearchParams(params)
    if (valor) siguiente.set(clave, valor)
    else siguiente.delete(clave)
    setParams(siguiente, { replace: true })
  }

  const nombreTurno = (id: string) => turnos.data?.find((t) => t.id === id)?.codigo ?? '—'
  const nombreGrupo = (id: string) => grupos.data?.find((g) => g.id === id)?.nombre ?? '—'

  const vigentes = reportes.data?.filter((r) => r.estado === 'REGISTRADO') ?? []
  const unidades = vigentes.reduce((s, r) => s + r.total.unidades, 0)
  const bolsas = vigentes.reduce((s, r) => s + (r.total.sinConvertir.BOLSA ?? 0), 0)
  const averias = vigentes.reduce((s, r) => s + r.registros.length, 0)

  return (
    <section className="mx-auto max-w-6xl space-y-5">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-tinta">Averías</h1>
          <p className="text-sm text-tinta-suave">Reportes de averías de producto terminado, con sus fotos de evidencia.</p>
        </div>
        {tienePermiso('averia.reportar') && (
          <Link to="/averias/nuevo" className="rounded-lg bg-marca px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-marca-hover">
            + Nuevo reporte
          </Link>
        )}
      </header>

      <Tarjeta>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          <Campo etiqueta="Desde (día operativo)" type="date" value={filtro.desde} onChange={(e) => cambiar('desde', e.target.value)} />
          <Campo etiqueta="Hasta" type="date" value={filtro.hasta} onChange={(e) => cambiar('hasta', e.target.value)} />
          <Select etiqueta="Turno" value={filtro.turnoId ?? ''} onChange={(e) => cambiar('turnoId', e.target.value)}>
            <option value="">Todos</option>
            {turnos.data?.map((t) => <option key={t.id} value={t.id}>{t.codigo} · {t.nombre}</option>)}
          </Select>
          <Select etiqueta="Operador MQ (grupo)" value={filtro.grupoId ?? ''} onChange={(e) => cambiar('grupoId', e.target.value)}>
            <option value="">Todos</option>
            {grupos.data?.map((g) => <option key={g.id} value={g.id}>{g.nombre}</option>)}
          </Select>
          <Select etiqueta="Estado" value={filtro.estado ?? ''} onChange={(e) => cambiar('estado', e.target.value)}>
            <option value="">Todos</option>
            <option value="REGISTRADO">Registrados</option>
            <option value="ANULADO">Anulados</option>
          </Select>
        </div>
      </Tarjeta>

      <div className="grid gap-3 sm:grid-cols-3">
        <Resumen titulo="Reportes vigentes" valor={vigentes.length} />
        <Resumen titulo="Averías registradas" valor={averias} />
        <Resumen titulo="Unidades averiadas" valor={unidades} nota={bolsas > 0 ? `+ ${bolsas} bolsa(s) sin convertir` : undefined} />
      </div>

      {reportes.isError && <Alerta tipo="error">{comoErrorApi(reportes.error).mensaje}</Alerta>}

      <Tarjeta sinRelleno>
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="bg-velo text-left text-xs uppercase text-tinta-suave">
              <tr>
                <th className="px-4 py-2">Fecha y hora</th>
                <th className="px-4 py-2">Día operativo</th>
                <th className="px-4 py-2">Turno</th>
                <th className="px-4 py-2">Operador MQ</th>
                <th className="px-4 py-2">Reportó</th>
                <th className="px-4 py-2 text-right">Averías</th>
                <th className="px-4 py-2 text-right">Unidades</th>
                <th className="px-4 py-2">Estado</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-borde">
              {reportes.data?.map((r) => (
                <tr key={r.id} className={`hover:bg-velo/60 ${r.estado === 'ANULADO' ? 'text-tinta-suave line-through decoration-1' : ''}`}>
                  <td className="px-4 py-2 whitespace-nowrap">
                    <Link to={`/averias/${r.id}`} className="font-medium text-marca hover:underline">{fechaHora(r.fechaHoraRegistro)}</Link>
                  </td>
                  <td className="px-4 py-2 cifra">{fechaCorta(r.fechaOperativa)}</td>
                  <td className="px-4 py-2">{nombreTurno(r.turnoId)}</td>
                  <td className="px-4 py-2">{nombreGrupo(r.grupoId)}</td>
                  <td className="px-4 py-2">{r.reportadoPorNombre}</td>
                  <td className="px-4 py-2 text-right cifra">{r.registros.length}</td>
                  <td className="px-4 py-2 text-right cifra">
                    {r.total.unidades.toLocaleString('es-CO')}
                    {r.total.sinConvertir.BOLSA ? <span className="text-alerta"> +{r.total.sinConvertir.BOLSA} b.</span> : null}
                  </td>
                  <td className="px-4 py-2 no-underline">
                    <Badge tono={r.estado === 'REGISTRADO' ? 'exito' : 'neutro'}>{r.estado === 'REGISTRADO' ? 'Registrado' : 'Anulado'}</Badge>
                  </td>
                </tr>
              ))}
              {reportes.data?.length === 0 && (
                <tr><td colSpan={8} className="px-4 py-6 text-center text-tinta-suave">No hay reportes de averías en este rango.</td></tr>
              )}
              {reportes.isLoading && (
                <tr><td colSpan={8} className="px-4 py-6 text-center text-tinta-suave">Cargando…</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </Tarjeta>
    </section>
  )
}

function Resumen({ titulo, valor, nota }: { titulo: string; valor: number; nota?: string }) {
  return (
    <Tarjeta>
      <p className="text-sm text-tinta-suave">{titulo}</p>
      <p className="cifra text-2xl font-semibold text-tinta">{valor.toLocaleString('es-CO')}</p>
      {nota && <p className="text-xs text-alerta">{nota}</p>}
    </Tarjeta>
  )
}
