/**
 * TABLERO: METAS Y PERSONAL DEL DÍA (/tableros/metas-personal)
 * ============================================================
 *
 * Lo que salió de la Programación del día (usuario, 2026-10-06: en
 * Programación queda solo lo editable): la meta de cada turno, el personal
 * que llegó contra lo que pide el DPP y contra cada grupo, la cobertura de
 * cada línea, y por línea su meta con cada bloque (máximo, meta y kilos).
 *
 * Solo consulta. Registrar personal, cargar bloques y cerrar el turno
 * siguen en la Programación del día.
 */

import { Link } from 'react-router-dom'

import { Alerta } from '../../../components/Alerta'
import { Badge } from '../../../components/Badge'
import { Boton } from '../../../components/Boton'
import { CifraEstado } from '../../../components/CifraEstado'
import { EncabezadoPagina } from '../../../components/EncabezadoPagina'
import { IconoCalendario } from '../../../components/Iconos'
import { FilaRegistro, ListaRegistros, MetaDato } from '../../../components/ListaRegistros'
import { ConCarga } from '../../../components/ConCarga'
import { Seccion } from '../../../components/Seccion'
import { comoErrorApi } from '../../../services/http'
import { fechaCorta } from '../../../shared/utils/fechas'
import { miles, porcentaje } from '../../../shared/utils/numeros'
import { useProductos } from '../../catalogo/hooks/useCatalogos'
import { PersonalBadge, PersonalDiaResumen } from '../../mfr/components/PersonalTurno'
import { useIndicadoresDia } from '../../mfr/hooks/useMfr'
import { SelectorPeriodo } from '../SelectorPeriodo'
import { usePeriodoTablero } from '../usePeriodoTablero'

const TONO_LINEA = { CUBIERTA: 'exito', INCOMPLETA: 'critico', SIN_DATO: 'neutro' } as const

