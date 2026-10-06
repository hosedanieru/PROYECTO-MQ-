/**
 * INDICADOR DE AVERÍAS DEL PERIODO
 * ================================
 *
 * % de averías contra lo programado en el DPP (T), con el máximo de 1 %
 * del contrato. La barra muestra cuánto del límite se ha usado: llena =
 * se llegó al 1 %. Las alertas las calcula el backend (dominio); aquí
 * solo se muestran.
 *
 * Rediseño (usuario, 2026-10-05: fuera las tarjetas, la información se
 * veía saturada): arriba el porcentaje grande con su semáforo; debajo,
 * cada desglose (día, turno, grupo, PT) como BARRAS contra la línea del
 * límite en vez de tablas: se ve de un golpe quién lo pasó.
 */

import type { ReactNode } from 'react'

import { Alerta } from '../../../components/Alerta'
import { Badge, COLOR_TONO } from '../../../components/Badge'
import { BarraProgreso } from '../../../components/graficas/BarraProgreso'
import { PantallaCargando } from '../../../components/PantallaCargando'
import { Seccion } from '../../../components/Seccion'
import type { IndicadorAverias as Indicador, MedidaAverias } from '../../../shared/types/averia'
import { fechaCorta } from '../../../shared/utils/fechas'
import { miles, porcentaje } from '../../../shared/utils/numeros'
import { useGrupos, useTurnos } from '../../catalogo/hooks/useCatalogos'
import { useIndicadorAverias } from '../hooks/useAverias'

const pct = (v: number | null) => porcentaje(v, 'sin DPP', 2)

export function IndicadorAverias({ desde, hasta }: { desde: string; hasta: string }) {
  const indicador = useIndicadorAverias(desde, hasta)
  const turnos = useTurnos()
  const grupos = useGrupos()

  if (indicador.isLoading) return <PantallaCargando />
  if (!indicador.data) return null
  const i = indicador.data
  const usoDelLimite = i.total.porcentaje === null ? 0 : (i.total.porcentaje / i.maximoPorcentaje) * 100

  return (
    <div className="space-y-8">
      {/* Marcador: el porcentaje del periodo, grande, con su semáforo y el uso del límite. */}
      <div className="grid items-end gap-x-10 gap-y-5 border-b border-borde pb-6 lg:grid-cols-[auto_1fr]">
        <div>
          <p className="text-xs font-bold uppercase tracking-wider text-tinta-suave">Averías contra lo programado</p>
          <p className={`cifra mt-1 text-6xl font-black leading-none tracking-tight ${i.total.excede ? 'text-critico' : 'text-tinta'}`}>
            {pct(i.total.porcentaje)}
          </p>
          <div className="mt-3">
            <Semaforo medida={i.total} />
          </div>
        </div>
        <div className="space-y-2">
          <p className="text-sm text-tinta-suave">
            <span className="cifra font-bold text-tinta">{miles(i.total.averiadasUnidades)}</span> unidades averiadas de{' '}
            <span className="cifra font-bold text-tinta">{miles(i.total.programadoUnidades)}</span> programadas · periodo{' '}
            {fechaCorta(desde)} – {fechaCorta(hasta)}
            {i.bolsasSinConvertir > 0 && <span className="text-alerta"> · {i.bolsasSinConvertir} bolsa(s) sin convertir</span>}
          </p>
          <BarraProgreso
            valor={usoDelLimite}
            tono={i.total.excede ? 'critico' : usoDelLimite >= 80 ? 'alerta' : 'exito'}
            titulo="Uso del límite de averías"
          />
          <p className="text-xs text-tinta-suave">
            {Math.round(usoDelLimite)} % del límite del contrato usado (máximo {i.maximoPorcentaje} % de lo programado)
          </p>
        </div>
      </div>

      {i.alertas.map((a) => (
        <Alerta key={a} tipo="error">
          {a}
        </Alerta>
      ))}
      {i.productosSinUnidadesPorCaja.length > 0 && (
        <Alerta tipo="advertencia">
          PT del DPP sin unidades por caja (su programado no se sumó): {i.productosSinUnidadesPorCaja.join(', ')}.
        </Alerta>
      )}

      <div className="grid gap-x-10 gap-y-8 lg:grid-cols-2">
        <Desglose
          titulo="Por día operativo"
          indicador={i}
          filas={i.porDia.map((d) => ({ clave: d.fechaOperativa, nombre: fechaCorta(d.fechaOperativa), medida: d }))}
        />
        <Desglose
          titulo="Por turno"
          indicador={i}
          filas={i.porTurno.map((t) => ({
            clave: t.turnoId,
            nombre: turnos.data?.find((x) => x.id === t.turnoId)?.codigo ?? '—',
            medida: t,
          }))}
        />
        <Desglose
          titulo="Por operador MQ (grupo)"
          descripcion="Aporte de cada grupo al % del periodo, sobre el mismo DPP."
          indicador={i}
          filas={i.porGrupo.map((g) => ({
            clave: g.grupoId,
            nombre: grupos.data?.find((x) => x.id === g.grupoId)?.nombre ?? '—',
            // Aporte al % del periodo: el backend no le pone semáforo propio, así que va en azul.
            medida: { ...g, programadoUnidades: i.total.programadoUnidades },
          }))}
        />
        <Desglose
          titulo="Por PT"
          descripcion="Los que tuvieron averías."
          indicador={i}
          filas={i.porProducto
            .filter((p) => p.averiadasUnidades > 0)
            .map((p) => ({
              clave: p.productoId,
              nombre: p.descripcion,
              detalle: (
                <>
                  <span className="cifra">{p.codigo}</span>
                  {p.unidadesFueraDelDpp > 0 && (
                    <Badge tono="alerta" className="ml-2">
                      {miles(p.unidadesFueraDelDpp)} u. fuera del DPP del día
                    </Badge>
                  )}
                </>
              ),
              medida: p,
            }))}
        />
      </div>
    </div>
  )
}

