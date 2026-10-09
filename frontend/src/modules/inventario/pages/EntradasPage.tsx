/**
 * ENTRADAS DE MERCANCÍA — LISTADO
 * ===============================
 *
 * Por rango de días operativos (en la URL; por defecto los últimos 7).
 */

import { Link, useSearchParams } from 'react-router-dom'

import { Alerta } from '../../../components/Alerta'
import { Boton } from '../../../components/Boton'
import { Campo } from '../../../components/Campo'
import { EstadoVacio } from '../../../components/EstadoVacio'
import { IconoCaja } from '../../../components/Iconos'
import { LineaTiempo, type GrupoTiempo } from '../../../components/LineaTiempo'
import { MetaDato } from '../../../components/ListaRegistros'
import { PantallaCargando } from '../../../components/PantallaCargando'
import { Seccion } from '../../../components/Seccion'
import { comoErrorApi } from '../../../services/http'
import { agruparEnOrden } from '../../../shared/utils/agrupar'
import { diaLargo, fechaOperativaDe, hora } from '../../../shared/utils/fechas'
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

  const lista = entradas.data ?? []
  const grupos: GrupoTiempo[] = agruparEnOrden(lista, (e) => e.fechaOperativa.slice(0, 10)).map((g): GrupoTiempo => ({
    clave: g.clave,
    titulo: diaLargo(g.clave),
    resumen: `${g.elementos.length} ${g.elementos.length === 1 ? 'entrada' : 'entradas'}`,
    eventos: g.elementos.map((e) => ({
      clave: e.id,
      tono: 'exito',
      contenido: (
        <div className="flex flex-wrap items-start justify-between gap-x-6 gap-y-2">
          <div className="min-w-0 flex-1 basis-64">
            <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
              <span className="cifra text-sm font-bold text-tinta">{hora(e.fechaHoraRegistro)}</span>
              <span className="text-[1rem] font-bold text-tinta">{e.documento}</span>
            </div>
            <div className="mt-1.5 flex flex-wrap gap-x-4 gap-y-1 text-xs text-tinta-suave">
              <MetaDato etiqueta="Turno">{turnos.data?.find((t) => t.id === e.turnoId)?.codigo ?? '—'}</MetaDato>
              <MetaDato etiqueta="Entregó">{e.remitente ?? '—'}</MetaDato>
              <MetaDato etiqueta="Recibió">{e.usuarioNombre}</MetaDato>
            </div>
          </div>
          <Link to={`/inventario/entradas/${e.id}`}>
            <Boton variante="sutil" tamano="sm">
              Ver detalle →
            </Boton>
          </Link>
        </div>
      ),
    })),
  }))

  return (
    <section className="space-y-6">
      <div className="flex flex-wrap items-end gap-4">
        <div className="w-44">
          <Campo etiqueta="Desde (día operativo)" type="date" value={desde} onChange={(e) => cambiar('desde', e.target.value)} />
        </div>
        <div className="w-44">
          <Campo etiqueta="Hasta" type="date" value={hasta} onChange={(e) => cambiar('hasta', e.target.value)} />
        </div>
        <div className="flex-1" />
        {tienePermiso('inventario.registrar') && (
          <Link to="/inventario/entradas/nueva">
            <Boton>+ Nueva entrada</Boton>
          </Link>
        )}
      </div>

      {entradas.isError && <Alerta tipo="error">{comoErrorApi(entradas.error).mensaje}</Alerta>}

      <Seccion
        titulo="Entradas de mercancía"
        contador={entradas.data ? lista.length : undefined}
        descripcion="Lo que ha llegado a la planta, por documento de soporte, día por día."
      >
        {entradas.isLoading ? (
          <PantallaCargando />
        ) : lista.length === 0 ? (
          <EstadoVacio
            Icono={IconoCaja}
            titulo="No hay entradas en este rango"
            texto="Amplíe las fechas, o registre la mercancía que acaba de llegar."
          />
        ) : (
          <LineaTiempo grupos={grupos} />
        )}
      </Seccion>
    </section>
  )
}
