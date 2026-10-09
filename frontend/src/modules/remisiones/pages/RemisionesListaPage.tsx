/**
 * LISTADO DE REMISIONES
 * =====================
 *
 * Arriba, una cifra por estado (con los filtros puestos): dice cuántas
 * hay y, al tocarla, filtra por ese estado. Debajo, filtros con atajos de
 * fecha y la tabla, con una franja del color del estado en cada fila.
 * Las APROBADAS (sin conciliar) se ven en ámbar porque son la fuente
 * probable de descuadres.
 *
 * Las acciones sobre varias remisiones (correo, PDF) aparecen en una
 * barra flotante solo cuando hay alguna marcada.
 *
 * Los filtros viven en la URL (`?estado=...&desde=...`): así se pueden
 * compartir y sobreviven a recargar la página.
 */

import { useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'

import { Alerta } from '../../../components/Alerta'
import { BarraSeleccion } from '../../../components/BarraSeleccion'
import { Boton } from '../../../components/Boton'
import { Campo } from '../../../components/Campo'
import { CifraEstado } from '../../../components/CifraEstado'
import { EncabezadoPagina } from '../../../components/EncabezadoPagina'
import { EstadoBadge } from '../../../components/EstadoBadge'
import { EstadoVacio } from '../../../components/EstadoVacio'
import { IconoRemision } from '../../../components/Iconos'
import { Paginacion } from '../../../components/Paginacion'
import { PanelFiltros } from '../../../components/PanelFiltros'
import { Select } from '../../../components/Select'
import { Celda, FilaTabla, Tabla } from '../../../components/Tabla'
import { TONO_ESTADO } from '../../../components/tonos-estado'
import { abrirPdf, descargarArchivo } from '../../../services/archivos'
import { comoErrorApi } from '../../../services/http'
import {
  ESTADOS_REMISION,
  ETIQUETA_ESTADO,
  type EstadoRemision,
  type FiltroRemisiones,
} from '../../../shared/types/remision'
import { useAparecer } from '../../../shared/animacion/useAnimacion'
import { fechaCorta } from '../../../shared/utils/fechas'
import { miles } from '../../../shared/utils/numeros'
import { useSesion } from '../../auth/useSesion'
import { useGrupos, useTurnos } from '../../catalogo/hooks/useCatalogos'
import { EnviarCorreoDialogo } from '../../correo/components/EnviarCorreoDialogo'
import { TarjetaRemision } from '../components/TarjetaRemision'
import { useRemisiones, useResumenRemisiones } from '../hooks/useRemisiones'

const POR_PAGINA = 20

/** Claves de filtro que viven en la URL (la página no cuenta como filtro). */
const CLAVES_FILTRO = ['desde', 'hasta', 'estado', 'turnoId', 'grupoId'] as const

const COLUMNAS = [
  { texto: '', clave: 'seleccion' },
  { texto: 'Consecutivo' },
  { texto: 'Fecha op.' },
  { texto: 'Turno' },
  { texto: 'Grupo' },
  { texto: 'PT' },
  { texto: 'Cajas', derecha: true },
  { texto: 'Unidades', derecha: true },
  { texto: 'Estibas' },
  { texto: 'Estado' },
]

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
  // Las cifras usan los mismos filtros, salvo el estado: muestran el reparto completo.
  const resumen = useResumenRemisiones({
    desde: filtro.desde,
    hasta: filtro.hasta,
    turnoId: filtro.turnoId,
    grupoId: filtro.grupoId,
  })
  const turnos = useTurnos()
  const grupos = useGrupos()
  // Celular: las tarjetas entran en cascada al llegar los datos y al cambiar de filtro o página.
  const listaMovil = useAparecer<HTMLDivElement>(`${remisiones.isLoading}|${params.toString()}`)

  // Selección para enviar por correo o ver el PDF por lote (dos por hoja).
  const [seleccion, setSeleccion] = useState<Set<string>>(new Set())
  const [enviando, setEnviando] = useState(false)
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

  /** Cambia uno o varios filtros a la vez; un filtro nuevo vuelve a la página 1. */
  const cambiar = (cambios: Record<string, string | undefined>) => {
    const siguiente = new URLSearchParams(params)
    for (const [clave, valor] of Object.entries(cambios)) {
      if (valor) siguiente.set(clave, valor)
      else siguiente.delete(clave)
    }
    if (!('pagina' in cambios)) siguiente.delete('pagina')
    setParams(siguiente)
  }

  const hayFiltros = CLAVES_FILTRO.some((c) => params.get(c))
  const turnoDe = (id: string) => turnos.data?.find((t) => t.id === id)?.codigo ?? '—'
  const grupoDe = (id: string) => grupos.data?.find((g) => g.id === id)?.nombre ?? '—'

  const items = remisiones.data?.items ?? []
  const todasMarcadas = items.length > 0 && items.every((r) => seleccion.has(r.id))

  const vacio = hayFiltros ? (
    <EstadoVacio
      Icono={IconoRemision}
      titulo="No hay remisiones con estos filtros"
      texto="Pruebe con otro rango de fechas u otro estado."
      accion={
        <Boton variante="secundario" onClick={() => setParams(new URLSearchParams())}>
          Limpiar filtros
        </Boton>
      }
    />
  ) : (
    <EstadoVacio
      Icono={IconoRemision}
      titulo="Todavía no hay remisiones"
      texto="Cada entrega de producto terminado a PepsiCo empieza con una remisión."
      accion={
        tienePermiso('remision.crear') && (
          <Link to="/remisiones/nueva">
            <Boton>+ Nueva remisión</Boton>
          </Link>
        )
      }
    />
  )

  return (
    <section className="space-y-5 pb-24">
      <EncabezadoPagina
        Icono={IconoRemision}
        titulo="Remisiones"
        descripcion="Documentos de entrega del PT a PepsiCo: se crean, se entregan, el OPA los aprueba y se concilian."
        acciones={
          <>
            {tienePermiso('remision.exportar') && (
              <Boton variante="vidrio" cargando={ocupado === 'excel'} onClick={() => void exportar()}>
                Exportar a Excel
              </Boton>
            )}
            {tienePermiso('remision.crear') && (
              <Link to="/remisiones/nueva">
                <Boton variante="claro">+ Nueva remisión</Boton>
              </Link>
            )}
          </>
        }
      >
        {/* Una cifra por estado, en el orden del flujo. Tocarla filtra; tocarla otra vez quita el filtro. */}
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-6">
          {ESTADOS_REMISION.map((estado) => (
            <CifraEstado
              key={estado}
              variante="vidrio"
              etiqueta={ETIQUETA_ESTADO[estado]}
              valor={resumen.porEstado?.[estado] ?? null}
              total={resumen.total}
              tono={TONO_ESTADO[estado]}
              detalle={estado === 'APROBADA' ? 'sin conciliar' : undefined}
              activo={filtro.estado === estado}
              onClick={() => cambiar({ estado: filtro.estado === estado ? undefined : estado })}
            />
          ))}
        </div>
      </EncabezadoPagina>

      {errorArchivo && <Alerta tipo="error">{errorArchivo}</Alerta>}

      <PanelFiltros
        desde={filtro.desde}
        hasta={filtro.hasta}
        cambiarRango={({ desde, hasta }) => cambiar({ desde, hasta })}
        hayFiltros={hayFiltros}
        limpiar={() => setParams(new URLSearchParams())}
      >
        <Campo
          etiqueta="Desde (fecha operativa)"
          type="date"
          value={filtro.desde ?? ''}
          onChange={(e) => cambiar({ desde: e.target.value })}
        />
        <Campo
          etiqueta="Hasta"
          type="date"
          value={filtro.hasta ?? ''}
          onChange={(e) => cambiar({ hasta: e.target.value })}
        />
        <Select etiqueta="Estado" value={filtro.estado ?? ''} onChange={(e) => cambiar({ estado: e.target.value })}>
          <option value="">Todos</option>
          {ESTADOS_REMISION.map((e) => (
            <option key={e} value={e}>
              {ETIQUETA_ESTADO[e]}
            </option>
          ))}
        </Select>
        <Select etiqueta="Turno" value={filtro.turnoId ?? ''} onChange={(e) => cambiar({ turnoId: e.target.value })}>
          <option value="">Todos</option>
          {turnos.data?.map((t) => (
            <option key={t.id} value={t.id}>
              {t.codigo}
            </option>
          ))}
        </Select>
        <Select etiqueta="Grupo" value={filtro.grupoId ?? ''} onChange={(e) => cambiar({ grupoId: e.target.value })}>
          <option value="">Todos</option>
          {grupos.data?.map((g) => (
            <option key={g.id} value={g.id}>
              {g.nombre}
            </option>
          ))}
        </Select>
      </PanelFiltros>

      {remisiones.isError && <Alerta tipo="error">{comoErrorApi(remisiones.error).mensaje}</Alerta>}

      {/* Computador y tablet: tabla. */}
      <div className="hidden md:block">
        <Tabla
          columnas={COLUMNAS.map((c) =>
            c.clave === 'seleccion'
              ? {
                  ...c,
                  texto: (
                    <input
                      type="checkbox"
                      aria-label="Seleccionar todas las de esta página"
                      className="h-4 w-4 accent-marca pointer-coarse:h-5 pointer-coarse:w-5"
                      checked={todasMarcadas}
                      onChange={(e) => setSeleccion(e.target.checked ? new Set(items.map((r) => r.id)) : new Set())}
                    />
                  ),
                }
              : c,
          )}
          cargando={remisiones.isLoading}
          estaVacia={items.length === 0}
          claveAnimacion={params.toString()}
          vacio={vacio}
        >
          {items.map((r) => (
            <FilaTabla key={r.id} tono={TONO_ESTADO[r.estado]} marcada={seleccion.has(r.id)}>
              <Celda className="w-10">
                <input
                  type="checkbox"
                  aria-label={`Seleccionar ${r.consecutivo}`}
                  className="h-4 w-4 accent-marca pointer-coarse:h-5 pointer-coarse:w-5"
                  checked={seleccion.has(r.id)}
                  onChange={() => alternar(r.id)}
                />
              </Celda>
              <Celda className="whitespace-nowrap">
                <Link to={`/remisiones/${r.id}`} className="codigo font-extrabold text-marca hover:underline">
                  {r.consecutivo}
                </Link>
                {r.version > 1 && <span className="ml-1 text-xs text-tinta-suave">v{r.version}</span>}
                {r.extraoficial && (
                  <span
                    className="ml-1.5 rounded bg-alerta-claro px-1.5 py-0.5 text-xs font-bold uppercase text-alerta"
                    title={r.motivoExtraoficial ?? ''}
                  >
                    extraoficial
                  </span>
                )}
              </Celda>
              <Celda className="whitespace-nowrap">{fechaCorta(r.fechaOperativa)}</Celda>
              <Celda>
                <span className="rounded-md bg-velo px-2 py-0.5 text-xs font-bold text-tinta">{turnoDe(r.turnoId)}</span>
              </Celda>
              <Celda>{grupoDe(r.grupoId)}</Celda>
              <Celda>
                <div className="codigo text-xs text-tinta-suave">{r.producto.codigo}</div>
                <div className="max-w-xs truncate font-medium">{r.producto.descripcion}</div>
              </Celda>
              {/* text-[1rem] y no text-base: `text-base` pinta de blanco (ver la nota en index.css). */}
              <Celda derecha className="text-[1rem] font-bold text-tinta">
                {miles(r.cantidadCajas)}
              </Celda>
              <Celda derecha>{miles(r.cantidadUnidades)}</Celda>
              <Celda className="text-tinta-suave">{r.descripcionEstibas}</Celda>
              <Celda>
                <EstadoBadge estado={r.estado} />
              </Celda>
            </FilaTabla>
          ))}
        </Tabla>
      </div>

      {/* Celular: filas abiertas con la franja del estado (sin cajas). */}
      <div ref={listaMovil} className="divide-y divide-borde border-y border-borde md:hidden">
        {remisiones.isLoading ? (
          Array.from({ length: 4 }, (_, i) => (
            <div key={i} className="my-2 h-20 animate-pulse rounded-xl bg-borde/60" aria-hidden="true" />
          ))
        ) : items.length === 0 ? (
          <div>{vacio}</div>
        ) : (
          items.map((r) => (
            <TarjetaRemision
              key={r.id}
              remision={r}
              turno={turnoDe(r.turnoId)}
              grupo={grupoDe(r.grupoId)}
              seleccionada={seleccion.has(r.id)}
              alternar={() => alternar(r.id)}
            />
          ))
        )}
      </div>

      <Paginacion
        pagina={filtro.pagina ?? 1}
        porPagina={POR_PAGINA}
        total={remisiones.data?.total ?? 0}
        unidad="remisiones"
        cambiar={(pagina) => cambiar({ pagina: String(pagina) })}
      />

      <BarraSeleccion
        cantidad={seleccion.size}
        unidad={['remisión seleccionada', 'remisiones seleccionadas']}
        quitar={() => setSeleccion(new Set())}
      >
        <Boton
          variante="vidrio"
          tamano="sm"
          cargando={ocupado === 'pdf'}
          onClick={() => void imprimirSeleccion()}
          title="Abre el PDF de las seleccionadas (para revisarlo o imprimirlo si hace falta)"
        >
          Ver PDF
        </Boton>
        {/* Usuario, 2026-10-03: las remisiones se envían por correo en lugar de imprimirse. */}
        {tienePermiso('remision.enviar_correo') && (
          <Boton variante="claro" tamano="sm" onClick={() => setEnviando(true)}>
            Enviar por correo
          </Boton>
        )}
      </BarraSeleccion>

      {enviando && <EnviarCorreoDialogo remisionIds={[...seleccion]} onCerrar={() => setEnviando(false)} />}
    </section>
  )
}