function Semaforo({ medida }: { medida: MedidaAverias }) {
  if (medida.porcentaje === null) return <Badge tono="neutro">Sin DPP</Badge>
  return medida.excede ? (
    <Badge tono="critico" punto>
      Supera el 1 %
    </Badge>
  ) : (
    <Badge tono="exito" punto>
      Dentro del límite
    </Badge>
  )
}

interface FilaDesglose {
  clave: string
  nombre: string
  detalle?: ReactNode
  /** Sin `excede` = sin semáforo propio (aporte del grupo): barra azul. */
  medida: Pick<MedidaAverias, 'porcentaje' | 'averiadasUnidades' | 'programadoUnidades'> & { excede?: boolean }
}

/**
 * Un desglose como barras horizontales. Todas las barras de la sección
 * usan la misma escala, y una línea vertical marca el límite del
 * contrato: lo que la cruza, se pasó.
 */
function Desglose({
  titulo,
  descripcion,
  filas,
  indicador,
}: {
  titulo: string
  descripcion?: string
  filas: FilaDesglose[]
  indicador: Indicador
}) {
  const limite = indicador.maximoPorcentaje
  // Escala: el mayor valor o el doble del límite, lo que sea más grande, para que la línea del límite no quede pegada al borde.
  const escala = Math.max(limite * 2, ...filas.map((f) => f.medida.porcentaje ?? 0))
  const posLimite = (limite / escala) * 100
  const hayExceso = filas.some((f) => f.medida.excede)

  return (
    <Seccion titulo={titulo} contador={filas.length} descripcion={descripcion} tono={hayExceso ? 'critico' : 'exito'}>
      {filas.length === 0 ? (
        <p className="border-y border-borde py-4 text-sm text-tinta-suave">Sin averías en el periodo.</p>
      ) : (
        <ul className="divide-y divide-borde border-y border-borde">
          {filas.map((f) => {
            const tono = f.medida.excede === undefined ? 'marca' : f.medida.excede ? 'critico' : 'exito'
            const ancho = f.medida.porcentaje === null ? 0 : Math.min(100, (f.medida.porcentaje / escala) * 100)
            return (
              <li key={f.clave} className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-4 gap-y-1.5 py-3">
                <div className="min-w-0">
                  <p className="truncate text-sm font-bold text-tinta" title={f.nombre}>
                    {f.nombre}
                  </p>
                  {f.detalle && <div className="text-xs text-tinta-suave">{f.detalle}</div>}
                </div>
                <p className={`cifra text-right text-lg font-black ${f.medida.excede ? 'text-critico' : 'text-tinta'}`}>
                  {pct(f.medida.porcentaje)}
                </p>
                {/* Barra contra la línea del límite. */}
                <div className="relative col-span-2 h-2.5 rounded-full bg-velo" aria-hidden="true">
                  <div className="h-full rounded-full" style={{ width: `${ancho}%`, backgroundColor: COLOR_TONO[tono] }} />
                  <span
                    className="absolute -top-1 h-4.5 w-0.5 rounded-full bg-tinta"
                    style={{ left: `${posLimite}%` }}
                    title={`Límite del contrato: ${limite} %`}
                  />
                </div>
                <p className="col-span-2 text-xs text-tinta-suave">
                  <span className="cifra font-semibold text-tinta">{miles(f.medida.averiadasUnidades)}</span> u. averiadas
                  {f.medida.programadoUnidades > 0 && (
                    <>
                      {' '}
                      de <span className="cifra">{miles(f.medida.programadoUnidades)}</span> programadas
                    </>
                  )}
                </p>
              </li>
            )
          })}
        </ul>
      )}
    </Seccion>
  )
}
