/**
 * TABLERO DE INICIO
 * =================
 *
 * Responde cuatro preguntas del turno, con datos reales del día
 * operativo en curso:
 *
 *   1. ¿Cómo va el día?              → los cuatro indicadores de arriba
 *   2. ¿Qué corre en cada línea?     → el tablero de líneas
 *   3. ¿Dónde está cada remisión?    → el flujo, la dona y las últimas
 *   4. ¿Qué requiere acción?         → los avisos
 *
 * Nada se calcula aquí que no venga del backend. Si un dato no existe
 * (día sin DPP, turno sin asistencia) se escribe "—", nunca un cero:
 * "no hay dato" y "el dato es cero" son cosas distintas.
 */

import { Link } from 'react-router-dom'

import { Badge } from '../../components/Badge'
import { Barras, type BarraDato } from '../../components/graficas/Barras'
import { Dona, type SegmentoDona } from '../../components/graficas/Dona'
import { IconoCaja, IconoPersonas, IconoRemision, IconoTablero } from '../../components/Iconos'
import { TarjetaKpi } from '../../components/TarjetaKpi'
import { Tarjeta } from '../../components/Tarjeta'
import { TONO_ESTADO } from '../../components/tonos-estado'
import { useTextos } from '../../shared/idioma/useTextos'
import { useSesion } from '../../modules/auth/useSesion'
import { useProductos } from '../../modules/catalogo/hooks/useCatalogos'
import { useIndicadoresDia } from '../../modules/mfr/hooks/useMfr'
import { useConteoPorEstado, useRemisiones } from '../../modules/remisiones/hooks/useRemisiones'
import { REFRESCO_LENTO, REFRESCO_TABLERO } from '../../shared/refresco'
import type { Semaforo } from '../../shared/types/mfr'
import type { EstadoRemision } from '../../shared/types/remision'
import { fechaCorta, fechaOperativaDe } from '../../shared/utils/fechas'
import { miles, porcentaje, proporcion } from '../../shared/utils/numeros'
import { AccesosRapidos } from './inicio/AccesosRapidos'
import { AvisosDia } from './inicio/AvisosDia'
import { construirAvisos } from './inicio/avisos'
import { FlujoRemisiones } from './inicio/FlujoRemisiones'
import { LineasEnVivo } from './inicio/LineasEnVivo'
import { UltimasRemisiones } from './inicio/UltimasRemisiones'

/**
 * Orden de la dona. No es alfabético ni decorativo: sigue el flujo y
 * deja EN_RECTIFICACION (morado) entre VALIDADA (verde) y RECHAZADA
 * (rojo). Verde y rojo contiguos son indistinguibles para la forma más
 * común de daltonismo.
 */
const ORDEN_DONA: EstadoRemision[] = [
  'BORRADOR',
  'ENTREGADA',
  'APROBADA',
  'VALIDADA',
  'EN_RECTIFICACION',
  'RECHAZADA',
]

const TONO_SEMAFORO = {
  VERDE: 'exito',
  AMARILLO: 'alerta',
  ROJO: 'critico',
} as const

function tonoDe(semaforo: Semaforo | null) {
  return semaforo ? TONO_SEMAFORO[semaforo] : 'neutro'
}

/** Clave del saludo según la hora de Bogotá. */
function claveSaludo(instante: Date): 'inicio.buenosDias' | 'inicio.buenasTardes' | 'inicio.buenasNoches' {
  const hora = Number(
    new Intl.DateTimeFormat('en-GB', { timeZone: 'America/Bogota', hour: '2-digit', hour12: false }).format(
      instante,
    ),
  )
  if (hora < 12) return 'inicio.buenosDias'
  if (hora < 19) return 'inicio.buenasTardes'
  return 'inicio.buenasNoches'
}

/** YYYY-MM-DD del día operativo anterior. */
function diaAnterior(fecha: string): string {
  const [anio, mes, dia] = fecha.split('-').map(Number)
  return new Date(Date.UTC(anio, mes - 1, dia - 1)).toISOString().slice(0, 10)
}

