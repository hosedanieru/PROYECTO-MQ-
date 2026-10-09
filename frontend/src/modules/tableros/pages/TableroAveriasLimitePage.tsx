/**
 * TABLERO: AVERÍAS, LÍMITE DEL 1 % (/tableros/averias-limite)
 * ===========================================================
 *
 * El indicador del contrato con PepsiCo: averías contra lo programado en
 * el DPP, con el máximo de 1 %. Antes era una pestaña dentro de Averías;
 * salió de ahí para no mezclar estadística con los reportes (usuario,
 * 2026-10-06). El cálculo no cambió (`IndicadorAverias`).
 */

import { EncabezadoPagina } from '../../../components/EncabezadoPagina'
import { IconoAveria } from '../../../components/Iconos'
import { IndicadorAverias } from '../../averias/components/IndicadorAverias'
import { descripcionPeriodo } from '../descripcionPeriodo'
import { SelectorPeriodo } from '../SelectorPeriodo'
import { usePeriodoTablero } from '../usePeriodoTablero'

export function TableroAveriasLimitePage() {
  const periodo = usePeriodoTablero()
  return (
    <section className="space-y-6">
      <EncabezadoPagina
        Icono={IconoAveria}
        escena="averia"
        titulo="Averías · límite del 1 %"
        descripcion={`Averías contra lo programado en el DPP; el contrato permite hasta el 1 %. ${descripcionPeriodo(periodo)}`}
        acciones={<SelectorPeriodo estado={periodo} />}
      />
      <IndicadorAverias desde={periodo.desde} hasta={periodo.hasta} />
    </section>
  )
}