export function TableroMetasPersonalPage() {
  const periodo = usePeriodoTablero()
  const dia = useIndicadoresDia(periodo.fecha)
  // Con inactivos: un bloque viejo puede tener un PT ya desactivado.
  const productos = useProductos({})
  const d = dia.data
  const producto = (id: string) => productos.data?.find((p) => p.id === id)

  return (
    <section className="space-y-7">
      <EncabezadoPagina
        Icono={IconoCalendario}
        escena="produccion"
        titulo="Metas y personal del día"
        descripcion={`Lo que pide el DPP por turno y por línea, y el personal que llegó. Día operativo ${fechaCorta(periodo.fecha)}.`}
        acciones={
          <>
            <SelectorPeriodo estado={periodo} soloDia />
            <Link to={`/mfr/programacion?fecha=${periodo.fecha}`}>
              <Boton variante="vidrio">Ir a la programación</Boton>
            </Link>
          </>
        }
      >
        <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
          <CifraEstado
            variante="vidrio"
            etiqueta="Meta del día"
            detalle="cajas (Σ T del DPP)"
            valor={d ? d.turnos.reduce((s, t) => s + t.targetCajas, 0) : null}
            tono="marca"
          />
          <CifraEstado
            variante="vidrio"
            etiqueta="Máximo teórico"
            detalle="cajas al 100 % (Σ Mx)"
            valor={d ? d.turnos.reduce((s, t) => s + t.maxCajas, 0) : null}
            tono="neutro"
          />
          <CifraEstado
            variante="vidrio"
            etiqueta="Personal"
            detalle="llegaron frente a lo que pide el DPP"
            valor={d && d.personal.coberturaDpp !== null ? d.personal.llegaron : null}
            total={d?.personal.requeridasDpp || null}
            tono={d?.personal.estado === 'AFECTADA' ? 'alerta' : 'exito'}
          />
          <CifraEstado
            variante="vidrio"
            etiqueta="Cobertura del DPP (%)"
            valor={d?.personal.coberturaDpp ?? null}
            total={100}
            tono={d?.personal.estado === 'AFECTADA' ? 'alerta' : 'exito'}
          />
        </div>
      </EncabezadoPagina>

      {dia.isError && <Alerta tipo="error">{comoErrorApi(dia.error).mensaje}</Alerta>}
      <ConCarga cargando={dia.isLoading} forma="detalle" mensaje="Cargando las metas y el personal…" className="space-y-6">
      {d && (
        <>
          {d.advertencias.map((a) => (
            <Alerta key={a} tipo="info">
              {a}
            </Alerta>
          ))}

          <PersonalDiaResumen personal={d.personal} />

          {/* Turnos en columnas abiertas: meta, personal y la cobertura de cada línea. */}
          <div className="grid divide-borde border-y border-borde sm:grid-cols-2 lg:grid-cols-3 lg:divide-x">
            {d.turnos.map((t) => (
              <div key={t.turnoId} className={`border-t-4 px-1 py-5 sm:px-5 ${t.cerrado ? 'border-t-neutro' : 'border-t-marca'}`}>
                <div className="flex items-start justify-between gap-2">
                  <p className="text-lg font-black text-tinta">{t.nombre}</p>
                  {t.cerrado ? <Badge tono="neutro">Cerrado</Badge> : <Badge tono="marca" punto>Abierto</Badge>}
                </div>
                <p className="mt-3">
                  <span className="cifra text-3xl font-black leading-none text-tinta">{miles(t.targetCajas)}</span>
                  <span className="ml-1.5 text-sm text-tinta-suave">cajas de meta</span>
                </p>
                <p className="mt-1 text-xs text-tinta-suave">
                  Máximo {miles(t.maxCajas)} · eficiencia planeada {porcentaje(t.eficienciaPlaneada)} · {t.bloques.length}{' '}
                  {t.bloques.length === 1 ? 'bloque' : 'bloques'}
                </p>
                <div className="mt-3">
                  <PersonalBadge personal={t.personal} />
                </div>
                {t.personal.lineas.length > 0 && (
                  <ul className="mt-3 space-y-1 text-xs">
                    {t.personal.lineas.map((l) => (
                      <li key={l.lineaId} className="flex items-center justify-between gap-2">
                        <span className="font-semibold text-tinta">{l.nombre}</span>
                        <Badge tono={TONO_LINEA[l.estado]}>
                          {l.personas} de {l.requeridasDpp || '—'}
                          {l.estado === 'INCOMPLETA' ? ` · faltan ${l.faltante}` : ''}
                        </Badge>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            ))}
          </div>

          <Seccion titulo="Metas por línea" contador={d.lineas.length} descripcion="Cada bloque del DPP con su máximo teórico (cajas por hora × horas), su meta (máximo × eficiencia) y los kilos de la meta.">
            <ListaRegistros estaVacia={d.lineas.length === 0} vacio={<p className="py-6 text-sm text-tinta-suave">No hay líneas activas.</p>}>
              {d.lineas.map((l) => (
                <FilaRegistro
                  key={l.lineaId}
                  tono={l.bloques.length > 0 ? 'marca' : 'neutro'}
                  etiqueta={<Badge tono="neutro">{l.tipo}</Badge>}
                  titulo={l.nombre}
                  detalle={`${miles(l.horasProgramadas)} horas programadas${l.capacidadKgHora ? ` · capacidad ${miles(l.capacidadKgHora)} kg/h` : ''}`}
                  meta={
                    l.bloques.length === 0 ? (
                      <span>Sin bloques ese día.</span>
                    ) : (
                      l.bloques.map((b) => (
                        <MetaDato key={b.id} etiqueta={`${b.horaInicio}–${b.horaFin} ${producto(b.productoId)?.codigo ?? ''}`}>
                          Mx {miles(b.maxCajas)} · T {miles(b.targetCajas)}
                          {b.targetKg !== null ? ` · ${miles(b.targetKg)} kg` : ' · sin peso'}
                        </MetaDato>
                      ))
                    )
                  }
                  cifra={miles(l.targetCajas)}
                  unidad="cajas"
                  notaCifra={l.targetKg > 0 ? `meta · ${miles(l.targetKg)} kg` : 'meta'}
                />
              ))}
            </ListaRegistros>
          </Seccion>
        </>
      )}
      </ConCarga>
    </section>
  )
}
