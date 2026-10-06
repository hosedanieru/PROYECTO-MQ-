/**
 * LISTADO DE REPORTES DE AVERÍAS
 * ==============================
 *
 * Filtros en la URL (igual que remisiones): se pueden compartir y
 * sobreviven a recargar. Por defecto, los últimos 7 días operativos.
 *
 * Rediseño (usuario, 2026-10-05: fuera las tarjetas, la información se
 * veía saturada): "una vista a la vez", como el tablero MFR. Debajo de
 * los filtros, dos pestañas grandes con su resumen vivo:
 *
 *   Reportes   línea de tiempo por día operativo, las unidades en grande
 *   Indicador  % de averías contra el DPP, con el máximo de 1 % del
 *              contrato (solo reportes vigentes), y sus desgloses
 *
 * La vista elegida vive en la URL (`?vista=`), como los filtros.
 */

import { Link, useSearchParams } from 'react-router-dom'

import { Alerta } from '../../../components/Alerta'
import { Badge } from '../../../components/Badge'
import { Boton } from '../../../components/Boton'
import { Campo } from '../../../components/Campo'
import { EncabezadoPagina } from '../../../components/EncabezadoPagina'
import { EstadoVacio } from '../../../components/EstadoVacio'
import { IconoAveria, IconoLista, IconoTablero } from '../../../components/Iconos'
import { LineaTiempo, type GrupoTiempo } from '../../../components/LineaTiempo'
import { MetaDato } from '../../../components/ListaRegistros'
import { PantallaCargando } from '../../../components/PantallaCargando'
import { PestanasVista, type OpcionVista } from '../../../components/PestanasVista'
import { Select } from '../../../components/Select'
import { comoErrorApi } from '../../../services/http'
import { useAparecer } from '../../../shared/animacion/useAnimacion'
import type { EstadoReporteAveria, FiltroAverias } from '../../../shared/types/averia'
import { agruparEnOrden } from '../../../shared/utils/agrupar'
import { diaLargo, fechaOperativaDe, hora } from '../../../shared/utils/fechas'
import { miles, porcentaje } from '../../../shared/utils/numeros'
import { useSesion } from '../../auth/useSesion'
import { useGrupos, useTurnos } from '../../catalogo/hooks/useCatalogos'
import { IndicadorAverias } from '../components/IndicadorAverias'
import { useIndicadorAverias, useReportesAveria } from '../hooks/useAverias'

const DIA_MS = 24 * 60 * 60 * 1000

