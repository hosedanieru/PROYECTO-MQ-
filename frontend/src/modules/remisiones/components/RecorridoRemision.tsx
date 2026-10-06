/**
 * RECORRIDO DE LA REMISIÓN
 * ========================
 *
 * Reemplaza la caja "Trazabilidad" (usuario, 2026-10-05: fuera las
 * tarjetas): los cuatro momentos del documento como pasos en una línea,
 * de izquierda a derecha. Lo hecho va en color con su fecha; lo que sigue
 * se marca como "siguiente"; lo pendiente, en gris. Así se ve de un golpe
 * dónde está la remisión, sin leer cuatro renglones.
 *
 * Solo muestra lo que el backend ya registró (fechas y nombres); no
 * decide transiciones.
 */

import { COLOR_TONO, type TonoBadge } from '../../../components/Badge'
import type { Remision } from '../../../shared/types/remision'
import { fechaHora } from '../../../shared/utils/fechas'

interface Paso {
  titulo: string
  hecho: boolean
  /** Qué pasó (fecha · quién) o por qué está detenido. */
  detalle: string
  /** Tono cuando el paso está detenido por un rechazo. */
  tonoDetenido?: TonoBadge
}

function pasosDe(r: Remision): Paso[] {
  const rechazada = r.estado === 'RECHAZADA' || r.estado === 'EN_RECTIFICACION'
  return [
    { titulo: 'Registrada', hecho: true, detalle: fechaHora(r.fechaHoraRegistro) },
    { titulo: 'Entregada al OPA', hecho: Boolean(r.entrega.fecha), detalle: r.entrega.fecha ? fechaHora(r.entrega.fecha) : 'Pendiente' },
    {
      titulo: 'Aprobada por PepsiCo',
      hecho: Boolean(r.aprobacion.fecha),
      detalle: r.aprobacion.fecha
        ? `${fechaHora(r.aprobacion.fecha)} · ${r.aprobacion.opaNombre ?? ''}${r.aprobacion.opaCargo ? ` (${r.aprobacion.opaCargo})` : ''}`
        : r.estado === 'RECHAZADA'
          ? 'Rechazada por el OPA'
          : r.estado === 'EN_RECTIFICACION'
            ? 'En rectificación'
            : 'Pendiente',
      tonoDetenido: rechazada && !r.aprobacion.fecha ? 'critico' : undefined,
    },
    {
      titulo: 'Validada (conciliada)',
      hecho: Boolean(r.validacion.fecha),
      detalle: r.validacion.fecha ? `${fechaHora(r.validacion.fecha)} · con ${r.validacion.conciliadoCon ?? ''}` : 'Pendiente',
    },
  ]
}

export function RecorridoRemision({ remision }: { remision: Remision }) {
  const pasos = pasosDe(remision)
  const siguiente = pasos.findIndex((p) => !p.hecho)

  return (
    <ol className="grid gap-x-4 gap-y-6 sm:grid-cols-2 lg:grid-cols-4" aria-label="Recorrido de la remisión">
      {pasos.map((p, i) => {
        const tono: TonoBadge = p.hecho ? 'exito' : (p.tonoDetenido ?? (i === siguiente ? 'marca' : 'neutro'))
        const activo = p.hecho || i === siguiente || p.tonoDetenido
        return (
          <li key={p.titulo} className="relative">
            {/* Línea hacia el paso siguiente (solo en una fila: pantallas grandes). */}
            {i < pasos.length - 1 && (
              <span
                className="absolute left-10 right-0 top-4 hidden h-0.5 lg:block"
                style={{ backgroundColor: p.hecho ? COLOR_TONO.exito : 'var(--color-borde)' }}
                aria-hidden="true"
              />
            )}
            <div className="relative flex items-start gap-3 lg:block">
              <span
                className={`relative grid h-8 w-8 shrink-0 place-items-center rounded-full text-sm font-black ring-4 ring-fondo ${
                  activo ? 'text-white' : 'bg-velo text-tinta-suave'
                } ${i === siguiente && !p.tonoDetenido ? 'shadow-[0_0_0_6px_color-mix(in_srgb,var(--color-marca)_20%,transparent)]' : ''}`}
                style={activo ? { backgroundColor: tono === 'marca' ? 'var(--color-marca-relleno)' : COLOR_TONO[tono] } : undefined}
              >
                {p.hecho ? '✓' : i + 1}
              </span>
              <div className="min-w-0 lg:mt-3 lg:pr-4">
                <p className={`text-sm font-black ${activo ? 'text-tinta' : 'text-tinta-suave'}`}>{p.titulo}</p>
                <p
                  className={`mt-0.5 text-xs ${p.tonoDetenido ? 'font-semibold text-critico' : 'text-tinta-suave'}`}
                >
                  {i === siguiente && !p.tonoDetenido && !p.hecho ? 'Siguiente paso' : p.detalle}
                </p>
              </div>
            </div>
          </li>
        )
      })}
    </ol>
  )
}
