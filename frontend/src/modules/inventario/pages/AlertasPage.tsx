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
import { Campo } from '../../../components/Campo'
import { Tarjeta } from '../../../components/Tarjeta'
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
    <section className="space-y-4">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <p className="max-w-2xl text-sm text-tinta-suave">
          Se calculan en el momento con las existencias, las recetas vigentes y el DPP del día operativo {fechaCorta(fecha)}. Se actualizan solas.
        </p>
        <div className="w-44">
          <Campo etiqueta="Día operativo" type="date" value={fecha} onChange={(e) => e.target.value && setParams({ fecha: e.target.value }, { replace: true })} />
        </div>
      </header>

      {consulta.isError && <Alerta tipo="error">{comoErrorApi(consulta.error).mensaje}</Alerta>}
      {consulta.data && !consulta.data.hayDpp && (
        <Alerta tipo="advertencia">Este día no tiene DPP cargado: no se puede calcular qué falta producir ni qué PT urgen.</Alerta>
      )}
      {consulta.data && alertas.length === 0 && <Alerta tipo="exito">Sin alertas de inventario para este día.</Alerta>}
      {alertas.length > 0 && (
        <p className="text-sm text-tinta">
          <strong>{alertas.length}</strong> alerta(s), <strong className="text-critico">{criticas}</strong> crítica(s).
        </p>
      )}

      {GRUPOS.map((g) => {
        const delGrupo = alertas.filter((a) => a.tipo === g.tipo)
        if (delGrupo.length === 0) return null
        return (
          <Tarjeta key={g.tipo} titulo={`${g.titulo} (${delGrupo.length})`} descripcion={g.descripcion} sinRelleno>
            <ul className="divide-y divide-borde">
              {delGrupo.map((a) => (
                <li key={`${a.tipo}-${a.itemId}-${a.mensaje}`} className="flex flex-wrap items-start gap-3 px-5 py-3 text-sm">
                  <Badge tono={a.gravedad === 'CRITICA' ? 'critico' : 'alerta'}>{a.gravedad === 'CRITICA' ? 'Crítica' : 'Advertencia'}</Badge>
                  <div className="min-w-0 flex-1">
                    <p>
                      <span className="cifra font-medium text-tinta">{a.codigo}</span> <span className="text-tinta-suave">{a.descripcion}</span>
                    </p>
                    <p className="text-tinta-suave">{a.mensaje}</p>
                    {a.falta !== undefined && (
                      <p className="mt-1 text-xs text-tinta-suave">
                        Necesita <span className="cifra">{cantidad(a.necesita!)}</span> · hay <span className="cifra">{cantidad(a.hay!)}</span> ·{' '}
                        <span className="cifra font-semibold text-critico">faltan {cantidad(a.falta)} {a.unidad}</span>
                      </p>
                    )}
                  </div>
                  <Link to={destino(a)} className="whitespace-nowrap text-marca hover:underline">
                    {a.tipo === 'PT_SIN_RECETA' || a.tipo === 'COMPONENTE_INACTIVO' ? 'Ir a la receta' : 'Ver kardex'}
                  </Link>
                </li>
              ))}
            </ul>
          </Tarjeta>
        )
      })}
    </section>
  )
}
