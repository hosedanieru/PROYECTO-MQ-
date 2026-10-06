/**
 * TABLERO MFR DEL DÍA
 * ===================
 *
 * Lo que un coordinador lee al empezar y al cerrar la jornada.
 *
 * Arriba, la banda responde "¿vamos bien?": medidor contra la meta,
 * frase que dice cuánto falta y las cifras del día.
 *
 * Debajo, "una vista a la vez" (decisión del usuario 2026-10-05: fuera
 * las tarjetas). Cuatro pestañas grandes con un resumen vivo y cada
 * vista a todo el ancho, sin cajas:
 *
 *   Turnos   → una columna abierta por turno, separadas por líneas
 *   Por PT   → ranking, primero lo que más falta
 *   Kilos    → la curva del día: CUÁNDO se perdió producción
 *   Líneas   → mapa de calor línea (o familia) × hora: DÓNDE
 *
 * La vista vive en la URL (`?vista=`), como los filtros: se comparte y
 * sobrevive a recargar.
 *
 * REGLA DE VOCABULARIO (2026-09-23): el nombre va en español y la sigla
 * del DPP (T, Mx, E, "Target Kilograms"…) queda al lado, en pequeño.
 */

import { useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'

import { Alerta } from '../../../components/Alerta'
import { BarraVista } from '../../../components/BarraVista'
import { Boton } from '../../../components/Boton'
import { CifraEstado } from '../../../components/CifraEstado'
import { EncabezadoPagina } from '../../../components/EncabezadoPagina'
import { EstadoVacio } from '../../../components/EstadoVacio'
import { Medidor } from '../../../components/graficas/Medidor'
import { IconoBalanza, IconoCaja, IconoLinea, IconoReloj, IconoTablero } from '../../../components/Iconos'
import { PantallaCargando } from '../../../components/PantallaCargando'
import { PestanasVista, type OpcionVista } from '../../../components/PestanasVista'
import { comoErrorApi } from '../../../services/http'
import { useAparecer } from '../../../shared/animacion/useAnimacion'
import type { FilaHoraria, IndicadoresDia } from '../../../shared/types/mfr'
import { miles } from '../../../shared/utils/numeros'
import { useSesion } from '../../auth/useSesion'
import { useProductos } from '../../catalogo/hooks/useCatalogos'
import { ColumnaTurno } from '../components/ColumnaTurno'
import { CurvaDia } from '../components/CurvaDia'
import { RankingPt } from '../components/RankingPt'
import { SelectorFecha } from '../components/SelectorFecha'
import { TablaHoraria } from '../components/TablaHoraria'
import { useFechaOperativa } from '../hooks/useFechaOperativa'
import { useIndicadoresDia } from '../hooks/useMfr'
import { resumenKilos, resumenPt, resumenTurnos } from '../resumen-vistas'
import { textoSemaforo, tonoSemaforo } from '../semaforo'

/**
 * Las cuatro filas que el DPP de PepsiCo trae por línea y hora. El
 * nombre va en español y debajo queda el del documento original, para
 * poder cotejar sin traducir de cabeza.
 */
type Serie = keyof Pick<FilaHoraria, 'targetKg' | 'instantKg' | 'capacidadKg' | 'overpull'>
const SERIES: Array<{
  clave: Serie
  etiqueta: string
  enElDpp: string
  explicacion: string
  sufijo: string
}> = [
  {
    clave: 'targetKg',
    etiqueta: 'Kilos de meta',
    enElDpp: 'Target Kilograms',
    explicacion: 'Lo que PepsiCo espera que salga de cada línea en cada hora.',
    sufijo: '',
  },
  {
    clave: 'instantKg',
    etiqueta: 'Kilos producidos',
    enElDpp: 'Instant Kilograms',
    explicacion: 'Lo que realmente salió, repartido en las horas del bloque.',
    sufijo: '',
  },
  {
    clave: 'capacidadKg',
    etiqueta: 'Capacidad de la línea',
    enElDpp: 'Capacity',
    explicacion: 'El máximo que la máquina puede dar en una hora, sin importar lo programado.',
    sufijo: '',
  },
  {
    clave: 'overpull',
    etiqueta: 'Sobreproducción',
    enElDpp: 'Pct Overpull',
    explicacion: 'Cuánto se pasó (o faltó) frente a la meta de esa hora, en porcentaje.',
    sufijo: '%',
  },
]

type Vista = 'turnos' | 'pt' | 'kilos' | 'lineas'
const VISTAS: Vista[] = ['turnos', 'pt', 'kilos', 'lineas']

/** Cajas que faltan por PT, sumadas: lo que sobra de un PT no tapa lo que falta de otro. */
function cajasFaltantes(mfr: IndicadoresDia['mfr']): number {
  return mfr.porProducto.reduce((s, p) => s + Math.max(0, p.programadoCajas - p.producidoCajas), 0)
}

/** La frase guía junto al medidor: qué falta para llegar a la meta. */
function fraseGuia(mfr: IndicadoresDia['mfr'], meta: number): string {
  if (mfr.programadoCajas === 0) return 'Sin DPP cargado: no hay contra qué medir.'
  const necesarias = Math.ceil((mfr.programadoCajas * meta) / 100)
  const faltan = necesarias - mfr.producidoCajas
  if (faltan <= 0)
    return `Meta alcanzada: ${miles(mfr.producidoCajas)} cajas aprobadas de ${miles(mfr.programadoCajas)}.`
  return `Para llegar al ${meta} % faltan ${miles(faltan)} cajas aprobadas por el OPA.`
}

export function TableroMfrPage() {
  const [fecha, setFecha] = useFechaOperativa()
  const [params, setParams] = useSearchParams()
  const { tienePermiso } = useSesion()
  const dia = useIndicadoresDia(fecha)
  const productos = useProductos()

  const vista: Vista = VISTAS.includes(params.get('vista') as Vista)
    ? (params.get('vista') as Vista)
    : 'turnos'
  const cambiarVista = (v: Vista) => {
    const siguiente = new URLSearchParams(params)
    siguiente.set('vista', v)
    setParams(siguiente, { replace: true })
  }
  // La vista entra con su animación al cambiar de pestaña o de día.
  const contenido = useAparecer<HTMLDivElement>(`${fecha}|${vista}|${dia.isSuccess}`)

  const datos = dia.data
  const mfr = datos?.mfr
  const sinDpp = datos !== undefined && datos.bloques.length === 0

  const opciones: OpcionVista<Vista>[] = datos
    ? [
        {
          clave: 'turnos',
          titulo: 'Turnos',
          Icono: IconoReloj,
          resumen: resumenTurnos(datos.turnos, datos.meta),
        },
        {
          clave: 'pt',
          titulo: 'Por PT',
          Icono: IconoCaja,
          resumen: resumenPt(datos.mfr, datos.meta),
          tono: tonoSemaforo(datos.mfr.semaforo),
        },
        {
          clave: 'kilos',
          titulo: 'Kilos',
          Icono: IconoBalanza,
          resumen: resumenKilos(datos.horario),
        },
        {
          clave: 'lineas',
          titulo: 'Líneas',
          Icono: IconoLinea,
          resumen: `${datos.lineas.filter((l) => l.bloques.length > 0).length} líneas con bloques`,
        },
      ]
    : []

  return (
    <section className="space-y-6">
      <EncabezadoPagina
        Icono={IconoTablero}
        escena="produccion"
        titulo="Cumplimiento del día"
        descripcion={
          <>
            Cuánto se produjo frente a lo que PepsiCo programó en el DPP. Solo cuentan las remisiones{' '}
            <strong className="font-semibold text-white">aprobadas por el OPA</strong>.
          </>
        }
        acciones={
          <>
            <SelectorFecha fecha={fecha} onCambiar={setFecha} variante="vidrio" />
            {tienePermiso('mfr.consultar') && (
              <Link to={`/mfr/programacion?fecha=${fecha}`}>
                <Boton variante="vidrio">Programación</Boton>
              </Link>
            )}
            <Link to="/mfr/tv" title="Pantalla completa para el televisor de planta, se refresca sola">
              <Boton variante="claro">Modo TV</Boton>
            </Link>
          </>
        }
      >
        {mfr && datos && (
          <div className="grid items-center gap-5 lg:grid-cols-[auto_1fr]">
            <div className="vidrio flex items-center gap-5 rounded-3xl p-4 pr-6">
              <Medidor
                valor={mfr.cumplimiento}
                meta={datos.meta}
                tono={tonoSemaforo(mfr.semaforo)}
                variante="vidrio"
                tamano={168}
                leyenda={textoSemaforo(mfr.semaforo)}
                titulo={`Cumplimiento del día: ${mfr.cumplimiento?.toFixed(1) ?? 'sin dato'} %, meta ${datos.meta} %`}
              />
              <p className="max-w-[14rem] text-sm font-medium leading-snug text-white/90">
                {fraseGuia(mfr, datos.meta)}
              </p>
            </div>

            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-5">
              <CifraEstado
                variante="vidrio"
                etiqueta="Programadas"
                detalle="cajas en el DPP (T)"
                valor={mfr.programadoCajas}
                tono="marca"
              />
              <CifraEstado
                variante="vidrio"
                etiqueta="Producidas"
                detalle="aprobadas por el OPA"
                valor={mfr.producidoCajas}
                total={mfr.programadoCajas}
                tono="exito"
              />
              <CifraEstado
                variante="vidrio"
                etiqueta="Faltan"
                detalle="sumando PT por PT"
                valor={cajasFaltantes(mfr)}
                total={mfr.programadoCajas}
                tono="alerta"
              />
              <CifraEstado
                variante="vidrio"
                etiqueta="Fuera del DPP"
                detalle={`${mfr.producidoSinProgramar.length} PT`}
                valor={mfr.producidoSinProgramar.reduce((s, p) => s + p.cajas, 0)}
                tono="neutro"
              />
              <CifraEstado
                variante="vidrio"
                etiqueta="Emergencia"
                detalle="extraoficiales, no cuentan"
                valor={mfr.extraoficialesCajas}
                tono="acento"
              />
            </div>
          </div>
        )}
      </EncabezadoPagina>

      {dia.isLoading && <PantallaCargando />}
      {dia.isError && <Alerta tipo="error">{comoErrorApi(dia.error).mensaje}</Alerta>}

      {datos && sinDpp && (
        <EstadoVacio
          Icono={IconoTablero}
          titulo="No hay programación (DPP) para este día"
          texto="El cumplimiento se mide contra el DPP de PepsiCo. Cárguelo en la programación del día y el tablero se llena solo."
          accion={
            tienePermiso('mfr.cargar_programacion') && (
              <Link to={`/mfr/programacion?fecha=${fecha}`}>
                <Boton>Ir a cargar el DPP</Boton>
              </Link>
            )
          }
        />
      )}

      {datos && !sinDpp && (
        <>
          {datos.advertencias.map((a) => (
            <Alerta key={a} tipo="info">
              {a}
            </Alerta>
          ))}

          <PestanasVista
            etiqueta="Vistas del tablero"
            opciones={opciones}
            activa={vista}
            cambiar={cambiarVista}
          />

          <div ref={contenido} role="tabpanel" className="pt-2">
            {vista === 'turnos' && (
              <div data-animar>
                <BarraVista texto="Cada turno frente a su meta. Abra los apartados de cada turno para ver el personal y la programación." />
                {/* Columnas abiertas: las separa una línea fina, no una caja. */}
                <div className="grid gap-y-10 md:grid-cols-3 md:divide-x md:divide-borde">
                  {datos.turnos.map((t) => (
                    <ColumnaTurno
                      key={t.turnoId}
                      turno={t}
                      meta={datos.meta}
                      productos={productos.data}
                      lineas={datos.lineas}
                    />
                  ))}
                </div>
              </div>
            )}

            {vista === 'pt' && (
              <div data-animar>
                <RankingPt mfr={datos.mfr} meta={datos.meta} productos={productos.data} />
              </div>
            )}

            {vista === 'kilos' && (
              <div data-animar>
                <BarraVista texto="Meta contra producido de todo el día, en kilos: el hueco entre las dos líneas es la hora en que se perdió producción." />
                {datos.horario.totalTargetKg.some((v) => v > 0) ? (
                  <CurvaDia
                    horas={datos.horario.horas}
                    meta={datos.horario.totalTargetKg}
                    producido={datos.horario.totalInstantKg}
                  />
                ) : (
                  <p className="border-y border-borde py-10 text-center text-sm text-tinta-suave">
                    Faltan los pesos por caja de los PT del DPP: sin ellos no hay kilos (Administración →
                    Pesos por caja).
                  </p>
                )}
              </div>
            )}

            {vista === 'lineas' && (
              <div data-animar>
                <VistaLineas datos={datos} />
              </div>
            )}
          </div>
        </>
      )}
    </section>
  )
}

/** Mapa de calor por línea o por familia, con el selector de qué serie mirar. */
function VistaLineas({ datos }: { datos: IndicadoresDia }) {
  const [serie, setSerie] = useState<Serie>('targetKg')
  const [agrupar, setAgrupar] = useState<'linea' | 'familia'>('linea')
  const serieActual = SERIES.find((s) => s.clave === serie)!
  const porFamilia = agrupar === 'familia'

  const boton = (activo: boolean) =>
    `rounded-lg px-3 py-1.5 text-xs font-semibold transition pointer-coarse:min-h-9 ${
      activo ? 'bg-marca-relleno text-white shadow-sm' : 'text-tinta-suave hover:text-tinta'
    }`

  return (
    <>
      <BarraVista
        texto={
          porFamilia ? (
            <>
              Kilos de meta por familia de PT. En el DPP de PepsiCo esta tabla se llama{' '}
              <em>Flavor Breakdown</em>.
            </>
          ) : (
            serieActual.explicacion
          )
        }
        acciones={
          <>
            {datos.familias.length > 0 && (
              <div className="flex gap-1 rounded-xl bg-velo p-1" role="group" aria-label="Agrupar por">
                <button
                  type="button"
                  aria-pressed={!porFamilia}
                  className={boton(!porFamilia)}
                  onClick={() => setAgrupar('linea')}
                >
                  Por línea
                </button>
                <button
                  type="button"
                  aria-pressed={porFamilia}
                  className={boton(porFamilia)}
                  onClick={() => setAgrupar('familia')}
                >
                  Por familia
                </button>
              </div>
            )}
            {/* Las series solo existen por línea; por familia el DPP trae solo la meta. */}
            {!porFamilia && (
              <div
                className="flex flex-wrap gap-1 rounded-xl bg-velo p-1"
                role="group"
                aria-label="Qué mostrar"
              >
                {SERIES.map((s) => (
                  <button
                    key={s.clave}
                    type="button"
                    title={`${s.explicacion} En el DPP de PepsiCo: "${s.enElDpp}".`}
                    aria-pressed={serie === s.clave}
                    className={boton(serie === s.clave)}
                    onClick={() => setSerie(s.clave)}
                  >
                    {s.etiqueta}
                  </button>
                ))}
              </div>
            )}
          </>
        }
      />

      {porFamilia ? (
        <TablaHoraria
          etiquetaFila="Familia"
          horas={datos.horario.horas}
          unidad="kilos"
          filas={datos.familias.map((f) => ({
            id: f.familia,
            nombre: f.familia,
            valores: f.targetKg,
          }))}
        />
      ) : (
        <TablaHoraria
          etiquetaFila="Línea"
          horas={datos.horario.horas}
          unidad={serie === 'overpull' ? 'sobre la meta' : 'kilos'}
          sufijo={serieActual.sufijo}
          divergente={serie === 'overpull'}
          filas={datos.horario.lineas.map((fila) => ({
            id: fila.lineaId,
            nombre: datos.lineas.find((l) => l.lineaId === fila.lineaId)?.nombre ?? fila.lineaId,
            valores: fila[serie],
          }))}
          totales={
            serie === 'targetKg'
              ? datos.horario.totalTargetKg
              : serie === 'instantKg'
                ? datos.horario.totalInstantKg
                : undefined
          }
        />
      )}
    </>
  )
}
