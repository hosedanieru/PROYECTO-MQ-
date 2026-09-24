import { Link } from 'react-router-dom'

import { COLOR_TONO } from '../../../components/Badge'
import type { Aviso } from './avisos'

/**
 * Lista de avisos. El color va acompañado siempre del título y del
 * texto: nunca es lo único que distingue un aviso grave de uno
 * informativo.
 */
export function AvisosDia({ avisos }: { avisos: Aviso[] }) {
  if (avisos.length === 0) {
    return (
      <p className="rounded-xl border border-dashed border-borde px-4 py-6 text-center text-sm text-tinta-suave">
        Nada pendiente por ahora.
      </p>
    )
  }

  return (
    <ul className="space-y-2">
      {avisos.map((aviso) => {
        const cuerpo = (
          <>
            <span
              className="mt-1.5 h-2 w-2 shrink-0 rounded-full"
              style={{ backgroundColor: COLOR_TONO[aviso.tono] }}
              aria-hidden="true"
            />
            <span className="min-w-0">
              <span className="block text-sm font-semibold text-tinta">{aviso.titulo}</span>
              <span className="mt-0.5 block text-xs leading-relaxed text-tinta-suave">{aviso.texto}</span>
            </span>
          </>
        )

        const clases = 'flex gap-3 rounded-xl border border-borde p-3 transition'

        return (
          <li key={aviso.clave}>
            {aviso.a ? (
              <Link to={aviso.a} className={`${clases} hover:border-marca/30 hover:bg-fondo`}>
                {cuerpo}
              </Link>
            ) : (
              <div className={clases}>{cuerpo}</div>
            )}
          </li>
        )
      })}
    </ul>
  )
}