type Vista = 'reportes' | 'indicador'
const VISTAS: Vista[] = ['reportes', 'indicador']

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
  const vista: Vista = VISTAS.includes(params.get('vista') as Vista) ? (params.get('vista') as Vista) : 'reportes'
  const { tienePermiso } = useSesion()
  const reportes = useReportesAveria(filtro)
  // El mismo indicador que pinta la vista: aquí solo da el resumen de la pestaña (react-query lo pide una vez).
  const indicador = useIndicadorAverias(filtro.desde, filtro.hasta)
  const turnos = useTurnos()
  const grupos = useGrupos()
  const contenido = useAparecer<HTMLDivElement>(vista)

  const cambiar = (clave: keyof FiltroAverias | 'vista', valor: string) => {
    const siguiente = new URLSearchParams(params)
    if (valor) siguiente.set(clave, valor)
    else siguiente.delete(clave)
    setParams(siguiente, { replace: true })
  }

  const nombreTurno = (id: string) => turnos.data?.find((t) => t.id === id)?.codigo ?? '—'
  const nombreGrupo = (id: string) => grupos.data?.find((g) => g.id === id)?.nombre ?? '—'
  const lista = reportes.data ?? []
  const total = indicador.data?.total

  const opciones: OpcionVista<Vista>[] = [
    {
      clave: 'reportes',
      titulo: 'Reportes',
      Icono: IconoLista,
      resumen: reportes.data ? `${lista.length} en el periodo` : 'Cargando…',
    },
    {
      clave: 'indicador',
      titulo: 'Indicador del 1 %',
      Icono: IconoTablero,
      resumen: total ? `${porcentaje(total.porcentaje, 'sin DPP', 2)} del programado` : 'Cargando…',
      tono: !total || total.porcentaje === null ? undefined : total.excede ? 'critico' : 'exito',
    },
  ]

  const gruposReportes: GrupoTiempo[] = agruparEnOrden(lista, (r) => r.fechaOperativa.slice(0, 10)).map(
    (g): GrupoTiempo => ({
      clave: g.clave,
      titulo: diaLargo(g.clave),
      resumen: `${g.elementos.length} ${g.elementos.length === 1 ? 'reporte' : 'reportes'} · ${miles(
        g.elementos.filter((r) => r.estado === 'REGISTRADO').reduce((s, r) => s + r.total.unidades, 0),
      )} unidades vigentes`,
      eventos: g.elementos.map((r) => {
        const anulado = r.estado === 'ANULADO'
        return {
          clave: r.id,
          tono: anulado ? 'neutro' : 'alerta',
          contenido: (
            <div className="flex flex-wrap items-start justify-between gap-x-6 gap-y-2">
              <div className="min-w-0 flex-1 basis-64">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="cifra text-sm font-bold text-tinta">{hora(r.fechaHoraRegistro)}</span>
                  <Badge tono="marca">{nombreTurno(r.turnoId)}</Badge>
                  <span className={`text-base font-bold ${anulado ? 'text-tinta-suave line-through decoration-1' : 'text-tinta'}`}>
                    {nombreGrupo(r.grupoId)}
                  </span>
                  {anulado && <Badge tono="neutro">Anulado</Badge>}
                </div>
                <div className="mt-1.5 flex flex-wrap gap-x-4 gap-y-1 text-xs text-tinta-suave">
                  <MetaDato etiqueta="Reportó">{r.reportadoPorNombre}</MetaDato>
                  <MetaDato etiqueta="Averías">{r.registros.length}</MetaDato>
                </div>
              </div>
              <div className="flex items-center gap-4">
                <div className="text-right">
                  <p className={`cifra text-xl font-black leading-none ${anulado ? 'text-tinta-suave' : 'text-tinta'}`}>
                    {miles(r.total.unidades)}
                    <span className="ml-1 text-xs font-semibold text-tinta-suave">unid.</span>
                  </p>
                  {r.total.sinConvertir.BOLSA ? (
                    <p className="mt-1 text-xs font-semibold text-alerta">+{r.total.sinConvertir.BOLSA} bolsa(s)</p>
                  ) : null}
                </div>
                <Link to={`/averias/${r.id}`}>
                  <Boton variante="sutil" tamano="sm">
                    Ver →
                  </Boton>
                </Link>
              </div>
            </div>
          ),
        }
      }),
    }),
  )

  return (
    <section className="mx-auto max-w-6xl space-y-6">
      <EncabezadoPagina
        Icono={IconoAveria}
        escena="averia"
        titulo="Averías"
        descripcion="Reportes de averías de producto terminado, con sus fotos de evidencia."
        acciones={
          tienePermiso('averia.reportar') && (
            <Link to="/averias/nuevo">
              <Boton variante="claro">+ Nuevo reporte</Boton>
            </Link>
          )
        }
      />

      {/* Filtros: a la vista y sin caja. El indicador mide el periodo completo: turno, grupo y estado solo filtran los reportes. */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        <Campo etiqueta="Desde (día operativo)" type="date" value={filtro.desde} onChange={(e) => cambiar('desde', e.target.value)} />
        <Campo etiqueta="Hasta" type="date" value={filtro.hasta} onChange={(e) => cambiar('hasta', e.target.value)} />
        <Select etiqueta="Turno" value={filtro.turnoId ?? ''} onChange={(e) => cambiar('turnoId', e.target.value)}>
          <option value="">Todos</option>
          {turnos.data?.map((t) => (
            <option key={t.id} value={t.id}>
              {t.codigo} · {t.nombre}
            </option>
          ))}
        </Select>
        <Select etiqueta="Operador MQ (grupo)" value={filtro.grupoId ?? ''} onChange={(e) => cambiar('grupoId', e.target.value)}>
          <option value="">Todos</option>
          {grupos.data?.map((g) => (
            <option key={g.id} value={g.id}>
              {g.nombre}
            </option>
          ))}
        </Select>
        <Select etiqueta="Estado" value={filtro.estado ?? ''} onChange={(e) => cambiar('estado', e.target.value)}>
          <option value="">Todos</option>
          <option value="REGISTRADO">Registrados</option>
          <option value="ANULADO">Anulados</option>
        </Select>
      </div>

      <PestanasVista opciones={opciones} activa={vista} cambiar={(v) => cambiar('vista', v)} etiqueta="Vistas de averías" />

      <div ref={contenido}>
        {vista === 'reportes' && (
          <div data-animar className="space-y-4">
            {reportes.isError && <Alerta tipo="error">{comoErrorApi(reportes.error).mensaje}</Alerta>}
            {reportes.isLoading ? (
              <PantallaCargando />
            ) : lista.length === 0 ? (
              <EstadoVacio
                Icono={IconoAveria}
                titulo="No hay reportes de averías en este rango"
                texto="Cambie las fechas o los filtros."
              />
            ) : (
              <LineaTiempo grupos={gruposReportes} />
            )}
          </div>
        )}
        {vista === 'indicador' && (
          <div data-animar>
            <IndicadorAverias desde={filtro.desde} hasta={filtro.hasta} />
          </div>
        )}
      </div>
    </section>
  )
}
