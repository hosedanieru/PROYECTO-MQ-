import { Link } from 'react-router-dom'

import { FRANJA_TONO } from '../../../components/franjas'
import { EstadoBadge } from '../../../components/EstadoBadge'
import { TONO_ESTADO } from '../../../components/tonos-estado'
import type { Remision } from '../../../shared/types/remision'
import { fechaCorta } from '../../../shared/utils/fechas'
import { miles } from '../../../shared/utils/numeros'

interface Props {
  remision: Remision
  turno: string
  grupo: string
  seleccionada: boolean
  alternar: () => void
}

/**
 * Una remisión como fila abierta, para celular: la tabla de diez columnas
 * no cabe en una pantalla de seis pulgadas. Muestra lo que se busca de un
 * vistazo (consecutivo, producto, cajas, estado) y el resto en una línea.
 * Sin caja (usuario, 2026-10-05): franja del estado al borde y una línea
 * fina debajo; la lista que la contiene pone las líneas.
 */
export function TarjetaRemision({ remision: r, turno, grupo, seleccionada, alternar }: Props) {
  return (
    <div
      data-animar
      className={`flex gap-3 border-l-[6px] py-3 pl-3 pr-1 transition duration-200 active:scale-[0.99] ${FRANJA_TONO[TONO_ESTADO[r.estado]]} ${
        seleccionada ? 'bg-marca-claro/60' : ''
      }`}
    >
      <input
        type="checkbox"
        aria-label={`Seleccionar ${r.consecutivo}`}
        checked={seleccionada}
        onChange={alternar}
        className="mt-1 h-5 w-5 shrink-0 accent-marca"
      />
      <Link to={`/remisiones/${r.id}`} className="min-w-0 flex-1">
        <div className="flex items-start justify-between gap-2">
          <span className="codigo text-base font-extrabold text-tinta">
            {r.consecutivo}
            {r.version > 1 && <span className="ml-1 text-xs font-semibold text-tinta-suave">v{r.version}</span>}
          </span>
          <EstadoBadge estado={r.estado} />
        </div>
        <p className="mt-1 truncate text-sm font-medium text-tinta">{r.producto.descripcion}</p>
        <p className="mt-1 flex flex-wrap gap-x-3 text-xs text-tinta-suave">
          <span className="cifra font-bold text-tinta">{miles(r.cantidadCajas)} cajas</span>
          <span>{fechaCorta(r.fechaOperativa)}</span>
          <span>{turno}</span>
          <span>{grupo}</span>
          {r.extraoficial && <span className="font-bold uppercase text-alerta">Extraoficial</span>}
        </p>
      </Link>
    </div>
  )
}