export function InicioPage() {
  const { usuario, tienePermiso } = useSesion()
  const { t } = useTextos()
  const ahora = new Date()
  const fecha = fechaOperativaDe(ahora)

  const puedeRemisiones = tienePermiso('remision.consultar')
  const puedeMfr = tienePermiso('mfr.consultar')
  const puedeCatalogo = tienePermiso('catalogo.consultar')

  /*
   * Cada consulta lleva el ritmo que le corresponde (ver
   * `shared/refresco.ts`). Lo de hoy se refresca cada 10 s; el total de
   * ayer, que ya no cambia, casi nunca.
   */
  const conteo = useConteoPorEstado(fecha, puedeRemisiones)
  const ayer = useRemisiones(
    { desde: diaAnterior(fecha), hasta: diaAnterior(fecha), porPagina: 1 },
    puedeRemisiones,
    REFRESCO_LENTO,
  )
  const ultimas = useRemisiones(
    { desde: fecha, hasta: fecha, porPagina: 6 },
    puedeRemisiones,
    REFRESCO_TABLERO,
  )
  const dia = useIndicadoresDia(fecha, puedeMfr, REFRESCO_TABLERO)
  const productos = useProductos({}, puedeCatalogo)

  const mfr = dia.data?.mfr
  const diferencia = conteo.total - (ayer.data?.total ?? 0)

  // Personal del día: suma de lo que llegó y de lo esperado en los tres turnos.
  const personal = (dia.data?.turnos ?? []).reduce(
    (acumulado, turno) => ({
      llegaron: acumulado.llegaron + turno.personal.llegaron,
      esperadas: acumulado.esperadas + turno.personal.esperadas,
    }),
    { llegaron: 0, esperadas: 0 },
  )

  const segmentos: SegmentoDona[] = ORDEN_DONA.map((estado) => ({
    clave: estado,
    etiqueta: t(`estado.${estado}`),
    valor: conteo.porEstado[estado],
    tono: TONO_ESTADO[estado],
  }))

  const barrasTurno: BarraDato[] = (dia.data?.turnos ?? []).map((turno) => ({
    clave: turno.turnoId,
    etiqueta: turno.codigo,
    valor: turno.cumplimiento === null ? null : Math.round(turno.cumplimiento),
    tono: tonoDe(turno.semaforo),
    detalle: `${miles(turno.producidoCajas)} de ${miles(turno.targetCajas)} cajas`,
  }))

  const avisos = construirAvisos({
    indicadores: dia.data,
    porEstado: puedeRemisiones ? conteo.porEstado : undefined,
    fecha,
  })

  return (
    <div className="space-y-5">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-tinta sm:text-3xl">
            {t(claveSaludo(ahora))}, {usuario?.nombre?.split(' ')[0]}
          </h1>
          <p className="mt-1 text-sm text-tinta-suave">
            {t('inicio.subtitulo', { fecha: fechaCorta(fecha) })}
          </p>
        </div>
        <Badge tono="exito" punto>
          {t('inicio.diaEnCurso')}
        </Badge>
      </header>

      {/* ---------- Indicadores ---------- */}
      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4" aria-label={t('inicio.indicadores')}>
        {puedeRemisiones && (
          <TarjetaKpi
            etiqueta={t('inicio.remisionesDelDia')}
            valor={conteo.total}
            porcentaje={proporcion(conteo.porEstado.VALIDADA, conteo.total)}
            tono="marca"
            Icono={IconoRemision}
            a={`/remisiones?desde=${fecha}&hasta=${fecha}`}
            detalle={
              ayer.data
                ? t('inicio.frenteAyer', {
                    diferencia: `${diferencia >= 0 ? '+' : ''}${diferencia}`,
                  })
                : undefined
            }
            tonoDetalle={diferencia >= 0 ? 'exito' : 'critico'}
          />
        )}

        {puedeMfr && (
          <>
            <TarjetaKpi
              etiqueta={t('inicio.cajasRemisionadas')}
              valor={mfr?.producidoCajas ?? 0}
              sobre={mfr?.programadoCajas ?? null}
              porcentaje={mfr?.cumplimiento ?? null}
              tono={tonoDe(mfr?.semaforo ?? null)}
              Icono={IconoCaja}
              a={`/mfr?fecha=${fecha}`}
              detalle={t('inicio.soloAprobadas')}
            />

            <TarjetaKpi
              etiqueta={t('inicio.mfrDelDia')}
              valor={Math.round(mfr?.cumplimiento ?? 0)}
              unidad="%"
              sinDato={mfr?.cumplimiento === undefined || mfr.cumplimiento === null}
              porcentaje={mfr?.cumplimiento ?? null}
              tono={tonoDe(mfr?.semaforo ?? null)}
              Icono={IconoTablero}
              a={`/mfr?fecha=${fecha}`}
              detalle={t('inicio.meta', { meta: dia.data?.meta ?? 95 })}
            />

            <TarjetaKpi
              etiqueta={t('inicio.personalDelDia')}
              valor={personal.llegaron}
              sobre={personal.esperadas || null}
              sinDato={personal.esperadas === 0}
              porcentaje={proporcion(personal.llegaron, personal.esperadas)}
              tono={personal.llegaron >= personal.esperadas ? 'exito' : 'alerta'}
              Icono={IconoPersonas}
              a={`/mfr/programacion?fecha=${fecha}`}
              detalle={t('inicio.llegaronFrenteEsperado')}
            />
          </>
        )}
      </section>

      {/* ---------- Líneas + flujo + avisos ---------- */}
      <div className="grid gap-4 xl:grid-cols-3">
        {puedeMfr && (
          <Tarjeta
            className="xl:col-span-2"
            titulo={t('inicio.lineasEnProduccion')}
            descripcion={t('inicio.lineasDescripcion')}
          >
            {dia.data ? (
              <LineasEnVivo dia={dia.data} productos={productos.data} esHoy fecha={fecha} />
            ) : (
              <p className="py-10 text-center text-sm text-tinta-suave">
                {t('inicio.cargandoProgramacion')}
              </p>
            )}
          </Tarjeta>
        )}

        <div className="space-y-4">
          {puedeRemisiones && (
            <Tarjeta titulo={t('inicio.flujoTitulo')} descripcion={t('inicio.flujoDescripcion')}>
              <FlujoRemisiones porEstado={conteo.porEstado} total={conteo.total} fecha={fecha} />
            </Tarjeta>
          )}

          <Tarjeta titulo={t('inicio.avisosTitulo')} descripcion={t('inicio.avisosDescripcion')}>
            <AvisosDia avisos={avisos} />
          </Tarjeta>
        </div>
      </div>

      {/* ---------- Gráficas ---------- */}
      <div className="grid gap-4 xl:grid-cols-3">
        {puedeMfr && (
          <Tarjeta
            titulo={t('inicio.cumplimientoPorTurno')}
            descripcion={t('inicio.cumplimientoTurnoDescripcion', { meta: dia.data?.meta ?? 95 })}
          >
            {barrasTurno.length > 0 ? (
              <Barras
                datos={barrasTurno}
                maximo={Math.max(100, ...barrasTurno.map((b) => b.valor ?? 0))}
                meta={dia.data?.meta}
                sufijo="%"
              />
            ) : (
              <p className="py-10 text-center text-sm text-tinta-suave">
                {t('inicio.sinProgramacion')}
              </p>
            )}
          </Tarjeta>
        )}

        {puedeRemisiones && (
          <Tarjeta titulo={t('inicio.estadoRemisiones')} descripcion={t('inicio.repartoDelDia')}>
            <Dona
              segmentos={segmentos}
              total={conteo.total}
              unidad={t('comun.remisiones')}
              tamano={140}
            />
          </Tarjeta>
        )}

        {puedeMfr && mfr && (
          <Tarjeta tono="marino" titulo={t('inicio.resumenDelDia')}>
            <dl className="space-y-4">
              <div>
                <dt className="text-xs font-semibold uppercase tracking-[0.14em] text-white/50">
                  {t('inicio.kilosProducidos')}
                </dt>
                <dd className="cifra mt-1 text-2xl font-bold">
                  {mfr.programadoKg > 0 ? (
                    <>
                      {miles(mfr.producidoKg)}
                      <span className="ml-1 text-sm font-semibold text-white/60">
                        {t('inicio.deKg', { total: miles(mfr.programadoKg) })}
                      </span>
                    </>
                  ) : (
                    <span className="text-base font-semibold text-white/60">
                      {t('inicio.sinPesoConfirmado')}
                    </span>
                  )}
                </dd>
              </div>

              <div>
                <dt className="text-xs font-semibold uppercase tracking-[0.14em] text-white/50">
                  {t('inicio.cumplimientoKilos')}
                </dt>
                <dd className="cifra mt-1 text-2xl font-bold">
                  {porcentaje(proporcion(mfr.producidoKg, mfr.programadoKg))}
                </dd>
              </div>

              <div>
                <dt className="text-xs font-semibold uppercase tracking-[0.14em] text-white/50">
                  {t('inicio.pedidosEmergencia')}
                </dt>
                <dd className="cifra mt-1 text-2xl font-bold">
                  {miles(mfr.extraoficialesCajas)}
                  <span className="ml-1 text-sm font-semibold text-white/60">
                    {t('inicio.cajasFueraMfr')}
                  </span>
                </dd>
              </div>
            </dl>
          </Tarjeta>
        )}
      </div>

      {/* ---------- Últimas remisiones ---------- */}
      {puedeRemisiones && (
        <Tarjeta
          sinRelleno
          titulo={t('inicio.ultimasRemisiones')}
          descripcion={t('inicio.ultimasDescripcion')}
          accion={
            <Link
              to={`/remisiones?desde=${fecha}&hasta=${fecha}`}
              className="text-sm font-semibold text-marca hover:underline"
            >
              {t('inicio.verTodas')}
            </Link>
          }
        >
          <UltimasRemisiones remisiones={ultimas.data?.items ?? []} />
        </Tarjeta>
      )}

      <section>
        <h2 className="mb-3 text-base font-semibold text-tinta">{t('inicio.accesosRapidos')}</h2>
        <AccesosRapidos tienePermiso={tienePermiso} />
      </section>
    </div>
  )
}
