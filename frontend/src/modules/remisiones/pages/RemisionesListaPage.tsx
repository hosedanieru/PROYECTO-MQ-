/**
 * LISTADO DE REMISIONES
 * =====================
 *
 * Filtros por fecha operativa, estado, turno y grupo; tabla
 * paginada. Las remisiones APROBADAS (sin conciliar) se destacan porque
 * son la fuente probable de descuadres.
 *
 * Los filtros viven en la URL (`?estado=...&desde=...`): así se pueden
 * compartir y sobreviven a recargar la página.
 */

import { useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'

import { Alerta } from '../../../components/Alerta'
import { Boton } from '../../../components/Boton'
import { Campo } from '../../../components/Campo'
import { EstadoBadge } from '../../../components/EstadoBadge'
import { Select } from '../../../components/Select'
import { abrirPdf, descargarArchivo } from '../../../services/archivos'
import { comoErrorApi } from '../../../services/http'
import {
  ESTADOS_REMISION,
  ETIQUETA_ESTADO,
  type EstadoRemision,
  type FiltroRemisiones,
} from '../../../shared/types/remision'
import { fechaCorta } from '../../../shared/utils/fechas'
import { useSesion } from '../../auth/useSesion'
import { useGrupos, useTurnos } from '../../catalogo/hooks/useCatalogos'
import { useRemisiones } from '../hooks/useRemisiones'

const POR_PAGINA = 20

function leerFiltro(params: URLSearchParams): FiltroRemisiones {
  const estado = params.get('estado')
  return {
    desde: params.get('desde') || undefined,
    hasta: params.get('hasta') || undefined,
    estado: ESTADOS_REMISION.includes(estado as EstadoRemision)
      ? (estado as EstadoRemision)
      : undefined,
    turnoId: params.get('turnoId') || undefined,
    grupoId: params.get('grupoId') || undefined,
    pagina: Number(params.get('pagina')) || 1,
    porPagina: POR_PAGINA,
  }
}

export function RemisionesListaPage() {
  const [params, setParams] = useSearchParams()
  const filtro = leerFiltro(params)
  const { tienePermiso } = useSesion()

  const remisiones = useRemisiones(filtro)
  const turnos = useTurnos()
  const grupos = useGrupos()

  // Selección para imprimir por lote (dos por hoja).
  const [seleccion, setSeleccion] = useState<Set<string>>(new Set())
  const [ocupado, setOcupado] = useState<'pdf' | 'excel' | null>(null)
  const [errorArchivo, setErrorArchivo] = useState<string | null>(null)

  const alternar = (id: string) =>
    setSeleccion((s) => {
      const n = new Set(s)
      if (n.has(id)) n.delete(id)
      else n.add(id)
      return n
    })

  const conArchivo = async (tipo: 'pdf' | 'excel', accion: () => Promise<void>) => {
    setErrorArchivo(null)
    setOcupado(tipo)
    try {
      await accion()
    } catch (e) {
      setErrorArchivo(comoErrorApi(e).mensaje)
    } finally {
      setOcupado(null)
    }
  }

  const imprimirSeleccion = () =>
    conArchivo('pdf', () => abrirPdf('/remisiones/pdf', { ids: [...seleccion].join(',') }))

  const exportar = () =>
    conArchivo('excel', () =>
      descargarArchivo(
        '/remisiones/exportar',
        {
          desde: filtro.desde,
          hasta: filtro.hasta,
          estado: filtro.estado,
          turnoId: filtro.turnoId,
          grupoId: filtro.grupoId,
        },
        `remisiones${filtro.desde ? `_${filtro.desde}` : ''}${filtro.hasta ? `_${filtro.hasta}` : ''}.xlsx`,
      ),
    )

  const cambiar = (clave: string, valor: string) => {
    const siguiente = new URLSearchParams(params)
    if (valor) siguiente.set(clave, valor)
    else siguiente.delete(clave)
    if (clave !== 'pagina') siguiente.delete('pagina') // filtro nuevo → página 1
    setParams(siguiente)
  }

  const nombreDe = (lista: { id: string; codigo: string }[] | undefined, id: string) =>
    lista?.find((i) => i.id === id)?.codigo ?? '—'

  const total = remisiones.data?.total ?? 0
  const totalPaginas = Math.max(1, Math.ceil(total / POR_PAGINA))

  return (
    <section className="space-y-4">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold text-slate-900">Remisiones</h1>
        <div className="flex flex-wrap gap-2">
          <Boton
            variante="secundario"
            disabled={seleccion.size === 0}
            cargando={ocupado === 'pdf'}
            onClick={() => void imprimirSeleccion()}
          >
            Imprimir seleccionadas{seleccion.size > 0 && ` (${seleccion.size})`}
          </Boton>
          {tienePermiso('remision.exportar') && (
            <Boton variante="secundario" cargando={ocupado === 'excel'} onClick={() => void exportar()}>
              Exportar a Excel
            </Boton>
          )}
          {tienePermiso('remision.crear') && (
            <Link to="/remisiones/nueva">
              <Boton>Nueva remisión</Boton>
            </Link>
          )}
        </div>
      </header>

      {errorArchivo && <Alerta tipo="error">{errorArchivo}</Alerta>}

      <div className="grid grid-cols-2 gap-3 rounded-lg bg-white p-4 shadow-sm md:grid-cols-5">
        <Campo
          etiqueta="Desde (fecha operativa)"
          type="date"
          value={filtro.desde ?? ''}
          onChange={(e) => cambiar('desde', e.target.value)}
        />
        <Campo
          etiqueta="Hasta"
          type="date"
          value={filtro.hasta ?? ''}
          onChange={(e) => cambiar('hasta', e.target.value)}
        />
        <Select
          etiqueta="Estado"
          value={filtro.estado ?? ''}
          onChange={(e) => cambiar('estado', e.target.value)}
        >
          <option value="">Todos</option>
          {ESTADOS_REMISION.map((e) => (
            <option key={e} value={e}>
              {ETIQUETA_ESTADO[e]}
            </option>
          ))}
        </Select>
        <Select
          etiqueta="Turno"
          value={filtro.turnoId ?? ''}
          onChange={(e) => cambiar('turnoId', e.target.value)}
        >
          <option value="">Todos</option>
          {turnos.data?.map((t) => (
            <option key={t.id} value={t.id}>
              {t.codigo}
            </option>
          ))}
        </Select>
        <Select
          etiqueta="Grupo"
          value={filtro.grupoId ?? ''}
          onChange={(e) => cambiar('grupoId', e.target.value)}
        >
          <option value="">Todos</option>
          {grupos.data?.map((p) => (
            <option key={p.id} value={p.id}>
              {p.nombre}
            </option>
          ))}
        </Select>
      </div>

      {remisiones.isError && (
        <Alerta tipo="error">{comoErrorApi(remisiones.error).mensaje}</Alerta>
      )}

      <div className="overflow-x-auto rounded-lg bg-white shadow-sm">
        <table className="min-w-full text-sm">
          <thead className="bg-slate-50 text-left text-xs uppercase text-slate-500">
            <tr>
              <th className="px-3 py-2">
                <input
                  type="checkbox"
                  aria-label="Seleccionar todas las de esta página"
                  checked={
                    (remisiones.data?.items.length ?? 0) > 0 &&
                    remisiones.data!.items.every((r) => seleccion.has(r.id))
                  }
                  onChange={(e) =>
                    setSeleccion(
                      e.target.checked
                        ? new Set(remisiones.data?.items.map((r) => r.id))
                        : new Set(),
                    )
                  }
                />
              </th>
              <th className="px-4 py-2">Consecutivo</th>
              <th className="px-4 py-2">Fecha op.</th>
              <th className="px-4 py-2">Turno</th>
              <th className="px-4 py-2">Grupo</th>
              <th className="px-4 py-2">Producto</th>
              <th className="px-4 py-2 text-right">Cajas</th>
              <th className="px-4 py-2 text-right">Unidades</th>
              <th className="px-4 py-2">Estibas</th>
              <th className="px-4 py-2">Estado</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {remisiones.isLoading && (
              <tr>
                <td colSpan={10} className="px-4 py-6 text-center text-slate-500">
                  Cargando…
                </td>
              </tr>
            )}
            {remisiones.data?.items.length === 0 && (
              <tr>
                <td colSpan={10} className="px-4 py-6 text-center text-slate-500">
                  No hay remisiones con esos filtros.
                </td>
              </tr>
            )}
            {remisiones.data?.items.map((r) => (
              <tr
                key={r.id}
                className={r.estaPendienteDeConciliar ? 'bg-amber-50/60' : 'hover:bg-slate-50'}
              >
                <td className="px-3 py-2">
                  <input
                    type="checkbox"
                    aria-label={`Seleccionar ${r.consecutivo}`}
                    checked={seleccion.has(r.id)}
                    onChange={() => alternar(r.id)}
                  />
                </td>
                <td className="px-4 py-2 font-medium">
                  <Link to={`/remisiones/${r.id}`} className="text-marca hover:underline">
                    {r.consecutivo}
                  </Link>
                  {r.version > 1 && (
                    <span className="ml-1 text-xs text-slate-400">v{r.version}</span>
                  )}
                  {r.extraoficial && (
                    <span className="ml-1 rounded bg-amber-100 px-1 text-[10px] font-semibold uppercase text-amber-800" title={r.motivoExtraoficial ?? ''}>
                      extraoficial
                    </span>
                  )}
                </td>
                <td className="px-4 py-2">{fechaCorta(r.fechaOperativa)}</td>
                <td className="px-4 py-2">{nombreDe(turnos.data, r.turnoId)}</td>
                <td className="px-4 py-2">
                  {grupos.data?.find((p) => p.id === r.grupoId)?.nombre ?? '—'}
                </td>
                <td className="px-4 py-2">
                  <div className="font-mono text-xs text-slate-500">{r.producto.codigo}</div>
                  <div className="max-w-xs truncate">{r.producto.descripcion}</div>
                </td>
                <td className="px-4 py-2 text-right">{r.cantidadCajas}</td>
                <td className="px-4 py-2 text-right">{r.cantidadUnidades}</td>
                <td className="px-4 py-2">{r.descripcionEstibas}</td>
                <td className="px-4 py-2">
                  <EstadoBadge estado={r.estado} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <footer className="flex items-center justify-between text-sm text-slate-600">
        <span>{total} remisiones</span>
        <div className="flex items-center gap-2">
          <Boton
            variante="secundario"
            disabled={filtro.pagina! <= 1}
            onClick={() => cambiar('pagina', String(filtro.pagina! - 1))}
          >
            Anterior
          </Boton>
          <span>
            Página {filtro.pagina} de {totalPaginas}
          </span>
          <Boton
            variante="secundario"
            disabled={filtro.pagina! >= totalPaginas}
            onClick={() => cambiar('pagina', String(filtro.pagina! + 1))}
          >
            Siguiente
          </Boton>
        </div>
      </footer>
    </section>
  )
}
