import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'

interface Props {
  volver: { a: string; texto: string }
  /** Insignias sobre el título (tipo, estado). */
  insignias?: ReactNode
  /** Código o número del documento, en pequeño junto a las insignias. */
  codigo?: ReactNode
  titulo: ReactNode
  /** La cifra que resume el registro ("Existencia 1.250 metros"). */
  cifra?: { etiqueta: string; valor: ReactNode; unidad?: string }
  acciones?: ReactNode
}

/**
 * Encabezado de un registro DENTRO de un módulo que ya tiene su banda
 * (kardex de un ítem, detalle de una entrada). Sin caja: el título a la
 * izquierda, la cifra que importa grande a la derecha y una línea fina
 * debajo (usuario, 2026-10-05: fuera las tarjetas).
 */
export function EncabezadoDetalle({ volver, insignias, codigo, titulo, cifra, acciones }: Props) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-x-8 gap-y-4 border-b border-borde pb-5">
      <div className="min-w-0 flex-1 basis-80">
        <Link to={volver.a} className="text-sm font-semibold text-marca hover:underline">
          ← {volver.texto}
        </Link>
        {(insignias || codigo) && (
          <div className="mt-3 flex flex-wrap items-center gap-2">
            {insignias}
            {codigo && <span className="cifra text-sm font-semibold text-tinta-suave">{codigo}</span>}
          </div>
        )}
        <h2 className="mt-1 text-2xl font-black leading-tight tracking-tight text-tinta sm:text-3xl">{titulo}</h2>
      </div>
      <div className="flex flex-wrap items-end gap-6">
        {cifra && (
          <div className="text-right">
            <p className="text-xs font-bold uppercase tracking-wider text-tinta-suave">{cifra.etiqueta}</p>
            <p className="cifra text-4xl font-black leading-none tracking-tight text-tinta">
              {cifra.valor}
              {cifra.unidad && <span className="ml-1.5 text-sm font-semibold tracking-normal text-tinta-suave">{cifra.unidad}</span>}
            </p>
          </div>
        )}
        {acciones && <div className="flex flex-wrap gap-2">{acciones}</div>}
      </div>
    </div>
  )
}
