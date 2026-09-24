import { Link } from 'react-router-dom'

import { EstadoBadge } from '../../../components/EstadoBadge'
import type { Remision } from '../../../shared/types/remision'
import { miles } from '../../../shared/utils/numeros'

/** Hora del registro, en hora de Colombia (es un instante, no un día). */
const HORA = new Intl.DateTimeFormat('es-CO', {
  timeZone: 'America/Bogota',
  hour: '2-digit',
  minute: '2-digit',
  hour12: false,
})

/**
 * Las últimas remisiones registradas del día. Es el equivalente al
 * "log de operaciones" del diseño: lo que acaba de pasar, sin tener que
 * entrar al listado.
 */
export function UltimasRemisiones({ remisiones }: { remisiones: Remision[] }) {
  if (remisiones.length === 0) {
    return (
      <p className="px-5 py-8 text-center text-sm text-tinta-suave">
        Todavía no se ha registrado ninguna remisión hoy.
      </p>
    )
  }

  return (
    <div className="overflow-x-auto">
      <table className="min-w-full text-sm">
        <thead>
          <tr className="border-b border-borde text-left text-xs font-semibold uppercase tracking-wide text-tinta-suave">
            <th className="px-5 py-2.5 font-semibold">Hora</th>
            <th className="px-5 py-2.5 font-semibold">Consecutivo</th>
            <th className="px-5 py-2.5 font-semibold">Producto</th>
            <th className="px-5 py-2.5 text-right font-semibold">Cajas</th>
            <th className="px-5 py-2.5 font-semibold">Estado</th>
          </tr>
        </thead>
        <tbody>
          {remisiones.map((remision) => (
            <tr key={remision.id} className="border-b border-borde/60 last:border-0 hover:bg-velo">
              <td className="cifra px-5 py-2.5 text-tinta-suave">
                {HORA.format(new Date(remision.fechaHoraRegistro))}
              </td>
              <td className="px-5 py-2.5">
                <Link
                  to={`/remisiones/${remision.id}`}
                  className="cifra font-semibold text-marca hover:underline"
                >
                  {remision.consecutivo}
                </Link>
                {remision.extraoficial && (
                  <span className="ml-2 text-xs font-semibold text-acento">extraoficial</span>
                )}
              </td>
              <td className="max-w-xs truncate px-5 py-2.5 text-tinta">
                <span className="cifra text-tinta-suave">{remision.producto.codigo}</span>{' '}
                {remision.producto.descripcion}
              </td>
              <td className="cifra px-5 py-2.5 text-right font-semibold text-tinta">
                {miles(remision.cantidadCajas)}
              </td>
              <td className="px-5 py-2.5">
                <EstadoBadge estado={remision.estado} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
