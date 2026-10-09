/**
 * TABLERO: RITMO DEL PERSONAL (/tableros/ritmo)
 * =============================================
 *
 * ¿Van adelantados, en línea o retrasados a esta hora? Es de UN día (por
 * hora), así que solo lleva el selector de día. El día en curso se
 * refresca como el tablero MFR.
 */

import { Alerta } from '../../../components/Alerta'
import { CifraEstado } from '../../../components/CifraEstado'
import { EncabezadoPagina } from '../../../components/EncabezadoPagina'
import { IconoReloj } from '../../../components/Iconos'
import { PantallaCargando } from '../../../components/PantallaCargando'
import { comoErrorApi } from '../../../services/http'
import { REFRESCO_TABLERO } from '../../../shared/refresco'
import { fechaCorta } from '../../../shared/utils/fechas'
import { unDecimal } from '../../mfr/components/indicadores/formatos'
import { VistaRitmo } from '../../mfr/components/indicadores/VistaRitmo'
import { useRitmoDia } from '../../mfr/hooks/useMfr'
import { TONO_RITMO } from '../../mfr/ritmo'
import { SelectorPeriodo } from '../SelectorPeriodo'
import { usePeriodoTablero } from '../usePeriodoTablero'

export function TableroRitmoPage() {
  const periodo = usePeriodoTablero()
  const ritmo = useRitmoDia(periodo.fecha, periodo.esHoy ? REFRESCO_TABLERO : undefined)
  const r = ritmo.data

  return (
    <section className="space-y-6">
      <EncabezadoPagina
        Icono={IconoReloj}
        escena="personas"
        titulo="Ritmo del personal"
        descripcion={`Lo producido hasta ahora frente a lo que el DPP esperaba a esta hora. En línea = ±5 %. Día operativo ${fechaCorta(periodo.fecha)}.`}
        acciones={<SelectorPeriodo estado={periodo} soloDia />}
      >
        <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
          <CifraEstado
            variante="vidrio"
            etiqueta="Desviación (%)"
            detalle="frente a lo esperado ahora"
            valor={r?.desviacionPorcentaje ?? null}
            tono={r ? TONO_RITMO[r.estado] : 'neutro'}
            formato={(n) => `${n > 0 ? '+' : n < 0 ? '−' : ''}${unDecimal(Math.abs(n))}`}
          />
          <CifraEstado variante="vidrio" etiqueta="Real" detalle="cajas creadas hasta ahora" valor={r?.realAhoraCajas ?? null} total={r?.metaCajas} tono="marca" />
          <CifraEstado variante="vidrio" etiqueta="Esperado" detalle="a esta hora" valor={r?.esperadoAhoraCajas ?? null} total={r?.metaCajas} tono="neutro" />
          <CifraEstado variante="vidrio" etiqueta="Meta del día" detalle="Σ de las metas del DPP" valor={r?.metaCajas ?? null} tono="acento" />
        </div>
      </EncabezadoPagina>

      {ritmo.isError && <Alerta tipo="error">{comoErrorApi(ritmo.error).mensaje}</Alerta>}
      {ritmo.isLoading && <PantallaCargando />}
      {r && <VistaRitmo ritmo={r} esHoy={periodo.esHoy} />}
    </section>
  )
}
