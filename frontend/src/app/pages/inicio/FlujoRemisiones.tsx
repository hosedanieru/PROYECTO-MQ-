import { Link } from 'react-router-dom'

import { COLOR_TONO, type TonoBadge } from '../../../components/Badge'
import { BarraProgreso } from '../../../components/graficas/BarraProgreso'
import { ETIQUETA_ESTADO, type EstadoRemision } from '../../../shared/types/remision'
import { proporcion } from '../../../shared/utils/numeros'

interface Props {
  porEstado: Record<EstadoRemision, number>
  total: number
  /** Día operativo que se está mirando; viaja al listado como filtro. */
  fecha: string
}

interface Paso {
  estado: EstadoRemision
  descripcion: string
  tono: TonoBadge
}

/**
 * Los cuatro pasos del camino normal de una remisión. RECHAZADA y
 * EN_RECTIFICACION no son pasos: son el desvío, y se muestran aparte
 * para que se note que necesitan acción.
 */
const PASOS: Paso[] = [
  { estado: 'BORRADOR', descripcion: 'Registradas, sin entregar', tono: 'neutro' },
  { estado: 'ENTREGADA', descripcion: 'En poder del OPA', tono: 'marca' },
  { estado: 'APROBADA', descripcion: 'Aceptadas, sin conciliar', tono: 'alerta' },
  { estado: 'VALIDADA', descripcion: 'Conciliadas y cerradas', tono: 'exito' },
]

const DESVIOS: Paso[] = [
  { estado: 'RECHAZADA', descripcion: 'Hay que rectificarlas', tono: 'critico' },
  { estado: 'EN_RECTIFICACION', descripcion: 'En corrección', tono: 'acento' },
]

/**
 * Flujo del día como línea de tiempo vertical: el orden de arriba abajo
 * ES el orden del proceso, así que la posición ya dice en qué punto va
 * cada documento antes de leer un número.
 */
export function FlujoRemisiones({ porEstado, total, fecha }: Props) {
  const desviosActivos = DESVIOS.filter((desvio) => porEstado[desvio.estado] > 0)
  const enlace = (estado: EstadoRemision) => `/remisiones?desde=${fecha}&hasta=${fecha}&estado=${estado}`

  return (
    <div className="space-y-4">
      <ol className="relative space-y-2">
        {/* Hilo que une los pasos. Decorativo: la lista ya está ordenada. */}
        <span
          aria-hidden="true"
          className="absolute bottom-6 left-[15px] top-6 w-px bg-borde"
        />

        {PASOS.map((paso, indice) => {
          const cantidad = porEstado[paso.estado]
          const porcentaje = proporcion(cantidad, total)

          return (
            <li key={paso.estado} className="relative">
              <Link
                to={enlace(paso.estado)}
                className="flex gap-3 rounded-xl p-2 transition hover:bg-velo"
              >
                <span
                  className="mt-1 grid h-8 w-8 shrink-0 place-items-center rounded-full border-4 border-base"
                  style={{ backgroundColor: COLOR_TONO[paso.tono] }}
                  aria-hidden="true"
                >
                  <span className="text-[11px] font-bold text-white">{indice + 1}</span>
                </span>

                <span className="min-w-0 flex-1">
                  <span className="flex items-baseline justify-between gap-2">
                    <span className="text-sm font-semibold text-tinta">
                      {ETIQUETA_ESTADO[paso.estado]}
                    </span>
                    <span className="cifra shrink-0 text-sm font-bold text-tinta">
                      {cantidad}
                      <span className="text-xs font-medium text-tinta-suave">/{total}</span>
                      {porcentaje !== null && (
                        <span className="ml-2 text-xs font-semibold text-tinta-suave">
                          {Math.round(porcentaje)}%
                        </span>
                      )}
                    </span>
                  </span>
                  <span className="mt-0.5 mb-2 block text-xs text-tinta-suave">{paso.descripcion}</span>
                  <BarraProgreso
                    valor={porcentaje ?? 0}
                    tono={paso.tono}
                    retraso={indice * 110}
                    titulo={`${ETIQUETA_ESTADO[paso.estado]}: ${cantidad} de ${total}`}
                  />
                </span>
              </Link>
            </li>
          )
        })}
      </ol>

      {desviosActivos.length > 0 && (
        <div className="space-y-2 border-t border-borde pt-3">
          {desviosActivos.map((desvio) => (
            <Link
              key={desvio.estado}
              to={enlace(desvio.estado)}
              className="flex items-center gap-2.5 rounded-lg border border-borde px-3 py-2 text-sm transition hover:border-marca/30"
            >
              <span
                className="h-2 w-2 shrink-0 rounded-full"
                style={{ backgroundColor: COLOR_TONO[desvio.tono] }}
                aria-hidden="true"
              />
              <span className="cifra font-bold text-tinta">{porEstado[desvio.estado]}</span>
              <span className="min-w-0 truncate text-tinta-suave">
                {ETIQUETA_ESTADO[desvio.estado]} · {desvio.descripcion}
              </span>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
