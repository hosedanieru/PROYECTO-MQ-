import { COLOR_TONO } from '../../../components/Badge'
import { BarrasComparadas } from '../../../components/graficas/BarrasComparadas'
import { MedidorZonas } from '../../../components/graficas/MedidorZonas'
import {
  IconoAveria,
  IconoCaja,
  IconoIndicadores,
  IconoLista,
  IconoPersonas,
  IconoPlanta,
  IconoReloj,
  IconoTablero,
} from '../../../components/Iconos'
import { PanelIndicador } from '../../../components/PanelIndicador'
import { TarjetaIndicador } from '../../../components/TarjetaIndicador'
import { motion, RESORTE_GRAFICA } from '../../../shared/animacion/movimiento'
import type { Producto } from '../../../shared/types/catalogo'
import type { IndicadoresDia } from '../../../shared/types/mfr'
import { miles, porcentaje, proporcion } from '../../../shared/utils/numeros'
import { cortesSemaforo, textoSemaforo, tonoSemaforo } from '../semaforo'

interface Props {
  datos: IndicadoresDia
  productos: Producto[] | undefined
  /** Unidades averiadas del día (indicador de averías); `null` mientras carga o si falla. */
  averiadasUnidades: number | null
}

/** Cuántos PT se muestran en las barras y en "más atrasados" (el detalle completo está en la vista "Por PT"). */
const MAXIMO_FILAS = 10
const MAXIMO_ATRASADOS = 5

/** Cajas que faltan por PT, sumadas: lo que sobra de un PT no tapa lo que falta de otro. */
function cajasFaltantes(mfr: IndicadoresDia['mfr']): number {
  return mfr.porProducto.reduce((s, p) => s + Math.max(0, p.programadoCajas - p.producidoCajas), 0)
}

/** La frase guía: qué falta para llegar a la meta. */
function fraseGuia(mfr: IndicadoresDia['mfr'], meta: number): string {
  if (mfr.programadoCajas === 0) return 'Sin DPP cargado: no hay contra qué medir.'
  const necesarias = Math.ceil((mfr.programadoCajas * meta) / 100)
  const faltan = necesarias - mfr.producidoCajas
  if (faltan <= 0) return `Meta alcanzada: ${miles(mfr.producidoCajas)} cajas aprobadas de ${miles(mfr.programadoCajas)}.`
  return `Para llegar al ${meta} % faltan ${miles(faltan)} cajas aprobadas por el OPA.`
}

/**
 * RESUMEN DEL DÍA — "Dashboard control de producción MFR MQ"
 * ==========================================================
 *
 * Réplica del tablero diario de Power BI del área (`MQ VISUAL J3.pdf`,
 * pág. 5; usuario, 2026-10-07): cinco tarjetas de color y, debajo, avance
 * del plan, cumplimiento por producto, cumplimiento general (medio arco
 * con aguja), los PT más atrasados y el personal por turno.
 *
 * Diferencias con el PDF, a propósito:
 * - Semáforo del sistema (≥ 95 / ≥ 85 / < 85; usuario, 2026-10-08), no
 *   las escalas del PDF.
 * - "Faltante" suma lo que falta PT por PT (lo que sobra de uno no tapa lo
 *   que falta de otro); el PDF resta los totales.
 * - Se conservan "fuera del DPP" y "emergencia", que el PDF no tiene.
 */
