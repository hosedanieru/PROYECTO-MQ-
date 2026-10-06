/**
 * TABLERO DE INICIO
 * =================
 *
 * Responde cuatro preguntas del turno, con datos reales del día
 * operativo en curso:
 *
 *   1. ¿Cómo va el día?              → las cuatro cifras de la banda
 *   2. ¿Qué requiere acción?         → los avisos, justo debajo
 *   3. ¿Qué corre en cada línea?     → vista "Líneas en vivo"
 *   4. ¿Dónde está cada remisión?    → vista "Remisiones de hoy"
 *
 * Rediseño (usuario, 2026-10-05: fuera las tarjetas, "una vista a la
 * vez"): las cifras viven en la banda, como en Remisiones y el MFR; los
 * avisos van primero porque dicen qué hacer; lo demás se parte en tres
 * vistas a todo el ancho, sin cajas. La vista elegida vive en la URL.
 *
 * Nada se calcula aquí que no venga del backend. Si un dato no existe
 * (día sin DPP, turno sin asistencia) se escribe "—", nunca un cero:
 * "no hay dato" y "el dato es cero" son cosas distintas.
 */

import { Link, useNavigate, useSearchParams } from 'react-router-dom'

import { Badge, type TonoBadge } from '../../components/Badge'
import { CifraEstado } from '../../components/CifraEstado'
import { EncabezadoPagina } from '../../components/EncabezadoPagina'
import { Barras, type BarraDato } from '../../components/graficas/Barras'
import { Dona, type SegmentoDona } from '../../components/graficas/Dona'
import { IconoInicio, IconoLinea, IconoRemision, IconoTablero } from '../../components/Iconos'
import { PestanasVista, type OpcionVista } from '../../components/PestanasVista'
import { Seccion } from '../../components/Seccion'
import { TONO_ESTADO } from '../../components/tonos-estado'
import { useAparecer } from '../../shared/animacion/useAnimacion'
import { useTextos } from '../../shared/idioma/useTextos'
import { useSesion } from '../../modules/auth/useSesion'
import { useProductos } from '../../modules/catalogo/hooks/useCatalogos'
import { useIndicadorAverias } from '../../modules/averias/hooks/useAverias'
import { useAlertasInventario } from '../../modules/inventario/hooks/useInventario'
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

function tonoDe(semaforo: Semaforo | null): TonoBadge {
  return semaforo ? TONO_SEMAFORO[semaforo] : 'neutro'
}

