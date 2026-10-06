/**
 * ALERTAS DE INVENTARIO (fase D)
 * ==============================
 *
 * Lo que pidió el usuario (2026-09-29): PT sin receta, componente
 * inactivo, agotado y "no alcanza para el DPP" del día operativo. Las
 * calcula el backend en el momento; aquí solo se agrupan y se enlaza a
 * donde se resuelve cada una. La fecha vive en la URL.
 */

import { Link, useSearchParams } from 'react-router-dom'

import { Alerta } from '../../../components/Alerta'
import { Badge } from '../../../components/Badge'
import { BarraProporcion } from '../../../components/BarraProporcion'
import { Boton } from '../../../components/Boton'
import { Campo } from '../../../components/Campo'
import { EstadoVacio } from '../../../components/EstadoVacio'
import { IconoInventario } from '../../../components/Iconos'
import { FilaRegistro, ListaRegistros, MetaDato } from '../../../components/ListaRegistros'
import { PantallaCargando } from '../../../components/PantallaCargando'
import { Seccion } from '../../../components/Seccion'
import { comoErrorApi } from '../../../services/http'
import type { AlertaInventario, TipoAlertaInventario } from '../../../shared/types/inventario'
import { fechaCorta, fechaOperativaDe } from '../../../shared/utils/fechas'
import { cantidad } from '../../../shared/utils/numeros'
import { useAlertasInventario } from '../hooks/useInventario'

const GRUPOS: Array<{ tipo: TipoAlertaInventario; titulo: string; descripcion: string }> = [
  { tipo: 'NO_ALCANZA_DPP', titulo: 'No alcanza para el DPP', descripcion: 'Lo que falta producir hoy (programado − aprobado) × receta, contra la existencia.' },
  { tipo: 'PT_SIN_RECETA', titulo: 'PT sin receta', descripcion: 'Sin receta no se puede aprobar su remisión. Crítico si está en el DPP del día.' },
  { tipo: 'AGOTADO', titulo: 'Agotados', descripcion: 'PI e insumos activos en cero. Crítico si alguna receta los usa.' },
  { tipo: 'COMPONENTE_INACTIVO', titulo: 'Recetas con componente inactivo', descripcion: 'La receta vigente usa un PI o insumo desactivado.' },
]

/** Dónde se resuelve: la receta en la pestaña PT; lo demás, en el kardex del ítem. */
const destino = (a: AlertaInventario) => (a.tipo === 'PT_SIN_RECETA' || a.tipo === 'COMPONENTE_INACTIVO' ? '/inventario/pt' : `/inventario/${a.itemId}`)

export function AlertasPage() {
  const [params, setParams] = useSearchParams()
  const fecha = params.get('fecha') ?? fechaOperativaDe(new Date())
  const consulta = useAlertasInventario(fecha)
  const alertas = consulta.data?.alertas ?? []
  const criticas = alertas.filter((a) => a.gravedad === 'CRITICA').length

  return (
    <section className="space-y-7">
      {/* Marcador: el total y las críticas en grande, la fecha a la mano. */}
      <div className="flex flex-wrap items-end justify-between gap-x-8 gap-y-4 border-b border-borde pb-5">
        <div className="flex flex-wrap items-end gap-x-10 gap-y-3">
          <Marcador valor={consulta.data ? alertas.length : null} etiqueta="alertas" color="text-tinta" />
          <Marcador valor={consulta.data ? criticas : null} etiqueta="críticas" color={criticas > 0 ? 'text-critico' : 'text-tinta-suave'} />
          <p className="max-w-md pb-1 text-sm text-tinta-suave">
            Calculadas en el momento con las existencias, las recetas vigentes y el DPP del {fechaCorta(fecha)}. Se actualizan solas.
          </p>
        </div>
        <div className="w-44">
          <Campo etiqueta="Día operativo" type="date" value={fecha} onChange={(e) => e.target.value && setParams({ fecha: e.target.value }, { replace: true })} />
        </div>
      </div>

      {consulta.isError && <Alerta tipo="error">{comoErrorApi(consulta.error).mensaje}</Alerta>}
      {consulta.data && !consulta.data.hayDpp && (
        <Alerta tipo="advertencia">Este día no tiene DPP cargado: no se puede calcular qué falta producir ni qué PT urgen.</Alerta>
      )}
      {consulta.isLoading && <PantallaCargando />}
      {consulta.data && alertas.length === 0 && (
        <EstadoVacio Icono={IconoInventario} titulo="Sin alertas de inventario" texto="Para este día no hay agotados, PT sin receta ni faltantes frente al DPP." />
      )}

      {GRUPOS.map((g) => {
        const delGrupo = alertas.filter((a) => a.tipo === g.tipo)
        if (delGrupo.length === 0) return null
        const hayCritica = delGrupo.some((a) => a.gravedad === 'CRITICA')
        return (
          <Seccion key={g.tipo} titulo={g.titulo} contador={delGrupo.length} descripcion={g.descripcion} tono={hayCritica ? 'critico' : 'alerta'}>
            <ListaRegistros>
              {delGrupo.map((a) => {
                const critica = a.gravedad === 'CRITICA'
                return (
                  <FilaRegistro
                    key={`${a.tipo}-${a.itemId}-${a.mensaje}`}
                    tono={critica ? 'critico' : 'alerta'}
                    etiqueta={<Badge tono={critica ? 'critico' : 'alerta'}>{critica ? 'Crítica' : 'Advertencia'}</Badge>}
                    titulo={a.descripcion}
                    detalle={
                      <>
                        <span className="cifra">{a.codigo}</span> · {a.mensaje}
                      </>
                    }
                    meta={
                      a.falta !== undefined && (
                        <>
                          <MetaDato etiqueta="Necesita">{cantidad(a.necesita!)}</MetaDato>
                          <MetaDato etiqueta="Hay">{cantidad(a.hay!)}</MetaDato>
                        </>
                      )
                    }
                    pie={
                      a.falta !== undefined && (
                        <BarraProporcion
                          valor={a.hay!}
                          total={a.necesita!}
                          tono={critica ? 'critico' : 'alerta'}
                          descripcion={`Hay ${cantidad(a.hay!)} de ${cantidad(a.necesita!)} necesarios`}
                        />
                      )
                    }
                    cifra={a.falta !== undefined ? cantidad(a.falta) : undefined}
                    unidad={a.falta !== undefined ? a.unidad : undefined}
                    notaCifra={a.falta !== undefined ? 'faltan' : undefined}
                    colorCifra="text-critico"
                    acciones={
                      <Link to={destino(a)}>
                        <Boton variante="sutil" tamano="sm">
                          {a.tipo === 'PT_SIN_RECETA' || a.tipo === 'COMPONENTE_INACTIVO' ? 'Ir a la receta →' : 'Ver kardex →'}
                        </Boton>
                      </Link>
                    }
                  />
                )
              })}
            </ListaRegistros>
          </Seccion>
        )
      })}
    </section>
  )
}

/** Cifra grande del marcador superior. `null` = todavía no hay dato: se escribe "—", no un cero. */
function Marcador({ valor, etiqueta, color }: { valor: number | null; etiqueta: string; color: string }) {
  return (
    <p className="flex items-baseline gap-2">
      <span className={`cifra text-5xl font-black leading-none tracking-tight ${valor === null ? 'text-tinta-suave' : color}`}>
        {valor ?? '—'}
      </span>
      <span className="text-sm font-bold uppercase tracking-wider text-tinta-suave">{etiqueta}</span>
    </p>
  )
}