export function ResumenDiaMfr({ datos, productos, averiadasUnidades }: Props) {
  const { mfr, meta } = datos
  const faltan = cajasFaltantes(mfr)
  const descripcion = (id: string) => productos?.find((p) => p.id === id)?.descripcion ?? 'PT fuera del catálogo'
  const tono = tonoSemaforo(mfr.semaforo)
  const avance = Math.min(mfr.cumplimiento ?? 0, 100)

  const programados = mfr.porProducto.filter((p) => p.programadoCajas > 0)
  const porVolumen = [...programados].sort((a, b) => b.programadoCajas - a.programadoCajas)
  const atrasados = [...programados]
    .filter((p) => (p.cumplimiento ?? 0) < meta)
    .sort((a, b) => (a.cumplimiento ?? 0) - (b.cumplimiento ?? 0))
    .slice(0, MAXIMO_ATRASADOS)
  const fueraDelDpp = mfr.producidoSinProgramar.reduce((s, p) => s + p.cajas, 0)
  const cortes = cortesSemaforo(meta)

  return (
    <div className="space-y-5">
      {/* ---------- Tarjetas ---------- */}
      {/* Las cinco en una fila desde 1280 px, como el tablero del área. */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
        <TarjetaIndicador etiqueta="Programado" unidad="CJ" valor={mfr.programadoCajas} Icono={IconoLista} tono="marca" nota="cajas en el DPP (T)" />
        <TarjetaIndicador
          etiqueta="Fabricado"
          unidad="CJ"
          valor={mfr.producidoCajas}
          Icono={IconoPlanta}
          tono="exito"
          nota={`${porcentaje(proporcion(mfr.producidoCajas, mfr.programadoCajas))} del programado`}
        />
        <TarjetaIndicador
          etiqueta="Faltante"
          unidad="CJ"
          // En negativo, como el tablero del área: es lo que le falta a lo fabricado para llegar.
          valor={faltan === 0 ? 0 : -faltan}
          Icono={IconoReloj}
          tono="alerta"
          nota={`${porcentaje(proporcion(faltan, mfr.programadoCajas))} del programado`}
        />
        <TarjetaIndicador
          etiqueta="Personas"
          valor={datos.personal.llegaronDia}
          Icono={IconoPersonas}
          tono="marca"
          nota={datos.personal.esperadasDia > 0 ? `de ${miles(datos.personal.esperadasDia)} esperadas en el día` : 'sin asistencia registrada'}
        />
        <TarjetaIndicador
          etiqueta="Averías"
          unidad="UND"
          valor={averiadasUnidades}
          Icono={IconoAveria}
          tono="critico"
          nota="unidades reportadas en el día"
        />
      </div>

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)]">
        {/* ---------- Columna izquierda ---------- */}
        <div className="space-y-5">
          <PanelIndicador titulo="Avance del plan del día" Icono={IconoIndicadores}>
            <div className="flex flex-wrap items-end justify-between gap-4">
              <div>
                <p className="cifra text-5xl font-black leading-none tracking-tight text-tinta">{porcentaje(mfr.cumplimiento)}</p>
                <p className="mt-2 flex items-center gap-2 text-sm font-bold text-tinta">
                  <span className="h-3 w-3 rounded-full" style={{ backgroundColor: COLOR_TONO[tono] }} aria-hidden="true" />
                  {textoSemaforo(mfr.semaforo)}
                </p>
              </div>
              <p className="text-right text-sm text-tinta-suave">
                Fabricado <span className="cifra font-bold text-tinta">{miles(mfr.producidoCajas)}</span>
                <br />
                Meta <span className="cifra font-bold text-tinta">{miles(mfr.programadoCajas)}</span> cajas
              </p>
            </div>
            {/* Pista = lo programado; relleno = lo fabricado; raya = la meta. */}
            <div
              className="relative mt-4 h-4 rounded-full bg-velo"
              role="progressbar"
              aria-valuenow={Math.round(avance)}
              aria-valuemin={0}
              aria-valuemax={100}
              aria-label={`Avance del plan: ${porcentaje(mfr.cumplimiento)}, meta ${meta} %`}
            >
              <motion.span
                className="absolute inset-y-0 left-0 rounded-full"
                style={{ backgroundColor: COLOR_TONO[tono] }}
                initial={{ width: '0%' }}
                animate={{ width: `${avance}%` }}
                transition={RESORTE_GRAFICA}
              />
              <span className="absolute -inset-y-1.5 w-1 rounded-full bg-tinta" style={{ left: `${meta}%` }} aria-hidden="true" />
            </div>
            <p className="mt-3 text-sm text-tinta-suave">{fraseGuia(mfr, meta)}</p>
            {(fueraDelDpp > 0 || mfr.extraoficialesCajas > 0) && (
              <p className="mt-2 text-xs text-tinta-suave">
                No cuentan para el cumplimiento: <span className="cifra font-bold text-tinta">{miles(fueraDelDpp)}</span> cajas fuera
                del DPP y <span className="cifra font-bold text-acento">{miles(mfr.extraoficialesCajas)}</span> de emergencia
                (extraoficiales).
              </p>
            )}
          </PanelIndicador>

          <PanelIndicador titulo="Cumplimiento por producto" Icono={IconoCaja}>
            <BarrasComparadas
              titulo="Cajas programadas contra fabricadas por PT"
              nombres={{ referencia: 'Programado (CJ)', valor: 'Fabricado (CJ)' }}
              filas={porVolumen.slice(0, MAXIMO_FILAS).map((p) => ({
                clave: p.productoId,
                etiqueta: descripcion(p.productoId),
                referencia: p.programadoCajas,
                valor: p.producidoCajas,
              }))}
            />
            {porVolumen.length > MAXIMO_FILAS && (
              <p className="mt-3 text-xs text-tinta-suave">
                Los {MAXIMO_FILAS} PT con más cajas programadas de {porVolumen.length}. El resto, en la vista "Por PT".
              </p>
            )}
          </PanelIndicador>
        </div>

        {/* ---------- Columna derecha ---------- */}
        <div className="space-y-5">
          <PanelIndicador titulo="Cumplimiento general" Icono={IconoTablero}>
            <MedidorZonas
              valor={mfr.cumplimiento}
              cortes={cortes}
              titulo={`Cumplimiento general: ${porcentaje(mfr.cumplimiento)}; verde desde ${cortes.verde} %, amarillo desde ${cortes.amarillo} %`}
            />
            <ul className="mt-2 flex flex-wrap justify-center gap-x-5 gap-y-1 text-xs text-tinta-suave">
              <li className="flex items-center gap-1.5">
                <span className="h-2.5 w-2.5 rounded-full bg-exito" aria-hidden="true" />≥ {cortes.verde} % cumple
              </li>
              <li className="flex items-center gap-1.5">
                <span className="h-2.5 w-2.5 rounded-full bg-alerta" aria-hidden="true" />
                {cortes.amarillo}–{cortes.verde - 1} % cerca de la meta
              </li>
              <li className="flex items-center gap-1.5">
                <span className="h-2.5 w-2.5 rounded-full bg-critico" aria-hidden="true" />
                &lt; {cortes.amarillo} % bajo la meta
              </li>
            </ul>
          </PanelIndicador>

          <PanelIndicador titulo="Productos más atrasados" Icono={IconoAveria}>
            {atrasados.length === 0 ? (
              <p className="py-4 text-sm text-tinta-suave">Todos los PT van en la meta o por encima.</p>
            ) : (
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-borde text-left text-xs font-bold uppercase tracking-wider text-tinta-suave">
                    <th className="pb-2 font-bold">Descripción</th>
                    <th className="pb-2 text-right font-bold">Cumplimiento</th>
                    <th className="pb-2 pl-3 font-bold">Estado</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-borde">
                  {atrasados.map((p) => (
                    <tr key={p.productoId}>
                      <td className="max-w-0 truncate py-2 pr-3 text-tinta" title={descripcion(p.productoId)}>
                        {descripcion(p.productoId)}
                      </td>
                      <td className="cifra py-2 text-right font-bold text-tinta">{porcentaje(p.cumplimiento)}</td>
                      <td className="whitespace-nowrap py-2 pl-3 text-tinta">
                        <span className="mr-1.5 inline-block h-2.5 w-2.5 rounded-full" style={{ backgroundColor: COLOR_TONO[tonoSemaforo(p.semaforo)] }} aria-hidden="true" />
                        {textoSemaforo(p.semaforo)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </PanelIndicador>

          <PanelIndicador titulo="Personal por turno" Icono={IconoPersonas}>
            <ul className="grid grid-cols-3 gap-3 text-center">
              {datos.turnos.map((t) => (
                <li key={t.turnoId} className="rounded-xl bg-marca-claro px-2 py-3">
                  <IconoPersonas className="mx-auto h-7 w-7 text-marca" aria-hidden="true" />
                  <p className="cifra mt-1 text-2xl font-black text-tinta">{t.personal.llegaron}</p>
                  <p className="text-xs font-bold text-tinta">{t.nombre}</p>
                  <p className="text-xs text-tinta-suave">
                    {t.personal.requeridasDpp > 0 ? `de ${t.personal.requeridasDpp} que pide el DPP` : 'sin dato del DPP'}
                  </p>
                </li>
              ))}
            </ul>
          </PanelIndicador>
        </div>
      </div>
    </div>
  )
}
