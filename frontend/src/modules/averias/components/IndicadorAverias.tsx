/**
 * INDICADOR DE AVERÍAS DEL PERIODO
 * ================================
 *
 * % de averías contra lo programado en el DPP (T), con el máximo de 1 %
 * del contrato. La barra muestra cuánto del límite se ha usado: llena =
 * se llegó al 1 %. Las alertas las calcula el backend (dominio); aquí
 * solo se muestran.
 */

import { Alerta } from '../../../components/Alerta'
import { Badge } from '../../../components/Badge'
import { BarraProgreso } from '../../../components/graficas/BarraProgreso'
import { Tarjeta } from '../../../components/Tarjeta'
import type { MedidaAverias } from '../../../shared/types/averia'
import { fechaCorta } from '../../../shared/utils/fechas'
import { miles, porcentaje } from '../../../shared/utils/numeros'
import { useGrupos, useTurnos } from '../../catalogo/hooks/useCatalogos'
import { useIndicadorAverias } from '../hooks/useAverias'

const pct = (v: number | null) => porcentaje(v, 'sin DPP', 2)

export function IndicadorAverias({ desde, hasta }: { desde: string; hasta: string }) {
  const indicador = useIndicadorAverias(desde, hasta)
  const turnos = useTurnos()
  const grupos = useGrupos()

  if (!indicador.data) return null
  const i = indicador.data
  const usoDelLimite = i.total.porcentaje === null ? 0 : (i.total.porcentaje / i.maximoPorcentaje) * 100

  return (
    <div className="space-y-4">
      <Tarjeta
        titulo="Averías contra lo programado (DPP)"
        descripcion={`Máximo por contrato: ${i.maximoPorcentaje} % de lo programado. Periodo ${fechaCorta(desde)} – ${fechaCorta(hasta)}.`}
        accion={<Semaforo medida={i.total} />}
      >
        <div className="flex flex-wrap items-end gap-x-8 gap-y-2">
          <p className={`cifra text-4xl font-bold ${i.total.excede ? 'text-critico' : 'text-tinta'}`}>{pct(i.total.porcentaje)}</p>
          <p className="text-sm text-tinta-suave">
            {miles(i.total.averiadasUnidades)} unidades averiadas de {miles(i.total.programadoUnidades)} programadas
            {i.bolsasSinConvertir > 0 && <span className="text-alerta"> · {i.bolsasSinConvertir} bolsa(s) sin convertir</span>}
          </p>
        </div>
        <div className="mt-3 space-y-1">
          <BarraProgreso valor={usoDelLimite} tono={i.total.excede ? 'critico' : usoDelLimite >= 80 ? 'alerta' : 'exito'} titulo="Uso del límite de averías" />
          <p className="text-xs text-tinta-suave">{Math.round(usoDelLimite)} % del límite del contrato usado</p>
        </div>
      </Tarjeta>

      {i.alertas.map((a) => <Alerta key={a} tipo="error">{a}</Alerta>)}
      {i.productosSinUnidadesPorCaja.length > 0 && (
        <Alerta tipo="advertencia">
          Productos del DPP sin unidades por caja (su programado no se sumó): {i.productosSinUnidadesPorCaja.join(', ')}.
        </Alerta>
      )}

      <div className="grid gap-4 lg:grid-cols-2">
        <TablaMedidas
          titulo="Por día operativo"
          filas={i.porDia.map((d) => ({ clave: d.fechaOperativa, nombre: fechaCorta(d.fechaOperativa), ...d }))}
        />
        <TablaMedidas
          titulo="Por turno"
          filas={i.porTurno.map((t) => ({ clave: t.turnoId, nombre: turnos.data?.find((x) => x.id === t.turnoId)?.codigo ?? '—', ...t }))}
        />
        <Tarjeta titulo="Por operador MQ (grupo)" descripcion="Aporte de cada grupo al % del periodo, sobre el mismo DPP." sinRelleno>
          <table className="min-w-full text-sm">
            <tbody className="divide-y divide-borde">
              {i.porGrupo.map((g) => (
                <tr key={g.grupoId}>
                  <td className="px-5 py-2">{grupos.data?.find((x) => x.id === g.grupoId)?.nombre ?? '—'}</td>
                  <td className="px-5 py-2 text-right cifra">{miles(g.averiadasUnidades)} u.</td>
                  <td className="px-5 py-2 text-right cifra">{pct(g.porcentaje)}</td>
                </tr>
              ))}
              {i.porGrupo.length === 0 && <tr><td className="px-5 py-3 text-tinta-suave">Sin averías en el periodo.</td></tr>}
            </tbody>
          </table>
        </Tarjeta>
        <Tarjeta titulo="Por producto" descripcion="Los que tuvieron averías." sinRelleno>
          <table className="min-w-full text-sm">
            <tbody className="divide-y divide-borde">
              {i.porProducto.filter((p) => p.averiadasUnidades > 0).map((p) => (
                <tr key={p.productoId}>
                  <td className="px-5 py-2">
                    <span className="cifra">{p.codigo}</span> <span className="text-tinta-suave">{p.descripcion}</span>
                    {p.unidadesFueraDelDpp > 0 && (
                      <Badge tono="alerta" className="ml-2">{miles(p.unidadesFueraDelDpp)} u. fuera del DPP del día</Badge>
                    )}
                  </td>
                  <td className="px-5 py-2 text-right cifra">{miles(p.averiadasUnidades)} u.</td>
                  <td className={`px-5 py-2 text-right cifra ${p.excede ? 'text-critico font-semibold' : ''}`}>{pct(p.porcentaje)}</td>
                </tr>
              ))}
              {!i.porProducto.some((p) => p.averiadasUnidades > 0) && <tr><td className="px-5 py-3 text-tinta-suave">Sin averías en el periodo.</td></tr>}
            </tbody>
          </table>
        </Tarjeta>
      </div>
    </div>
  )
}

function Semaforo({ medida }: { medida: MedidaAverias }) {
  if (medida.porcentaje === null) return <Badge tono="neutro">Sin DPP</Badge>
  return medida.excede ? <Badge tono="critico" punto>Supera el 1 %</Badge> : <Badge tono="exito" punto>Dentro del límite</Badge>
}

function TablaMedidas({ titulo, filas }: { titulo: string; filas: Array<MedidaAverias & { clave: string; nombre: string }> }) {
  return (
    <Tarjeta titulo={titulo} sinRelleno>
      <table className="min-w-full text-sm">
        <thead className="bg-velo text-left text-xs uppercase text-tinta-suave">
          <tr>
            <th className="px-5 py-2"></th>
            <th className="px-5 py-2 text-right">Programado</th>
            <th className="px-5 py-2 text-right">Averiadas</th>
            <th className="px-5 py-2 text-right">%</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-borde">
          {filas.map((f) => (
            <tr key={f.clave} className={f.excede ? 'bg-critico-claro/50' : ''}>
              <td className="px-5 py-2 font-medium">{f.nombre}</td>
              <td className="px-5 py-2 text-right cifra">{miles(f.programadoUnidades)}</td>
              <td className="px-5 py-2 text-right cifra">{miles(f.averiadasUnidades)}</td>
              <td className={`px-5 py-2 text-right cifra ${f.excede ? 'font-semibold text-critico' : ''}`}>{pct(f.porcentaje)}</td>
            </tr>
          ))}
          {filas.length === 0 && <tr><td colSpan={4} className="px-5 py-3 text-tinta-suave">Sin datos en el periodo.</td></tr>}
        </tbody>
      </table>
    </Tarjeta>
  )
}
