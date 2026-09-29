/**
 * ENTRADAS DE MERCANCÍA — LISTADO
 * ===============================
 *
 * Por rango de días operativos (en la URL; por defecto los últimos 7).
 */

import { Link, useSearchParams } from 'react-router-dom'

import { Alerta } from '../../../components/Alerta'
import { Campo } from '../../../components/Campo'
import { Tarjeta } from '../../../components/Tarjeta'
import { comoErrorApi } from '../../../services/http'
import { fechaCorta, fechaHora, fechaOperativaDe } from '../../../shared/utils/fechas'
import { useSesion } from '../../auth/useSesion'
import { useTurnos } from '../../catalogo/hooks/useCatalogos'
import { useEntradas } from '../hooks/useInventario'

const DIA_MS = 24 * 60 * 60 * 1000

/** Rango de la URL; si no viene, los últimos 7 días operativos. */
function leerRango(params: URLSearchParams): { desde: string; hasta: string } {
  return {
    desde: params.get('desde') ?? fechaOperativaDe(new Date(Date.now() - 6 * DIA_MS)),
    hasta: params.get('hasta') ?? fechaOperativaDe(new Date()),
  }
}

export function EntradasPage() {
  const [params, setParams] = useSearchParams()
  const { desde, hasta } = leerRango(params)
  const entradas = useEntradas(desde, hasta)
  const turnos = useTurnos()
  const { tienePermiso } = useSesion()

  const cambiar = (clave: string, valor: string) => {
    const siguiente = new URLSearchParams(params)
    if (valor) siguiente.set(clave, valor)
    else siguiente.delete(clave)
    setParams(siguiente, { replace: true })
  }

  return (
    <section className="mx-auto max-w-5xl space-y-5">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <Link to="/inventario" className="text-sm text-marca hover:underline">← Inventario</Link>
          <h1 className="mt-1 text-2xl font-semibold text-tinta">Entradas de mercancía</h1>
        </div>
        {tienePermiso('inventario.registrar') && (
          <Link to="/inventario/entradas/nueva" className="rounded-lg bg-marca px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-marca-hover">
            + Nueva entrada
          </Link>
        )}
      </header>

      <Tarjeta>
        <div className="grid gap-3 sm:grid-cols-2">
          <Campo etiqueta="Desde (día operativo)" type="date" value={desde} onChange={(e) => cambiar('desde', e.target.value)} />
          <Campo etiqueta="Hasta" type="date" value={hasta} onChange={(e) => cambiar('hasta', e.target.value)} />
        </div>
      </Tarjeta>

      {entradas.isError && <Alerta tipo="error">{comoErrorApi(entradas.error).mensaje}</Alerta>}

      <Tarjeta sinRelleno>
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="bg-velo text-left text-xs uppercase text-tinta-suave">
              <tr>
                <th className="px-4 py-2">Fecha y hora</th>
                <th className="px-4 py-2">Día op.</th>
                <th className="px-4 py-2">Turno</th>
                <th className="px-4 py-2">Documento</th>
                <th className="px-4 py-2">Quién entrega</th>
                <th className="px-4 py-2">Recibió</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-borde">
              {entradas.data?.map((e) => (
                <tr key={e.id} className="hover:bg-velo/60">
                  <td className="px-4 py-2 whitespace-nowrap">
                    <Link to={`/inventario/entradas/${e.id}`} className="font-medium text-marca hover:underline">{fechaHora(e.fechaHoraRegistro)}</Link>
                  </td>
                  <td className="px-4 py-2 cifra">{fechaCorta(e.fechaOperativa)}</td>
                  <td className="px-4 py-2">{turnos.data?.find((t) => t.id === e.turnoId)?.codigo ?? '—'}</td>
                  <td className="px-4 py-2 font-medium">{e.documento}</td>
                  <td className="px-4 py-2">{e.remitente ?? '—'}</td>
                  <td className="px-4 py-2">{e.usuarioNombre}</td>
                </tr>
              ))}
              {entradas.data?.length === 0 && <tr><td colSpan={6} className="px-4 py-6 text-center text-tinta-suave">No hay entradas en este rango.</td></tr>}
            </tbody>
          </table>
        </div>
      </Tarjeta>
    </section>
  )
}
