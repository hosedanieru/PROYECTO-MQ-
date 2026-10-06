import { Link } from 'react-router-dom'

import { COLOR_TONO } from '../../../components/Badge'
import type { Aviso } from './avisos'

/**
 * Lista de avisos. El color va acompañado siempre del título y del
 * texto: nunca es lo único que distingue un aviso grave de uno
 * informativo.
 *
 * Sin cajas (usuario, 2026-10-05): filas abiertas con la franja de color
 * al borde, como el resto de listas del aplicativo. Si el aviso lleva a
 * algún lado, la fila entera es el enlace y muestra una flecha.
 */
export function AvisosDia({ avisos }: { avisos: Aviso[] }) {
  if (avisos.length === 0) {
    return (
      <p className="flex items-center gap-2 border-y border-borde py-4 text-sm text-tinta-suave">
        <span className="h-2 w-2 rounded-full bg-exito" aria-hidden="true" />
        Nada pendiente por ahora.
      </p>
    )
  }

  return (
    <ul className="divide-y divide-borde border-y border-borde">
      {avisos.map((aviso) => {
        const cuerpo = (
          <>
            <span
              className="absolute inset-y-3 left-0 w-1 rounded-full"
              style={{ backgroundColor: COLOR_TONO[aviso.tono] }}
              aria-hidden="true"
            />
            <span className="min-w-0 flex-1">
              <span className="block text-base font-bold text-tinta">{aviso.titulo}</span>
              <span className="mt-0.5 block text-sm leading-relaxed text-tinta-suave">{aviso.texto}</span>
            </span>
            {aviso.a && (
              <span className="shrink-0 self-center text-sm font-semibold text-marca transition group-hover:translate-x-1" aria-hidden="true">
                →
              </span>
            )}
          </>
        )

        const clases = 'group relative flex gap-4 py-3.5 pl-5 pr-2 transition-colors'

        return (
          <li key={aviso.clave}>
            {aviso.a ? (
              <Link to={aviso.a} className={`${clases} hover:bg-linear-to-r hover:from-marca-claro/60 hover:to-transparent`}>
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
