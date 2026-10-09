import { useState } from 'react'

import { Badge } from '../../../../components/Badge'
import { BarraProporcion } from '../../../../components/BarraProporcion'
import { Seccion } from '../../../../components/Seccion'
import { SelectorSegmentado } from '../../../../components/SelectorSegmentado'
import type { MedidaRitmo, RitmoDia } from '../../../../shared/types/mfr'
import { miles } from '../../../../shared/utils/numeros'
import { TEXTO_RITMO, TONO_RITMO } from '../../ritmo'
import { CurvaRitmo } from './CurvaRitmo'
import { unDecimal } from './formatos'

/** "+255 cajas" / "−40 cajas" frente a lo esperado. */
const diferencia = (n: number) => `${n > 0 ? '+' : n < 0 ? '−' : ''}${miles(Math.abs(n))} cajas`

/** Frase guía: qué significa el estado, en palabras del piso. */
function frase(m: MedidaRitmo): string {
  if (m.estado === 'SIN_DATO') return 'Todavía no hay nada esperado a esta hora.'
  if (m.estado === 'EN_LINEA') return 'Van al ritmo del DPP.'
  return m.estado === 'ADELANTADO'
    ? `Van ${miles(m.diferenciaCajas)} cajas por delante de lo esperado.`
    : `Faltan ${miles(-m.diferenciaCajas)} cajas para ir al ritmo del DPP.`
}

/**
 * RITMO DEL PERSONAL
 * ==================
 *
 * ¿Van adelantados, en línea o retrasados a esta hora? (usuario,
 * 2026-10-06). Lo real son las remisiones CREADAS hasta ahora; lo
 * esperado, el T de cada bloque repartido parejo en sus horas (las 7,5 h
 * del turno son productivas). En línea = ±5 %.
 */
export function VistaRitmo({ ritmo, esHoy }: { ritmo: RitmoDia; esHoy: boolean }) {
  const [serie, setSerie] = useState<string>('dia')
  const elegido = serie === 'dia' ? ritmo : (ritmo.porTurno.find((t) => t.turnoId === serie) ?? ritmo)
  const nombre = (turnoId: string) => ritmo.turnos[turnoId]?.nombre ?? turnoId

  return (
    <div className="space-y-8">
      {/* El día: estado grande y la frase que dice qué hacer. */}
      <div className="flex flex-wrap items-end gap-x-10 gap-y-3 border-b border-borde pb-6">
        <div>
          <p className="text-xs font-bold uppercase tracking-wider text-tinta-suave">{esHoy ? 'El día, ahora' : 'El día, al cierre'}</p>
          <div className="mt-2 flex items-center gap-3">
            <Badge tono={TONO_RITMO[ritmo.estado]} punto>
              {TEXTO_RITMO[ritmo.estado]}
            </Badge>
            {ritmo.desviacionPorcentaje !== null && (
              <span className={`cifra text-4xl font-black ${ritmo.estado === 'RETRASADO' ? 'text-critico' : 'text-tinta'}`}>
                {ritmo.desviacionPorcentaje > 0 ? '+' : ritmo.desviacionPorcentaje < 0 ? '−' : ''}
                {unDecimal(Math.abs(ritmo.desviacionPorcentaje))} %
              </span>
            )}
          </div>
        </div>
        <p className="max-w-md pb-1 text-sm text-tinta-suave">
          {frase(ritmo)} Real <span className="cifra font-bold text-tinta">{miles(ritmo.realAhoraCajas)}</span> de{' '}
          <span className="cifra font-bold text-tinta">{miles(ritmo.esperadoAhoraCajas)}</span> cajas esperadas.
        </p>
      </div>

      {/* Turnos en columnas abiertas. */}
      {ritmo.porTurno.length > 0 && (
        <div className="grid divide-borde border-y border-borde sm:grid-cols-2 lg:grid-cols-3 lg:divide-x">
          {ritmo.porTurno.map((t) => (
            <div key={t.turnoId} className="border-t-4 px-1 py-5 sm:px-5" style={{ borderTopColor: `var(--color-${TONO_RITMO[t.estado]})` }}>
              <div className="flex items-center justify-between gap-2">
                <p className="text-lg font-black text-tinta">{nombre(t.turnoId)}</p>
                <Badge tono={TONO_RITMO[t.estado]} punto={t.estado !== 'SIN_DATO'}>
                  {t.empezo ? TEXTO_RITMO[t.estado] : 'Aún no empieza'}
                </Badge>
              </div>
              <p className="mt-3">
                <span className="cifra text-3xl font-black leading-none text-tinta">{miles(t.realAhoraCajas)}</span>
                <span className="ml-1.5 text-sm text-tinta-suave">de {miles(t.esperadoAhoraCajas)} esperadas</span>
              </p>
              {t.empezo && t.estado !== 'SIN_DATO' && (
                <p className={`mt-1 text-sm font-bold ${t.diferenciaCajas < 0 ? 'text-critico' : 'text-tinta'}`}>{diferencia(t.diferenciaCajas)}</p>
              )}
              <div className="mt-3 space-y-1">
                <BarraProporcion
                  valor={t.realAhoraCajas}
                  total={t.metaCajas}
                  tono={TONO_RITMO[t.estado]}
                  descripcion={`${miles(t.realAhoraCajas)} de ${miles(t.metaCajas)} cajas de la meta del turno`}
                />
                <p className="text-xs text-tinta-suave">
                  Meta del turno: <span className="cifra font-semibold text-tinta">{miles(t.metaCajas)}</span> cajas
                </p>
              </div>
            </div>
          ))}
        </div>
      )}

      <Seccion
        titulo="Cajas acumuladas, hora por hora"
        descripcion="Si la línea azul va dentro de la franja verde, van en línea; por encima, adelantados; por debajo, retrasados."
        accion={
          <SelectorSegmentado
            etiqueta="Qué curva ver"
            opciones={[{ valor: 'dia', texto: 'Día' }, ...ritmo.porTurno.map((t) => ({ valor: t.turnoId, texto: ritmo.turnos[t.turnoId]?.codigo ?? t.turnoId }))]}
            activo={serie}
            cambiar={setSerie}
          />
        }
      >
        <CurvaRitmo serie={elegido.serie} tolerancia={ritmo.tolerancia} />
      </Seccion>
    </div>
  )
}
