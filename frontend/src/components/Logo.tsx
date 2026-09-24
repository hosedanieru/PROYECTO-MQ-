import { useState } from 'react'

type Variante = 'claro' | 'oscuro'

interface Props {
  /** `claro` = logo blanco, para fondo oscuro. `oscuro` = para fondo blanco. */
  variante?: Variante
  /** Solo el símbolo, sin el nombre (barra lateral colapsada). */
  soloIsotipo?: boolean
  className?: string
}

/**
 * Logotipo de Inlotrans.
 *
 * Mientras no existan los archivos de marca, dibuja una versión
 * tipográfica provisional. En cuanto se dejen los SVG en
 * `frontend/public/marca/` (ver el README de esa carpeta) aparecen solos:
 * no hay que tocar este archivo ni ninguna pantalla.
 *
 * El logo de PepsiCo NO se incluye: es marca de un tercero y está
 * pendiente de que el área confirme si puede usarse (ver CLAUDE.md,
 * sección 8).
 */
const ARCHIVO: Record<Variante, string> = {
  claro: '/marca/inlotrans-blanco.svg',
  oscuro: '/marca/inlotrans-color.svg',
}

export function Logo({ variante = 'claro', soloIsotipo = false, className = '' }: Props) {
  const [falloImagen, setFalloImagen] = useState(false)
  const ruta = soloIsotipo ? '/marca/isotipo.svg' : ARCHIVO[variante]

  if (!falloImagen) {
    return (
      <img
        src={ruta}
        alt="Inlotrans"
        onError={() => setFalloImagen(true)}
        className={`${soloIsotipo ? 'h-9 w-9' : 'h-8 w-auto'} ${className}`}
      />
    )
  }

  // --- Provisional: se usa solo si el archivo de marca no está todavía.
  const colorTexto = variante === 'claro' ? 'text-white' : 'text-marina'

  if (soloIsotipo) {
    return (
      <span
        className={`grid h-9 w-9 place-items-center rounded-xl bg-marca text-sm font-bold tracking-wider text-white ${className}`}
        aria-label="Inlotrans"
      >
        IN
      </span>
    )
  }

  return (
    <span className={`flex items-center gap-2 ${className}`} aria-label="Inlotrans">
      <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-marca text-sm font-bold tracking-wider text-white">
        IN
      </span>
      <span className={`text-lg font-bold tracking-[0.12em] ${colorTexto}`}>INLOTRANS</span>
    </span>
  )
}