type Vista = 'lineas' | 'remisiones' | 'turnos'

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
  const navegar = useNavigate()
  const [params, setParams] = useSearchParams()
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
  const averiasDia = useIndicadorAverias(fecha, fecha, tienePermiso('averia.consultar'))
  const inventarioDia = useAlertasInventario(fecha, tienePermiso('inventario.consultar'))

  const mfr = dia.data?.mfr
  const diferencia = conteo.total - (ayer.data?.total ?? 0)

  // Personal del día contra lo que pide el DPP (lo suma el backend, solo turnos ya registrados).
  const personal = dia.data?.personal

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
    averias: averiasDia.data,
    inventario: inventarioDia.data,
    fecha,
  })

  // Vistas según permisos: quien no ve el MFR no tiene pestañas de líneas ni turnos.
  const opciones: OpcionVista<Vista>[] = [
    ...(puedeMfr
      ? [{ clave: 'lineas' as const, titulo: t('inicio.vistaLineas'), Icono: IconoLinea, resumen: t('inicio.resumenLineas') }]
      : []),
    ...(puedeRemisiones
      ? [
          {
            clave: 'remisiones' as const,
            titulo: t('inicio.vistaRemisiones'),
            Icono: IconoRemision,
            resumen: t('inicio.resumenRemisiones', { n: conteo.total }),
          },
        ]
      : []),
    ...(puedeMfr
      ? [
          {
            clave: 'turnos' as const,
            titulo: t('inicio.vistaTurnos'),
            Icono: IconoTablero,
            resumen: t('inicio.resumenTurnos', { meta: dia.data?.meta ?? 95 }),
            tono: mfr ? tonoDe(mfr.semaforo) : undefined,
          },
        ]
      : []),
  ]
  const pedida = params.get('vista') as Vista | null
  const vista: Vista | undefined = opciones.find((o) => o.clave === pedida)?.clave ?? opciones[0]?.clave
  const cambiarVista = (v: Vista) => {
    const siguiente = new URLSearchParams(params)
    siguiente.set('vista', v)
    setParams(siguiente, { replace: true })
  }
  const contenido = useAparecer<HTMLDivElement>(vista)

  return (
    <div className="space-y-7">
      <EncabezadoPagina
        Icono={IconoInicio}
        titulo={`${t(claveSaludo(ahora))}, ${usuario?.nombre?.split(' ')[0] ?? ''}`}
        insignia={
          <Badge tono="exito" punto>
            {t('inicio.diaEnCurso')}
          </Badge>
        }
        descripcion={t('inicio.subtitulo', { fecha: fechaCorta(fecha) })}
      >
        {/* ---------- ¿Cómo va el día? Cuatro cifras; tocar una lleva a su módulo. ---------- */}
        {(puedeRemisiones || puedeMfr) && (
          <section className="grid grid-cols-2 gap-3 xl:grid-cols-4" aria-label={t('inicio.indicadores')}>
            {puedeRemisiones && (
              <CifraEstado
                variante="vidrio"
                etiqueta={t('inicio.remisionesDelDia')}
                valor={conteo.total}
                tono="marca"
                detalle={
                  ayer.data
                    ? t('inicio.frenteAyer', { diferencia: `${diferencia >= 0 ? '+' : ''}${diferencia}` })
                    : undefined
                }
                onClick={() => navegar(`/remisiones?desde=${fecha}&hasta=${fecha}`)}
              />
            )}
            {puedeMfr && (
              <>
                <CifraEstado
                  variante="vidrio"
                  etiqueta={t('inicio.cajasRemisionadas')}
                  valor={mfr ? mfr.producidoCajas : null}
                  total={mfr?.programadoCajas ?? null}
                  tono={tonoDe(mfr?.semaforo ?? null)}
                  detalle={t('inicio.soloAprobadas')}
                  onClick={() => navegar(`/mfr?fecha=${fecha}`)}
                />
                <CifraEstado
                  variante="vidrio"
                  etiqueta={`${t('inicio.mfrDelDia')} (%)`}
                  valor={mfr?.cumplimiento === undefined || mfr.cumplimiento === null ? null : Math.round(mfr.cumplimiento)}
                  total={100}
                  tono={tonoDe(mfr?.semaforo ?? null)}
                  detalle={t('inicio.meta', { meta: dia.data?.meta ?? 95 })}
                  onClick={() => navegar(`/mfr?fecha=${fecha}`)}
                />
                <CifraEstado
                  variante="vidrio"
                  etiqueta={t('inicio.personalDelDia')}
                  valor={!personal || personal.coberturaDpp === null ? null : personal.llegaron}
                  total={personal?.requeridasDpp || null}
                  tono={personal?.estado === 'AFECTADA' ? 'alerta' : 'exito'}
                  detalle={t('inicio.llegaronFrenteEsperado')}
                  onClick={() => navegar(`/mfr/programacion?fecha=${fecha}`)}
                />
              </>
            )}
          </section>
        )}
      </EncabezadoPagina>

      {/* ---------- ¿Qué requiere acción? Primero, porque dice qué hacer. ---------- */}
      <Seccion
        titulo={t('inicio.avisosTitulo')}
        contador={avisos.length}
        descripcion={t('inicio.avisosDescripcion')}
        tono={avisos.some((a) => a.tono === 'critico') ? 'critico' : avisos.length > 0 ? 'alerta' : 'exito'}
      >
        <AvisosDia avisos={avisos} />
      </Seccion>

      {/* ---------- Una vista a la vez, a todo el ancho. ---------- */}
      {vista && (
        <>
          <PestanasVista opciones={opciones} activa={vista} cambiar={cambiarVista} etiqueta={t('inicio.vistas')} />
          <div ref={contenido}>
            {vista === 'lineas' && (
              <div data-animar className="space-y-3">
                <p className="text-sm text-tinta-suave">{t('inicio.lineasDescripcion')}</p>
                {dia.data ? (
                  <LineasEnVivo dia={dia.data} productos={productos.data} esHoy fecha={fecha} />
                ) : (
                  <p className="py-10 text-center text-sm text-tinta-suave">{t('inicio.cargandoProgramacion')}</p>
                )}
              </div>
            )}

            {vista === 'remisiones' && (
              <div data-animar className="space-y-8">
                <div className="grid gap-x-10 gap-y-8 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
                  <Seccion titulo={t('inicio.flujoTitulo')} descripcion={t('inicio.flujoDescripcion')}>
                    <FlujoRemisiones porEstado={conteo.porEstado} total={conteo.total} fecha={fecha} />
                  </Seccion>
                  <Seccion titulo={t('inicio.estadoRemisiones')} descripcion={t('inicio.repartoDelDia')}>
                    <Dona segmentos={segmentos} total={conteo.total} unidad={t('comun.remisiones')} tamano={160} />
                  </Seccion>
                </div>
                <Seccion
                  titulo={t('inicio.ultimasRemisiones')}
                  descripcion={t('inicio.ultimasDescripcion')}
                  accion={
                    <Link
                      to={`/remisiones?desde=${fecha}&hasta=${fecha}`}
                      className="text-sm font-semibold text-marca hover:underline"
                    >
                      {t('inicio.verTodas')} →
                    </Link>
                  }
                >
                  <UltimasRemisiones remisiones={ultimas.data?.items ?? []} />
                </Seccion>
              </div>
            )}

            {vista === 'turnos' && (
              <div data-animar className="grid gap-x-10 gap-y-8 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
                <Seccion
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
                    <p className="py-10 text-center text-sm text-tinta-suave">{t('inicio.sinProgramacion')}</p>
                  )}
                </Seccion>

                {mfr && (
                  <Seccion titulo={t('inicio.resumenDelDia')}>
                    {/* Tres cifras grandes una bajo otra, separadas por líneas finas. */}
                    <dl className="divide-y divide-borde border-y border-borde">
                      <div className="py-4">
                        <dt className="text-xs font-bold uppercase tracking-wider text-tinta-suave">{t('inicio.kilosProducidos')}</dt>
                        <dd className="cifra mt-1 text-3xl font-black text-tinta">
                          {mfr.programadoKg > 0 ? (
                            <>
                              {miles(mfr.producidoKg)}
                              <span className="ml-1.5 text-sm font-semibold text-tinta-suave">
                                {t('inicio.deKg', { total: miles(mfr.programadoKg) })}
                              </span>
                            </>
                          ) : (
                            <span className="text-base font-semibold text-tinta-suave">{t('inicio.sinPesoConfirmado')}</span>
                          )}
                        </dd>
                      </div>
                      <div className="py-4">
                        <dt className="text-xs font-bold uppercase tracking-wider text-tinta-suave">{t('inicio.cumplimientoKilos')}</dt>
                        <dd className="cifra mt-1 text-3xl font-black text-tinta">
                          {porcentaje(proporcion(mfr.producidoKg, mfr.programadoKg))}
                        </dd>
                      </div>
                      <div className="py-4">
                        <dt className="text-xs font-bold uppercase tracking-wider text-tinta-suave">{t('inicio.pedidosEmergencia')}</dt>
                        <dd className="cifra mt-1 text-3xl font-black text-tinta">
                          {miles(mfr.extraoficialesCajas)}
                          <span className="ml-1.5 text-sm font-semibold text-tinta-suave">{t('inicio.cajasFueraMfr')}</span>
                        </dd>
                      </div>
                    </dl>
                  </Seccion>
                )}
              </div>
            )}
          </div>
        </>
      )}

      <Seccion titulo={t('inicio.accesosRapidos')} tono="neutro">
        <AccesosRapidos tienePermiso={tienePermiso} />
      </Seccion>
    </div>
  )
}
